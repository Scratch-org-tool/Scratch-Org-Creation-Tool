import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  type PipelineStepId,
  type ScratchOrgPipelineInput,
  type UserTriggeredPipelineStepId,
  getCustomSettingsOrgId,
  getDataDeploymentOrgId,
  pipelineResumeSchema,
  pipelineRunActionsSchema,
  resolveUserProvisionSlots,
} from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { StreamService } from '../stream/stream.service';
import { AzureService } from '../../integrations/azure/azure.service';
import { MetadataDeployQueueService } from '../deployment/metadata-deploy-queue.service';
import { MetadataDeployJobService } from '../deployment/metadata-deploy-job.service';
import { DeploymentService } from '../deployment/deployment.service';
import { ScratchOrgJobService } from '../environment/scratch-org-job.service';
import { assertResourceOwner } from '../../common/user-tenancy.util';
import {
  loadBundledCustomSettingsExport,
  writeSfdmuExportFromUpload,
} from '../data/sfdmu-config.generator';

export interface PipelineCheckpoint {
  completedSteps: PipelineStepId[];
  resumeFrom: PipelineStepId;
  scratchOrgJobId?: string;
  scratchSubStep?: string;
  scratchOrgCreated?: boolean;
  targetOrgConnectionId?: string;
  deploymentId?: string;
  intelligentDeployRunId?: string;
  awaitingUserActions?: boolean;
  userActionsCompleted?: UserTriggeredPipelineStepId[];
  fullyProvisioned?: boolean;
  artifacts?: {
    manifestPath?: string;
  };
}

@Injectable()
export class PipelineOrchestratorService {
  constructor(
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly azureService: AzureService,
    private readonly metadataDeployQueue: MetadataDeployQueueService,
    private readonly metadataDeployJobService: MetadataDeployJobService,
    private readonly deploymentService: DeploymentService,
    private readonly scratchOrgJobService: ScratchOrgJobService,
  ) {}

  async getRun(id: string, userId?: string) {
    const run = await prisma.automationRun.findUnique({
      where: { id },
      include: {
        jobs: { orderBy: { createdAt: 'asc' }, include: { logs: { orderBy: { timestamp: 'asc' }, take: 500 } } },
      },
    });
    if (userId) assertResourceOwner(run, userId, 'Automation run');
    return run;
  }

  async getActiveRun(intent: string, userId: string) {
    const run = await prisma.automationRun.findFirst({
      where: {
        intent,
        createdBy: userId,
        status: { in: ['running', 'paused'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return run ? { automationRunId: run.id } : { automationRunId: null };
  }

  async startPipeline(config: ScratchOrgPipelineInput, userId: string) {
    const checkpoint: PipelineCheckpoint = {
      completedSteps: [],
      resumeFrom: 'scratch_org_create',
    };

    const run = await prisma.automationRun.create({
      data: {
        intent: 'scratch_org_pipeline',
        status: 'running',
        createdBy: userId,
        config: config as unknown as Prisma.InputJsonValue,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });

    const scratchConfig = {
      ...config,
      skipSteps: [
        ...(config.skipSteps ?? []),
        'deployMetadata',
        'assignPermissions',
      ].filter((v, i, a) => a.indexOf(v) === i) as typeof config.skipSteps,
    };

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.SCRATCH_ORG_CREATE,
        type: 'scratch_org_workflow',
        alias: config.alias,
        currentStep: 'Not Started',
        status: 'pending',
        createdBy: userId,
        parentRunId: run.id,
        payload: { config: scratchConfig, automationRunId: run.id } as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.SCRATCH_ORG_CREATE,
      'scratch_org_workflow',
      { config: scratchConfig, dbJobId: job.id, automationRunId: run.id },
      job.id,
      { attempts: 1 },
    );

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'queued', currentStep: 'Pending' },
    });

    checkpoint.scratchOrgJobId = job.id;
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });

    return { automationRunId: run.id, jobId: job.id, status: 'running' };
  }

  async handleJobSucceeded(
    automationRunId: string,
    jobType: string,
    result?: Record<string, unknown>,
  ) {
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) return;

    const config = run.config as ScratchOrgPipelineInput;
    const checkpoint = (run.checkpoint ?? {
      completedSteps: [],
      resumeFrom: 'scratch_org_create',
    }) as unknown as PipelineCheckpoint;

    if (jobType === 'scratch_org_workflow') {
      const conn = await prisma.orgConnection.findUnique({
        where: { alias: config.alias },
      });
      checkpoint.completedSteps.push('scratch_org_create');
      checkpoint.targetOrgConnectionId = conn?.id;
      checkpoint.resumeFrom = 'azure_metadata_deploy';
      await this.enqueueMetadataDeploy(automationRunId, config, checkpoint);
      return;
    }

    if (jobType === 'pipeline_metadata_deploy') {
      if (!checkpoint.completedSteps.includes('azure_metadata_deploy')) {
        checkpoint.completedSteps.push('azure_metadata_deploy');
      }
      if (result?.assignPermissionSetCompleted) {
        checkpoint.completedSteps.push('assign_permission_set');
      }
      if (checkpoint.deploymentId) {
        await prisma.deployment.update({
          where: { id: checkpoint.deploymentId },
          data: { status: 'completed' },
        });
      }
      const customEnabled = config.customSettings?.enabled !== false;
      if (customEnabled) {
        checkpoint.resumeFrom = 'load_custom_settings';
        await this.enqueueCustomSettingsLoad(automationRunId, config, checkpoint, run.createdBy);
      } else {
        checkpoint.resumeFrom = 'load_org_config';
        await this.enqueueLoadOrgConfig(automationRunId, config, checkpoint);
      }
      return;
    }

    if (jobType === 'custom_settings_load') {
      if (!checkpoint.completedSteps.includes('load_custom_settings')) {
        checkpoint.completedSteps.push('load_custom_settings');
      }
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
      });
      checkpoint.resumeFrom = 'load_org_config';
      await this.enqueueLoadOrgConfig(automationRunId, config, checkpoint);
      return;
    }

    if (jobType === 'pipeline_load_org_config') {
      if (!checkpoint.completedSteps.includes('load_org_config')) {
        checkpoint.completedSteps.push('load_org_config');
      }
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
      });
      await this.enqueuePostDeployChain(automationRunId, config, checkpoint);
      return;
    }

    if (jobType === 'cona_user_provision' || jobType === 'cona_seed' || jobType === 'account_partner_import') {
      const actionMap: Record<string, UserTriggeredPipelineStepId> = {
        cona_user_provision: 'provision_users',
        cona_seed: 'load_data_seed',
        account_partner_import: 'load_account_partners',
      };
      const action = actionMap[jobType];
      if (action) {
        const completed = new Set(checkpoint.userActionsCompleted ?? []);
        completed.add(action);
        checkpoint.userActionsCompleted = [...completed];
        await prisma.automationRun.update({
          where: { id: automationRunId },
          data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
        });
        await this.maybeCompletePostDeploy(automationRunId, config, checkpoint);
      }
    }
  }

  async handleJobFailed(automationRunId: string, failedStep: PipelineStepId, error: string) {
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) return;

    const checkpoint = (run.checkpoint ?? { completedSteps: [], resumeFrom: 'scratch_org_create' }) as unknown as PipelineCheckpoint;
    if (failedStep === 'assign_permission_set' && !checkpoint.completedSteps.includes('azure_metadata_deploy')) {
      checkpoint.completedSteps.push('azure_metadata_deploy');
    }
    checkpoint.resumeFrom = failedStep;

    const checkpointData = (run.checkpoint ?? {}) as unknown as PipelineCheckpoint;
    if (
      checkpointData.deploymentId &&
      (failedStep === 'azure_metadata_deploy' || failedStep === 'assign_permission_set')
    ) {
      await prisma.deployment.update({
        where: { id: checkpointData.deploymentId },
        data: { status: 'failed', metadata: { error } as Prisma.InputJsonValue },
      });
    }

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        status: 'paused',
        failedStep,
        lastError: error,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });

    await this.streamService.publish('job_status', {
      automationRunId,
      status: 'paused',
      step: failedStep,
      message: error,
      recoverable: true,
    });
    await this.jobsService.addLog(
      checkpoint.scratchOrgJobId ?? automationRunId,
      'stderr',
      `[PIPELINE PAUSED] ${failedStep}: ${error}`,
    );
  }

  async resumeRun(automationRunId: string, body: unknown, userId?: string) {
    const patch = pipelineResumeSchema.parse(body ?? {});
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) throw new Error('Automation run not found');
    if (userId) assertResourceOwner(run, userId, 'Automation run');
    if (run.status !== 'paused') throw new Error('Run is not paused');

    // Org-to-org metadata runs store the full deploy input in run.config —
    // resume re-enqueues the deploy (with any chained data config) directly.
    if (run.intent === 'org_to_org_metadata_data') {
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: { status: 'running', failedStep: null, lastError: null },
      });
      const result = await this.deploymentService.deployOrgToOrgMetadata(
        run.config as Record<string, unknown>,
        run.createdBy,
        { automationRunId },
      );
      return {
        automationRunId,
        resumeFrom: 'azure_metadata_deploy' as PipelineStepId,
        ...result,
        status: 'running',
      };
    }

    const config = {
      ...(run.config as ScratchOrgPipelineInput),
      ...(patch.azureDeploy
        ? { azureDeploy: { ...(run.config as ScratchOrgPipelineInput).azureDeploy, ...patch.azureDeploy } }
        : {}),
    } as ScratchOrgPipelineInput;

    const checkpoint = (run.checkpoint ?? { completedSteps: [], resumeFrom: 'scratch_org_create' }) as unknown as PipelineCheckpoint;

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        status: 'running',
        failedStep: null,
        lastError: null,
        config: config as unknown as Prisma.InputJsonValue,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });

    const resumeFrom = checkpoint.resumeFrom;

    if (resumeFrom === 'azure_metadata_deploy') {
      await this.enqueueMetadataDeploy(automationRunId, config, checkpoint);
    } else if (resumeFrom === 'assign_permission_set') {
      await this.enqueueAssignPermissionSet(automationRunId, checkpoint);
    } else if (resumeFrom === 'load_custom_settings') {
      await this.enqueueCustomSettingsLoad(automationRunId, config, checkpoint, run.createdBy);
    } else if (resumeFrom === 'load_org_config') {
      await this.enqueueLoadOrgConfig(automationRunId, config, checkpoint);
    } else if (resumeFrom === 'scratch_org_create') {
      await this.enqueueScratchOrgResume(automationRunId, config, checkpoint);
    } else {
      throw new Error(`Resume not supported for step "${resumeFrom}"`);
    }

    return { automationRunId, status: 'running', resumeFrom };
  }

  async runUserActions(automationRunId: string, body: unknown, userId?: string) {
    const parsed = pipelineRunActionsSchema.parse(body);
    const { actions, partnerExcelBase64, partnerSheet } = parsed;
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) throw new NotFoundException('Automation run not found');
    if (userId) assertResourceOwner(run, userId, 'Automation run');

    const config = run.config as ScratchOrgPipelineInput;
    const checkpoint = (run.checkpoint ?? {}) as unknown as PipelineCheckpoint;
    const targetOrgId = checkpoint.targetOrgConnectionId;
    if (!targetOrgId) throw new Error('Target org not found in checkpoint');

    const jobs: Array<{ action: UserTriggeredPipelineStepId; jobId: string }> = [];

    for (const action of actions) {
      if (action === 'provision_users') {
        const templates = config.userProvisioning?.templates ?? [];
        const slots = config.userProvisioning?.slots ?? [];
        const users = slots.length && templates.length
          ? resolveUserProvisionSlots(slots, templates)
          : (config.userProvisioning?.users ?? []);
        if (!users.length) throw new Error('No users configured in pipeline config');
        const job = await this.jobsService.create({
          queue: QUEUE_NAMES.USER_PROVISION,
          type: 'cona_user_provision',
          parentRunId: automationRunId,
          payload: {
            orgId: targetOrgId,
            users: users.map((u) => ({
              ...u,
              username: u.email,
            })),
            conaMode: true,
            automationRunId,
          },
        });
        await this.queueService.addJob(QUEUE_NAMES.USER_PROVISION, 'cona_user_provision', {
          orgId: targetOrgId,
          users,
          conaMode: true,
          dbJobId: job.id,
          automationRunId,
        }, job.id);
        jobs.push({ action, jobId: job.id });
      }

      if (action === 'load_data_seed') {
        const sourceOrgId = getDataDeploymentOrgId({
          dataDeploymentOrgId: config.dataDeploymentOrgId,
          sourceOrgId: config.dataDeploymentOrgId ?? config.sourceOrgId,
        });
        if (!sourceOrgId) throw new Error('dataDeploymentOrgId required for data seed');
        const datasets = config.dataSeed?.datasets ?? ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'];
        const dataSeedMode = config.dataSeed?.mode ?? 'hybrid';
        const querySet = config.dataSeed?.querySet;
        const salesOfficeConfig = config.partnerImport?.salesOfficeConfig;
        const job = await this.jobsService.create({
          queue: QUEUE_NAMES.CONA_SEED,
          type: 'cona_seed',
          parentRunId: automationRunId,
          payload: {
            sourceOrgId,
            targetOrgId,
            datasets,
            accountSeedRows: config.accountSeedRows,
            dataSeedMode,
            querySet,
            salesOfficeConfig,
            automationRunId,
          },
        });
        await this.queueService.addJob(QUEUE_NAMES.CONA_SEED, 'cona_seed', {
          sourceOrgId,
          targetOrgId,
          datasets,
          accountSeedRows: config.accountSeedRows,
          dataSeedMode,
          querySet,
          salesOfficeConfig,
          dbJobId: job.id,
          automationRunId,
        }, job.id);
        jobs.push({ action, jobId: job.id });
      }

      if (action === 'load_account_partners') {
        const partner = config.partnerImport ?? {
          mode: (partnerExcelBase64 ? 'excel' : 'org_to_org_matched') as 'excel' | 'org_to_org' | 'org_to_org_matched',
          bottler: '5000' as const,
          perOffice: 20,
          matchOrgDistribution: true,
        };
        const sourceOrgId = getDataDeploymentOrgId({
          dataDeploymentOrgId: config.dataDeploymentOrgId,
          sourceOrgId: config.dataDeploymentOrgId ?? config.sourceOrgId,
        });
        const job = await this.jobsService.create({
          queue: QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT,
          type: 'account_partner_import',
          parentRunId: automationRunId,
          payload: { ...partner, targetOrgId, sourceOrgId, automationRunId },
        });
        await this.queueService.addJob(QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT, 'account_partner_import', {
          mode: partner.mode,
          bottler: partner.bottler,
          targetOrgId,
          sourceOrgId,
          perOffice: partner.perOffice,
          matchOrgDistribution: partner.matchOrgDistribution,
          salesOfficeConfig: partner.salesOfficeConfig,
          excelPath: partner.excelPath,
          excelBase64: partnerExcelBase64,
          sheet: partnerSheet ?? partner.sheet,
          dbJobId: job.id,
          automationRunId,
        }, job.id);
        jobs.push({ action, jobId: job.id });
      }
    }

    return { automationRunId, jobs };
  }

  async cancelRun(automationRunId: string, userId?: string) {
    const run = await prisma.automationRun.findUnique({
      where: { id: automationRunId },
      include: { jobs: true },
    });
    if (!run) throw new NotFoundException('Automation run not found');
    if (userId) assertResourceOwner(run, userId, 'Automation run');
    if (['completed', 'cancelled'].includes(run.status)) {
      return { cancelled: false, reason: `Run already ${run.status}` };
    }

    for (const job of run.jobs) {
      if (!['pending', 'queued', 'running'].includes(job.status)) continue;
      if (job.queue === QUEUE_NAMES.SCRATCH_ORG_CREATE) {
        this.scratchOrgJobService.cancel(job.id);
      }
      if (job.queue === QUEUE_NAMES.METADATA_DEPLOY) {
        this.metadataDeployJobService.cancel(job.id);
      }
      await this.queueService.removeJob(job.queue, job.id);
      await this.jobsService.updateStatus(job.id, 'cancelled');
      await this.jobsService.addLog(job.id, 'stderr', 'Pipeline cancelled by user');
      await this.streamService.publish('job_status', { jobId: job.id, status: 'cancelled' });
    }

    const checkpoint = (run.checkpoint ?? {}) as unknown as PipelineCheckpoint;
    if (checkpoint.deploymentId) {
      await prisma.deployment.update({
        where: { id: checkpoint.deploymentId },
        data: { status: 'cancelled' },
      }).catch(() => undefined);
    }

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { status: 'cancelled', lastError: null, failedStep: null },
    });
    await this.streamService.publish('job_status', { automationRunId, status: 'cancelled' });

    return { cancelled: true };
  }

  private async enqueueScratchOrgResume(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const scratchConfig = {
      ...config,
      skipSteps: [
        ...(config.skipSteps ?? []),
        'deployMetadata',
        'assignPermissions',
      ].filter((v, i, a) => a.indexOf(v) === i) as typeof config.skipSteps,
    };

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.SCRATCH_ORG_CREATE,
        type: 'scratch_org_workflow',
        alias: config.alias,
        currentStep: checkpoint.scratchSubStep ?? 'Pending',
        status: 'pending',
        parentRunId: automationRunId,
        payload: {
          config: scratchConfig,
          automationRunId,
          resumeFromSubStep: checkpoint.scratchSubStep,
        } as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.SCRATCH_ORG_CREATE,
      'scratch_org_workflow',
      {
        config: scratchConfig,
        dbJobId: job.id,
        automationRunId,
        resumeFromSubStep: checkpoint.scratchSubStep,
      },
      job.id,
      { attempts: 1 },
    );

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'queued', currentStep: 'Pending' },
    });

    checkpoint.scratchOrgJobId = job.id;
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });
  }

  private async enqueueMetadataDeploy(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const target = await prisma.orgConnection.findUnique({
      where: { id: checkpoint.targetOrgConnectionId ?? '' },
    });
    if (!target) throw new Error('Target org connection not found');

    const deployment = await prisma.deployment.create({
      data: {
        targetOrgId: target.id,
        repo: config.azureDeploy.repo,
        branch: config.azureDeploy.branch,
        strategy: 'azure',
        status: 'queued',
        createdBy: (await prisma.automationRun.findUnique({ where: { id: automationRunId } }))?.createdBy ?? 'system',
      },
    });
    checkpoint.deploymentId = deployment.id;

    await this.azureService.triggerPipeline(
      config.azureDeploy.project ?? process.env.AZURE_DEFAULT_PROJECT ?? '',
      config.azureDeploy.repo,
      config.azureDeploy.branch,
      {
        targetOrgAlias: target.alias,
        targetOrgUsername: target.username ?? target.alias,
        instanceUrl: target.instanceUrl,
      },
    );

    const orgAlias = target.username ?? target.alias;
    const job = await this.metadataDeployQueue.enqueue({
      automationRunId,
      deploymentId: deployment.id,
      orgAlias,
      azureDeploy: config.azureDeploy,
      assignPermissionSet: true,
      intelligentDeployRunId: checkpoint.intelligentDeployRunId,
    });

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });

    return job;
  }

  private async enqueueAssignPermissionSet(
    automationRunId: string,
    checkpoint: PipelineCheckpoint,
  ) {
    const target = await prisma.orgConnection.findUnique({
      where: { id: checkpoint.targetOrgConnectionId ?? '' },
    });
    if (!target) throw new Error('Target org connection not found');

    const orgAlias = target.username ?? target.alias;
    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.METADATA_DEPLOY,
        type: 'pipeline_metadata_deploy',
        parentRunId: automationRunId,
        status: 'pending',
        currentStep: 'Assign Permission Set',
        payload: {
          orgAlias,
          automationRunId,
          assignPermissionSetOnly: true,
        } as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.METADATA_DEPLOY,
      'pipeline_metadata_deploy',
      {
        orgAlias,
        dbJobId: job.id,
        automationRunId,
        assignPermissionSetOnly: true,
      },
      job.id,
      { attempts: 1 },
    );

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });
  }

  private async enqueueLoadOrgConfig(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const target = await prisma.orgConnection.findUnique({
      where: { id: checkpoint.targetOrgConnectionId ?? '' },
    });
    if (!target) throw new Error('Target org connection not found');

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.ORG_SETUP,
        type: 'pipeline_load_org_config',
        parentRunId: automationRunId,
        status: 'pending',
        currentStep: 'Load Org Config',
        payload: {
          orgId: target.id,
          orgConfig: config.orgConfig,
          automationRunId,
        } as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.ORG_SETUP,
      'pipeline_load_org_config',
      {
        orgId: target.id,
        orgConfig: config.orgConfig,
        dbJobId: job.id,
        automationRunId,
      },
      job.id,
      { attempts: 1 },
    );

    checkpoint.resumeFrom = 'load_org_config';
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });
  }

  private async enqueueCustomSettingsLoad(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
    createdBy: string,
  ) {
    const sourceOrgId = getCustomSettingsOrgId({
      customSettingsOrgId: config.customSettingsOrgId,
      sourceOrgId: config.dataDeploymentOrgId ?? config.sourceOrgId,
      dataDeploymentOrgId: config.dataDeploymentOrgId,
    });
    const targetOrgId = checkpoint.targetOrgConnectionId;
    if (!sourceOrgId || !targetOrgId) {
      await this.enqueuePostDeployChain(automationRunId, config, checkpoint);
      return;
    }

    const source = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
    const target = await prisma.orgConnection.findUnique({ where: { id: targetOrgId } });
    if (!source || !target) {
      await this.enqueuePostDeployChain(automationRunId, config, checkpoint);
      return;
    }

    const mode = config.customSettings?.mode ?? 'bundled';
    const exportConfig =
      mode === 'custom' && config.customSettings?.exportConfig
        ? config.customSettings.exportConfig
        : loadBundledCustomSettingsExport();

    const movement = await prisma.dataMovement.create({
      data: {
        sourceOrgId,
        targetOrgId,
        objectName: 'custom_settings',
        movementType: 'custom_settings',
        status: 'queued',
        createdBy,
      },
    });

    const generated = writeSfdmuExportFromUpload({
      runId: movement.id,
      sourceOrgAlias: source.username ?? source.alias,
      targetOrgAlias: target.username ?? target.alias,
      exportConfig,
    });

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.SFDMU_RUN,
        type: 'custom_settings_load',
        parentRunId: automationRunId,
        status: 'pending',
        currentStep: 'Load Custom Settings',
        createdBy,
        payload: {
          sourceOrgAlias: source.username ?? source.alias,
          targetOrgAlias: target.username ?? target.alias,
          configPath: generated.configPath,
          movementId: movement.id,
          automationRunId,
        } as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.SFDMU_RUN,
      'custom_settings_load',
      {
        sourceOrgAlias: source.username ?? source.alias,
        targetOrgAlias: target.username ?? target.alias,
        configPath: generated.configPath,
        movementId: movement.id,
        dbJobId: job.id,
        automationRunId,
      },
      job.id,
      { attempts: 1 },
    );

    checkpoint.resumeFrom = 'load_custom_settings';
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });
  }

  private async enqueuePostDeployChain(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const steps = config.pipelineSteps ?? {
      autoRunDataSeed: true,
      autoRunPartners: false,
      autoRunUsers: true,
    };

    const actions: UserTriggeredPipelineStepId[] = [];
    if (steps.autoRunDataSeed) actions.push('load_data_seed');
    if (steps.autoRunPartners) actions.push('load_account_partners');
    if (steps.autoRunUsers) actions.push('provision_users');

    if (!actions.length) {
      await this.completeAutoPipeline(automationRunId, checkpoint, false);
      return;
    }

    const partnerExcelBase64 = config.partnerImport?.partnerExcelBase64;
    await this.runUserActions(automationRunId, {
      actions,
      partnerExcelBase64,
      partnerSheet: config.partnerImport?.sheet,
    });
    checkpoint.awaitingUserActions = false;
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
    });
  }

  private async maybeCompletePostDeploy(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const steps = config.pipelineSteps ?? {
      autoRunDataSeed: true,
      autoRunPartners: false,
      autoRunUsers: true,
    };
    const expected: UserTriggeredPipelineStepId[] = [];
    if (steps.autoRunDataSeed) expected.push('load_data_seed');
    if (steps.autoRunPartners) expected.push('load_account_partners');
    if (steps.autoRunUsers) expected.push('provision_users');
    const done = new Set(checkpoint.userActionsCompleted ?? []);
    if (expected.every((a) => done.has(a))) {
      checkpoint.fullyProvisioned = true;
      await this.completeAutoPipeline(automationRunId, checkpoint, false);
    }
  }

  private async completeAutoPipeline(
    automationRunId: string,
    checkpoint: PipelineCheckpoint,
    awaitingUserActions = true,
  ) {
    checkpoint.resumeFrom = checkpoint.completedSteps.includes('load_custom_settings')
      ? 'load_custom_settings'
      : 'load_org_config';
    checkpoint.awaitingUserActions = awaitingUserActions;
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        status: 'completed',
        failedStep: null,
        lastError: null,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });
    await this.streamService.publish('job_status', {
      automationRunId,
      status: 'completed',
      awaitingUserActions,
      fullyProvisioned: checkpoint.fullyProvisioned ?? false,
    });
  }
}
