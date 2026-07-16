import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { QUEUE_NAMES } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { generateSfdmuConfigFromSoql } from '../data/sfdmu-config.generator';
import { chainedDataConfigItemSchema } from '@sfcc/shared';

interface DataDeployConfigItem {
  objectName: string;
  soql?: string;
  strategy?: 'insert' | 'upsert';
  matchField?: string;
}

interface ChainedChild {
  movementId: string;
  jobId?: string;
}

class ChainedDataCancelledError extends Error {
  constructor() {
    super('Chained data deployment cancelled');
    this.name = 'ChainedDataCancelledError';
  }
}

@Injectable()
export class MetadataDataChainService {
  constructor(
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
    private readonly processRegistry: JobProcessRegistryService,
  ) {}

  async runChainedDataDeploys(options: {
    sourceOrgId: string;
    targetOrgId: string;
    dataDeployConfig: DataDeployConfigItem[];
    automationRunId?: string;
    workbenchRunId?: string;
    createdBy?: string;
    onLog: (line: string) => Promise<void>;
    awaitTerminal?: boolean;
    sequential?: boolean;
    stopOnError?: boolean;
    timeoutMs?: number;
    isCancelled?: () => Promise<boolean>;
  }): Promise<string[]> {
    // Validate the complete chain before creating a movement or queue job.
    const configs = options.dataDeployConfig.map((item) => chainedDataConfigItemSchema.parse(item));
    const [source, target] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: options.sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: options.targetOrgId } }),
    ]);
    if (!source || !target) throw new Error('Source or target org not found for data chain');
    if (
      options.createdBy
      && (source.createdBy !== options.createdBy || target.createdBy !== options.createdBy)
    ) {
      throw new Error('Chained data source or target is not owned by the deployment actor');
    }
    if (source.id === target.id) throw new Error('Chained data source and target must differ');

    const sourceAlias = source.username ?? source.alias;
    const targetAlias = target.username ?? target.alias;
    const jobIds: string[] = [];
    const children = new Map<string, ChainedChild>();

    await options.onLog(`Starting chained data deploy for ${configs.length} object(s)...`);

    const ensureParentActive = async (child?: ChainedChild) => {
      if (!(await this.parentCancelled(options))) return;
      if (child) await this.cancelChild(child);
      throw new ChainedDataCancelledError();
    };

    const enqueueOne = async (cfg: DataDeployConfigItem) => {
      await ensureParentActive();
      const soql = cfg.soql?.trim()
        ?? `SELECT Id, Name FROM ${cfg.objectName} LIMIT 200`;

      const movement = await prisma.dataMovement.create({
        data: {
          sourceOrgId: options.sourceOrgId,
          targetOrgId: options.targetOrgId,
          objectName: cfg.objectName,
          soql,
          movementType: 'org_to_org',
          status: 'queued',
          createdBy: options.createdBy ?? 'system',
          sfdmuConfig: options.workbenchRunId
            ? { workbenchRunId: options.workbenchRunId }
            : undefined,
        },
      });
      const child: ChainedChild = { movementId: movement.id };
      children.set(movement.id, child);
      await ensureParentActive(child);

      const generated = generateSfdmuConfigFromSoql({
        runId: movement.id,
        sourceOrgAlias: sourceAlias,
        targetOrgAlias: targetAlias,
        objectName: cfg.objectName,
        soql,
        externalId: cfg.matchField ?? 'Name',
      });

      await prisma.dataMovement.update({
        where: { id: movement.id },
        data: {
          sfdmuConfig: {
            configPath: generated.configPath,
            strategy: cfg.strategy ?? 'upsert',
            matchField: cfg.matchField ?? 'Name',
            ...(options.workbenchRunId ? { workbenchRunId: options.workbenchRunId } : {}),
          } as Prisma.InputJsonValue,
        },
      });

      await ensureParentActive(child);
      const job = await this.jobsService.create({
        queue: QUEUE_NAMES.SFDMU_RUN,
        type: 'org_to_org_data_deploy',
        payload: {
          sourceOrgAlias: sourceAlias,
          targetOrgAlias: targetAlias,
          configPath: generated.configPath,
          movementId: movement.id,
          ...(options.workbenchRunId ? { workbenchRunId: options.workbenchRunId } : {}),
        },
        parentRunId: options.automationRunId,
        createdBy: options.createdBy,
      });
      child.jobId = job.id;
      await ensureParentActive(child);

      await ensureParentActive(child);
      await this.queueService.addJob(
        QUEUE_NAMES.SFDMU_RUN,
        'org_to_org_data_deploy',
        {
          sourceOrgAlias: sourceAlias,
          targetOrgAlias: targetAlias,
          configPath: generated.configPath,
          movementId: movement.id,
          dbJobId: job.id,
          ...(options.workbenchRunId ? { workbenchRunId: options.workbenchRunId } : {}),
        },
        job.id,
      );
      await ensureParentActive(child);

      jobIds.push(job.id);
      await options.onLog(`Queued data deploy for ${cfg.objectName} (job ${job.id})`);
      return job.id;
    };

    const childForJob = (id: string) =>
      [...children.values()].find((child) => child.jobId === id);
    try {
      if (options.sequential !== false) {
        for (const cfg of configs) {
          const id = await enqueueOne(cfg);
          if (options.awaitTerminal) {
            const terminal = await this.awaitJob(id, childForJob(id), options);
            await options.onLog(`Data deploy ${id} finished with ${terminal.status}`);
            if (terminal.status !== 'completed' && options.stopOnError !== false) {
              throw new Error(`Chained data deploy ${id} ${terminal.status}: ${terminal.error ?? 'unknown error'}`);
            }
          }
        }
      } else {
        const settled = await Promise.allSettled(configs.map(enqueueOne));
        const rejected = settled.find(
          (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
        );
        if (rejected) throw rejected.reason;
        const ids = settled.map((outcome) => (outcome as PromiseFulfilledResult<string>).value);
        if (options.awaitTerminal) {
          const outcomes = await Promise.all(
            ids.map((id) => this.awaitJob(id, childForJob(id), options)),
          );
          const failed = outcomes.find((outcome) => outcome.status !== 'completed');
          if (failed && options.stopOnError !== false) {
            throw new Error(`Chained data deploy ${failed.id} ${failed.status}: ${failed.error ?? 'unknown error'}`);
          }
        }
      }
    } catch (error) {
      if (error instanceof ChainedDataCancelledError || await this.parentCancelled(options)) {
        await this.reconcileCancelledChildren(children);
        throw new ChainedDataCancelledError();
      }
      throw error;
    }

    return jobIds;
  }

  private async awaitJob(
    id: string,
    child: ChainedChild | undefined,
    options: {
      automationRunId?: string;
      workbenchRunId?: string;
      timeoutMs?: number;
      isCancelled?: () => Promise<boolean>;
    },
  ) {
    const timeoutMs = options.timeoutMs ?? 30 * 60_000;
    const deadline = Date.now() + Math.min(Math.max(timeoutMs, 1_000), 24 * 60 * 60_000);
    for (;;) {
      const job = await prisma.job.findUnique({
        where: { id },
        select: { id: true, status: true, error: true },
      });
      if (!job) throw new Error(`Chained data job ${id} disappeared`);
      if (['completed', 'partial', 'failed', 'cancelled'].includes(job.status)) return job;
      if (await this.parentCancelled(options)) {
        if (child) await this.cancelChild(child);
        const cancelled = await prisma.job.findUnique({
          where: { id },
          select: { id: true, status: true, error: true },
        });
        if (!cancelled) throw new Error(`Chained data job ${id} disappeared`);
        if (['completed', 'partial', 'failed', 'cancelled'].includes(cancelled.status)) {
          return cancelled;
        }
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for chained data job ${id}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private async parentCancelled(options: {
    automationRunId?: string;
    workbenchRunId?: string;
    isCancelled?: () => Promise<boolean>;
  }): Promise<boolean> {
    if (await options.isCancelled?.()) return true;
    const [automationRun, workbenchRun] = await Promise.all([
      options.automationRunId
        ? prisma.automationRun.findUnique({
            where: { id: options.automationRunId },
            select: { status: true },
          })
        : null,
      options.workbenchRunId
        ? prisma.deploymentQualityRun.findUnique({
            where: { id: options.workbenchRunId },
            select: { status: true },
          })
        : null,
    ]);
    return Boolean(
      (automationRun && ['cancelled', 'failed', 'paused'].includes(automationRun.status))
      || (workbenchRun && ['cancelled', 'failed', 'rejected'].includes(workbenchRun.status)),
    );
  }

  private async cancelChild(child: ChainedChild): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.dataMovement.updateMany({
        where: {
          id: child.movementId,
          status: { in: ['pending', 'queued', 'running'] },
        },
        data: { status: 'cancelled' },
      });
      if (child.jobId) {
        await tx.job.updateMany({
          where: {
            id: child.jobId,
            status: { in: ['pending', 'queued', 'running'] },
          },
          data: {
            status: 'cancelled',
            error: 'Parent deployment cancelled',
            finishedAt: new Date(),
          },
        });
      }
    });
    if (child.jobId) {
      await Promise.all([
        this.queueService.removeJob(QUEUE_NAMES.SFDMU_RUN, child.jobId).catch(() => false),
        this.processRegistry.cancel(child.jobId),
      ]);
    }
  }

  private async reconcileCancelledChildren(children: Map<string, ChainedChild>): Promise<void> {
    for (;;) {
      const snapshot = [...children.values()];
      await Promise.all(snapshot.map((child) => this.cancelChild(child)));
      const jobIds = snapshot.flatMap((child) => child.jobId ? [child.jobId] : []);
      const [activeJobs, activeMovements] = await Promise.all([
        jobIds.length
          ? prisma.job.findMany({
              where: { id: { in: jobIds }, status: { in: ['pending', 'queued', 'running'] } },
              select: { id: true },
            })
          : [],
        snapshot.length
          ? prisma.dataMovement.findMany({
              where: {
                id: { in: snapshot.map((child) => child.movementId) },
                status: { in: ['pending', 'queued', 'running'] },
              },
              select: { id: true },
            })
          : [],
      ]);
      if (
        activeJobs.length === 0
        && activeMovements.length === 0
        && snapshot.length === children.size
      ) return;
    }
  }
}
