import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { prisma } from '@sfcc/db';
import { buildGenericDeployQuery, extractLimitFromSoql } from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { JobsService } from '../modules/jobs/jobs.service';
import { JobProcessRegistryService } from '../modules/jobs/job-process-registry.service';
import { StreamService } from '../modules/stream/stream.service';
import { BulkThrottleService } from '../modules/data/bulk-throttle.service';
import { DataDeployOrchestratorService } from '../modules/data/data-deploy-orchestrator.service';

function resolveOrgTarget(org: { alias: string; username?: string | null }): string {
  return org.username ?? org.alias;
}

async function countCsvDataRowsFromFile(csvPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = createReadStream(csvPath, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', () => {
      count += 1;
    });
    rl.on('close', () => resolve(Math.max(0, count - 1)));
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

function parseBulkJobId(text: string): string | null {
  const match = text.match(/--job-id\s+([a-zA-Z0-9]{15,18})/i);
  return match?.[1] ?? null;
}

function formatBulkFailureLines(output: string): string[] {
  const lines: string[] = [];
  try {
    const parsed = JSON.parse(output) as {
      result?: {
        records?: Array<{ Error?: string; errors?: Array<{ message?: string; statusCode?: string }> }>;
      };
    };
    const records = parsed.result?.records ?? [];
    for (const record of records.slice(0, 20)) {
      const err = record.Error
        ?? record.errors?.map((e) => e.message ?? e.statusCode).filter(Boolean).join('; ');
      if (err) lines.push(err);
    }
  } catch {
    for (const line of output.split('\n').filter(Boolean).slice(0, 20)) {
      lines.push(line);
    }
  }
  return lines;
}

function resolveBulkWaitMinutes(recordLimit: number): number {
  const envDefault = parseInt(process.env.SF_DATA_BULK_WAIT_MINUTES ?? '', 10);
  if (Number.isFinite(envDefault) && envDefault > 0) return envDefault;
  if (recordLimit >= 25_000) return 120;
  if (recordLimit >= 10_000) return 90;
  if (recordLimit >= 5_000) return 60;
  return 30;
}

@Injectable()
export class DataDeployWorker {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly bulkThrottle: BulkThrottleService,
    private readonly dataDeployOrchestrator: DataDeployOrchestratorService,
    private readonly processRegistry: JobProcessRegistryService,
  ) {}

  async process(job: Job) {
    if (job.name === 'data_deploy_plan') {
      return this.processPlan(job);
    }
    return this.processDeploy(job);
  }

  private async processPlan(job: Job) {
    const { batchId, dbJobId } = job.data as { batchId: string; dbJobId: string };
    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };
    return this.dataDeployOrchestrator.planBatch(batchId, log);
  }

  private async processDeploy(job: Job) {
    const {
      sourceOrgId,
      targetOrgId,
      objectName,
      soql,
      recordLimit,
      movementId,
      dbJobId,
      chunkId,
      batchId,
      chunkIndex,
      externalIdField,
    } = job.data as {
      sourceOrgId: string;
      targetOrgId: string;
      objectName: string;
      soql?: string;
      recordLimit?: number;
      movementId: string;
      dbJobId: string;
      chunkId?: string;
      batchId?: string;
      chunkIndex?: number;
      externalIdField?: string;
    };

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    if (this.processRegistry.isCancelled(dbJobId)) {
      await log('stderr', 'Job was cancelled before it started');
      await prisma.dataMovement.update({
        where: { id: movementId },
        data: { status: 'cancelled' },
      }).catch(() => undefined);
      return { cancelled: true, movementId, chunkId };
    }

    await prisma.dataMovement.update({
      where: { id: movementId },
      data: { status: 'running' },
    });

    if (chunkId) {
      await prisma.dataDeployChunk.update({
        where: { id: chunkId },
        data: { status: 'running' },
      });
      await log('stdout', `Processing chunk ${(chunkIndex ?? 0) + 1}${batchId ? ` (batch ${batchId})` : ''}`);
    }

    const [source, target] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: targetOrgId } }),
    ]);

    if (!source || !target) throw new Error('Source or target org not found');

    const sourceOrg = resolveOrgTarget(source);
    const targetOrg = resolveOrgTarget(target);
    // Chunk queries are pre-resolved with Id-range bounds — never rewrite them.
    const exportQuery = chunkId && soql
      ? soql
      : buildGenericDeployQuery({ soql, objectName, recordLimit });
    const effectiveLimit = recordLimit ?? extractLimitFromSoql(exportQuery) ?? 200;
    const waitMinutes = resolveBulkWaitMinutes(effectiveLimit);

    const workDir = join(tmpdir(), 'sfcc-data-deploy', movementId);
    const csvPath = join(workDir, `${objectName}-export.csv`);
    const unregisterCallbacks: Array<() => void> = [];

    try {
      await mkdir(workDir, { recursive: true });

      await log('stdout', `Exporting from ${source.alias} (${sourceOrg})...`);
      await log('stdout', `Record limit: ${effectiveLimit} (bulk wait: ${waitMinutes} min)`);
      await log('stdout', `SOQL: ${exportQuery}`);

      const exportSlot = await this.bulkThrottle.acquire(sourceOrg);
      let exportResult;
      try {
        exportResult = await this.sfCli.exportBulk(exportQuery, sourceOrg, csvPath, waitMinutes, {
          cwd: workDir,
          onSpawn: (proc) => {
            unregisterCallbacks.push(
              this.processRegistry.register(dbJobId, () => proc.kill('SIGTERM')),
            );
          },
        });
      } finally {
        await exportSlot.release();
      }

      if (exportResult.stdout) {
        for (const line of exportResult.stdout.split('\n').filter(Boolean)) await log('stdout', line);
      }
      if (!exportResult.success) {
        throw new Error(exportResult.error ?? 'Bulk export failed');
      }

      let recordCount = 0;
      try {
        recordCount = await countCsvDataRowsFromFile(csvPath);
      } catch {
        recordCount = 0;
      }

      await log('stdout', `Exported ${recordCount} record(s) to CSV`);

      if (recordCount === 0) {
        await log('stderr', 'No records to import — chunk completed with 0 records');
        await prisma.dataMovement.update({
          where: { id: movementId },
          data: { status: 'completed', recordCount: 0 },
        });
        if (chunkId) {
          await this.dataDeployOrchestrator.onChunkCompleted(chunkId, 0);
        }
        return { recordCount: 0, movementId, chunkId };
      }

      if (this.processRegistry.isCancelled(dbJobId)) {
        throw new Error('Job cancelled by user');
      }

      const importVerb = externalIdField ? `Upserting (by ${externalIdField}) into` : 'Importing into';
      await log('stdout', `${importVerb} ${target.alias} (${targetOrg})...`);

      const importSlot = await this.bulkThrottle.acquire(targetOrg);
      let importResult;
      try {
        const cliOptions = {
          cwd: workDir,
          onSpawn: (proc: import('child_process').ChildProcess) => {
            unregisterCallbacks.push(
              this.processRegistry.register(dbJobId, () => proc.kill('SIGTERM')),
            );
          },
        };
        importResult = externalIdField
          ? await this.sfCli.upsertBulk(objectName, csvPath, externalIdField, targetOrg, waitMinutes, cliOptions)
          : await this.sfCli.importBulk(objectName, csvPath, targetOrg, waitMinutes, cliOptions);
      } finally {
        await importSlot.release();
      }

      if (importResult.stdout) {
        for (const line of importResult.stdout.split('\n').filter(Boolean)) await log('stdout', line);
      }
      if (importResult.stderr) {
        for (const line of importResult.stderr.split('\n').filter(Boolean)) await log('stderr', line);
      }
      if (!importResult.success) {
        const combined = [importResult.stderr, importResult.stdout, importResult.error].filter(Boolean).join('\n');
        const bulkJobId = parseBulkJobId(combined);
        if (bulkJobId) {
          await log('stderr', `Fetching bulk job failure details (${bulkJobId})...`);
          const results = await this.sfCli.getBulkJobResults(targetOrg, bulkJobId, { cwd: workDir });
          const failureOutput = [results.stdout, results.stderr].filter(Boolean).join('\n');
          const failureLines = formatBulkFailureLines(failureOutput);
          for (const line of failureLines) {
            await log('stderr', line);
          }
        }
        throw new Error(
          importResult.error
            ?? `Bulk import failed${bulkJobId ? ` — run: sf data bulk results -o ${targetOrg} --job-id ${bulkJobId}` : ''}`,
        );
      }

      await log('stdout', `Successfully deployed ${recordCount} record(s) to ${target.alias}`);

      await prisma.dataMovement.update({
        where: { id: movementId },
        data: { status: 'completed', recordCount },
      });

      if (chunkId) {
        await this.dataDeployOrchestrator.onChunkCompleted(chunkId, recordCount);
      }

      return { recordCount, movementId, chunkId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cancelled = this.processRegistry.isCancelled(dbJobId);
      await log('stderr', cancelled ? 'Deployment cancelled by user' : `Deployment failed: ${message}`);
      await prisma.dataMovement.update({
        where: { id: movementId },
        data: { status: cancelled ? 'cancelled' : 'failed' },
      }).catch(() => undefined);
      if (chunkId && !cancelled) {
        await this.dataDeployOrchestrator.onChunkFailed(chunkId, message);
      }
      if (chunkId && cancelled) {
        await prisma.dataDeployChunk.updateMany({
          where: { id: chunkId, status: { in: ['pending', 'queued', 'running'] } },
          data: { status: 'cancelled', error: 'Cancelled by user' },
        });
        if (batchId) await this.dataDeployOrchestrator.refreshBatchProgress(batchId);
      }
      throw error;
    } finally {
      for (const unregister of unregisterCallbacks) unregister();
      this.processRegistry.clear(dbJobId);
      try {
        await rm(workDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
