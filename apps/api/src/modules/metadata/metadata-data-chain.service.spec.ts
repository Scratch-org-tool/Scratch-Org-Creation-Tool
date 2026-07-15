import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
  dataMovement: { create: vi.fn(), update: vi.fn() },
  job: { findUnique: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('../data/sfdmu-config.generator', () => ({
  generateSfdmuConfigFromSoql: vi.fn(() => ({ configPath: '/tmp/export.json' })),
}));

import { MetadataDataChainService } from './metadata-data-chain.service';

describe('MetadataDataChainService Workbench ownership and cancellation', () => {
  const addJob = vi.fn();
  const createJob = vi.fn();

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
    db.job.findUnique.mockResolvedValue({ id: 'data-job-1', status: 'running', error: null });
    createJob.mockResolvedValue({ id: 'data-job-1' });
    addJob.mockResolvedValue({});
  });

  it('tags child jobs and movements and makes the terminal wait observe cancellation', async () => {
    const service = new MetadataDataChainService(
      { addJob } as never,
      { create: createJob } as never,
    );
    const isCancelled = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    await expect(service.runChainedDataDeploys({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      dataDeployConfig: [{ objectName: 'Account' }],
      workbenchRunId: 'workbench-1',
      createdBy: 'owner',
      onLog: vi.fn().mockResolvedValue(undefined),
      awaitTerminal: true,
      isCancelled,
    })).rejects.toThrow('data-job-1 cancelled');

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
  });
});
