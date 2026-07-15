import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  canonicalPipelineStep,
  normalizeGitSourceConfig,
  normalizePipelineCheckpointAliases,
  type GitSourceConfig,
  type PipelineStepId,
  type ScratchOrgPipelineInput,
  type UserTriggeredPipelineStepId,
  getCustomSettingsOrgId,
  getDataDeploymentOrgId,
  pipelineResumeSchema,
  automationRunRecentQuerySchema,
  pipelineRunActionsSchema,
  hasInsertOperation,
  resolveUserProvisioningPlan,
  userProvisioningConfigSchema,
  type ResolvedProvisionUser,
} from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { StreamService } from '../stream/stream.service';
import { MetadataDeployQueueService } from '../deployment/metadata-deploy-queue.service';
import { MetadataDeployJobService } from '../deployment/metadata-deploy-job.service';
import { DeploymentService } from '../deployment/deployment.service';
import { ScratchOrgJobService } from '../environment/scratch-org-job.service';
import { ScratchOrgPreparationService } from '../environment/scratch-org-preparation.service';
import { assertResourceOwner } from '../../common/user-tenancy.util';
import {
  loadBundledCustomSettingsExport,
  writeSfdmuExportFromUpload,
} from '../data/sfdmu-config.generator';
import { ScmAdapterRegistry } from '../../integrations/foundation/adapter.registry';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import { createSfCliClient } from '@sfcc/sf-cli';

export interface PipelineCheckpoint {
  completedSteps: PipelineStepId[];
  resumeFrom: PipelineStepId;
  scratchOrgJobId?: string;
  preparationJobId?: string;
  scratchSubStep?: string;
  scratchOrgCreated?: boolean;
  targetOrgConnectionId?: string;
  launchMode?: 'create_new' | 'configure_existing';
  skippedSteps?: string[];
  deploymentId?: string;
  intelligentDeployRunId?: string;
  awaitingUserActions?: boolean;
  userActionsCompleted?: UserTriggeredPipelineStepId[];
  failedUserAction?: UserTriggeredPipelineStepId;
  partialUserActions?: UserTriggeredPipelineStepId[];
  provisioningBatchId?: string;
  resolvedProvisioningUsers?: ResolvedProvisionUser[];
  fullyProvisioned?: boolean;
  artifacts?: {
    manifestPath?: string;
  };
}

class PreparationQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreparationQueueError';
  }
}

@Injectable()
export class PipelineOrchestratorService {
  private readonly sfCli = createSfCliClient();
  constructor(
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly streamService: StreamService,
    private readonly scmAdapters: ScmAdapterRegistry,
    private readonly scmSources: ScmSourceService,
    private readonly metadataDeployQueue: MetadataDeployQueueService,
    private readonly metadataDeployJobService: MetadataDeployJobService,
    private readonly deploymentService: DeploymentService,
    private readonly scratchOrgJobService: ScratchOrgJobService,
    private readonly scratchOrgPreparation: ScratchOrgPreparationService,
  ) {}

  async getRun(id: string, userId?: string) {
    const run = await prisma.automationRun.findUnique({
      where: { id },
      include: {
        jobs: { orderBy: { createdAt: 'asc' }, include: { logs: { orderBy: { timestamp: 'asc' }, take: 500 } } },
      },
    });
    if (userId) assertResourceOwner(run, userId, 'Automation run');
    if (!run) return run;
    return {
      ...run,
      config: normalizeGitSourceConfig(
        run.config as unknown as {
          gitSource?: GitSourceConfig;
          azureDeploy?: ScratchOrgPipelineInput['azureDeploy'];
        },
      ),
      checkpoint: normalizePipelineCheckpointAliases(
        (run.checkpoint ?? {}) as unknown as PipelineCheckpoint,
      ),
    };
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

  async getRecentRuns(
    rawQuery: { target?: string; targetOrgConnectionId?: string; limit?: string },
    userId: string,
  ) {
    const query = automationRunRecentQuerySchema.parse(rawQuery);
    const targetMatches = query.target
      ? await prisma.orgConnection.findMany({
          where: {
            createdBy: userId,
            OR: [
              { alias: { contains: query.target, mode: 'insensitive' } },
              { username: { contains: query.target, mode: 'insensitive' } },
              { orgId: { contains: query.target, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        })
      : [];
    const filters: Prisma.AutomationRunWhereInput[] = [];
    if (query.targetOrgConnectionId) {
      filters.push({
        OR: [
          { targetOrgConnectionId: query.targetOrgConnectionId },
          {
            targetOrgConnectionId: null,
            checkpoint: {
              path: ['targetOrgConnectionId'],
              equals: query.targetOrgConnectionId,
            },
          },
        ],
      });
    }
    if (query.target) {
      const targetIds = targetMatches.map((target) => target.id);
      filters.push({
        OR: [
          {
            targetOrgConnection: {
              OR: [
                { alias: { contains: query.target, mode: 'insensitive' } },
                { username: { contains: query.target, mode: 'insensitive' } },
                { orgId: { contains: query.target, mode: 'insensitive' } },
              ],
            },
          },
          ...targetIds.map((targetId) => ({
            targetOrgConnectionId: null,
            checkpoint: {
              path: ['targetOrgConnectionId'],
              equals: targetId,
            },
          })),
        ],
      });
    }
    const runs = await prisma.automationRun.findMany({
      where: {
        intent: 'scratch_org_pipeline',
        createdBy: userId,
        ...(filters.length ? { AND: filters } : {}),
      },
      include: {
        targetOrgConnection: {
          select: { id: true, alias: true, username: true, orgId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
    return runs.map(({ checkpoint, ...run }) => {
      const legacyTargetId = (checkpoint ?? {}) as Record<string, unknown>;
      return {
        ...run,
        targetOrgConnectionId:
          run.targetOrgConnection?.id
          ?? run.targetOrgConnectionId
          ?? (
            typeof legacyTargetId.targetOrgConnectionId === 'string'
              ? legacyTargetId.targetOrgConnectionId
              : null
          ),
      };
    });
  }

  async startPipeline(config: ScratchOrgPipelineInput, userId: string) {
    if (config.mode === 'configure_existing') {
      return this.startExistingOrgPipeline(config, userId);
    }
    const checkpoint: PipelineCheckpoint = {
      completedSteps: [],
      resumeFrom: 'scratch_org_create',
      launchMode: 'create_new',
    };

    const run = await prisma.automationRun.create({
      data: {
        intent: 'scratch_org_pipeline',
        status: 'running',
        createdBy: userId,
        launchMode: 'create_new',
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

  private async startExistingOrgPipeline(
    config: Extract<ScratchOrgPipelineInput, { mode: 'configure_existing' }>,
    userId: string,
  ) {
    let target;
    try {
      ({ target } = await this.scratchOrgPreparation.requireOwnedActiveScratchTarget(
        config.existingOrgConnectionId,
        userId,
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) throw new NotFoundException(message);
      throw new BadRequestException(message);
    }
    const checkpoint: PipelineCheckpoint = {
      completedSteps: ['scratch_org_create'],
      skippedSteps: ['create_scratch_org', 'generate_password', 'retrieve_org_details'],
      resumeFrom: 'prepare_existing_org',
      scratchOrgCreated: true,
      targetOrgConnectionId: target.id,
      launchMode: 'configure_existing',
    };

    let run;
    try {
      run = await prisma.automationRun.create({
        data: {
          intent: 'scratch_org_pipeline',
          status: 'running',
          createdBy: userId,
          launchMode: 'configure_existing',
          targetOrgConnectionId: target.id,
          config: { ...config, alias: target.alias } as unknown as Prisma.InputJsonValue,
          checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const conflict = await prisma.automationRun.findFirst({
          where: {
            intent: 'scratch_org_pipeline',
            targetOrgConnectionId: target.id,
            status: { in: ['pending', 'queued', 'planning', 'running', 'paused'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        throw new ConflictException({
          message: 'An active pipeline already targets this scratch org',
          conflictRunId: conflict?.id ?? null,
        });
      }
      throw error;
    }

    const job = await this.enqueueExistingPreparation(run.id, {
      ...config,
      alias: target.alias,
    }, checkpoint, userId);
    return { automationRunId: run.id, jobId: job.id, status: 'running' };
  }

  async handleJobSucceeded(
    automationRunId: string,
    jobType: string,
    result?: Record<string, unknown>,
  ) {
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) return;

    const config = normalizeGitSourceConfig(
      run.config as unknown as ScratchOrgPipelineInput,
    ) as ScratchOrgPipelineInput;
    const checkpoint = normalizePipelineCheckpointAliases((run.checkpoint ?? {
      completedSteps: [],
      resumeFrom: 'scratch_org_create',
    }) as unknown as PipelineCheckpoint) as PipelineCheckpoint;

    if (jobType === 'scratch_org_workflow') {
      const conn = await prisma.orgConnection.findUnique({
        where: { alias: config.alias },
      });
      checkpoint.completedSteps.push('scratch_org_create');
      checkpoint.targetOrgConnectionId = conn?.id;
      checkpoint.resumeFrom = 'git_metadata_deploy';
      if (conn?.id) {
        try {
          await prisma.automationRun.update({
            where: { id: automationRunId },
            data: { targetOrgConnectionId: conn.id },
          });
        } catch (error) {
          if ((error as { code?: string }).code !== 'P2002') throw error;
          const conflict = await prisma.automationRun.findFirst({
            where: {
              id: { not: automationRunId },
              intent: 'scratch_org_pipeline',
              targetOrgConnectionId: conn.id,
              status: { in: ['pending', 'queued', 'planning', 'running', 'paused'] },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });
          await prisma.automationRun.update({
            where: { id: automationRunId },
            data: {
              status: 'failed',
              failedStep: 'scratch_org_create',
              lastError: 'Another active pipeline claimed the scratch target',
            },
          }).catch(() => undefined);
          throw new ConflictException({
            message: 'An active pipeline already targets this scratch org',
            conflictRunId: conflict?.id ?? null,
          });
        }
      }
      await this.enqueueMetadataDeploy(automationRunId, config, checkpoint);
      return;
    }

    if (jobType === 'prepare_existing_org') {
      if (!checkpoint.completedSteps.includes('prepare_existing_org')) {
        checkpoint.completedSteps.push('prepare_existing_org');
      }
      checkpoint.resumeFrom = 'git_metadata_deploy';
      await this.enqueueMetadataDeploy(automationRunId, config, checkpoint);
      return;
    }

    if (jobType === 'pipeline_metadata_deploy') {
      if (!checkpoint.completedSteps.includes('git_metadata_deploy')) {
        checkpoint.completedSteps.push('git_metadata_deploy');
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
        const partial = new Set(checkpoint.partialUserActions ?? []);
        if (Number(result?.failCount ?? 0) > 0) partial.add(action);
        else partial.delete(action);
        checkpoint.partialUserActions = [...partial];
        checkpoint.failedUserAction = undefined;
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
    if (['completed', 'partial', 'failed', 'cancelled'].includes(run.status)) return;

    const canonicalFailedStep = canonicalPipelineStep(failedStep) as PipelineStepId;
    const checkpoint = normalizePipelineCheckpointAliases(
      (run.checkpoint ?? { completedSteps: [], resumeFrom: 'scratch_org_create' }) as unknown as PipelineCheckpoint,
    ) as PipelineCheckpoint;
    if (canonicalFailedStep === 'assign_permission_set' && !checkpoint.completedSteps.includes('git_metadata_deploy')) {
      checkpoint.completedSteps.push('git_metadata_deploy');
    }
    checkpoint.resumeFrom = canonicalFailedStep;

    const checkpointData = (run.checkpoint ?? {}) as unknown as PipelineCheckpoint;
    if (
      checkpointData.deploymentId &&
      (canonicalFailedStep === 'git_metadata_deploy' || canonicalFailedStep === 'assign_permission_set')
    ) {
      const deployment = await prisma.deployment.findUnique({
        where: { id: checkpointData.deploymentId },
        select: { metadata: true },
      });
      await prisma.deployment.update({
        where: { id: checkpointData.deploymentId },
        data: {
          status: 'failed',
          metadata: {
            ...((deployment?.metadata as Record<string, unknown> | null) ?? {}),
            error,
            failedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        status: 'paused',
        failedStep: canonicalFailedStep,
        lastError: error,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });

    await this.streamService.publish('job_status', {
      automationRunId,
      status: 'paused',
      step: canonicalFailedStep,
      message: error,
      recoverable: true,
    });
    const failureLogJobId =
      checkpoint.scratchOrgJobId
      ?? checkpoint.preparationJobId
      ?? (await prisma.job.findFirst({
        where: { parentRunId: automationRunId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }))?.id;
    if (failureLogJobId) {
      await this.jobsService.addLog(
        failureLogJobId,
        'stderr',
        `[PIPELINE PAUSED] ${canonicalFailedStep}: ${error}`,
      );
    }
  }

  async handleUserActionFailed(
    automationRunId: string,
    action: UserTriggeredPipelineStepId,
    error: string,
  ) {
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) return;
    const checkpoint = (run.checkpoint ?? {}) as unknown as PipelineCheckpoint;
    checkpoint.failedUserAction = action;
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        status: 'paused',
        lastError: error,
        failedStep: action,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });
    await this.streamService.publish('job_status', {
      automationRunId,
      status: 'paused',
      step: action,
      message: error,
      recoverable: action !== 'load_data_seed'
        || !error.toLowerCase().includes('unsafe insert retry'),
    });
  }

  async resumeRun(automationRunId: string, body: unknown, userId?: string) {
    pipelineResumeSchema.parse(body ?? {});
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
    if (!run) throw new Error('Automation run not found');
    if (userId) assertResourceOwner(run, userId, 'Automation run');
    if (run.status !== 'paused') throw new Error('Run is not paused');

    const preclaimConfig = normalizeGitSourceConfig(
      run.config as unknown as ScratchOrgPipelineInput,
    ) as ScratchOrgPipelineInput;
    const preclaimCheckpoint = normalizePipelineCheckpointAliases(
      (run.checkpoint ?? {}) as unknown as PipelineCheckpoint,
    ) as PipelineCheckpoint;
    if (preclaimConfig.mode === 'configure_existing') {
      await this.requireConfigureExistingTarget(
        run.id,
        preclaimConfig,
        preclaimCheckpoint,
        {
          createdBy: run.createdBy,
          targetOrgConnectionId: run.targetOrgConnectionId,
        },
      );
    }

    // Atomically claim the paused run. Concurrent resume requests must not
    // create two active jobs (or two Deployment rows) for the same checkpoint.
    const claimed = await prisma.automationRun.updateMany({
      where: { id: automationRunId, status: 'paused' },
      data: { status: 'running', failedStep: null, lastError: null },
    });
    if (claimed.count === 0) throw new Error('Run is no longer paused');

    const activeJob = await prisma.job.findFirst({
      where: {
        parentRunId: automationRunId,
        status: { in: ['pending', 'queued', 'running'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (activeJob) {
      return {
        automationRunId,
        jobId: activeJob.id,
        status: 'running',
        resumeFrom: ((run.checkpoint as unknown as PipelineCheckpoint | null)?.resumeFrom),
      };
    }

    // Org-to-org metadata runs store the full deploy input in run.config —
    // resume re-enqueues the deploy (with any chained data config) directly.
    if (run.intent === 'org_to_org_metadata_data') {
      const checkpoint = normalizePipelineCheckpointAliases(
        (run.checkpoint ?? {}) as unknown as PipelineCheckpoint,
      ) as PipelineCheckpoint;
      let deploymentId = checkpoint.deploymentId;
      if (!deploymentId) {
        const previousJob = await prisma.job.findFirst({
          where: { parentRunId: automationRunId, queue: QUEUE_NAMES.METADATA_DEPLOY },
          orderBy: { createdAt: 'desc' },
          select: { payload: true },
        });
        deploymentId = ((previousJob?.payload ?? {}) as Record<string, unknown>).deploymentId as string | undefined;
      }
      try {
        const result = await this.deploymentService.deployOrgToOrgMetadata(
          run.config as Record<string, unknown>,
          run.createdBy,
          { automationRunId, deploymentId },
        );
        checkpoint.deploymentId = result.deploymentId;
        await prisma.automationRun.update({
          where: { id: automationRunId },
          data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
        });
        return {
          automationRunId,
          resumeFrom: 'git_metadata_deploy' as PipelineStepId,
          ...result,
          status: 'running',
        };
      } catch (error) {
        await this.restorePausedResume(automationRunId, error);
        throw error;
      }
    }

    const persistedConfig = normalizeGitSourceConfig(
      run.config as unknown as ScratchOrgPipelineInput,
    ) as ScratchOrgPipelineInput;
    // A run's SCM coordinates are immutable execution input. Browser defaults
    // or stale resume payloads must never redirect an already-created run.
    const config = persistedConfig;

    const checkpoint = normalizePipelineCheckpointAliases(
      (run.checkpoint ?? { completedSteps: [], resumeFrom: 'scratch_org_create' }) as unknown as PipelineCheckpoint,
    ) as PipelineCheckpoint;

    if (checkpoint.failedUserAction) {
      try {
        await this.runUserActions(automationRunId, { actions: [checkpoint.failedUserAction] });
        return {
          automationRunId,
          status: 'running',
          resumeFrom: checkpoint.failedUserAction,
        };
      } catch (error) {
        await this.restorePausedResume(automationRunId, error);
        throw error;
      }
    }

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        config: config as unknown as Prisma.InputJsonValue,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });

    const resumeFrom = checkpoint.resumeFrom;

    try {
      if (resumeFrom === 'git_metadata_deploy' || resumeFrom === 'azure_metadata_deploy') {
        await this.enqueueMetadataDeploy(automationRunId, config, checkpoint);
      } else if (resumeFrom === 'assign_permission_set') {
        await this.enqueueAssignPermissionSet(automationRunId, checkpoint);
      } else if (resumeFrom === 'load_custom_settings') {
        await this.enqueueCustomSettingsLoad(automationRunId, config, checkpoint, run.createdBy);
      } else if (resumeFrom === 'load_org_config') {
        await this.enqueueLoadOrgConfig(automationRunId, config, checkpoint);
      } else if (resumeFrom === 'prepare_existing_org') {
        await this.enqueueExistingPreparation(
          automationRunId,
          config as Extract<ScratchOrgPipelineInput, { mode: 'configure_existing' }>,
          checkpoint,
          run.createdBy,
        );
      } else if (resumeFrom === 'scratch_org_create' && config.mode === 'configure_existing') {
        checkpoint.resumeFrom = 'prepare_existing_org';
        await this.enqueueExistingPreparation(
          automationRunId,
          config,
          checkpoint,
          run.createdBy,
        );
      } else if (resumeFrom === 'scratch_org_create') {
        await this.enqueueScratchOrgResume(automationRunId, config, checkpoint);
      } else {
        throw new Error(`Resume not supported for step "${resumeFrom}"`);
      }
    } catch (error) {
      if (!(error instanceof PreparationQueueError)) {
        await this.restorePausedResume(automationRunId, error);
      }
      throw error;
    }

    return { automationRunId, status: 'running', resumeFrom };
  }

  private async restorePausedResume(automationRunId: string, error: unknown) {
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        status: 'paused',
        lastError: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
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
    if (config.mode === 'configure_existing') {
      await this.requireConfigureExistingTarget(
        automationRunId,
        config,
        checkpoint,
        {
          createdBy: run.createdBy,
          targetOrgConnectionId: run.targetOrgConnectionId,
        },
      );
    }

    const jobs: Array<{ action: UserTriggeredPipelineStepId; jobId: string }> = [];

    for (const action of actions) {
      if (action === 'provision_users') {
        let resolvedUsers = checkpoint.resolvedProvisioningUsers;
        let batchId = checkpoint.provisioningBatchId;
        let users: ResolvedProvisionUser[];
        if (!resolvedUsers || !batchId) {
          resolvedUsers = this.resolveProvisioningUsers(config, automationRunId);
          if (!resolvedUsers.length) throw new Error('No users configured in pipeline config');
          if (config.version === 2) {
            const missingProfile = resolvedUsers.find((user) => !user.profile);
            if (missingProfile) {
              throw new Error(`V2 provisioning profile is required for ${missingProfile.username}`);
            }
          }
          try {
            const batch = await prisma.$transaction(async (transaction) => {
              const created = await transaction.provisioningBatch.create({
                data: {
                  orgId: targetOrgId,
                  totalRows: resolvedUsers!.length,
                  status: 'queued',
                  createdBy: run.createdBy,
                  users: {
                    create: resolvedUsers!.map((user) => ({
                      firstName: user.firstName,
                      lastName: user.lastName,
                      email: user.email,
                      username: user.username!,
                      profile: user.profile,
                      role: user.role,
                      permissionSets: user.permissionSets ?? [],
                      status: 'queued',
                    })),
                  },
                },
              });
              checkpoint.resolvedProvisioningUsers = resolvedUsers;
              checkpoint.provisioningBatchId = created.id;
              await transaction.automationRun.update({
                where: { id: automationRunId },
                data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
              });
              return created;
            });
            batchId = batch.id;
          } catch (error) {
            if ((error as { code?: string })?.code === 'P2002') {
              throw new Error('Resolved provisioning plan contains duplicate usernames');
            }
            throw error;
          }
          users = resolvedUsers;
        } else {
          const batch = await prisma.provisioningBatch.findUnique({
            where: { id: batchId },
            include: { users: true },
          });
          if (!batch || batch.orgId !== targetOrgId || batch.createdBy !== run.createdBy) {
            throw new Error('Checkpointed provisioning batch is invalid');
          }
          const retryable = new Set(
            batch.users
              .filter((user) => user.status === 'failed')
              .map((user) => user.username.toLowerCase()),
          );
          users = resolvedUsers.filter((user) => retryable.has(user.username!.toLowerCase()));
          if (!users.length) {
            throw new Error('Provisioning batch has no failed users to retry');
          }
          await prisma.provisionedUser.updateMany({
            where: {
              batchId,
              username: { in: users.map((user) => user.username!) },
              status: 'failed',
            },
            data: { status: 'queued', error: null },
          });
          await prisma.provisioningBatch.update({
            where: { id: batchId },
            data: { status: 'queued' },
          });
        }
        if (!batchId) throw new Error('Provisioning batch checkpoint was not created');
        const execution = userProvisioningConfigSchema.parse(
          config.userProvisioning ?? {},
        ).execution;
        const payload = {
          orgId: targetOrgId,
          batchId,
          users,
          conaMode: true,
          strictMetadata: config.version === 2,
          discoveryPolicy: config.userProvisioning?.discoveryPolicy ?? 'best_effort',
          discoveryFailurePolicy: execution?.discoveryFailurePolicy ?? 'fail',
          failurePolicy: execution?.failurePolicy ?? 'fail_fast',
          automationRunId,
        };
        let job: { id: string } | undefined;
        try {
          job = await this.jobsService.create({
            queue: QUEUE_NAMES.USER_PROVISION,
            type: 'cona_user_provision',
            parentRunId: automationRunId,
            createdBy: run.createdBy,
            payload,
          });
          await this.queueService.addJob(QUEUE_NAMES.USER_PROVISION, 'cona_user_provision', {
            ...payload,
            dbJobId: job.id,
          }, job.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await prisma.provisionedUser.updateMany({
            where: {
              batchId,
              username: { in: users.map((user) => user.username!) },
              status: 'queued',
            },
            data: { status: 'failed', error: `Queueing failed: ${message}` },
          });
          const rows = await prisma.provisionedUser.findMany({
            where: { batchId },
            select: { status: true },
          });
          const successCount = rows.filter((row) => row.status === 'completed').length;
          const failCount = rows.filter((row) => row.status === 'failed').length;
          await prisma.provisioningBatch.update({
            where: { id: batchId },
            data: {
              status: successCount > 0 ? 'partial' : 'failed',
              successCount,
              failCount,
            },
          });
          if (job) {
            await this.jobsService.updateStatus(job.id, 'failed', message).catch(() => undefined);
          }
          throw error;
        }
        jobs.push({ action, jobId: job.id });
      }

      if (action === 'load_data_seed') {
        const sourceOrgId = getDataDeploymentOrgId({
          dataDeploymentOrgId: config.dataDeploymentOrgId,
          customSettingsOrgId: config.customSettingsOrgId,
          sourceOrgId: config.sourceOrgId,
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
          createdBy: run.createdBy,
          payload: {
            sourceOrgId,
            targetOrgId,
            datasets,
            accountSeedRows: config.accountSeedRows,
            dataSeedMode,
            querySet,
            querySection: config.dataSeed?.querySection,
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
          querySection: config.dataSeed?.querySection,
          salesOfficeConfig,
          dbJobId: job.id,
          automationRunId,
        }, job.id);
        jobs.push({ action, jobId: job.id });
      }

      if (action === 'load_account_partners') {
        if (config.dataSeed?.mode === 'query_section' && config.dataSeed.querySection?.accountPartnerPlan) {
          continue;
        }
        const partner = config.partnerImport ?? {
          mode: (partnerExcelBase64 ? 'excel' : 'org_to_org_matched') as 'excel' | 'org_to_org' | 'org_to_org_matched',
          bottler: '5000' as const,
          perOffice: 20,
          matchOrgDistribution: true,
          salesOfficeConfig: undefined,
          excelPath: undefined,
          sheet: undefined,
        };
        const sourceOrgId = getDataDeploymentOrgId({
          dataDeploymentOrgId: config.dataDeploymentOrgId,
          customSettingsOrgId: config.customSettingsOrgId,
          sourceOrgId: config.sourceOrgId,
        });
        const job = await this.jobsService.create({
          queue: QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT,
          type: 'account_partner_import',
          parentRunId: automationRunId,
          createdBy: run.createdBy,
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

    const cancellableJobs = run.jobs.filter((job) =>
      ['pending', 'queued', 'planning', 'running', 'paused'].includes(job.status));

    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: { status: 'cancelled', lastError: null, failedStep: null },
    });
    for (const job of cancellableJobs) {
      await this.jobsService.updateStatus(job.id, 'cancelled');
    }

    const checkpoint = (run.checkpoint ?? {}) as unknown as PipelineCheckpoint;
    if (checkpoint.deploymentId) {
      await prisma.deployment.update({
        where: { id: checkpoint.deploymentId },
        data: { status: 'cancelled' },
      }).catch(() => undefined);
    }

    for (const job of cancellableJobs) {
      await this.processRegistry.cancel(job.id);
      if (job.queue === QUEUE_NAMES.SCRATCH_ORG_CREATE) {
        this.scratchOrgJobService.cancel(job.id);
      }
      if (job.queue === QUEUE_NAMES.METADATA_DEPLOY) {
        this.metadataDeployJobService.cancel(job.id);
      }
    }

    for (const job of cancellableJobs) {
      await this.queueService.removeJob(job.queue, job.id).catch(() => false);
      await this.jobsService.addLog(job.id, 'stderr', 'Pipeline cancelled by user');
      await this.streamService.publish('job_status', { jobId: job.id, status: 'cancelled' });
    }

    await this.streamService.publish('job_status', { automationRunId, status: 'cancelled' });

    return { cancelled: true };
  }

  private async enqueueScratchOrgResume(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const owner = await prisma.automationRun.findUnique({
      where: { id: automationRunId },
      select: { createdBy: true },
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
        currentStep: checkpoint.scratchSubStep ?? 'Pending',
        status: 'pending',
        createdBy: owner?.createdBy ?? 'system',
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

  private async requireConfigureExistingTarget(
    automationRunId: string,
    suppliedConfig?: ScratchOrgPipelineInput,
    suppliedCheckpoint?: PipelineCheckpoint,
    suppliedRun?: { createdBy: string; targetOrgConnectionId?: string | null },
  ) {
    const persisted = suppliedRun ?? await prisma.automationRun.findUnique({
      where: { id: automationRunId },
      select: { createdBy: true, targetOrgConnectionId: true },
    });
    if (!persisted) throw new Error('Automation run not found');

    let config = suppliedConfig;
    let checkpoint = suppliedCheckpoint;
    if (!config || !checkpoint) {
      const run = await prisma.automationRun.findUnique({
        where: { id: automationRunId },
        select: { config: true, checkpoint: true },
      });
      if (!run) throw new Error('Automation run not found');
      config ??= normalizeGitSourceConfig(
        run.config as unknown as ScratchOrgPipelineInput,
      ) as ScratchOrgPipelineInput;
      checkpoint ??= normalizePipelineCheckpointAliases(
        (run.checkpoint ?? {}) as unknown as PipelineCheckpoint,
      ) as PipelineCheckpoint;
    }
    if (config.mode !== 'configure_existing') {
      throw new Error('Existing scratch target validation requires configure_existing mode');
    }

    const targetId = checkpoint.targetOrgConnectionId ?? config.existingOrgConnectionId;
    if (
      !targetId
      || config.existingOrgConnectionId !== targetId
      || (
        persisted.targetOrgConnectionId
        && persisted.targetOrgConnectionId !== targetId
      )
    ) {
      throw new Error('Configure-existing target binding does not match the persisted run');
    }
    return this.scratchOrgPreparation.requireOwnedActiveScratchTarget(
      targetId,
      persisted.createdBy,
    );
  }

  private async enqueueExistingPreparation(
    automationRunId: string,
    config: Extract<ScratchOrgPipelineInput, { mode: 'configure_existing' }>,
    checkpoint: PipelineCheckpoint,
    createdBy: string,
  ) {
    const targetOrgConnectionId =
      checkpoint.targetOrgConnectionId ?? config.existingOrgConnectionId;
    const payload = {
      orgId: targetOrgConnectionId,
      automationRunId,
      existingOrgOptions: config.existingOrgOptions,
    };
    let job: { id: string } | undefined;
    let enqueueAttempted = false;
    try {
      await this.requireConfigureExistingTarget(automationRunId, config, checkpoint);
      job = await this.jobsService.create({
        queue: QUEUE_NAMES.ORG_SETUP,
        type: 'prepare_existing_org',
        parentRunId: automationRunId,
        createdBy,
        payload,
      });
      enqueueAttempted = true;
      await this.queueService.addJob(
        QUEUE_NAMES.ORG_SETUP,
        'prepare_existing_org',
        { ...payload, dbJobId: job.id },
        job.id,
        { attempts: 1 },
      );
      checkpoint.preparationJobId = job.id;
      checkpoint.resumeFrom = 'prepare_existing_org';
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
      });
      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (job) {
        if (enqueueAttempted) {
          await this.processRegistry.cancel(job.id).catch(() => undefined);
          await this.queueService.removeJob(QUEUE_NAMES.ORG_SETUP, job.id)
            .catch(() => false);
        }
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: enqueueAttempted ? 'cancelled' : 'failed',
            error: `Queueing failed: ${message}`,
            finishedAt: new Date(),
          },
        }).catch(() => undefined);
      }
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: {
          status: 'failed',
          failedStep: 'prepare_existing_org',
          lastError: `Preparation queueing failed: ${message}`,
        },
      }).catch(() => undefined);
      throw new PreparationQueueError(`Preparation queueing failed: ${message}`);
    }
  }

  private async enqueueMetadataDeploy(
    automationRunId: string,
    config: ScratchOrgPipelineInput,
    checkpoint: PipelineCheckpoint,
  ) {
    const ownerRun = await prisma.automationRun.findUnique({
      where: { id: automationRunId },
      select: { createdBy: true, targetOrgConnectionId: true },
    });
    if (!ownerRun) throw new Error('Automation run not found');
    const target = config.mode === 'configure_existing'
      ? (await this.requireConfigureExistingTarget(
          automationRunId,
          config,
          checkpoint,
          ownerRun,
        )).target
      : await prisma.orgConnection.findUnique({
          where: { id: checkpoint.targetOrgConnectionId ?? '' },
        });
    if (!target) throw new Error('Target org connection not found');
    if (target.createdBy !== ownerRun.createdBy) {
      throw new Error('Target org ownership validation failed');
    }
    const normalized = normalizeGitSourceConfig(config);
    if (!normalized.gitSource) throw new Error('gitSource is required for metadata deployment');
    const gitSource = await this.scmSources.requireActive(normalized.gitSource);

    const existingDeployment = checkpoint.deploymentId
      ? await prisma.deployment.findUnique({ where: { id: checkpoint.deploymentId } })
      : null;
    const deployment = existingDeployment
      ? await prisma.deployment.update({
          where: { id: existingDeployment.id },
          data: {
            status: 'queued',
            repo: gitSource.repo,
            branch: gitSource.branch,
            metadata: {
              ...((existingDeployment.metadata as Record<string, unknown> | null) ?? {}),
              provider: gitSource.provider,
              connectionId: gitSource.connectionId,
              bindingId: gitSource.bindingId,
              manifestPath: gitSource.manifestPath,
              gitSource,
            } as Prisma.InputJsonValue,
          },
        })
      : await prisma.deployment.create({
          data: {
            targetOrgId: target.id,
            repo: gitSource.repo,
            branch: gitSource.branch,
            strategy: 'azure',
            status: 'queued',
            metadata: {
              provider: gitSource.provider,
              connectionId: gitSource.connectionId,
              bindingId: gitSource.bindingId,
              manifestPath: gitSource.manifestPath,
              gitSource,
            } as Prisma.InputJsonValue,
            createdBy: ownerRun.createdBy,
          },
        });
    checkpoint.deploymentId = deployment.id;

    const adapter = this.scmAdapters.get(gitSource.provider);
    if (adapter.triggerPipeline) {
      await adapter.triggerPipeline(gitSource, {
        targetOrgAlias: target.alias,
        targetOrgUsername: target.username ?? target.alias,
        instanceUrl: target.instanceUrl,
      });
    }

    const orgAlias = target.username ?? target.alias;
    const job = await this.metadataDeployQueue.enqueue({
      automationRunId,
      deploymentId: deployment.id,
      orgAlias,
      gitSource,
      assignPermissionSet: true,
      intelligentDeployRunId: checkpoint.intelligentDeployRunId,
      createdBy: ownerRun.createdBy,
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
    const owner = await prisma.automationRun.findUnique({
      where: { id: automationRunId },
      select: { createdBy: true, targetOrgConnectionId: true, config: true },
    });
    if (!owner) throw new Error('Automation run not found');
    const config = normalizeGitSourceConfig(
      owner.config as unknown as ScratchOrgPipelineInput,
    ) as ScratchOrgPipelineInput;
    const target = config.mode === 'configure_existing'
      ? (await this.requireConfigureExistingTarget(
          automationRunId,
          config,
          checkpoint,
          owner,
        )).target
      : await prisma.orgConnection.findUnique({
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
        createdBy: owner?.createdBy ?? 'system',
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
    const owner = await prisma.automationRun.findUnique({
      where: { id: automationRunId },
      select: { createdBy: true, targetOrgConnectionId: true },
    });
    if (!owner) throw new Error('Automation run not found');
    const target = config.mode === 'configure_existing'
      ? (await this.requireConfigureExistingTarget(
          automationRunId,
          config,
          checkpoint,
          owner,
        )).target
      : await prisma.orgConnection.findUnique({
          where: { id: checkpoint.targetOrgConnectionId ?? '' },
        });
    if (!target) throw new Error('Target org connection not found');

    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.ORG_SETUP,
        type: 'pipeline_load_org_config',
        parentRunId: automationRunId,
        status: 'pending',
        createdBy: owner?.createdBy ?? 'system',
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
      sourceOrgId: config.sourceOrgId,
      dataDeploymentOrgId: config.dataDeploymentOrgId,
    });
    const targetOrgId = checkpoint.targetOrgConnectionId;
    if (!sourceOrgId || !targetOrgId) {
      throw new Error('customSettingsOrgId and scratch target org are required');
    }

    const source = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
    const target = config.mode === 'configure_existing'
      ? (await this.requireConfigureExistingTarget(
          automationRunId,
          config,
          checkpoint,
          { createdBy, targetOrgConnectionId: targetOrgId },
        )).target
      : await prisma.orgConnection.findUnique({ where: { id: targetOrgId } });
    if (!source || !target) {
      throw new Error('Custom settings source or target org not found');
    }
    if (source.createdBy !== createdBy || target.createdBy !== createdBy) {
      throw new Error('Custom settings org ownership validation failed');
    }

    const mode = config.customSettings?.mode ?? 'bundled';
    const exportConfig =
      mode === 'custom' && config.customSettings?.exportConfig
        ? config.customSettings.exportConfig
        : loadBundledCustomSettingsExport();
    if (config.version === 2 && hasInsertOperation(exportConfig)) {
      throw new Error('V2 resumable custom settings do not support Insert; use Upsert');
    }
    await this.sfCli.ensureSfdmuPlugin();

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
    const actions = this.autoActions(config);

    if (!actions.length) {
      await this.completeAutoPipeline(automationRunId, checkpoint, false);
      return;
    }

    const partnerExcelBase64 = config.partnerImport?.partnerExcelBase64;
    await this.runUserActions(automationRunId, {
      actions: [actions[0]],
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
    const expected = this.autoActions(config);
    const done = new Set(checkpoint.userActionsCompleted ?? []);
    if (expected.every((a) => done.has(a))) {
      checkpoint.fullyProvisioned = true;
      await this.completeAutoPipeline(automationRunId, checkpoint, false);
      return;
    }
    const next = expected.find((action) => !done.has(action));
    if (next) await this.runUserActions(automationRunId, { actions: [next] });
  }

  private autoActions(config: ScratchOrgPipelineInput): UserTriggeredPipelineStepId[] {
    const steps = config.pipelineSteps ?? {
      autoRunDataSeed: true,
      autoRunPartners: false,
      autoRunUsers: true,
    };
    const actions: UserTriggeredPipelineStepId[] = [];
    if (steps.autoRunDataSeed) actions.push('load_data_seed');
    const queryHandlesPartners = Boolean(
      config.dataSeed?.mode === 'query_section'
      && config.dataSeed.querySection?.accountPartnerPlan,
    );
    if (steps.autoRunPartners && !queryHandlesPartners) actions.push('load_account_partners');
    if (steps.autoRunUsers && this.hasProvisioningUsers(config)) actions.push('provision_users');
    return actions;
  }

  private hasProvisioningUsers(config: ScratchOrgPipelineInput): boolean {
    return Boolean(
      config.userProvisioning?.users?.length
      || config.userProvisioning?.slots?.length
      || config.userProvisioning?.userGenerators?.length,
    );
  }

  private resolveProvisioningUsers(config: ScratchOrgPipelineInput, automationRunId: string) {
    return resolveUserProvisioningPlan(config.userProvisioning ?? {}, automationRunId);
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
        status: checkpoint.partialUserActions?.length ? 'partial' : 'completed',
        failedStep: null,
        lastError: null,
        checkpoint: checkpoint as unknown as Prisma.InputJsonValue,
      },
    });
    await this.streamService.publish('job_status', {
      automationRunId,
      status: checkpoint.partialUserActions?.length ? 'partial' : 'completed',
      awaitingUserActions,
      fullyProvisioned: checkpoint.fullyProvisioned ?? false,
    });
  }
}
