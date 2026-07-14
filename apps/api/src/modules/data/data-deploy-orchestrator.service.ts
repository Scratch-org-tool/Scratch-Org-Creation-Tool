import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { prisma, Prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  DATA_DEPLOY_CHUNK_SIZE,
  planDataDeployChunks,
  buildIdOnlySoql,
  buildIdRangeChunkSoql,
  computeChunkBoundaries,
  stripLimitOffset,
  buildGenericDeployQuery,
  extractLimitFromSoql,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { generateSfdmuConfigFromSoql } from './sfdmu-config.generator';
import { BulkThrottleService } from './bulk-throttle.service';
import { assertResourceOwner } from '../../common/user-tenancy.util';
import { ACTIVE_CHUNK_STATUSES, aggregateBatchStatus, countChunkStatuses } from './batch-status.util';

export type DataDeployStrategy = 'generic' | 'insert' | 'upsert' | 'replicate';

export interface CreateDataDeployBatchInput {
  sourceOrgId: string;
  targetOrgId: string;
  objectName: string;
  baseSoql: string;
  recordLimit: number;
  strategy: DataDeployStrategy;
  movementType: string;
  userId: string;
  matchField?: string;
  recordTypeMappings?: Record<string, string>;
  externalId?: string;
  groupId?: string;
}

function resolveOrgTarget(org: { alias: string; username?: string | null }): string {
  return org.username ?? org.alias;
}

/**
 * Orchestrates chunked ("load balanced") data deploys.
 *
 * Large deploys are split into Id-range chunks. Because Salesforce caps SOQL
 * OFFSET at 2,000, chunk boundaries are computed by a planner job that exports
 * the ordered Id set once, then every chunk runs as an independent, retryable
 * queue job bounded by `Id > afterId AND Id <= endId`.
 */
@Injectable()
export class DataDeployOrchestratorService {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly bulkThrottle: BulkThrottleService,
  ) {}

  chunkSize(): number {
    const parsed = parseInt(process.env.DATA_DEPLOY_CHUNK_SIZE ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DATA_DEPLOY_CHUNK_SIZE;
  }

  async getBatch(id: string, userId: string) {
    const batch = await prisma.dataDeployBatch.findUnique({
      where: { id },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' } },
        sourceOrg: { select: { alias: true, username: true } },
        targetOrg: { select: { alias: true, username: true } },
      },
    });
    if (!batch) throw new NotFoundException('Data deploy batch not found');
    assertResourceOwner(batch, userId, 'Data deploy batch');
    return batch;
  }

  async createBatch(input: CreateDataDeployBatchInput) {
    const chunkSize = this.chunkSize();
    const plans = planDataDeployChunks(input.baseSoql, input.recordLimit, chunkSize);

    const [source, target] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } }),
    ]);
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    const { batch, deployments } = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.dataDeployBatch.create({
        data: {
          groupId: input.groupId,
          sourceOrgId: input.sourceOrgId,
          targetOrgId: input.targetOrgId,
          objectName: input.objectName,
          strategy: input.strategy,
          movementType: input.movementType,
          status: 'planning',
          baseSoql: input.baseSoql,
          matchField: input.matchField ?? input.externalId,
          recordTypeMappings: input.recordTypeMappings as Prisma.InputJsonValue | undefined,
          totalRecords: input.recordLimit,
          chunkSize,
          totalChunks: plans.length,
          createdBy: input.userId,
        },
      });

      const created: Array<{ chunkIndex: number; chunkId: string; movementId: string }> = [];
      for (const plan of plans) {
        const movement = await tx.dataMovement.create({
          data: {
            sourceOrgId: input.sourceOrgId,
            targetOrgId: input.targetOrgId,
            objectName: input.objectName,
            soql: plan.soql,
            movementType: input.movementType,
            status: 'pending',
            batchId: createdBatch.id,
            chunkIndex: plan.chunkIndex,
            recordTypeMappings: input.recordTypeMappings as Prisma.InputJsonValue | undefined,
            createdBy: input.userId,
          },
        });
        const chunk = await tx.dataDeployChunk.create({
          data: {
            batchId: createdBatch.id,
            chunkIndex: plan.chunkIndex,
            soql: plan.soql,
            movementId: movement.id,
            status: 'pending',
          },
        });
        created.push({ chunkIndex: plan.chunkIndex, chunkId: chunk.id, movementId: movement.id });
      }
      return { batch: createdBatch, deployments: created };
    });

    const plannerJob = await this.orchestrator.enqueueJob(
      QUEUE_NAMES.DATA_DEPLOY,
      'data_deploy_plan',
      {
        batchId: batch.id,
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: input.objectName,
      },
      { createdBy: input.userId },
    );

    return {
      batchId: batch.id,
      totalChunks: plans.length,
      chunkSize,
      deployments: deployments.map((d) => ({ ...d, jobId: plannerJob.id })),
      plannerJobId: plannerJob.id,
      status: 'queued' as const,
      message: `Load-balanced deploy queued as ${plans.length} chunk(s) of up to ${chunkSize.toLocaleString()} records`,
    };
  }

  /**
   * Planner job: exports the ordered Id set once, resolves per-chunk Id ranges,
   * then enqueues every chunk as an independent queue job.
   */
  async planBatch(batchId: string, log: (stream: 'stdout' | 'stderr', line: string) => Promise<void>) {
    const batch = await prisma.dataDeployBatch.findUnique({
      where: { id: batchId },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' } },
        sourceOrg: true,
        targetOrg: true,
      },
    });
    if (!batch) throw new Error(`Data deploy batch ${batchId} not found`);
    if (!['planning', 'queued'].includes(batch.status)) {
      await log('stdout', `Batch ${batchId} already ${batch.status} — skipping plan`);
      return { batchId, skipped: true };
    }
    if (!batch.baseSoql) throw new Error('Batch is missing its base SOQL');

    const sourceAlias = resolveOrgTarget(batch.sourceOrg);
    const idSoql = buildIdOnlySoql(batch.baseSoql, batch.totalRecords);
    const workDir = join(tmpdir(), 'sfcc-data-deploy', `plan-${batchId}`);
    const idCsvPath = join(workDir, 'chunk-ids.csv');

    try {
      await mkdir(workDir, { recursive: true });
      await log('stdout', `Planning ${batch.totalChunks} chunk(s) for ${batch.objectName ?? 'object'}`);
      await log('stdout', `Boundary query: ${idSoql}`);

      const slot = await this.bulkThrottle.acquire(sourceAlias);
      let exportResult;
      try {
        exportResult = await this.sfCli.exportBulk(idSoql, sourceAlias, idCsvPath, 30, { cwd: workDir });
      } finally {
        await slot.release();
      }
      if (!exportResult.success) {
        throw new Error(exportResult.error ?? 'Chunk boundary export failed');
      }

      const ids = await this.readIdColumn(idCsvPath, batch.totalRecords);
      await log('stdout', `Found ${ids.length} record(s) to deploy`);

      if (ids.length === 0) {
        await prisma.dataDeployChunk.updateMany({
          where: { batchId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
          data: { status: 'cancelled', error: 'No records matched the deploy query' },
        });
        await prisma.dataMovement.updateMany({
          where: { batchId },
          data: { status: 'cancelled' },
        });
        await prisma.dataDeployBatch.update({
          where: { id: batchId },
          data: { status: 'completed', totalChunks: 0, completedChunks: 0 },
        });
        return { batchId, totalChunks: 0 };
      }

      const boundaries = computeChunkBoundaries(ids, batch.chunkSize);

      // Drop chunks planned for records that do not exist.
      const extraChunks = batch.chunks.filter((c) => c.chunkIndex >= boundaries.length);
      if (extraChunks.length > 0) {
        await prisma.dataDeployChunk.updateMany({
          where: { id: { in: extraChunks.map((c) => c.id) } },
          data: { status: 'cancelled', error: 'Chunk not needed — fewer records than requested limit' },
        });
        await prisma.dataMovement.updateMany({
          where: { id: { in: extraChunks.map((c) => c.movementId).filter((v): v is string => Boolean(v)) } },
          data: { status: 'cancelled' },
        });
      }

      await prisma.dataDeployBatch.update({
        where: { id: batchId },
        data: { status: 'running', totalChunks: boundaries.length, totalRecords: ids.length },
      });

      for (const boundary of boundaries) {
        const chunk = batch.chunks.find((c) => c.chunkIndex === boundary.chunkIndex);
        if (!chunk) continue;
        const chunkSoql = buildIdRangeChunkSoql(batch.baseSoql, boundary.recordCount, {
          afterId: boundary.afterId,
          endId: boundary.endId,
        });
        await prisma.dataDeployChunk.update({
          where: { id: chunk.id },
          data: {
            soql: chunkSoql,
            afterId: boundary.afterId,
            endId: boundary.endId,
            status: 'queued',
          },
        });
        if (chunk.movementId) {
          await prisma.dataMovement.update({
            where: { id: chunk.movementId },
            data: { soql: chunkSoql, status: 'queued' },
          });
        }
        await this.enqueueChunkJob(batch, {
          chunkId: chunk.id,
          chunkIndex: boundary.chunkIndex,
          movementId: chunk.movementId,
          soql: chunkSoql,
          recordCount: boundary.recordCount,
        });
        await log('stdout', `Chunk ${boundary.chunkIndex + 1}/${boundaries.length} queued (${boundary.recordCount} records)`);
      }

      return { batchId, totalChunks: boundaries.length, totalRecords: ids.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await log('stderr', `Batch planning failed: ${message}`);
      await prisma.dataDeployChunk.updateMany({
        where: { batchId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
        data: { status: 'failed', error: `Planning failed: ${message}` },
      });
      await prisma.dataMovement.updateMany({
        where: { batchId, status: { in: ['pending', 'queued', 'running'] } },
        data: { status: 'failed' },
      });
      await prisma.dataDeployBatch.update({
        where: { id: batchId },
        data: { status: 'failed', error: message },
      });
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async enqueueChunkJob(
    batch: {
      id: string;
      strategy: string;
      objectName: string | null;
      matchField: string | null;
      recordTypeMappings: Prisma.JsonValue;
      createdBy: string;
      sourceOrgId: string;
      targetOrgId: string;
      movementType: string;
      sourceOrg: { alias: string; username: string | null };
      targetOrg: { alias: string; username: string | null };
    },
    chunk: {
      chunkId: string;
      chunkIndex: number;
      movementId: string | null;
      soql: string;
      recordCount: number;
    },
  ) {
    const sourceAlias = resolveOrgTarget(batch.sourceOrg);
    const targetAlias = resolveOrgTarget(batch.targetOrg);
    const recordTypeMappings = (batch.recordTypeMappings ?? undefined) as
      | Record<string, string>
      | undefined;

    let job;
    if (batch.strategy === 'upsert' || batch.strategy === 'replicate') {
      const generated = generateSfdmuConfigFromSoql({
        runId: chunk.movementId ?? chunk.chunkId,
        sourceOrgAlias: sourceAlias,
        targetOrgAlias: targetAlias,
        objectName: batch.objectName ?? 'Unknown',
        soql: chunk.soql,
        externalId: batch.matchField ?? 'Name',
        recordTypeMappings,
      });

      if (chunk.movementId) {
        await prisma.dataMovement.update({
          where: { id: chunk.movementId },
          data: {
            sfdmuConfig: {
              configPath: generated.configPath,
              strategy: batch.strategy,
              matchField: batch.matchField ?? 'Name',
              batchId: batch.id,
              chunkIndex: chunk.chunkIndex,
            } as Prisma.InputJsonValue,
          },
        });
      }

      job = await this.orchestrator.enqueueJob(
        QUEUE_NAMES.SFDMU_RUN,
        batch.strategy === 'replicate' ? 'data_replication_chunk' : 'org_to_org_data_deploy_chunk',
        {
          sourceOrgAlias: sourceAlias,
          targetOrgAlias: targetAlias,
          configPath: generated.configPath,
          movementId: chunk.movementId,
          chunkId: chunk.chunkId,
          batchId: batch.id,
          chunkIndex: chunk.chunkIndex,
          chunkRecordCount: chunk.recordCount,
        },
        { createdBy: batch.createdBy },
      );
    } else {
      job = await this.orchestrator.enqueueJob(
        QUEUE_NAMES.DATA_DEPLOY,
        'data_deploy_chunk',
        {
          sourceOrgId: batch.sourceOrgId,
          targetOrgId: batch.targetOrgId,
          objectName: batch.objectName,
          soql: chunk.soql,
          recordLimit: chunk.recordCount,
          movementId: chunk.movementId,
          chunkId: chunk.chunkId,
          batchId: batch.id,
          chunkIndex: chunk.chunkIndex,
          // Upsert-by-external-Id when configured so chunk retries are idempotent.
          externalIdField: batch.matchField ?? undefined,
        },
        { createdBy: batch.createdBy },
      );
    }

    await prisma.dataDeployChunk.update({
      where: { id: chunk.chunkId },
      data: { jobId: job.id },
    });
    return job;
  }

  private async readIdColumn(csvPath: string, maxIds: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const ids: string[] = [];
      let headerSeen = false;
      const stream = createReadStream(csvPath, { encoding: 'utf-8' });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      rl.on('line', (line) => {
        if (!headerSeen) {
          headerSeen = true;
          return;
        }
        if (!line.trim() || ids.length >= maxIds) return;
        const id = line.split(',')[0]?.trim().replace(/^"|"$/g, '');
        if (id) ids.push(id);
      });
      rl.on('close', () => resolve(ids));
      rl.on('error', reject);
      stream.on('error', reject);
    });
  }

  /** Idempotent: only transitions chunks that are not already terminal. */
  async onChunkCompleted(chunkId: string, recordCount?: number) {
    const transitioned = await prisma.dataDeployChunk.updateMany({
      where: { id: chunkId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
      data: {
        status: 'completed',
        ...(recordCount != null ? { recordCount } : {}),
        error: null,
      },
    });
    if (transitioned.count === 0) return;

    const chunk = await prisma.dataDeployChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) return;

    if (chunk.movementId) {
      await prisma.dataMovement.update({
        where: { id: chunk.movementId },
        data: { status: 'completed', recordCount: recordCount ?? undefined },
      }).catch(() => undefined);
    }

    await this.refreshBatchProgress(chunk.batchId);
  }

  /** Idempotent: only transitions chunks that are not already terminal. */
  async onChunkFailed(chunkId: string, error: string) {
    const transitioned = await prisma.dataDeployChunk.updateMany({
      where: { id: chunkId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
      data: { status: 'failed', error },
    });
    if (transitioned.count === 0) return;

    const chunk = await prisma.dataDeployChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) return;

    if (chunk.movementId) {
      await prisma.dataMovement.update({
        where: { id: chunk.movementId },
        data: { status: 'failed' },
      }).catch(() => undefined);
    }

    await this.refreshBatchProgress(chunk.batchId);
  }

  /** Recompute batch counters/status from chunk rows (drift-proof). */
  async refreshBatchProgress(batchId: string) {
    const grouped = await prisma.dataDeployChunk.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });
    const counts = countChunkStatuses(
      grouped.map((g) => [g.status, g._count._all] as [string, number]),
    );
    const status = aggregateBatchStatus(counts);
    const { completed, failed } = counts;

    await prisma.dataDeployBatch.update({
      where: { id: batchId },
      data: {
        completedChunks: completed,
        failedChunks: failed,
        status,
        ...(status === 'partial'
          ? { error: `${failed} of ${completed + failed} chunk(s) failed — retry failed chunks to complete the deploy` }
          : {}),
      },
    }).catch(() => undefined);
  }

  /** Re-enqueue a single failed/cancelled chunk (resumable deploys). */
  async retryChunk(batchId: string, chunkId: string, userId: string) {
    const batch = await prisma.dataDeployBatch.findUnique({
      where: { id: batchId },
      include: { sourceOrg: true, targetOrg: true },
    });
    if (!batch) throw new NotFoundException('Data deploy batch not found');
    assertResourceOwner(batch, userId, 'Data deploy batch');

    const chunk = await prisma.dataDeployChunk.findUnique({ where: { id: chunkId } });
    if (!chunk || chunk.batchId !== batchId) throw new NotFoundException('Chunk not found');
    if (!['failed', 'cancelled'].includes(chunk.status)) {
      throw new BadRequestException(`Chunk is ${chunk.status} — only failed or cancelled chunks can be retried`);
    }
    if (!chunk.endId && chunk.chunkIndex > 0) {
      throw new BadRequestException('Chunk bounds were never planned — retry the whole deploy instead');
    }

    await prisma.dataDeployChunk.update({
      where: { id: chunkId },
      data: { status: 'queued', error: null, attempts: { increment: 1 } },
    });
    if (chunk.movementId) {
      await prisma.dataMovement.update({
        where: { id: chunk.movementId },
        data: { status: 'queued' },
      }).catch(() => undefined);
    }

    const job = await this.enqueueChunkJob(batch, {
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      movementId: chunk.movementId,
      soql: chunk.soql,
      recordCount: chunk.recordCount ?? batch.chunkSize,
    });

    await prisma.dataDeployBatch.update({
      where: { id: batchId },
      data: { status: 'running' },
    });

    return { batchId, chunkId, jobId: job.id, status: 'queued' as const };
  }

  /** Re-enqueue all failed chunks in a batch. */
  async retryFailedChunks(batchId: string, userId: string) {
    const batch = await this.getBatch(batchId, userId);
    const failed = batch.chunks.filter((c) => c.status === 'failed');
    if (failed.length === 0) {
      throw new BadRequestException('No failed chunks to retry');
    }
    const retried: Array<{ chunkId: string; jobId: string }> = [];
    for (const chunk of failed) {
      const result = await this.retryChunk(batchId, chunk.id, userId);
      retried.push({ chunkId: chunk.id, jobId: result.jobId });
    }
    return { batchId, retried, count: retried.length };
  }

  /** Progress for every batch in a multi-object deploy group. */
  async getBatchGroup(groupId: string, userId: string) {
    const batches = await prisma.dataDeployBatch.findMany({
      where: { groupId, createdBy: userId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    if (batches.length === 0) throw new NotFoundException('Deploy group not found');
    return { groupId, batches };
  }

  resolveBaseSoql(soql: string | undefined, objectName: string): string {
    if (soql?.trim()) {
      return stripLimitOffset(soql.trim().replace(/;+\s*$/, ''));
    }
    return `SELECT Id FROM ${objectName}`;
  }

  resolveRecordLimit(
    soql: string | undefined,
    recordLimit?: number,
    fallback = 200,
  ): number {
    return recordLimit ?? extractLimitFromSoql(soql ?? '') ?? fallback;
  }

  shouldChunk(recordLimit: number): boolean {
    return recordLimit > this.chunkSize();
  }

  buildResolvedSoql(input: {
    soql?: string;
    objectName: string;
    recordLimit?: number;
  }): string {
    return buildGenericDeployQuery({
      soql: input.soql,
      objectName: input.objectName,
      recordLimit: input.recordLimit,
    });
  }
}
