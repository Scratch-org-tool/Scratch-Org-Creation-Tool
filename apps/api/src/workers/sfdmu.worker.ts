import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { prisma } from '@sfcc/db';
import { createSfCliClient, isSfdmuPluginMissingError } from '@sfcc/sf-cli';
import { JobsService } from '../modules/jobs/jobs.service';
import { JobProcessRegistryService } from '../modules/jobs/job-process-registry.service';
import { StreamService } from '../modules/stream/stream.service';
import { BulkThrottleService, type BulkThrottleSlot } from '../modules/data/bulk-throttle.service';
import { DataDeployOrchestratorService } from '../modules/data/data-deploy-orchestrator.service';
import { cleanupSfdmuRunDir } from '../modules/data/sfdmu-config.generator';

@Injectable()
export class SfdmuWorker {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly bulkThrottle: BulkThrottleService,
    private readonly dataDeployOrchestrator: DataDeployOrchestratorService,
    private readonly processRegistry: JobProcessRegistryService,
  ) {}

  async process(job: Job) {
    const {
      sourceOrgAlias,
      targetOrgAlias,
      configPath,
      dbJobId,
      movementId,
      chunkId,
      batchId,
      chunkIndex,
    } = job.data as {
      sourceOrgAlias: string;
      targetOrgAlias: string;
      configPath: string;
      dbJobId: string;
      movementId?: string;
      chunkId?: string;
      batchId?: string;
      chunkIndex?: number;
    };

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      try {
        await this.jobsService.addLog(dbJobId, stream, line);
        await this.streamService.publishJobLog(dbJobId, stream, line);
      } catch {
        // logging must never crash the worker
      }
    };

    if (await this.processRegistry.isCancellationRequested(dbJobId)) {
      await log('stderr', 'Job was cancelled before it started');
      if (movementId) {
        await prisma.dataMovement.update({
          where: { id: movementId },
          data: { status: 'cancelled' },
        }).catch(() => undefined);
      }
      cleanupSfdmuRunDir(configPath);
      return { cancelled: true, movementId, chunkId };
    }

    if (chunkId) {
      const claimed = await prisma.dataDeployChunk.updateMany({
        where: { id: chunkId, status: { in: ['pending', 'queued'] } },
        data: { status: 'running' },
      });
      if (claimed.count === 0) {
        await log('stderr', 'Chunk is no longer active; skipping cancelled or duplicate work');
        cleanupSfdmuRunDir(configPath);
        return { cancelled: true, movementId, chunkId };
      }
      await log('stdout', `Processing SFDMU chunk ${(chunkIndex ?? 0) + 1}${batchId ? ` (batch ${batchId})` : ''}`);
    }
    if (movementId) {
      await prisma.dataMovement.updateMany({
        where: { id: movementId, status: { in: ['pending', 'queued', 'planning'] } },
        data: { status: 'running' },
      });
    }

    // Acquire org slots in a deterministic (sorted) order so that two jobs
    // moving data in opposite directions (A->B and B->A) can never deadlock
    // waiting on each other's org slot.
    const orderedAliases = [...new Set([sourceOrgAlias, targetOrgAlias])].sort();
    const slots: BulkThrottleSlot[] = [];
    const killHolder: { unregister?: () => void } = {};

    try {
      for (const alias of orderedAliases) {
        slots.push(await this.bulkThrottle.acquire(alias));
      }

      if (await this.processRegistry.isCancellationRequested(dbJobId)) {
        throw new Error('Job cancelled by user');
      }

      const result = await this.sfCli.runSfdmu(
        sourceOrgAlias,
        targetOrgAlias,
        configPath,
        (event) => {
          void log(event.stream, event.line);
        },
        {
          onSpawn: (proc) => {
            killHolder.unregister = this.processRegistry.register(dbJobId, () => proc.kill('SIGTERM'));
          },
        },
      );

      if (!result.success) {
        const output = [result.stderr, result.stdout, result.error].filter(Boolean).join('\n');
        if (isSfdmuPluginMissingError(output)) {
          throw new Error(
            'SFDMU Salesforce CLI plugin is not installed on the API server. Run: sf plugins install sfdmu',
          );
        }
        throw new Error(result.error ?? 'SFDMU run failed');
      }

      if (movementId) {
        await prisma.dataMovement.updateMany({
          where: { id: movementId, status: { in: ['pending', 'queued', 'planning', 'running'] } },
          data: { status: 'completed' },
        });
      }

      if (chunkId) {
        await this.dataDeployOrchestrator.onChunkCompleted(chunkId);
      }

      return result.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cancelled = await this.processRegistry.isCancellationRequested(dbJobId);
      if (movementId) {
        await prisma.dataMovement.update({
          where: { id: movementId },
          data: { status: cancelled ? 'cancelled' : 'failed' },
        }).catch(() => undefined);
      }
      if (chunkId) {
        if (cancelled) {
          await prisma.dataDeployChunk.updateMany({
            where: { id: chunkId, status: { in: ['pending', 'queued', 'running'] } },
            data: { status: 'cancelled', error: 'Cancelled by user' },
          }).catch(() => undefined);
          if (batchId) await this.dataDeployOrchestrator.refreshBatchProgress(batchId);
        } else {
          await this.dataDeployOrchestrator.onChunkFailed(chunkId, message);
        }
      }
      throw error;
    } finally {
      killHolder.unregister?.();
      this.processRegistry.clear(dbJobId);
      for (const slot of slots) {
        await slot.release();
      }
      cleanupSfdmuRunDir(configPath);
    }
  }
}
