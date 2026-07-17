import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => ({
  sfCli: {
    ensureSfdmuPlugin: vi.fn(),
    runSfdmu: vi.fn(),
  },
  dataDeployChunk: {
    updateMany: vi.fn(),
  },
  dataMovement: {
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({
  prisma: {
    dataDeployChunk: mocks.dataDeployChunk,
    dataMovement: mocks.dataMovement,
  },
}));

vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: () => mocks.sfCli,
  isSfdmuPluginMissingError: () => false,
  SFDMU_PLUGIN_INSTALL_MESSAGE: 'SFDMU plugin unavailable',
}));

import { SfdmuWorker } from './sfdmu.worker';

function createWorker() {
  const jobsService = { addLog: vi.fn().mockResolvedValue(undefined) };
  const streamService = { publishJobLog: vi.fn().mockResolvedValue(undefined) };
  const release = vi.fn().mockResolvedValue(undefined);
  const bulkThrottle = { acquire: vi.fn().mockResolvedValue({ release }) };
  const dataDeployOrchestrator = {
    onChunkCompleted: vi.fn().mockResolvedValue(undefined),
    onChunkFailed: vi.fn().mockResolvedValue(undefined),
    refreshBatchProgress: vi.fn().mockResolvedValue(undefined),
  };
  const processRegistry = {
    isCancellationRequested: vi.fn().mockResolvedValue(false),
    register: vi.fn().mockReturnValue(vi.fn()),
    clear: vi.fn(),
  };
  return {
    worker: new SfdmuWorker(
      jobsService as never,
      streamService as never,
      bulkThrottle as never,
      dataDeployOrchestrator as never,
      processRegistry as never,
    ),
    jobsService,
    dataDeployOrchestrator,
  };
}

function jobData() {
  return {
    data: {
      sourceOrgAlias: 'source',
      targetOrgAlias: 'target',
      configPath: join(tmpdir(), 'sfcc-sfdmu-worker-test'),
      dbJobId: 'job-1',
      movementId: 'movement-1',
      chunkId: 'chunk-1',
      batchId: 'batch-1',
      chunkIndex: 0,
      chunkRecordCount: 35_000,
    },
  };
}

describe('SfdmuWorker deployment outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sfCli.ensureSfdmuPlugin.mockResolvedValue(undefined);
    mocks.dataDeployChunk.updateMany.mockResolvedValue({ count: 1 });
    mocks.dataMovement.update.mockResolvedValue({});
    mocks.dataMovement.updateMany.mockResolvedValue({ count: 1 });
  });

  it('fails the chunk when SFDMU reports rejected rows with exit code zero', async () => {
    mocks.sfCli.runSfdmu.mockResolvedValue({
      success: true,
      stdout: '[Batch# 750xx:Upsert] {Account} Completed. 35,000 records processed, 120 records failed.',
      stderr: '',
      exitCode: 0,
    });
    const { worker, dataDeployOrchestrator } = createWorker();

    await expect(worker.process(jobData() as never)).rejects.toThrow(
      '120 failed record(s)',
    );

    expect(dataDeployOrchestrator.onChunkCompleted).not.toHaveBeenCalled();
    expect(dataDeployOrchestrator.onChunkFailed).toHaveBeenCalledWith(
      'chunk-1',
      expect.stringContaining('120 failed record(s)'),
      expect.objectContaining({
        phase: 'sfdmu',
        processedRecords: 35_000,
        failedRecords: 120,
      }),
    );
  });

  it('completes with persisted row counters only when no failures are reported', async () => {
    mocks.sfCli.runSfdmu.mockResolvedValue({
      success: true,
      stdout: '[Batch# 750xx:Upsert] {Account} Completed. 35,000 records processed, 0 records failed.',
      stderr: '',
      exitCode: 0,
    });
    const { worker, jobsService, dataDeployOrchestrator } = createWorker();

    await expect(worker.process(jobData() as never)).resolves.toEqual(expect.objectContaining({
      outcome: {
        processedRecords: 35_000,
        failedRecords: 0,
        completedOperations: 1,
      },
    }));

    expect(dataDeployOrchestrator.onChunkCompleted).toHaveBeenCalledWith(
      'chunk-1',
      35_000,
      expect.objectContaining({ processedRecords: 35_000, failedRecords: 0 }),
    );
    expect(jobsService.addLog).toHaveBeenCalledWith(
      'job-1',
      'stdout',
      expect.stringContaining('verified 35,000 processed record(s)'),
    );
  });
});
