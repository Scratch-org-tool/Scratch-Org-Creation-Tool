import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  deploymentPlan: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  deploymentPlanRun: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  orgConnection: { findUnique: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { PlansService } from './plans.service';

function metadataPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    name: 'Nightly promotion',
    planType: 'metadata',
    sourceOrgId: 'src',
    targetOrgId: 'tgt',
    enabled: true,
    scheduleEnabled: true,
    schedule: { frequency: 'daily', minute: 0, hour: 2 },
    metadataConfig: { packageXml: '<Package/>' },
    dataConfig: null,
    createdBy: 'user-1',
    ...overrides,
  };
}

function createService() {
  const deploymentService = {
    deployOrgToOrgMetadata: vi.fn().mockResolvedValue({ deploymentId: 'd1', jobId: 'job-1', status: 'running' }),
  };
  const metadataPipeline = { startPipeline: vi.fn().mockResolvedValue({ automationRunId: 'run-1' }) };
  const dataService = { deployOrgToOrgBatch: vi.fn().mockResolvedValue({ groupId: 'g1' }) };
  const notifications = { notify: vi.fn().mockResolvedValue(null) };
  const service = new PlansService(
    deploymentService as never,
    metadataPipeline as never,
    dataService as never,
    notifications as never,
  );
  return { service, deploymentService, metadataPipeline, dataService, notifications };
}

describe('PlansService.runScheduledPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('claims a due plan, executes it and records a succeeded run', async () => {
    const plan = metadataPlan();
    db.deploymentPlan.findUnique.mockResolvedValue(plan);
    db.deploymentPlan.updateMany.mockResolvedValue({ count: 1 });
    db.deploymentPlanRun.create.mockResolvedValue({ id: 'run-1' });
    db.deploymentPlanRun.update.mockResolvedValue({});
    db.deploymentPlan.update.mockResolvedValue({});
    const { service, deploymentService } = createService();

    const result = await service.runScheduledPlan('plan-1', new Date('2026-07-16T03:00:00Z'));

    expect(result.claimed).toBe(true);
    expect(deploymentService.deployOrgToOrgMetadata).toHaveBeenCalledTimes(1);
    // The claim advances nextRunAt so a sibling replica cannot double-fire.
    const claimArgs = db.deploymentPlan.updateMany.mock.calls[0][0];
    expect(claimArgs.data.nextRunAt).toBeInstanceOf(Date);
    const runUpdate = db.deploymentPlanRun.update.mock.calls[0][0];
    expect(runUpdate.data.status).toBe('succeeded');
    expect(runUpdate.data.jobId).toBe('job-1');
  });

  it('does nothing when the claim is lost to another replica', async () => {
    db.deploymentPlan.findUnique.mockResolvedValue(metadataPlan());
    db.deploymentPlan.updateMany.mockResolvedValue({ count: 0 });
    const { service, deploymentService } = createService();

    const result = await service.runScheduledPlan('plan-1');
    expect(result.claimed).toBe(false);
    expect(deploymentService.deployOrgToOrgMetadata).not.toHaveBeenCalled();
    expect(db.deploymentPlanRun.create).not.toHaveBeenCalled();
  });

  it('skips plans whose schedule is disabled', async () => {
    db.deploymentPlan.findUnique.mockResolvedValue(metadataPlan({ scheduleEnabled: false }));
    const { service } = createService();
    const result = await service.runScheduledPlan('plan-1');
    expect(result.claimed).toBe(false);
    expect(db.deploymentPlan.updateMany).not.toHaveBeenCalled();
  });

  it('records a failed run and notifies the owner when execution cannot start', async () => {
    db.deploymentPlan.findUnique.mockResolvedValue(metadataPlan());
    db.deploymentPlan.updateMany.mockResolvedValue({ count: 1 });
    db.deploymentPlanRun.create.mockResolvedValue({ id: 'run-1' });
    db.deploymentPlanRun.update.mockResolvedValue({});
    db.deploymentPlan.update.mockResolvedValue({});
    const { service, deploymentService, notifications } = createService();
    deploymentService.deployOrgToOrgMetadata.mockRejectedValue(new Error('org not found'));

    const result = await service.runScheduledPlan('plan-1');

    expect(result.claimed).toBe(true);
    const runUpdate = db.deploymentPlanRun.update.mock.calls[0][0];
    expect(runUpdate.data.status).toBe('failed');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'deployment', level: 'error', userId: 'user-1' }),
    );
  });
});

describe('PlansService.updateSchedule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes the next run time when enabling a schedule', async () => {
    db.deploymentPlan.findUnique.mockResolvedValue(metadataPlan({ schedule: null, scheduleEnabled: false }));
    db.deploymentPlan.update.mockResolvedValue({});
    const { service } = createService();

    await service.updateSchedule(
      'plan-1',
      { schedule: { frequency: 'daily', minute: 30, hour: 4 }, scheduleEnabled: true },
      'user-1',
    );

    const updateArgs = db.deploymentPlan.update.mock.calls[0][0];
    expect(updateArgs.data.scheduleEnabled).toBe(true);
    expect(updateArgs.data.nextRunAt).toBeInstanceOf(Date);
  });

  it('clears the next run time when disabling', async () => {
    db.deploymentPlan.findUnique.mockResolvedValue(metadataPlan());
    db.deploymentPlan.update.mockResolvedValue({});
    const { service } = createService();

    await service.updateSchedule('plan-1', { scheduleEnabled: false }, 'user-1');

    const updateArgs = db.deploymentPlan.update.mock.calls[0][0];
    expect(updateArgs.data.scheduleEnabled).toBe(false);
    expect(updateArgs.data.nextRunAt).toBeNull();
  });

  it('rejects a foreign plan', async () => {
    db.deploymentPlan.findUnique.mockResolvedValue(metadataPlan({ createdBy: 'someone-else' }));
    const { service } = createService();
    await expect(
      service.updateSchedule('plan-1', { scheduleEnabled: false }, 'user-1'),
    ).rejects.toThrow();
  });
});
