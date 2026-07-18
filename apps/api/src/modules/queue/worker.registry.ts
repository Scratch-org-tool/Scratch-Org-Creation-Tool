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
import { NotificationsService } from '../notifications/notifications.service';
import { PipelineOrchestratorService } from '../orchestrator/pipeline-orchestrator.service';
import { JobCancelledError } from '../environment/scratch-org-job.service';
import {
  notificationLevelForStatus,
  queueToNotificationCategory,
  type PipelineStepId,
} from '@sfcc/shared';
import { PipelineStepError } from '../../workers/metadata-deploy.worker';
import { resolvePipelineSuccessAction } from '../orchestrator/pipeline-dispatch.util';

@Injectable()
export class WorkerRegistry implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly streamService: StreamService,
    private readonly jobsService: JobsService,
    private readonly notificationsService: NotificationsService,
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

  private isParentRunBlocked(status?: string): boolean {
    return status === 'failed' || status === 'cancelled';
  }

  private async cancelBlockedChild(
    dbJobId: string,
    currentStatus?: string,
  ): Promise<void> {
    if (!currentStatus || ['completed', 'partial', 'failed', 'cancelled'].includes(currentStatus)) {
      return;
    }
    await this.jobsService.updateStatus(dbJobId, 'cancelled');
    await this.streamService.publish('job_status', {
      jobId: dbJobId,
      status: 'cancelled',
    });
  }

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

  private humanizeJobType(type: string, alias?: string | null): string {
    const cleaned = type
      .replace(/^pipeline_/, '')
      .replace(/^org_to_org_/, '')
      .replace(/_/g, ' ')
      .trim();
    const label = cleaned
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : 'Job';
    return alias ? `${label} (${alias})` : label;
  }

  /**
   * Emit an in-app notification to a finished job's owner. Delivery is gated by
   * the admin controls inside NotificationsService, so this is a no-op unless an
   * administrator has enabled notifications for the relevant category.
   *
   * Noise policy: successes only notify for standalone jobs (no parent run) so
   * multi-step pipelines don't emit one alert per child; failures always notify
   * because they always warrant attention.
   */
  private async notifyJobTerminal(
    dbJobId: string,
    status: 'completed' | 'partial' | 'failed',
    error?: string,
  ): Promise<void> {
    try {
      const job = await prisma.job.findUnique({
        where: { id: dbJobId },
        select: {
          queue: true,
          type: true,
          alias: true,
          parentRunId: true,
          createdBy: true,
          parentRun: { select: { createdBy: true } },
        },
      });
      if (!job) return;
      if (status !== 'failed' && job.parentRunId) return;

      const owner =
        job.createdBy && job.createdBy !== 'system'
          ? job.createdBy
          : job.parentRun?.createdBy;
      if (!owner || owner === 'system') return;

      const label = this.humanizeJobType(job.type, job.alias);
      const title =
        status === 'failed'
          ? `${label} failed`
          : status === 'partial'
            ? `${label} finished with warnings`
            : `${label} completed`;
      const body =
        status === 'failed' && error
          ? error.length > 240
            ? `${error.slice(0, 237)}...`
            : error
          : undefined;

      await this.notificationsService.notify({
        userId: owner,
        category: queueToNotificationCategory(job.queue),
        level: notificationLevelForStatus(status),
        title,
        body,
        jobId: dbJobId,
        link: '/monitoring',
        metadata: { jobId: dbJobId, status, queue: job.queue, type: job.type },
      });
    } catch {
      // Best-effort only — a notification failure must never break the queue.
    }
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
          const current = await prisma.job.findUnique({
            where: { id: dbJobId },
            select: {
              status: true,
              parentRun: { select: { status: true } },
            },
          });
          if (
            current?.status === 'cancelled'
            || this.isParentRunBlocked(current?.parentRun?.status)
          ) {
            await this.cancelBlockedChild(dbJobId, current?.status);
            return;
          }
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
            const current = await prisma.job.findUnique({
              where: { id: dbJobId },
              select: {
                status: true,
                parentRunId: true,
                type: true,
                parentRun: { select: { status: true } },
              },
            });
            if (
              current?.status === 'cancelled'
              || this.isParentRunBlocked(current?.parentRun?.status)
            ) {
              await this.cancelBlockedChild(dbJobId, current?.status);
              if (data.deploymentId) {
                await prisma.deployment.update({
                  where: { id: data.deploymentId },
                  data: { status: 'cancelled' },
                }).catch(() => undefined);
              }
              return result;
            }
            const terminalStatus = result?.cancelled
              ? 'cancelled'
              : ['cona_user_provision', 'lifecycle_user_provision'].includes(job.name) && result?.partial
                ? 'partial'
                : 'completed';
            if (current?.status !== terminalStatus) {
              await this.jobsService.updateStatus(dbJobId, terminalStatus);
              await this.streamService.publish('job_status', { jobId: dbJobId, status: terminalStatus });
              if (terminalStatus !== 'cancelled') {
                void this.notifyJobTerminal(dbJobId, terminalStatus);
              }
            }
            if (terminalStatus === 'cancelled') return result;
          }

          const runId = data.automationRunId ?? (dbJobId
            ? (await prisma.job.findUnique({ where: { id: dbJobId }, select: { parentRunId: true } }))?.parentRunId ?? undefined
            : undefined);

          if (runId && options?.pipelineJobType) {
            const run = await prisma.automationRun.findUnique({
              where: { id: runId },
              select: { status: true, intent: true },
            });
            if (run && ['paused', 'cancelled', 'failed'].includes(run.status)) {
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
              select: {
                status: true,
                parentRunId: true,
                type: true,
                parentRun: { select: { status: true } },
              },
            });
            if (
              current?.status === 'cancelled'
              || this.isParentRunBlocked(current?.parentRun?.status)
            ) {
              await this.cancelBlockedChild(dbJobId, current?.status);
              return;
            }
            await this.jobsService.updateStatus(dbJobId, 'failed', message);
            await this.streamService.publish('job_status', { jobId: dbJobId, status: 'failed', error: message });
            void this.notifyJobTerminal(dbJobId, 'failed', message);

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
          : job.name === 'prepare_existing_org'
            ? {
                pipelineJobType: 'prepare_existing_org',
                failedStep: 'prepare_existing_org' as PipelineStepId,
              }
            : undefined;
        return wrap((j) => this.orgSetupWorker.process(j), pipelineOpts)(job);
      },
    );
    this.queueService.registerWorker(QUEUE_NAMES.CONA_SEED, wrap((j) => this.conaSeedWorker.process(j)));
    this.queueService.registerWorker(QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT, wrap((j) => this.accountPartnerImportWorker.process(j)));
    this.queueService.registerWorker(QUEUE_NAMES.AI_ANALYSIS, wrap((j) => this.aiAnalysisWorker.process(j)));
  }
}
