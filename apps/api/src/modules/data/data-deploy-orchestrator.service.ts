import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { mkdir, rm } from 'fs/promises';
import { randomUUID } from 'node:crypto';
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
  dataChunkReleaseCount,
  resolveMaxParallelDataChunks,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { generateSfdmuConfigFromSoql } from './sfdmu-config.generator';
import { BulkThrottleService } from './bulk-throttle.service';
import { assertResourceOwner } from '../../common/user-tenancy.util';
import { ACTIVE_CHUNK_STATUSES, aggregateBatchStatus, countChunkStatuses } from './batch-status.util';
import { isSafeIdempotentUpsertRetry } from './retry-safety.util';
import { QueueService } from '../queue/queue.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';

export type DataDeployStrategy = 'generic' | 'insert' | 'upsert' | 'replicate';

export interface CreateDataDeployBatchInput {
  sourceOrgId: string;
  targetOrgId: string;
  objectName: string;
  baseSoql: string;
  recordLimit: number;
  strategy: DataDeployStrategy;
  operation: 'insert' | 'upsert';
  movementType: string;
  userId: string;
  matchField?: string;
  recordTypeMappings?: Record<string, string>;
  externalId?: string;
  groupId?: string;
  objectKey?: string;
  dependsOn?: string[];
  deferStart?: boolean;
  maxParallelChunks?: number;
  quotaRemaining?: number | null;
  quotaConfidence?: 'known' | 'unknown';
  rollbackPolicy?: 'none' | 'capture';
}

type DataChunkBoundary = {
  chunkIndex: number;
  afterId: string | null;
  endId: string;
  recordCount: number;
};

const BLOCKED_BY_PREREQUISITE_PREFIX = 'Blocked by failed prerequisite: ';

export class ChunkPublicationError extends Error {
  constructor(
    message: string,
    readonly recoverable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ChunkPublicationError';
  }
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
export class DataDeployOrchestratorService implements OnModuleInit {
  private readonly sfCli = createSfCliClient();
  private readonly logger = new Logger(DataDeployOrchestratorService.name);

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly bulkThrottle: BulkThrottleService,
    private readonly queue: QueueService,
    private readonly processRegistry: JobProcessRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.recoverStrandedChunkPublications();
    } catch (error) {
      this.logger.error(
        `Could not recover stranded data chunk publications: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

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

  async cancelMovement(id: string, userId: string) {
    const movement = await prisma.dataMovement.findUnique({
      where: { id },
      select: {
        id: true,
        createdBy: true,
        status: true,
        batchId: true,
        movementType: true,
      },
    });
    if (!movement) throw new NotFoundException('Data movement not found');
    assertResourceOwner(movement, userId, 'Data movement');
    if (movement.batchId) {
      throw new BadRequestException('Batched movements must be cancelled through their deploy batch');
    }

    const jobs = await prisma.job.findMany({
      where: {
        createdBy: userId,
        queue: { in: [QUEUE_NAMES.DATA_DEPLOY, QUEUE_NAMES.SFDMU_RUN] },
        payload: { path: ['movementId'], equals: id },
      },
      select: { id: true, queue: true },
    });
    const activeStatuses = ['pending', 'queued', 'planning', 'running', 'paused'] as const;
    const now = new Date();
    const changed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.dataMovement.updateMany({
        where: { id, createdBy: userId, status: { in: [...activeStatuses] } },
        data: { status: 'cancelled' },
      });
      if (jobs.length) {
        await tx.job.updateMany({
          where: { id: { in: jobs.map((job) => job.id) }, status: { in: [...activeStatuses] } },
          data: {
            status: 'cancelled',
            currentStep: 'Cancelled',
            error: 'Cancelled by user',
            finishedAt: now,
          },
        });
      }
      return claimed.count > 0;
    });

    // Re-broadcast even for an idempotent repeat: a previous API process may
    // have committed cancellation and died before removing/killing the job.
    for (const job of jobs) {
      await this.queue.removeJob(job.queue, job.id).catch(() => false);
      await this.processRegistry.cancel(job.id);
    }
    return {
      movementId: id,
      status: changed ? 'cancelled' : movement.status,
      cancelled: changed || movement.status === 'cancelled',
      idempotent: !changed,
      cancelledJobs: jobs.length,
    };
  }

  async cancelBatch(id: string, userId: string) {
    const owned = await prisma.dataDeployBatch.findUnique({
      where: { id },
      select: { id: true, createdBy: true, status: true },
    });
    if (!owned) throw new NotFoundException('Data deploy batch not found');
    assertResourceOwner(owned, userId, 'Data deploy batch');

    const cancellation = await this.withCancellationLock(id, async () => {
      const batch = await prisma.dataDeployBatch.findUnique({
        where: { id },
        include: { chunks: { select: { jobId: true } } },
      });
      if (!batch) throw new NotFoundException('Data deploy batch not found');
      assertResourceOwner(batch, userId, 'Data deploy batch');
      if (['completed', 'partial', 'failed'].includes(batch.status)) {
        return { status: batch.status, changed: false, jobs: [] as Array<{ id: string; queue: string }> };
      }

      const chunkJobIds = new Set(
        batch.chunks.map((chunk) => chunk.jobId).filter((id): id is string => Boolean(id)),
      );
      const jobs = await prisma.job.findMany({
        where: {
          createdBy: userId,
          queue: { in: [QUEUE_NAMES.DATA_DEPLOY, QUEUE_NAMES.SFDMU_RUN] },
          OR: [
            { id: { in: [...chunkJobIds] } },
            { payload: { path: ['batchId'], equals: id } },
          ],
        },
        select: { id: true, queue: true },
      });
      const now = new Date();
      const activeStatuses = ['pending', 'queued', 'planning', 'running', 'paused'] as const;
      const changed = await prisma.$transaction(async (tx) => {
        const claimed = await tx.dataDeployBatch.updateMany({
          where: { id, createdBy: userId, status: { in: [...activeStatuses] } },
          data: { status: 'cancelled', error: 'Cancelled by user' },
        });
        await tx.dataDeployChunk.updateMany({
          where: { batchId: id, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
          data: { status: 'cancelled', error: 'Cancelled by user' },
        });
        await tx.dataMovement.updateMany({
          where: { batchId: id, status: { in: [...activeStatuses] } },
          data: { status: 'cancelled' },
        });
        if (jobs.length) {
          await tx.job.updateMany({
            where: { id: { in: jobs.map((job) => job.id) }, status: { in: [...activeStatuses] } },
            data: {
              status: 'cancelled',
              currentStep: 'Cancelled',
              error: 'Cancelled by user',
              finishedAt: now,
            },
          });
        }
        return claimed.count > 0;
      });
      return { status: 'cancelled', changed, jobs };
    });

    for (const job of cancellation.jobs) {
      await this.queue.removeJob(job.queue, job.id).catch(() => false);
      await this.processRegistry.cancel(job.id);
    }
    await this.refreshBatchProgress(id);
    const refreshed = await prisma.dataDeployBatch.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        completedChunks: true,
        failedChunks: true,
        totalChunks: true,
      },
    });
    return {
      ...refreshed,
      cancelled: cancellation.status === 'cancelled',
      idempotent: !cancellation.changed,
      cancelledJobs: cancellation.jobs.length,
    };
  }

  async cancelBatchGroup(groupId: string, userId: string) {
    const batches = await prisma.dataDeployBatch.findMany({
      where: { groupId },
      select: { id: true, createdBy: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!batches.length || batches.some((batch) => batch.createdBy !== userId)) {
      throw new NotFoundException('Deploy group not found');
    }
    const results = [];
    for (const batch of batches) results.push(await this.cancelBatch(batch.id, userId));
    return {
      groupId,
      cancelled: results.filter((result) => result.cancelled).length,
      batches: results,
    };
  }

  async createBatch(input: CreateDataDeployBatchInput) {
    const chunkSize = this.chunkSize();
    const plans = planDataDeployChunks(input.baseSoql, input.recordLimit, chunkSize);
    const externalIdField = input.matchField ?? input.externalId;
    const maxParallelChunks = resolveMaxParallelDataChunks(
      input.maxParallelChunks
      ?? Number.parseInt(process.env.DATA_DEPLOY_MAX_PARALLEL_CHUNKS ?? '', 10),
    );

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
          objectKey: input.objectKey ?? input.objectName,
          dependsOn: input.dependsOn ?? [],
          strategy: input.strategy,
          operation: input.operation,
          externalIdField,
          idempotent: input.operation === 'upsert',
          movementType: input.movementType,
          status: input.deferStart ? 'pending' : 'planning',
          baseSoql: input.baseSoql,
          matchField: externalIdField,
          recordTypeMappings: input.recordTypeMappings as Prisma.InputJsonValue | undefined,
          requestedRecords: input.recordLimit,
          totalRecords: input.recordLimit,
          chunkSize,
          totalChunks: plans.length,
          maxParallelChunks,
          quotaRemaining: input.quotaRemaining,
          quotaConfidence: input.quotaConfidence ?? 'unknown',
          rollbackPolicy: input.rollbackPolicy ?? 'none',
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
            operation: input.operation,
            externalIdField,
            idempotent: input.operation === 'upsert',
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

    const plannerJob = input.deferStart
      ? null
      : await this.enqueueAndTrackPlanner(batch.id, input.userId);

    return {
      batchId: batch.id,
      totalChunks: plans.length,
      chunkSize,
      operation: input.operation,
      externalIdField,
      idempotent: input.operation === 'upsert',
      deployments: deployments.map((d) => ({ ...d, jobId: plannerJob?.id })),
      plannerJobId: plannerJob?.id,
      status: input.deferStart ? 'pending' as const : 'queued' as const,
      message: `Load-balanced deploy queued as ${plans.length} chunk(s) of up to ${chunkSize.toLocaleString()} records`,
    };
  }

  private async enqueuePlanner(batchId: string, createdBy: string) {
    return this.orchestrator.enqueueJob(
      QUEUE_NAMES.DATA_DEPLOY,
      'data_deploy_plan',
      { batchId },
      { createdBy },
    );
  }

  private async enqueueAndTrackPlanner(batchId: string, createdBy: string) {
    const plannerJob = await this.enqueuePlanner(batchId, createdBy);
    await prisma.dataDeployBatch.update({
      where: { id: batchId },
      data: { plannerJobId: plannerJob.id },
    });
    return plannerJob;
  }

  async startBatch(batchId: string) {
    const batch = await prisma.dataDeployBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Data deploy batch not found');
    const claimed = await prisma.dataDeployBatch.updateMany({
      where: { id: batchId, status: 'pending' },
      data: { status: 'planning' },
    });
    if (claimed.count === 0) return null;
    try {
      return await this.enqueueAndTrackPlanner(batchId, batch.createdBy);
    } catch (error) {
      await prisma.dataDeployBatch.update({
        where: { id: batchId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * Planner job: exports the ordered Id set once, resolves per-chunk Id ranges,
   * then enqueues every chunk as an independent queue job.
   */
  async planBatch(
    batchId: string,
    log: (stream: 'stdout' | 'stderr', line: string) => Promise<void>,
    dbJobId?: string,
  ) {
    const batch = await prisma.dataDeployBatch.findUnique({
      where: { id: batchId },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' } },
        sourceOrg: true,
        targetOrg: true,
      },
    });
    if (!batch) throw new Error(`Data deploy batch ${batchId} not found`);
    if (!['planning', 'queued', 'running'].includes(batch.status)) {
      await log('stdout', `Batch ${batchId} already ${batch.status} — skipping plan`);
      return { batchId, skipped: true };
    }
    if (!batch.baseSoql) throw new Error('Batch is missing its base SOQL');

    const sourceAlias = resolveOrgTarget(batch.sourceOrg);
    const idSoql = buildIdOnlySoql(batch.baseSoql, batch.totalRecords);
    const workDir = join(tmpdir(), 'sfcc-data-deploy', `plan-${batchId}`);
    const idCsvPath = join(workDir, 'chunk-ids.csv');

    try {
      const savedBoundaries = this.readBoundaryArtifact(batch.boundaryArtifact);
      if (savedBoundaries) {
        await log('stdout', `Resuming ${savedBoundaries.length} persisted chunk boundary/boundaries`);
        const activated = await this.activateChunkBoundaries(
          batchId,
          batch.baseSoql,
          idSoql,
          savedBoundaries,
          batch.totalRecords,
          true,
        );
        if (!activated) return { batchId, cancelled: true };
        const released = await this.releaseReadyChunks(batchId);
        await log('stdout', `Released ${released} resumed chunk(s)`);
        return {
          batchId,
          totalChunks: savedBoundaries.length,
          totalRecords: savedBoundaries.reduce((sum, boundary) => sum + boundary.recordCount, 0),
          resumed: true,
        };
      }
      if (batch.status === 'running') {
        throw new Error('Running batch is missing a valid boundary artifact and cannot be safely replanned');
      }

      await mkdir(workDir, { recursive: true });
      await log('stdout', `Planning ${batch.totalChunks} chunk(s) for ${batch.objectName ?? 'object'}`);
      await log('stdout', `Boundary query: ${idSoql}`);

      const slot = await this.bulkThrottle.acquire(sourceAlias);
      let exportResult;
      try {
        exportResult = await this.sfCli.exportBulk(idSoql, sourceAlias, idCsvPath, 30, {
          cwd: workDir,
          ...(dbJobId ? {
            onSpawn: (proc) => {
              this.processRegistry.register(dbJobId, () => proc.kill('SIGTERM'));
            },
          } : {}),
        });
      } finally {
        await slot.release();
      }
      if (await this.isBatchCancellationRequested(batchId, dbJobId)) {
        await log('stderr', 'Batch planning cancelled by user');
        return { batchId, cancelled: true };
      }
      if (!exportResult.success) {
        throw new Error(exportResult.error ?? 'Chunk boundary export failed');
      }

      const ids = await this.readIdColumn(idCsvPath, batch.totalRecords);
      await log('stdout', `Found ${ids.length} record(s) to deploy`);

      if (ids.length === 0) {
        await prisma.dataDeployBatch.update({
          where: { id: batchId },
          data: { totalRecords: 0 },
        });
        throw new Error('No source records matched the deploy query; no records were written');
      }

      const boundaries = computeChunkBoundaries(ids, batch.chunkSize);
      const activated = await this.activateChunkBoundaries(
        batchId,
        batch.baseSoql,
        idSoql,
        boundaries,
        ids.length,
      );
      if (!activated) {
        await log('stderr', 'Batch planning stopped before chunk release');
        return { batchId, cancelled: true };
      }

      for (const boundary of boundaries) {
        await log('stdout', `Chunk ${boundary.chunkIndex + 1}/${boundaries.length} planned (${boundary.recordCount} records)`);
      }

      const released = await this.releaseReadyChunks(batchId);
      await log('stdout', `Released ${released} chunk(s); remaining chunks wait for scheduler capacity`);

      return { batchId, totalChunks: boundaries.length, totalRecords: ids.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (await this.isBatchCancellationRequested(batchId, dbJobId)) {
        await log('stderr', 'Batch planning cancelled by user');
        return { batchId, cancelled: true };
      }
      const publicationError = error instanceof ChunkPublicationError;
      if (publicationError && error.recoverable) {
        await log(
          'stderr',
          `Batch publication is recoverable and will resume from its pending or claimed state: ${message}`,
        );
        throw error;
      }
      const phase = publicationError ? 'Publication' : 'Planning';
      await log('stderr', `Batch ${phase.toLowerCase()} failed: ${message}`);
      await prisma.dataDeployChunk.updateMany({
        where: { batchId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
        data: { status: 'failed', error: `${phase} failed: ${message}` },
      });
      await prisma.dataMovement.updateMany({
        where: { batchId, status: { in: ['pending', 'queued', 'running'] } },
        data: { status: 'failed' },
      });
      await prisma.dataDeployBatch.update({
        where: { id: batchId },
        data: { status: 'failed', error: `${phase} failed: ${message}` },
      });
      throw error;
    } finally {
      if (dbJobId) this.processRegistry.clear(dbJobId);
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private readBoundaryArtifact(value: Prisma.JsonValue): DataChunkBoundary[] | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const boundaries = (value as Record<string, unknown>).boundaries;
    if (!Array.isArray(boundaries) || boundaries.length === 0) return null;
    const valid = boundaries.every((boundary) => {
      if (!boundary || typeof boundary !== 'object' || Array.isArray(boundary)) return false;
      const item = boundary as Record<string, unknown>;
      return Number.isInteger(item.chunkIndex)
        && (item.afterId === null || typeof item.afterId === 'string')
        && typeof item.endId === 'string'
        && Number.isInteger(item.recordCount)
        && Number(item.recordCount) > 0;
    });
    return valid ? boundaries as DataChunkBoundary[] : null;
  }

  /**
   * Persist every bound and its movement query in the same transaction that
   * publishes the boundary artifact and running state. A planner crash can
   * therefore leave either an entirely plannable batch or an entirely
   * resumable batch, never a running batch with placeholder chunks.
   */
  private async activateChunkBoundaries(
    batchId: string,
    baseSoql: string,
    plannerQuery: string,
    boundaries: DataChunkBoundary[],
    totalRecords: number,
    resume = false,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.dataDeployBatch.findUnique({
        where: { id: batchId },
        include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
      });
      const allowedStatuses = resume ? ['planning', 'queued', 'running'] : ['planning', 'queued'];
      if (!current || !allowedStatuses.includes(current.status)) return false;

      const byIndex = new Map(current.chunks.map((chunk) => [chunk.chunkIndex, chunk]));
      for (const boundary of boundaries) {
        const chunk = byIndex.get(boundary.chunkIndex);
        if (!chunk) throw new Error(`Missing chunk placeholder ${boundary.chunkIndex}`);
        const soql = buildIdRangeChunkSoql(baseSoql, boundary.recordCount, {
          afterId: boundary.afterId,
          endId: boundary.endId,
        });
        await tx.dataDeployChunk.update({
          where: { id: chunk.id },
          data: {
            soql,
            afterId: boundary.afterId,
            endId: boundary.endId,
            recordCount: boundary.recordCount,
          },
        });
        if (chunk.movementId) {
          await tx.dataMovement.update({
            where: { id: chunk.movementId },
            data: { soql },
          });
        }
      }

      const extra = current.chunks.filter((chunk) => chunk.chunkIndex >= boundaries.length);
      if (extra.length) {
        await tx.dataDeployChunk.updateMany({
          where: { id: { in: extra.map((chunk) => chunk.id) } },
          data: { status: 'cancelled', error: 'Chunk not needed — fewer records than requested limit' },
        });
        const movementIds = extra
          .map((chunk) => chunk.movementId)
          .filter((id): id is string => Boolean(id));
        if (movementIds.length) {
          await tx.dataMovement.updateMany({
            where: { id: { in: movementIds } },
            data: { status: 'cancelled' },
          });
        }
      }

      await tx.dataDeployBatch.update({
        where: { id: batchId },
        data: {
          status: 'running',
          totalChunks: boundaries.length,
          totalRecords,
          error: null,
          boundaryArtifact: {
            kind: 'id-ranges',
            plannerQuery,
            totalRecords,
            boundaries,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return true;
    });
  }

  private buildChunkPublication(
    batch: {
      id: string;
      strategy: string;
      operation: string;
      objectName: string | null;
      matchField: string | null;
      externalIdField: string | null;
      recordTypeMappings: Prisma.JsonValue;
      createdBy: string;
      sourceOrgId: string;
      targetOrgId: string;
      movementType: string;
      rollbackPolicy: string;
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

    let queue: string;
    let type: string;
    let payload: Record<string, unknown>;
    let movementConfig: Prisma.InputJsonValue | undefined;
    if (batch.strategy === 'upsert' || batch.strategy === 'replicate') {
      const externalIdField = batch.externalIdField ?? batch.matchField ?? undefined;
      if (batch.operation === 'upsert' && !externalIdField) {
        throw new Error('Upsert chunk is missing externalIdField');
      }
      const generated = generateSfdmuConfigFromSoql({
        runId: chunk.movementId ?? chunk.chunkId,
        sourceOrgAlias: sourceAlias,
        targetOrgAlias: targetAlias,
        objectName: batch.objectName ?? 'Unknown',
        soql: chunk.soql,
        operation: batch.operation as 'insert' | 'upsert',
        externalId: externalIdField,
        recordTypeMappings,
      });

      movementConfig = {
        configPath: generated.configPath,
        strategy: batch.operation,
        matchField: externalIdField,
        batchId: batch.id,
        chunkIndex: chunk.chunkIndex,
      } as Prisma.InputJsonValue;
      queue = QUEUE_NAMES.SFDMU_RUN;
      type = batch.strategy === 'replicate'
        ? 'data_replication_chunk'
        : 'org_to_org_data_deploy_chunk';
      payload = {
        sourceOrgAlias: sourceAlias,
        targetOrgAlias: targetAlias,
        configPath: generated.configPath,
        movementId: chunk.movementId,
        chunkId: chunk.chunkId,
        batchId: batch.id,
        chunkIndex: chunk.chunkIndex,
        chunkRecordCount: chunk.recordCount,
        operation: batch.operation,
        externalIdField,
      };
    } else {
      queue = QUEUE_NAMES.DATA_DEPLOY;
      type = 'data_deploy_chunk';
      payload = {
        sourceOrgId: batch.sourceOrgId,
        targetOrgId: batch.targetOrgId,
        objectName: batch.objectName,
        soql: chunk.soql,
        recordLimit: chunk.recordCount,
        movementId: chunk.movementId,
        chunkId: chunk.chunkId,
        batchId: batch.id,
        chunkIndex: chunk.chunkIndex,
        operation: batch.operation,
        externalIdField: batch.externalIdField ?? batch.matchField ?? undefined,
        rollbackEnabled: batch.rollbackPolicy === 'capture',
      };
    }

    return { queue, type, payload, movementConfig };
  }

  /**
   * Atomically creates the durable DB job and records its id on the still-pending
   * chunk. The pending chunk + jobId pair is the publication outbox claim.
   */
  private async claimChunkPublication(
    batch: Parameters<DataDeployOrchestratorService['buildChunkPublication']>[0],
    chunk: Parameters<DataDeployOrchestratorService['buildChunkPublication']>[1],
  ): Promise<string | null> {
    let publication: ReturnType<DataDeployOrchestratorService['buildChunkPublication']>;
    try {
      publication = this.buildChunkPublication(batch, chunk);
    } catch (error) {
      throw new ChunkPublicationError(
        error instanceof Error ? error.message : String(error),
        false,
        { cause: error },
      );
    }
    try {
      return await prisma.$transaction(async (tx) => {
        const jobId = randomUUID();
        const claimed = await tx.dataDeployChunk.updateMany({
          where: { id: chunk.chunkId, status: 'pending', jobId: null },
          data: { jobId, error: null, errorDetails: Prisma.DbNull },
        });
        if (!claimed.count) return null;
        await tx.job.create({
          data: {
            id: jobId,
            queue: publication.queue,
            type: publication.type,
            payload: publication.payload as Prisma.InputJsonValue,
            status: 'pending',
            currentStep: 'Awaiting queue publication',
            createdBy: batch.createdBy,
          },
        });
        if (chunk.movementId && publication.movementConfig) {
          await tx.dataMovement.update({
            where: { id: chunk.movementId },
            data: { sfdmuConfig: publication.movementConfig },
          });
        }
        return jobId;
      });
    } catch (error) {
      throw new ChunkPublicationError(
        `Could not persist publication claim for chunk ${chunk.chunkId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        true,
        { cause: error },
      );
    }
  }

  /**
   * BullMQ de-duplicates by the durable DB job id. A crash after addJob but
   * before the final transaction therefore leaves a safely republishable claim.
   */
  private async publishClaimedChunk(
    chunk: { id: string; batchId: string; movementId: string | null; jobId: string | null },
  ): Promise<boolean> {
    if (!chunk.jobId) return false;
    const job = await prisma.job.findUnique({ where: { id: chunk.jobId } });
    if (!job) {
      throw new ChunkPublicationError(
        `Chunk ${chunk.id} publication job ${chunk.jobId} is missing`,
        false,
      );
    }
    const payload = job.payload as Record<string, unknown>;
    try {
      await this.queue.addJob(
        job.queue,
        job.type,
        { ...payload, dbJobId: job.id },
        job.id,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.$transaction(async (tx) => {
        await tx.dataDeployChunk.updateMany({
          where: { id: chunk.id, status: 'pending', jobId: job.id },
          data: {
            status: 'failed',
            error: message,
            errorDetails: { phase: 'enqueue', message } as Prisma.InputJsonValue,
          },
        });
        if (chunk.movementId) {
          await tx.dataMovement.updateMany({
            where: { id: chunk.movementId, status: 'pending' },
            data: { status: 'failed' },
          });
        }
        await tx.job.updateMany({
          where: { id: job.id, status: 'pending' },
          data: {
            status: 'failed',
            currentStep: 'Queue publication failed',
            error: message,
            finishedAt: new Date(),
          },
        });
      });
      await this.refreshBatchProgress(chunk.batchId);
      return false;
    }
    // Keep finalization outside the enqueue catch. If this transaction fails
    // after BullMQ accepted the job, the pending claim must remain recoverable
    // rather than being misclassified as an enqueue failure.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.dataDeployChunk.updateMany({
          where: { id: chunk.id, status: 'pending', jobId: job.id },
          data: { status: 'queued', error: null, errorDetails: Prisma.DbNull },
        });
        if (chunk.movementId) {
          await tx.dataMovement.updateMany({
            where: { id: chunk.movementId, status: 'pending' },
            data: { status: 'queued' },
          });
        }
        await tx.job.updateMany({
          where: { id: job.id, status: 'pending' },
          data: { status: 'queued', currentStep: 'Pending', error: null },
        });
      });
    } catch (error) {
      throw new ChunkPublicationError(
        `Queue accepted chunk ${chunk.id}, but publication finalization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        true,
        { cause: error },
      );
    }
    return true;
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

  async releaseReadyChunks(batchId: string): Promise<number> {
    const released = await this.bulkThrottle.withSchedulerLock(batchId, async (lease) => {
      let batch = await prisma.dataDeployBatch.findUnique({
        where: { id: batchId },
        include: {
          chunks: { orderBy: { chunkIndex: 'asc' } },
          sourceOrg: true,
          targetOrg: true,
        },
      });
      if (!batch || !['running', 'partial'].includes(batch.status)) return 0;
      let queued = 0;
      const strandedClaims = batch.chunks.filter(
        (chunk) => chunk.status === 'pending' && Boolean(chunk.jobId),
      );
      for (const chunk of strandedClaims) {
        await lease?.assertOwned();
        if (await this.publishClaimedChunk(chunk)) queued += 1;
      }
      if (strandedClaims.length) {
        batch = await prisma.dataDeployBatch.findUnique({
          where: { id: batchId },
          include: {
            chunks: { orderBy: { chunkIndex: 'asc' } },
            sourceOrg: true,
            targetOrg: true,
          },
        });
        if (!batch || !['running', 'partial'].includes(batch.status)) return queued;
      }
      const pending = batch.chunks.filter(
        (chunk) => chunk.status === 'pending' && !chunk.jobId,
      );
      const active = batch.chunks.filter((chunk) => ['queued', 'running'].includes(chunk.status)).length;
      const quotaReserved = batch.chunks.reduce(
        (total, chunk) =>
          total
          + chunk.attempts
          + (chunk.jobId && ['queued', 'running', 'completed', 'failed', 'cancelled'].includes(chunk.status)
            ? 1
            : 0),
        0,
      );
      const quotaRemaining = batch.quotaConfidence === 'known' && batch.quotaRemaining != null
        ? Math.max(0, batch.quotaRemaining - quotaReserved)
        : null;
      const count = dataChunkReleaseCount({
        pending: pending.length,
        active,
        maxParallel: batch.maxParallelChunks,
        quotaRemaining,
      });
      let newlyQueued = 0;
      for (const chunk of pending) {
        if (newlyQueued >= count) break;
        await lease?.assertOwned();
        const jobId = await this.claimChunkPublication(batch, {
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          movementId: chunk.movementId,
          soql: chunk.soql,
          recordCount: chunk.recordCount ?? batch.chunkSize,
        });
        if (!jobId) continue;
        if (await this.publishClaimedChunk({
          id: chunk.id,
          batchId,
          movementId: chunk.movementId,
          jobId,
        })) {
          queued += 1;
          newlyQueued += 1;
        }
      }
      return queued;
    });
    return released ?? 0;
  }

  async recoverStrandedChunkPublications(): Promise<number> {
    const claims = await prisma.dataDeployChunk.findMany({
      where: {
        status: 'pending',
        batch: { status: { in: ['running', 'partial'] } },
      },
      select: { batchId: true },
      distinct: ['batchId'],
    });
    let recovered = 0;
    for (const claim of claims) recovered += await this.releaseReadyChunks(claim.batchId);
    return recovered;
  }

  /** Idempotent: only transitions chunks that are not already terminal. */
  async onChunkCompleted(
    chunkId: string,
    recordCount?: number,
    outcome?: { processedRecords: number | null; failedRecords: number },
  ) {
    const transitioned = await prisma.dataDeployChunk.updateMany({
      where: { id: chunkId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
      data: {
        status: 'completed',
        ...(recordCount != null ? { recordCount } : {}),
        ...(outcome?.processedRecords != null
          ? { processedRecords: outcome.processedRecords }
          : {}),
        ...(outcome ? { failedRecords: outcome.failedRecords } : {}),
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

    await this.releaseReadyChunks(chunk.batchId);
    await this.refreshBatchProgress(chunk.batchId);
  }

  /** Idempotent: only transitions chunks that are not already terminal. */
  async onChunkFailed(chunkId: string, error: string, details?: Record<string, unknown>) {
    const processedRecords = typeof details?.processedRecords === 'number'
      ? details.processedRecords
      : undefined;
    const failedRecords = typeof details?.failedRecords === 'number'
      ? details.failedRecords
      : undefined;
    const transitioned = await prisma.dataDeployChunk.updateMany({
      where: { id: chunkId, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
      data: {
        status: 'failed',
        ...(processedRecords != null ? { processedRecords } : {}),
        ...(failedRecords != null ? { failedRecords } : {}),
        error,
        errorDetails: (details ?? { message: error }) as Prisma.InputJsonValue,
      },
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

    await this.releaseReadyChunks(chunk.batchId);
    await this.refreshBatchProgress(chunk.batchId);
  }

  /** Recompute batch counters/status from chunk rows (drift-proof). */
  async refreshBatchProgress(batchId: string) {
    const [grouped, current] = await Promise.all([
      prisma.dataDeployChunk.groupBy({
        by: ['status'],
        where: { batchId },
        _count: { _all: true },
      }),
      prisma.dataDeployBatch.findUnique({
        where: { id: batchId },
        select: { status: true },
      }),
    ]);
    const counts = countChunkStatuses(
      grouped.map((g) => [g.status, g._count._all] as [string, number]),
    );
    const status = current?.status === 'cancelled' ? 'cancelled' : aggregateBatchStatus(counts);
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
    if ((status === 'failed' || status === 'partial') && current) {
      await this.blockDependentBatches(batchId);
    }
    if (status === 'completed') {
      const batch = await prisma.dataDeployBatch.findUnique({
        where: { id: batchId },
        select: { groupId: true },
      });
      if (batch?.groupId) await this.releaseReadyObjectBatches(batch.groupId);
    }
  }

  async releaseReadyObjectBatches(groupId: string): Promise<number> {
    let batches = await prisma.dataDeployBatch.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
    });
    const completed = new Set(
      batches
        .filter((batch) => batch.status === 'completed')
        .map((batch) => batch.objectKey ?? batch.objectName)
        .filter((key): key is string => Boolean(key)),
    );
    const releasableBlocked = batches.filter((batch) =>
      batch.status === 'failed'
      && batch.error?.startsWith(BLOCKED_BY_PREREQUISITE_PREFIX)
      && batch.dependsOn.every((dependency) => completed.has(dependency)));
    for (const batch of releasableBlocked) {
      await prisma.$transaction(async (tx) => {
        const reopened = await tx.dataDeployBatch.updateMany({
          where: {
            id: batch.id,
            status: 'failed',
            error: { startsWith: BLOCKED_BY_PREREQUISITE_PREFIX },
          },
          data: { status: 'pending', error: null, failedChunks: 0 },
        });
        if (!reopened.count) return;
        await tx.dataDeployChunk.updateMany({
          where: {
            batchId: batch.id,
            status: 'failed',
            error: { startsWith: BLOCKED_BY_PREREQUISITE_PREFIX },
          },
          data: {
            status: 'pending',
            jobId: null,
            error: null,
            errorDetails: Prisma.DbNull,
          },
        });
        await tx.dataMovement.updateMany({
          where: { batchId: batch.id, status: 'failed' },
          data: { status: 'pending' },
        });
      });
    }
    if (releasableBlocked.length) {
      batches = await prisma.dataDeployBatch.findMany({
        where: { groupId },
        orderBy: { createdAt: 'asc' },
      });
    }
    const ready = batches.filter((batch) =>
      batch.status === 'pending'
      && batch.dependsOn.every((dependency) => completed.has(dependency)));
    let started = 0;
    for (const batch of ready) {
      if (await this.startBatch(batch.id)) started += 1;
    }
    return started;
  }

  private async blockDependentBatches(failedBatchId: string): Promise<void> {
    const failed = await prisma.dataDeployBatch.findUnique({
      where: { id: failedBatchId },
      select: { groupId: true, objectKey: true, objectName: true },
    });
    if (!failed?.groupId) return;
    const failedKey = failed.objectKey ?? failed.objectName;
    if (!failedKey) return;
    const batches = await prisma.dataDeployBatch.findMany({
      where: { groupId: failed.groupId },
      orderBy: { createdAt: 'asc' },
    });
    const blockedKeys = new Set([failedKey]);
    const descendants: typeof batches = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const batch of batches) {
        const key = batch.objectKey ?? batch.objectName;
        if (!key || blockedKeys.has(key)) continue;
        if (batch.dependsOn.some((dependency) => blockedKeys.has(dependency))) {
          blockedKeys.add(key);
          descendants.push(batch);
          changed = true;
        }
      }
    }
    for (const descendant of descendants) {
      const reason = `${BLOCKED_BY_PREREQUISITE_PREFIX}${failedKey}`;
      await prisma.$transaction(async (tx) => {
        const blocked = await tx.dataDeployBatch.updateMany({
          where: {
            id: descendant.id,
            status: { in: ['pending', 'planning', 'queued'] },
          },
          data: { status: 'failed', error: reason },
        });
        if (!blocked.count) return;
        await tx.dataDeployChunk.updateMany({
          where: { batchId: descendant.id, status: { in: [...ACTIVE_CHUNK_STATUSES] } },
          data: {
            status: 'failed',
            error: reason,
            errorDetails: { phase: 'dependency', prerequisite: failedKey } as Prisma.InputJsonValue,
          },
        });
        await tx.dataMovement.updateMany({
          where: {
            batchId: descendant.id,
            status: { in: ['pending', 'planning', 'queued'] },
          },
          data: { status: 'failed' },
        });
      });
    }
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
    if (!isSafeIdempotentUpsertRetry(batch.operation, batch.externalIdField ?? batch.matchField)) {
      throw new BadRequestException(
        'Insert chunks cannot be retried safely because Salesforce may have committed some records; use an upsert strategy or retry only verified failed records',
      );
    }
    if (!chunk.endId && chunk.chunkIndex > 0) {
      throw new BadRequestException('Chunk bounds were never planned — retry the whole deploy instead');
    }

    await prisma.dataDeployChunk.update({
      where: { id: chunkId },
      data: {
        status: 'pending',
        jobId: null,
        error: null,
        errorDetails: Prisma.DbNull,
        processedRecords: null,
        failedRecords: null,
        attempts: { increment: 1 },
      },
    });
    if (chunk.movementId) {
      await prisma.dataMovement.update({
        where: { id: chunk.movementId },
        data: { status: 'pending' },
      }).catch(() => undefined);
    }

    await prisma.dataDeployBatch.update({
      where: { id: batchId },
      data: { status: 'running', error: null },
    });

    await this.releaseReadyChunks(batchId);
    const scheduled = await prisma.dataDeployChunk.findUnique({ where: { id: chunkId } });
    return {
      batchId,
      chunkId,
      jobId: scheduled?.jobId ?? undefined,
      status: scheduled?.status ?? 'pending',
    };
  }

  /** Re-enqueue all failed chunks in a batch. */
  async retryFailedChunks(batchId: string, userId: string) {
    const batch = await this.getBatch(batchId, userId);
    const failed = batch.chunks.filter((c) => c.status === 'failed');
    if (failed.length === 0) {
      throw new BadRequestException('No failed chunks to retry');
    }
    const retried: Array<{ chunkId: string; jobId?: string; status: string }> = [];
    for (const chunk of failed) {
      const result = await this.retryChunk(batchId, chunk.id, userId);
      retried.push({ chunkId: chunk.id, jobId: result.jobId, status: result.status });
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

  private async withCancellationLock<T>(batchId: string, callback: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await this.bulkThrottle.withSchedulerLock(batchId, callback);
      if (result !== null) return result;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new ServiceUnavailableException('Data deploy scheduler is busy; retry cancellation');
  }

  private async isBatchCancellationRequested(batchId: string, dbJobId?: string): Promise<boolean> {
    if (dbJobId && await this.processRegistry.isCancellationRequested(dbJobId)) return true;
    const batch = await prisma.dataDeployBatch.findUnique({
      where: { id: batchId },
      select: { status: true },
    });
    return batch?.status === 'cancelled';
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
