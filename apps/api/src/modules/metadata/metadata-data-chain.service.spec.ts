import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
  dataMovement: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  job: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  automationRun: { findUnique: vi.fn() },
  deploymentQualityRun: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('../data/sfdmu-config.generator', () => ({
  generateSfdmuConfigFromSoql: vi.fn(() => ({ configPath: '/tmp/export.json' })),
}));

import { MetadataDataChainService } from './metadata-data-chain.service';

describe('MetadataDataChainService Workbench ownership and cancellation', () => {
  const addJob = vi.fn();
  const removeJob = vi.fn();
  const createJob = vi.fn();
  const cancelProcess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique
      .mockResolvedValueOnce({
        id: 'source',
        alias: 'source',
        username: null,
        createdBy: 'owner',
      })
      .mockResolvedValueOnce({
        id: 'target',
        alias: 'target',
        username: null,
        createdBy: 'owner',
      });
    db.dataMovement.create.mockResolvedValue({ id: 'movement-1' });
    db.dataMovement.update.mockResolvedValue({});
    db.dataMovement.updateMany.mockResolvedValue({ count: 1 });
    db.dataMovement.findMany.mockResolvedValue([]);
    db.job.updateMany.mockResolvedValue({ count: 1 });
    db.job.findMany.mockResolvedValue([]);
    db.automationRun.findUnique.mockResolvedValue({ status: 'running' });
    db.deploymentQualityRun.findUnique.mockResolvedValue({ status: 'running' });
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    createJob.mockResolvedValue({ id: 'data-job-1' });
    addJob.mockResolvedValue({});
    removeJob.mockResolvedValue(true);
    cancelProcess.mockResolvedValue(undefined);
  });

  it('tags child jobs and movements and makes the terminal wait observe cancellation', async () => {
    const service = new MetadataDataChainService(
      { addJob, removeJob } as never,
      { create: createJob } as never,
      { cancel: cancelProcess } as never,
    );
    db.job.findUnique
      .mockResolvedValueOnce({ id: 'data-job-1', status: 'running', error: null })
      .mockResolvedValue({ id: 'data-job-1', status: 'cancelled', error: 'Parent deployment cancelled' });
    const isCancelled = vi.fn(async () =>
      addJob.mock.calls.length > 0 && db.job.findUnique.mock.calls.length > 0);

    await expect(service.runChainedDataDeploys({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      dataDeployConfig: [{ objectName: 'Account' }],
      workbenchRunId: 'workbench-1',
      createdBy: 'owner',
      onLog: vi.fn().mockResolvedValue(undefined),
      awaitTerminal: true,
      isCancelled,
    })).rejects.toThrow('Chained data deployment cancelled');

    expect(db.dataMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdBy: 'owner',
        sfdmuConfig: { workbenchRunId: 'workbench-1' },
      }),
    });
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        movementId: 'movement-1',
        workbenchRunId: 'workbench-1',
      }),
    }));
    expect(addJob).toHaveBeenCalledWith(
      'sfdmu-run',
      'org_to_org_data_deploy',
      expect.objectContaining({
        movementId: 'movement-1',
        workbenchRunId: 'workbench-1',
      }),
      'data-job-1',
    );
    expect(db.job.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(db.dataMovement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'cancelled' },
    }));
    expect(removeJob).toHaveBeenCalledWith('sfdmu-run', 'data-job-1');
    expect(cancelProcess).toHaveBeenCalledWith('data-job-1');
  });

  it('cancels a child created in the parent-cancellation race before enqueue', async () => {
    const service = new MetadataDataChainService(
      { addJob, removeJob } as never,
      { create: createJob } as never,
      { cancel: cancelProcess } as never,
    );
    const isCancelled = vi.fn(async () => db.dataMovement.create.mock.calls.length > 0);

    await expect(service.runChainedDataDeploys({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      dataDeployConfig: [{ objectName: 'Account' }],
      workbenchRunId: 'workbench-1',
      createdBy: 'owner',
      onLog: vi.fn().mockResolvedValue(undefined),
      isCancelled,
    })).rejects.toThrow('Chained data deployment cancelled');

    expect(createJob).not.toHaveBeenCalled();
    expect(addJob).not.toHaveBeenCalled();
    expect(db.dataMovement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'movement-1' }),
      data: { status: 'cancelled' },
    }));
    expect(db.dataMovement.findMany).toHaveBeenCalled();
  });

  it('uses durable parent status before creating a child', async () => {
    const service = new MetadataDataChainService(
      { addJob, removeJob } as never,
      { create: createJob } as never,
      { cancel: cancelProcess } as never,
    );
    db.deploymentQualityRun.findUnique.mockResolvedValue({ status: 'cancelled' });

    await expect(service.runChainedDataDeploys({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      dataDeployConfig: [{ objectName: 'Account' }],
      workbenchRunId: 'workbench-1',
      createdBy: 'owner',
      onLog: vi.fn().mockResolvedValue(undefined),
    })).rejects.toThrow('Chained data deployment cancelled');

    expect(db.dataMovement.create).not.toHaveBeenCalled();
    expect(createJob).not.toHaveBeenCalled();
    expect(addJob).not.toHaveBeenCalled();
  });

  it('reconciles repeatedly when cancellation races queue publication', async () => {
    const service = new MetadataDataChainService(
      { addJob, removeJob } as never,
      { create: createJob } as never,
      { cancel: cancelProcess } as never,
    );
    const isCancelled = vi.fn(async () => addJob.mock.calls.length > 0);
    db.job.findMany
      .mockResolvedValueOnce([{ id: 'data-job-1' }])
      .mockResolvedValueOnce([]);

    await expect(service.runChainedDataDeploys({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      dataDeployConfig: [{ objectName: 'Account' }],
      workbenchRunId: 'workbench-1',
      createdBy: 'owner',
      onLog: vi.fn().mockResolvedValue(undefined),
      isCancelled,
    })).rejects.toThrow('Chained data deployment cancelled');

    expect(addJob).toHaveBeenCalledTimes(1);
    expect(db.job.findMany).toHaveBeenCalledTimes(2);
    expect(removeJob).toHaveBeenCalledWith('sfdmu-run', 'data-job-1');
    expect(cancelProcess).toHaveBeenCalledWith('data-job-1');
  });
});
