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
    update: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
  },
  dataMovement: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  job: { findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: { DbNull: null } }));

import { DataDeployOrchestratorService } from './data-deploy-orchestrator.service';

describe('DataDeployOrchestratorService cancellation', () => {
  const removeJob = vi.fn();
  const cancelProcess = vi.fn();
  const withSchedulerLock = vi.fn();
  const enqueueJob = vi.fn();
  let service: DataDeployOrchestratorService;

  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.dataDeployBatch.updateMany.mockResolvedValue({ count: 1 });
    db.dataDeployBatch.update.mockResolvedValue({});
    db.dataDeployChunk.updateMany.mockResolvedValue({ count: 2 });
    db.dataDeployChunk.update.mockResolvedValue({});
    db.dataMovement.updateMany.mockResolvedValue({ count: 2 });
    db.job.updateMany.mockResolvedValue({ count: 2 });
    db.dataDeployChunk.groupBy.mockResolvedValue([
      { status: 'cancelled', _count: { _all: 2 } },
    ]);
    removeJob.mockResolvedValue(true);
    cancelProcess.mockResolvedValue(undefined);
    enqueueJob.mockResolvedValue({ id: 'planner-job' });
    withSchedulerLock.mockImplementation(
      async (_id: string, callback: () => Promise<unknown>) => callback(),
    );
    service = new DataDeployOrchestratorService(
      { enqueueJob } as never,
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

  it('cancels and kills a non-batched movement idempotently', async () => {
    db.dataMovement.findUnique.mockResolvedValue({
      id: 'movement-1',
      createdBy: 'user-1',
      status: 'running',
      batchId: null,
      movementType: 'deploy',
    });
    db.job.findMany.mockResolvedValue([{ id: 'job-1', queue: 'data-deploy' }]);
    db.dataMovement.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.cancelMovement('movement-1', 'user-1');

    expect(result).toEqual(expect.objectContaining({
      movementId: 'movement-1',
      status: 'cancelled',
      idempotent: false,
    }));
    expect(db.job.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(removeJob).toHaveBeenCalledWith('data-deploy', 'job-1');
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

  it('resumes a running planner artifact and atomically fills every chunk bound', async () => {
    const boundaryArtifact = {
      kind: 'id-ranges',
      plannerQuery: 'SELECT Id FROM Account ORDER BY Id LIMIT 2',
      totalRecords: 2,
      boundaries: [
        { chunkIndex: 0, afterId: null, endId: '001A', recordCount: 1 },
        { chunkIndex: 1, afterId: '001A', endId: '001B', recordCount: 1 },
      ],
    };
    const chunks = [
      { id: 'chunk-0', chunkIndex: 0, movementId: 'movement-0', status: 'queued', soql: 'placeholder' },
      { id: 'chunk-1', chunkIndex: 1, movementId: 'movement-1', status: 'queued', soql: 'placeholder' },
    ];
    const batch = {
      id: 'batch-1',
      status: 'running',
      baseSoql: 'SELECT Name FROM Account',
      totalRecords: 2,
      totalChunks: 2,
      chunkSize: 1,
      boundaryArtifact,
      chunks,
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
      maxParallelChunks: 2,
      quotaConfidence: 'unknown',
      quotaRemaining: null,
    };
    db.dataDeployBatch.findUnique
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(batch);
    db.dataDeployBatch.update.mockResolvedValue({});
    db.dataMovement.update.mockResolvedValue({});
    withSchedulerLock.mockImplementation(
      async (_id: string, callback: (lease?: { assertOwned: () => Promise<void> }) => Promise<unknown>) =>
        callback({ assertOwned: vi.fn() }),
    );

    const result = await service.planBatch('batch-1', vi.fn());

    expect(result).toEqual(expect.objectContaining({ resumed: true, totalChunks: 2 }));
    expect(db.dataDeployChunk.update).toHaveBeenCalledTimes(2);
    expect(db.dataDeployChunk.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'chunk-1' },
      data: expect.objectContaining({ afterId: '001A', endId: '001B' }),
    }));
    expect(db.dataDeployChunk.update.mock.invocationCallOrder[1])
      .toBeLessThan(db.dataDeployBatch.update.mock.invocationCallOrder[0]);
  });

  it('terminally blocks every descendant of a failed DAG prerequisite', async () => {
    db.dataDeployChunk.groupBy.mockResolvedValue([
      { status: 'failed', _count: { _all: 1 } },
    ]);
    db.dataDeployBatch.findUnique
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({
        groupId: 'group-1',
        objectKey: 'accounts',
        objectName: 'Account',
      });
    db.dataDeployBatch.findMany.mockResolvedValue([
      { id: 'root', objectKey: 'accounts', objectName: 'Account', dependsOn: [], status: 'failed' },
      { id: 'child', objectKey: 'contacts', objectName: 'Contact', dependsOn: ['accounts'], status: 'pending' },
      { id: 'grandchild', objectKey: 'cases', objectName: 'Case', dependsOn: ['contacts'], status: 'pending' },
    ]);

    await service.refreshBatchProgress('root');

    expect(db.dataDeployBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'child' }),
      data: expect.objectContaining({
        status: 'failed',
        error: 'Blocked by failed prerequisite: accounts',
      }),
    }));
    expect(db.dataDeployBatch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'grandchild' }),
    }));
    expect(db.dataDeployChunk.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ batchId: 'grandchild' }),
      data: expect.objectContaining({ status: 'failed' }),
    }));
  });

  it('reopens and releases a blocked descendant after its retried prerequisite succeeds', async () => {
    const root = {
      id: 'root',
      objectKey: 'accounts',
      objectName: 'Account',
      dependsOn: [],
      status: 'completed',
      error: null,
    };
    const blocked = {
      id: 'child',
      objectKey: 'contacts',
      objectName: 'Contact',
      dependsOn: ['accounts'],
      status: 'failed',
      error: 'Blocked by failed prerequisite: accounts',
    };
    db.dataDeployBatch.findMany
      .mockResolvedValueOnce([root, blocked])
      .mockResolvedValueOnce([root, { ...blocked, status: 'pending', error: null }]);
    db.dataDeployBatch.findUnique.mockResolvedValue({
      id: 'child',
      status: 'pending',
      createdBy: 'owner',
    });
    db.dataDeployBatch.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.releaseReadyObjectBatches('group-1')).resolves.toBe(1);

    expect(db.dataDeployChunk.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        batchId: 'child',
        error: { startsWith: 'Blocked by failed prerequisite: ' },
      }),
      data: expect.objectContaining({ status: 'pending', error: null }),
    }));
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.any(String),
      'data_deploy_plan',
      { batchId: 'child' },
      { createdBy: 'owner' },
    );
  });
});
