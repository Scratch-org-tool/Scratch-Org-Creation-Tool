import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  deployment: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { MetadataEnqueueError } from './metadata-deploy-queue.service';
import { DeploymentService } from './deployment.service';

describe('DeploymentService approval compensation', () => {
  const enqueue = vi.fn();
  const triggerBuild = vi.fn();
  let service: DeploymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    db.deployment.update.mockResolvedValue({});
    db.deployment.updateMany.mockResolvedValue({ count: 1 });
    service = new DeploymentService(
      {} as never,
      {} as never,
      {} as never,
      { triggerBuild } as never,
      { enqueue } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  function deployment(strategy: 'azure' | 'jenkins') {
    return {
      id: 'deployment-1',
      strategy,
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      metadata: {},
      repo: 'metadata',
      branch: 'main',
      createdBy: 'user-1',
      targetOrg: {
        alias: 'target',
        username: 'target@example.com',
      },
    };
  }

  it('restores approval fields when metadata enqueue failed before dispatch', async () => {
    db.deployment.findUnique.mockResolvedValue(deployment('azure'));
    enqueue.mockRejectedValue(new MetadataEnqueueError(new Error('inactive'), false));

    await expect(service.approveDeployment('deployment-1', 'user-1')).rejects.toThrow('inactive');

    expect(db.deployment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'deployment-1',
        status: 'queued',
        approvedBy: 'user-1',
        approvedAt: expect.any(Date),
      },
      data: {
        status: 'pending',
        approvedBy: null,
        approvedAt: null,
      },
    });
  });

  it.each([
    ['queue dispatch', 'azure', new MetadataEnqueueError(new Error('timeout'), true)],
    ['Jenkins trigger', 'jenkins', new Error('timeout')],
  ] as const)('does not compensate an ambiguous %s failure', async (_label, strategy, error) => {
    db.deployment.findUnique.mockResolvedValue(deployment(strategy));
    if (strategy === 'azure') enqueue.mockRejectedValue(error);
    else triggerBuild.mockRejectedValue(error);

    await expect(service.approveDeployment('deployment-1', 'user-1')).rejects.toThrow('timeout');
    expect(db.deployment.updateMany).not.toHaveBeenCalled();
    expect(db.deployment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'queued' }),
    }));
  });
});
