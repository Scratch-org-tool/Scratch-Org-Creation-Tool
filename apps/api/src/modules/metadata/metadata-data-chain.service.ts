import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { QUEUE_NAMES } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { generateSfdmuConfigFromSoql } from '../data/sfdmu-config.generator';
import { chainedDataConfigItemSchema } from '@sfcc/shared';

interface DataDeployConfigItem {
  objectName: string;
  soql?: string;
  strategy?: 'insert' | 'upsert';
  matchField?: string;
}

@Injectable()
export class MetadataDataChainService {
  constructor(
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
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

    await options.onLog(`Starting chained data deploy for ${configs.length} object(s)...`);

    const enqueueOne = async (cfg: DataDeployConfigItem) => {
      if (await options.isCancelled?.()) throw new Error('Chained data deployment cancelled');
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
      if (await options.isCancelled?.()) {
        await prisma.dataMovement.update({
          where: { id: movement.id },
          data: { status: 'cancelled' },
        });
        throw new Error('Chained data deployment cancelled');
      }

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
      if (await options.isCancelled?.()) {
        await Promise.all([
          this.jobsService.updateStatus(job.id, 'cancelled', 'Workbench run cancelled'),
          prisma.dataMovement.update({
            where: { id: movement.id },
            data: { status: 'cancelled' },
          }),
        ]);
        throw new Error('Chained data deployment cancelled');
      }

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
      if (await options.isCancelled?.()) {
        await Promise.all([
          this.queueService.removeJob(QUEUE_NAMES.SFDMU_RUN, job.id).catch(() => false),
          this.jobsService.updateStatus(job.id, 'cancelled', 'Workbench run cancelled'),
          prisma.dataMovement.update({
            where: { id: movement.id },
            data: { status: 'cancelled' },
          }),
        ]);
        throw new Error('Chained data deployment cancelled');
      }

      jobIds.push(job.id);
      await options.onLog(`Queued data deploy for ${cfg.objectName} (job ${job.id})`);
      return job.id;
    };

    if (options.sequential !== false) {
      for (const cfg of configs) {
        const id = await enqueueOne(cfg);
        if (options.awaitTerminal) {
          const terminal = await this.awaitJob(id, options.timeoutMs, options.isCancelled);
          await options.onLog(`Data deploy ${id} finished with ${terminal.status}`);
          if (terminal.status !== 'completed' && options.stopOnError !== false) {
            throw new Error(`Chained data deploy ${id} ${terminal.status}: ${terminal.error ?? 'unknown error'}`);
          }
        }
      }
    } else {
      const ids = await Promise.all(configs.map(enqueueOne));
      if (options.awaitTerminal) {
        const outcomes = await Promise.all(
          ids.map((id) => this.awaitJob(id, options.timeoutMs, options.isCancelled)),
        );
        const failed = outcomes.find((outcome) => outcome.status !== 'completed');
        if (failed && options.stopOnError !== false) {
          throw new Error(`Chained data deploy ${failed.id} ${failed.status}: ${failed.error ?? 'unknown error'}`);
        }
      }
    }

    return jobIds;
  }

  private async awaitJob(
    id: string,
    timeoutMs = 30 * 60_000,
    isCancelled?: () => Promise<boolean>,
  ) {
    const deadline = Date.now() + Math.min(Math.max(timeoutMs, 1_000), 24 * 60 * 60_000);
    for (;;) {
      const job = await prisma.job.findUnique({
        where: { id },
        select: { id: true, status: true, error: true },
      });
      if (!job) throw new Error(`Chained data job ${id} disappeared`);
      if (['completed', 'partial', 'failed', 'cancelled'].includes(job.status)) return job;
      if (await isCancelled?.()) {
        return { ...job, status: 'cancelled', error: 'Workbench run cancelled' };
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for chained data job ${id}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
