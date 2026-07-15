import { Injectable, OnModuleInit } from '@nestjs/common';
import { QUEUE_NAMES } from '@sfcc/shared';
import { prisma, type Prisma } from '@sfcc/db';
import { QueueService } from './queue.service';
import { ScratchOrgWorker } from '../../workers/scratch-org.worker';
import { MetadataDeployWorker } from '../../workers/metadata-deploy.worker';
import { SfdmuWorker } from '../../workers/sfdmu.worker';
import { DataDeployWorker } from '../../workers/data-deploy.worker';
import { UserProvisionWorker } from '../../workers/user-provision.worker';
import { OrgSetupWorker } from '../../workers/org-setup.worker';
import { ConaSeedWorker } from '../../workers/cona-seed.worker';
import { AccountPartnerImportWorker } from '../../workers/account-partner-import.worker';
import { AiAnalysisWorker } from '../../workers/ai-analysis.worker';
import { StreamService } from '../stream/stream.service';
import { JobsService } from '../jobs/jobs.service';
import { PipelineOrchestratorService } from '../orchestrator/pipeline-orchestrator.service';
import { JobCancelledError } from '../environment/scratch-org-job.service';
import type { PipelineStepId } from '@sfcc/shared';
import { PipelineStepError } from '../../workers/metadata-deploy.worker';
import { resolvePipelineSuccessAction } from '../orchestrator/pipeline-dispatch.util';

@Injectable()
export class WorkerRegistry implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly streamService: StreamService,
    private readonly jobsService: JobsService,
    private readonly pipelineOrchestrator: PipelineOrchestratorService,
    private readonly scratchOrgWorker: ScratchOrgWorker,
    private readonly metadataDeployWorker: MetadataDeployWorker,
    private readonly sfdmuWorker: SfdmuWorker,
    private readonly dataDeployWorker: DataDeployWorker,
    private readonly userProvisionWorker: UserProvisionWorker,
    private readonly orgSetupWorker: OrgSetupWorker,
    private readonly conaSeedWorker: ConaSeedWorker,
    private readonly accountPartnerImportWorker: AccountPartnerImportWorker,
    private readonly aiAnalysisWorker: AiAnalysisWorker,
  ) {}

  /** Immutable audit row recording a deployment's terminal state. */
  private async writeDeploymentAudit(
    deploymentId: string,
    status: string,
    error?: string,
    result?: Record<string, unknown>,
  ) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { sourceOrgId: true, targetOrgId: true, repo: true, branch: true, validationId: true, createdBy: true },
    }).catch(() => null);
    if (!deployment) return;
    const validated = Boolean(result && (result as { validated?: boolean }).validated);
    await prisma.deploymentAudit.create({
      data: {
        deploymentId,
        action: validated ? 'validation_finished' : 'deploy_finished',
        sourceOrgId: deployment.sourceOrgId,
        targetOrgId: deployment.targetOrgId,
        repo: deployment.repo,
        branch: deployment.branch,
        validationId: deployment.validationId,
        status,
        error,
        performedBy: deployment.createdBy,
      },
    }).catch(() => undefined);
  }

  /** Complete a metadata→data chained run only when every chained job is terminal. */
  private async completeChainedRunIfDone(runId: string) {
    const run = await prisma.automationRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    if (!run || ['paused', 'cancelled', 'completed', 'failed'].includes(run.status)) return;

    const jobs = await prisma.job.findMany({
      where: { parentRunId: runId },
      select: { id: true, type: true, status: true, error: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const latestMetadata = [...jobs]
      .reverse()
      .find((job) => job.type === 'pipeline_metadata_deploy');
    const relevantJobs = latestMetadata
      ? jobs.filter((job) =>
          job.id === latestMetadata.id ||
          (job.type !== 'pipeline_metadata_deploy' && job.createdAt >= latestMetadata.createdAt))
      : jobs;
    const terminal = ['completed', 'failed', 'cancelled'];
    if (relevantJobs.length === 0 || relevantJobs.some((j) => !terminal.includes(j.status))) return;

    const failed = relevantJobs.filter((j) => j.status === 'failed');
    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: failed.length > 0 ? 'failed' : 'completed',
        ...(failed.length > 0
          ? { lastError: failed[0]?.error ?? 'Chained data deploy failed' }
          : {}),
      },
    }).catch(() => undefined);
  }

  onModuleInit() {
    const wrap = (
      handler: (job: Parameters<Parameters<typeof this.queueService.registerWorker>[1]>[0]) => Promise<unknown>,
      options?: {
        pipelineJobType?: string;
        failedStep?: PipelineStepId;
        resolveFailedStep?: (error: unknown) => PipelineStepId;
      },
    ) =>
      async (job: Parameters<typeof handler>[0]) => {
        const data = job.data as {
          dbJobId?: string;
          automationRunId?: string;
          deploymentId?: string;
        };
        const dbJobId = data.dbJobId;
        if (dbJobId) {
          await this.jobsService.updateStatus(dbJobId, 'running');
          await this.streamService.publish('job_status', { jobId: dbJobId, status: 'running' });
        }
        if (data.deploymentId) {
          await prisma.deployment.update({
            where: { id: data.deploymentId },
            data: { status: 'running' },
          }).catch(() => undefined);
        }
        try {
          const result = await handler(job) as Record<string, unknown> | undefined;
          if (dbJobId) {
            const current = await prisma.job.findUnique({ where: { id: dbJobId }, select: { status: true, parentRunId: true, type: true } });
            if (current?.status === 'cancelled') {
              if (data.deploymentId) {
                await prisma.deployment.update({
                  where: { id: data.deploymentId },
                  data: { status: 'cancelled' },
                }).catch(() => undefined);
              }
              return result;
            }
            if (current?.status !== 'completed') {
              await this.jobsService.updateStatus(dbJobId, 'completed');
              await this.streamService.publish('job_status', { jobId: dbJobId, status: 'completed' });
            }
          }

          const runId = data.automationRunId ?? (dbJobId
            ? (await prisma.job.findUnique({ where: { id: dbJobId }, select: { parentRunId: true } }))?.parentRunId ?? undefined
            : undefined);

          if (runId && options?.pipelineJobType) {
            const run = await prisma.automationRun.findUnique({
              where: { id: runId },
              select: { status: true, intent: true },
            });
            if (run && ['paused', 'cancelled'].includes(run.status)) {
              return result;
            }
            if (
              run &&
              resolvePipelineSuccessAction(run.intent, options.pipelineJobType) === 'combined_metadata'
            ) {
              if (data.deploymentId) {
                await prisma.deployment.update({
                  where: { id: data.deploymentId },
                  data: { status: 'completed' },
                }).catch(() => undefined);
                await this.writeDeploymentAudit(data.deploymentId, 'completed', undefined, result);
              }
              await this.completeChainedRunIfDone(runId);
            } else {
              await this.pipelineOrchestrator.handleJobSucceeded(runId, options.pipelineJobType, result);
            }
          } else if (runId && job.name === 'cona_user_provision') {
            await this.pipelineOrchestrator.handleJobSucceeded(runId, 'cona_user_provision', result);
          } else if (runId && job.name === 'cona_seed') {
            await this.pipelineOrchestrator.handleJobSucceeded(runId, 'cona_seed', result);
          } else if (runId && job.name === 'account_partner_import') {
            await this.pipelineOrchestrator.handleJobSucceeded(runId, 'account_partner_import', result);
          } else if (runId && job.name === 'org_to_org_data_deploy') {
            // Chained data deploys after a metadata deploy: the run only
            // completes once every chained job reaches a terminal state.
            await this.completeChainedRunIfDone(runId);
          } else if (data.deploymentId) {
            const jobRow = dbJobId
              ? await prisma.job.findUnique({ where: { id: dbJobId }, select: { status: true } })
              : null;
            const terminalStatus = jobRow?.status === 'cancelled' ? 'cancelled' : 'completed';
            await prisma.deployment.update({
              where: { id: data.deploymentId },
              data: { status: terminalStatus },
            });
            await this.writeDeploymentAudit(data.deploymentId, terminalStatus, undefined, result);
          }
          return result;
        } catch (error) {
          if (error instanceof JobCancelledError) return;
          const message = error instanceof Error ? error.message : String(error);
          if (dbJobId) {
            const current = await prisma.job.findUnique({
              where: { id: dbJobId },
              select: { status: true, parentRunId: true, type: true },
            });
            if (current?.status === 'cancelled') return;
            await this.jobsService.updateStatus(dbJobId, 'failed', message);
            await this.streamService.publish('job_status', { jobId: dbJobId, status: 'failed', error: message });

            const runId = data.automationRunId ?? current?.parentRunId ?? undefined;
            if (runId && options?.failedStep) {
              const failedStep = options.resolveFailedStep?.(error) ?? options.failedStep;
              await this.pipelineOrchestrator.handleJobFailed(runId, failedStep, message);
            } else if (runId && ['cona_seed', 'account_partner_import', 'cona_user_provision'].includes(job.name)) {
              const action = job.name === 'cona_seed'
                ? 'load_data_seed'
                : job.name === 'account_partner_import'
                  ? 'load_account_partners'
                  : 'provision_users';
              await this.pipelineOrchestrator.handleUserActionFailed(runId, action, message);
            } else if (runId && job.name === 'org_to_org_data_deploy') {
              await this.completeChainedRunIfDone(runId);
            } else if (data.deploymentId) {
              // Merge the error into existing metadata — never destroy audit context.
              const existing = await prisma.deployment.findUnique({
                where: { id: data.deploymentId },
                select: { metadata: true },
              });
              const mergedMetadata = {
                ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
                error: message,
                failedAt: new Date().toISOString(),
              };
              await prisma.deployment.update({
                where: { id: data.deploymentId },
                data: { status: 'failed', metadata: mergedMetadata as Prisma.InputJsonValue },
              }).catch(() => undefined);
              await this.writeDeploymentAudit(data.deploymentId, 'failed', message);
            }
          }
          throw error;
        }
      };

    this.queueService.registerWorker(
      QUEUE_NAMES.SCRATCH_ORG_CREATE,
      wrap((j) => this.scratchOrgWorker.process(j), { pipelineJobType: 'scratch_org_workflow', failedStep: 'scratch_org_create' }),
    );
    this.queueService.registerWorker(
      QUEUE_NAMES.METADATA_DEPLOY,
      wrap((j) => this.metadataDeployWorker.process(j), {
        pipelineJobType: 'pipeline_metadata_deploy',
        failedStep: 'git_metadata_deploy',
        resolveFailedStep: (error) =>
          error instanceof PipelineStepError ? error.pipelineStep : 'git_metadata_deploy',
      }),
    );
    this.queueService.registerWorker(
      QUEUE_NAMES.SFDMU_RUN,
      async (job) => {
        const pipelineOpts = job.name === 'custom_settings_load'
          ? { pipelineJobType: 'custom_settings_load', failedStep: 'load_custom_settings' as PipelineStepId }
          : undefined;
        return wrap((j) => this.sfdmuWorker.process(j), pipelineOpts)(job);
      },
    );
    this.queueService.registerWorker(QUEUE_NAMES.DATA_DEPLOY, wrap((j) => this.dataDeployWorker.process(j)));
    this.queueService.registerWorker(QUEUE_NAMES.USER_PROVISION, wrap((j) => this.userProvisionWorker.process(j)));
    this.queueService.registerWorker(
      QUEUE_NAMES.ORG_SETUP,
      async (job) => {
        const pipelineOpts = job.name === 'pipeline_load_org_config'
          ? { pipelineJobType: 'pipeline_load_org_config', failedStep: 'load_org_config' as PipelineStepId }
          : undefined;
        return wrap((j) => this.orgSetupWorker.process(j), pipelineOpts)(job);
      },
    );
    this.queueService.registerWorker(QUEUE_NAMES.CONA_SEED, wrap((j) => this.conaSeedWorker.process(j)));
    this.queueService.registerWorker(QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT, wrap((j) => this.accountPartnerImportWorker.process(j)));
    this.queueService.registerWorker(QUEUE_NAMES.AI_ANALYSIS, wrap((j) => this.aiAnalysisWorker.process(j)));
  }
}
