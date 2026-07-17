import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';

const db = vi.hoisted(() => ({
  dataDeployBatch: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  dataDeployChunk: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
  },
  dataMovement: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  job: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: { DbNull: null } }));

import { DataDeployOrchestratorService } from './data-deploy-orchestrator.service';

describe('DataDeployOrchestratorService cancellation', () => {
  const removeJob = vi.fn();
  const cancelProcess = vi.fn();
  const withSchedulerLock = vi.fn();
  const enqueueJob = vi.fn();
  const addJob = vi.fn();
  let service: DataDeployOrchestratorService;

  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.dataDeployBatch.updateMany.mockResolvedValue({ count: 1 });
    db.dataDeployBatch.update.mockResolvedValue({});
    db.dataDeployChunk.updateMany.mockResolvedValue({ count: 2 });
    db.dataDeployChunk.update.mockResolvedValue({});
    db.dataMovement.updateMany.mockResolvedValue({ count: 2 });
    db.job.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
    db.job.updateMany.mockResolvedValue({ count: 2 });
    db.dataDeployChunk.groupBy.mockResolvedValue([
      { status: 'cancelled', _count: { _all: 2 } },
    ]);
    removeJob.mockResolvedValue(true);
    cancelProcess.mockResolvedValue(undefined);
    enqueueJob.mockResolvedValue({ id: 'planner-job' });
    addJob.mockResolvedValue('chunk-job');
    withSchedulerLock.mockImplementation(
      async (_id: string, callback: () => Promise<unknown>) => callback(),
    );
    service = new DataDeployOrchestratorService(
      { enqueueJob } as never,
      { withSchedulerLock } as never,
      { removeJob, addJob } as never,
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

  it('persists write-engine counters on a completed chunk', async () => {
    db.dataDeployChunk.updateMany.mockResolvedValueOnce({ count: 1 });
    db.dataDeployChunk.findUnique.mockResolvedValue({
      id: 'chunk-1',
      batchId: 'batch-1',
      movementId: null,
    });

    await service.onChunkCompleted('chunk-1', 35_000, {
      processedRecords: 35_000,
      failedRecords: 0,
    });

    expect(db.dataDeployChunk.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        status: 'completed',
        recordCount: 35_000,
        processedRecords: 35_000,
        failedRecords: 0,
      }),
    }));
  });

  it('tracks the planner job id when a deferred batch starts', async () => {
    db.dataDeployBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: 'pending',
      createdBy: 'owner',
    });

    await expect(service.startBatch('batch-1')).resolves.toEqual({ id: 'planner-job' });

    expect(db.dataDeployBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { plannerJobId: 'planner-job' },
    });
  });

  it('fails planning instead of reporting success when no source rows match', async () => {
    db.dataDeployBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: 'planning',
      baseSoql: 'SELECT Name FROM Account',
      requestedRecords: 35_000,
      totalRecords: 35_000,
      totalChunks: 2,
      chunkSize: 25_000,
      boundaryArtifact: null,
      chunks: [],
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
    });
    const sfCli = (service as unknown as {
      sfCli: {
        exportBulk: (
          soql: string,
          alias: string,
          outputPath: string,
        ) => Promise<{ success: boolean }>;
      };
    }).sfCli;
    sfCli.exportBulk = vi.fn(async (_soql, _alias, outputPath) => {
      await writeFile(outputPath, 'Id\n', 'utf8');
      return { success: true };
    });

    await expect(service.planBatch('batch-1', vi.fn())).rejects.toThrow(
      'No source records matched',
    );

    expect(db.dataDeployBatch.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'failed',
        error: expect.stringContaining('No source records matched'),
      }),
    }));
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

  it('keeps a chunk pending behind a durable job claim until queue publication succeeds', async () => {
    const batch = {
      id: 'batch-1',
      status: 'running',
      strategy: 'generic',
      operation: 'upsert',
      objectName: 'Account',
      matchField: 'External__c',
      externalIdField: 'External__c',
      recordTypeMappings: null,
      createdBy: 'owner',
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      movementType: 'deploy',
      rollbackPolicy: 'capture',
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
      maxParallelChunks: 1,
      quotaConfidence: 'unknown',
      quotaRemaining: null,
      chunkSize: 25_000,
      chunks: [{
        id: 'chunk-1',
        batchId: 'batch-1',
        chunkIndex: 0,
        movementId: 'movement-1',
        status: 'pending',
        jobId: null,
        soql: 'SELECT External__c FROM Account',
        recordCount: 10,
        attempts: 0,
      }],
    };
    db.dataDeployBatch.findUnique.mockResolvedValue(batch);
    db.job.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      queue: 'data-deploy',
      type: 'data_deploy_chunk',
      payload: { chunkId: 'chunk-1', batchId: 'batch-1' },
    }));

    await expect(service.releaseReadyChunks('batch-1')).resolves.toBe(1);

    const claimCall = db.dataDeployChunk.updateMany.mock.calls.find(
      ([arg]) => arg.where?.jobId === null,
    )?.[0];
    expect(claimCall.data).toEqual(expect.objectContaining({
      jobId: expect.any(String),
    }));
    expect(claimCall.data.status).toBeUndefined();
    const queuedCall = db.dataDeployChunk.updateMany.mock.calls.find(
      ([arg]) => arg.data?.status === 'queued',
    )?.[0];
    expect(db.job.create.mock.invocationCallOrder[0]).toBeLessThan(addJob.mock.invocationCallOrder[0]);
    expect(addJob.mock.invocationCallOrder[0])
      .toBeLessThan(db.dataDeployChunk.updateMany.mock.invocationCallOrder.at(-1)!);
    expect(queuedCall).toBeDefined();
  });

  it('republishes a stranded durable chunk claim with the original job id', async () => {
    const claimedBatch = {
      id: 'batch-1',
      status: 'running',
      maxParallelChunks: 1,
      quotaConfidence: 'unknown',
      quotaRemaining: null,
      chunks: [{
        id: 'chunk-1',
        batchId: 'batch-1',
        chunkIndex: 0,
        movementId: 'movement-1',
        status: 'pending',
        jobId: 'durable-job',
        attempts: 0,
      }],
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
    };
    db.dataDeployChunk.findMany.mockResolvedValue([{ batchId: 'batch-1' }]);
    db.dataDeployBatch.findUnique
      .mockResolvedValueOnce(claimedBatch)
      .mockResolvedValueOnce({
        ...claimedBatch,
        chunks: [{ ...claimedBatch.chunks[0], status: 'queued' }],
      });
    db.job.findUnique.mockResolvedValue({
      id: 'durable-job',
      queue: 'data-deploy',
      type: 'data_deploy_chunk',
      payload: { chunkId: 'chunk-1', batchId: 'batch-1' },
    });

    await expect(service.recoverStrandedChunkPublications()).resolves.toBe(1);

    expect(addJob).toHaveBeenCalledWith(
      'data-deploy',
      'data_deploy_chunk',
      expect.objectContaining({ dbJobId: 'durable-job' }),
      'durable-job',
    );
    expect(db.job.create).not.toHaveBeenCalled();
  });

  it('leaves the durable claim recoverable when finalization fails after enqueue', async () => {
    const batch = {
      id: 'batch-1',
      status: 'running',
      strategy: 'generic',
      operation: 'upsert',
      objectName: 'Account',
      matchField: 'External__c',
      externalIdField: 'External__c',
      recordTypeMappings: null,
      createdBy: 'owner',
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      movementType: 'deploy',
      rollbackPolicy: 'capture',
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
      maxParallelChunks: 1,
      quotaConfidence: 'unknown',
      quotaRemaining: null,
      chunkSize: 25_000,
      chunks: [{
        id: 'chunk-1',
        batchId: 'batch-1',
        chunkIndex: 0,
        movementId: 'movement-1',
        status: 'pending',
        jobId: null,
        soql: 'SELECT External__c FROM Account',
        recordCount: 10,
        attempts: 0,
      }],
    };
    db.dataDeployBatch.findUnique.mockResolvedValue(batch);
    db.job.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      queue: 'data-deploy',
      type: 'data_deploy_chunk',
      payload: { chunkId: 'chunk-1', batchId: 'batch-1' },
    }));
    db.$transaction
      .mockImplementationOnce((callback: (tx: typeof db) => unknown) => callback(db))
      .mockRejectedValueOnce(new Error('database unavailable after enqueue'));

    await expect(service.releaseReadyChunks('batch-1')).rejects.toThrow(
      'database unavailable after enqueue',
    );

    expect(addJob).toHaveBeenCalledTimes(1);
    expect(db.dataDeployChunk.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }));
    expect(db.job.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }));
  });

  it('keeps planBatch publication finalization failures recoverable for startup recovery', async () => {
    const boundaryArtifact = {
      kind: 'id-ranges',
      plannerQuery: 'SELECT Id FROM Account ORDER BY Id LIMIT 10',
      totalRecords: 10,
      boundaries: [
        { chunkIndex: 0, afterId: null, endId: '001Z', recordCount: 10 },
      ],
    };
    const batch = {
      id: 'batch-1',
      status: 'running',
      baseSoql: 'SELECT External__c FROM Account',
      totalRecords: 10,
      totalChunks: 1,
      chunkSize: 25_000,
      boundaryArtifact,
      strategy: 'generic',
      operation: 'upsert',
      objectName: 'Account',
      matchField: 'External__c',
      externalIdField: 'External__c',
      recordTypeMappings: null,
      createdBy: 'owner',
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      movementType: 'deploy',
      rollbackPolicy: 'capture',
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
      maxParallelChunks: 1,
      quotaConfidence: 'unknown',
      quotaRemaining: null,
      chunks: [{
        id: 'chunk-1',
        batchId: 'batch-1',
        chunkIndex: 0,
        movementId: 'movement-1',
        status: 'pending',
        jobId: null,
        soql: 'SELECT External__c FROM Account',
        recordCount: 10,
        attempts: 0,
      }],
    };
    db.dataDeployBatch.findUnique.mockResolvedValue(batch);
    db.job.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      queue: 'data-deploy',
      type: 'data_deploy_chunk',
      payload: { chunkId: 'chunk-1', batchId: 'batch-1' },
    }));
    db.$transaction
      .mockImplementationOnce((callback: (tx: typeof db) => unknown) => callback(db))
      .mockImplementationOnce((callback: (tx: typeof db) => unknown) => callback(db))
      .mockRejectedValueOnce(new Error('database unavailable after enqueue'));
    const log = vi.fn().mockResolvedValue(undefined);

    await expect(service.planBatch('batch-1', log)).rejects.toThrow(
      'publication finalization failed',
    );

    expect(addJob).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'stderr',
      expect.stringContaining('publication is recoverable'),
    );
    expect(log).not.toHaveBeenCalledWith(
      'stderr',
      expect.stringContaining('planning failed'),
    );
    expect(db.dataDeployChunk.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }));
    expect(db.dataDeployBatch.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed' }),
    }));
  });

  it('terminalizes and refreshes a chunk when queue publication fails', async () => {
    const batch = {
      id: 'batch-1',
      status: 'running',
      strategy: 'generic',
      operation: 'upsert',
      objectName: 'Account',
      matchField: 'External__c',
      externalIdField: 'External__c',
      recordTypeMappings: null,
      createdBy: 'owner',
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      movementType: 'deploy',
      rollbackPolicy: 'capture',
      sourceOrg: { alias: 'source', username: null },
      targetOrg: { alias: 'target', username: null },
      maxParallelChunks: 1,
      quotaConfidence: 'unknown',
      quotaRemaining: null,
      chunkSize: 25_000,
      chunks: [{
        id: 'chunk-1',
        batchId: 'batch-1',
        chunkIndex: 0,
        movementId: 'movement-1',
        status: 'pending',
        jobId: null,
        soql: 'SELECT External__c FROM Account',
        recordCount: 10,
        attempts: 0,
      }],
    };
    db.dataDeployBatch.findUnique
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(null);
    db.dataDeployChunk.groupBy.mockResolvedValue([
      { status: 'failed', _count: { _all: 1 } },
    ]);
    db.job.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      queue: 'data-deploy',
      type: 'data_deploy_chunk',
      payload: { chunkId: 'chunk-1', batchId: 'batch-1' },
    }));
    addJob.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.releaseReadyChunks('batch-1')).resolves.toBe(0);

    expect(db.dataDeployChunk.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'failed',
        errorDetails: expect.objectContaining({ phase: 'enqueue' }),
      }),
    }));
    expect(db.dataMovement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'failed' },
    }));
    expect(db.job.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', finishedAt: expect.any(Date) }),
    }));
    expect(db.dataDeployBatch.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', failedChunks: 1 }),
    }));
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
