import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { QUEUE_NAMES } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { generateSfdmuConfigFromSoql } from '../data/sfdmu-config.generator';

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
    createdBy?: string;
    onLog: (line: string) => Promise<void>;
  }): Promise<string[]> {
    const [source, target] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: options.sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: options.targetOrgId } }),
    ]);
    if (!source || !target) throw new Error('Source or target org not found for data chain');

    const sourceAlias = source.username ?? source.alias;
    const targetAlias = target.username ?? target.alias;
    const jobIds: string[] = [];

    await options.onLog(`Starting chained data deploy for ${options.dataDeployConfig.length} object(s)...`);

    for (const cfg of options.dataDeployConfig) {
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
        },
      });

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
        },
        parentRunId: options.automationRunId,
        createdBy: options.createdBy,
      });

      await this.queueService.addJob(
        QUEUE_NAMES.SFDMU_RUN,
        'org_to_org_data_deploy',
        {
          sourceOrgAlias: sourceAlias,
          targetOrgAlias: targetAlias,
          configPath: generated.configPath,
          movementId: movement.id,
          dbJobId: job.id,
        },
        job.id,
      );

      jobIds.push(job.id);
      await options.onLog(`Queued data deploy for ${cfg.objectName} (job ${job.id})`);
    }

    return jobIds;
  }
}
