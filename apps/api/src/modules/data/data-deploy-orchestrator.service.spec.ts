import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  dataDeployBatch: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  dataDeployChunk: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
  },
  dataMovement: { updateMany: vi.fn(), update: vi.fn() },
  job: { findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: { DbNull: null } }));

import { DataDeployOrchestratorService } from './data-deploy-orchestrator.service';

describe('DataDeployOrchestratorService cancellation', () => {
  const removeJob = vi.fn();
  const cancelProcess = vi.fn();
  const withSchedulerLock = vi.fn();
  let service: DataDeployOrchestratorService;

  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.dataDeployBatch.updateMany.mockResolvedValue({ count: 1 });
    db.dataDeployBatch.update.mockResolvedValue({});
    db.dataDeployChunk.updateMany.mockResolvedValue({ count: 2 });
    db.dataMovement.updateMany.mockResolvedValue({ count: 2 });
    db.job.updateMany.mockResolvedValue({ count: 2 });
    db.dataDeployChunk.groupBy.mockResolvedValue([
      { status: 'cancelled', _count: { _all: 2 } },
    ]);
    removeJob.mockResolvedValue(true);
    cancelProcess.mockResolvedValue(undefined);
    withSchedulerLock.mockImplementation(
      async (_id: string, callback: () => Promise<unknown>) => callback(),
    );
    service = new DataDeployOrchestratorService(
      {} as never,
      { withSchedulerLock } as never,
      { removeJob } as never,
      { cancel: cancelProcess, isCancellationRequested: vi.fn() } as never,
    );
  });

  it('marks queued/running state before queue removal and process cancellation', async () => {
    db.dataDeployBatch.findUnique
      .mockResolvedValueOnce({ id: 'batch-1', createdBy: 'user-1', status: 'running' })
      .mockResolvedValueOnce({
        id: 'batch-1',
        createdBy: 'user-1',
        status: 'running',
        chunks: [{ jobId: 'queued-job' }, { jobId: 'running-job' }],
      })
      .mockResolvedValueOnce({ status: 'cancelled' })
      .mockResolvedValueOnce({
        id: 'batch-1',
        status: 'cancelled',
        completedChunks: 0,
        failedChunks: 0,
        totalChunks: 2,
      });
    db.job.findMany.mockResolvedValue([
      { id: 'queued-job', queue: 'data-deploy', payload: { batchId: 'batch-1' } },
      { id: 'running-job', queue: 'sfdmu-run', payload: { batchId: 'batch-1' } },
    ]);

    const result = await service.cancelBatch('batch-1', 'user-1');

    expect(result).toEqual(expect.objectContaining({
      status: 'cancelled',
      cancelled: true,
      cancelledJobs: 2,
    }));
    expect(db.dataDeployBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'batch-1', createdBy: 'user-1' }),
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(db.dataDeployChunk.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(db.job.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(cancelProcess.mock.invocationCallOrder[0]);
    expect(removeJob).toHaveBeenCalledWith('data-deploy', 'queued-job');
    expect(cancelProcess).toHaveBeenCalledWith('running-job');
  });

  it('is idempotent while still rebroadcasting cancellation for a prior interrupted request', async () => {
    db.dataDeployBatch.findUnique
      .mockResolvedValueOnce({ id: 'batch-1', createdBy: 'user-1', status: 'cancelled' })
      .mockResolvedValueOnce({
        id: 'batch-1',
        createdBy: 'user-1',
        status: 'cancelled',
        chunks: [{ jobId: 'job-1' }],
      })
      .mockResolvedValueOnce({ status: 'cancelled' })
      .mockResolvedValueOnce({
        id: 'batch-1',
        status: 'cancelled',
        completedChunks: 0,
        failedChunks: 0,
        totalChunks: 1,
      });
    db.dataDeployBatch.updateMany.mockResolvedValue({ count: 0 });
    db.job.findMany.mockResolvedValue([
      { id: 'job-1', queue: 'data-deploy', payload: { batchId: 'batch-1' } },
    ]);

    const result = await service.cancelBatch('batch-1', 'user-1');

    expect(result.idempotent).toBe(true);
    expect(cancelProcess).toHaveBeenCalledWith('job-1');
  });

  it('hides another owner’s batch and performs no cancellation', async () => {
    db.dataDeployBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      createdBy: 'user-2',
      status: 'running',
    });

    await expect(service.cancelBatch('batch-1', 'user-1')).rejects.toThrow(
      'Data deploy batch not found',
    );
    expect(withSchedulerLock).not.toHaveBeenCalled();
    expect(cancelProcess).not.toHaveBeenCalled();
  });

  it('ignores a late worker completion after cancellation', async () => {
    db.dataDeployChunk.updateMany.mockResolvedValue({ count: 0 });

    await service.onChunkCompleted('chunk-1', 25);

    expect(db.dataDeployChunk.findUnique).not.toHaveBeenCalled();
    expect(withSchedulerLock).not.toHaveBeenCalled();
  });
});
