import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  driftMonitor: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  driftSnapshot: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  orgConnection: { findUnique: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { DriftService } from './drift.service';

function monitor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mon-1',
    name: 'Prod vs UAT',
    description: null,
    sourceOrgId: 'src',
    targetOrgId: 'tgt',
    metadataTypes: ['ApexClass'],
    schedule: { frequency: 'daily', minute: 0, hour: 2 },
    scheduleEnabled: true,
    enabled: true,
    notifyOnDrift: true,
    nextRunAt: new Date('2026-07-16T02:00:00Z'),
    lastCheckedAt: null,
    lastStatus: null,
    lastDriftCount: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-07-15T00:00:00Z'),
    updatedAt: new Date('2026-07-15T00:00:00Z'),
    ...overrides,
  };
}

function createService() {
  const browseService = { listComponentsRaw: vi.fn() };
  const notifications = { notify: vi.fn().mockResolvedValue(null) };
  const deploymentService = { deployOrgToOrgMetadata: vi.fn() };
  const service = new DriftService(
    browseService as never,
    notifications as never,
    deploymentService as never,
  );
  return { service, browseService, notifications, deploymentService };
}

describe('DriftService.runCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue({ id: 'org', createdBy: 'user-1' });
    db.driftSnapshot.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'snap-1',
      createdAt: new Date('2026-07-16T02:00:00Z'),
      byType: null,
      items: null,
      newlyDrifted: null,
      error: null,
      ...data,
    }));
    db.driftMonitor.update.mockResolvedValue({});
  });

  it('records drift and alerts the owner about newly drifted components', async () => {
    const { service, browseService, notifications } = createService();
    // Source has a class that the target is missing → one "new" difference.
    browseService.listComponentsRaw
      .mockResolvedValueOnce([{ fullName: 'AccountService' }]) // source
      .mockResolvedValueOnce([]); // target
    db.driftSnapshot.findFirst.mockResolvedValue(null);

    await service.runCheck(monitor() as never, 'schedule');

    const createArgs = db.driftSnapshot.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('drifted');
    expect(createArgs.data.totalDifferences).toBe(1);
    expect(createArgs.data.added).toBe(1);
    expect(db.driftMonitor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastStatus: 'drifted', lastDriftCount: 1 }) }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'deployment', level: 'warning' }),
    );
  });

  it('does not alert when notifyOnDrift is off', async () => {
    const { service, browseService, notifications } = createService();
    browseService.listComponentsRaw
      .mockResolvedValueOnce([{ fullName: 'AccountService' }])
      .mockResolvedValueOnce([]);
    db.driftSnapshot.findFirst.mockResolvedValue(null);

    await service.runCheck(monitor({ notifyOnDrift: false }) as never, 'schedule');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('records a clean snapshot when the orgs match', async () => {
    const { service, browseService, notifications } = createService();
    browseService.listComponentsRaw
      .mockResolvedValueOnce([{ fullName: 'AccountService', lastModifiedDate: '2026-01-01T00:00:00Z' }])
      .mockResolvedValueOnce([{ fullName: 'AccountService', lastModifiedDate: '2026-01-01T00:00:00Z' }]);
    db.driftSnapshot.findFirst.mockResolvedValue(null);

    await service.runCheck(monitor() as never, 'schedule');
    const createArgs = db.driftSnapshot.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('clean');
    expect(createArgs.data.totalDifferences).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('marks the snapshot failed when every metadata listing fails', async () => {
    const { service, browseService } = createService();
    browseService.listComponentsRaw.mockRejectedValue(new Error('CLI exploded'));

    const result = await service.runCheck(monitor() as never, 'schedule');
    expect(result).toBeNull();
    const createArgs = db.driftSnapshot.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('failed');
    expect(db.driftMonitor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastStatus: 'failed' }) }),
    );
  });
});

describe('DriftService.runScheduledMonitor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs a check when the claim is won', async () => {
    db.driftMonitor.findUnique.mockResolvedValue(monitor());
    db.driftMonitor.updateMany.mockResolvedValue({ count: 1 });
    const { service } = createService();
    const runCheck = vi.spyOn(service, 'runCheck').mockResolvedValue(null as never);

    const result = await service.runScheduledMonitor('mon-1', new Date('2026-07-16T02:05:00Z'));
    expect(result.claimed).toBe(true);
    expect(runCheck).toHaveBeenCalledTimes(1);
    const claimArgs = db.driftMonitor.updateMany.mock.calls[0][0];
    expect(claimArgs.data.nextRunAt).toBeInstanceOf(Date);
  });

  it('does not run when the claim is lost', async () => {
    db.driftMonitor.findUnique.mockResolvedValue(monitor());
    db.driftMonitor.updateMany.mockResolvedValue({ count: 0 });
    const { service } = createService();
    const runCheck = vi.spyOn(service, 'runCheck').mockResolvedValue(null as never);

    const result = await service.runScheduledMonitor('mon-1');
    expect(result.claimed).toBe(false);
    expect(runCheck).not.toHaveBeenCalled();
  });
});

describe('DriftService remediation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.driftMonitor.findUnique.mockResolvedValue(monitor());
  });

  const driftedSnapshot = {
    id: 'snap-9',
    monitorId: 'mon-1',
    status: 'drifted',
    createdAt: new Date('2026-07-17T01:00:00Z'),
    items: [
      { metadataType: 'ApexClass', fullName: 'Alpha', diffType: 'new' },
      { metadataType: 'ApexClass', fullName: 'Beta', diffType: 'changed' },
      { metadataType: 'CustomObject', fullName: 'Extra__c', diffType: 'deleted' },
    ],
  };

  it('builds a preview that separates deploys from deletions', async () => {
    db.driftSnapshot.findFirst.mockResolvedValue(driftedSnapshot);
    const { service } = createService();

    const preview = await service.remediationPreview('mon-1', 'user-1');
    expect(preview.deployCount).toBe(2);
    expect(preview.deleteCount).toBe(1);
    expect(preview.deploySelections).toEqual([
      { metadataType: 'ApexClass', members: ['Alpha', 'Beta'] },
    ]);
    expect(preview.deleteSelections).toEqual([
      { metadataType: 'CustomObject', members: ['Extra__c'] },
    ]);
  });

  it('creates the org-to-org deployment from the snapshot plan', async () => {
    db.driftSnapshot.findFirst.mockResolvedValue(driftedSnapshot);
    const { service, deploymentService } = createService();
    deploymentService.deployOrgToOrgMetadata.mockResolvedValue({ deploymentId: 'dep-1', jobId: 'job-1' });

    const result = await service.remediate('mon-1', { includeDeletions: true }, 'user-1');

    expect(deploymentService.deployOrgToOrgMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceOrgId: 'src',
        targetOrgId: 'tgt',
        selections: [{ metadataType: 'ApexClass', members: ['Alpha', 'Beta'] }],
        destructiveSelections: [{ metadataType: 'CustomObject', members: ['Extra__c'] }],
        validateOnly: false,
      }),
      'user-1',
    );
    expect(result.deployCount).toBe(2);
    expect(result.deleteCount).toBe(1);
  });

  it('omits destructive changes unless explicitly requested', async () => {
    db.driftSnapshot.findFirst.mockResolvedValue(driftedSnapshot);
    const { service, deploymentService } = createService();
    deploymentService.deployOrgToOrgMetadata.mockResolvedValue({ deploymentId: 'dep-1' });

    await service.remediate('mon-1', {}, 'user-1');
    const payload = deploymentService.deployOrgToOrgMetadata.mock.calls[0][0];
    expect(payload.destructiveSelections).toBeUndefined();
  });

  it('rejects remediation when there is nothing to deploy', async () => {
    db.driftSnapshot.findFirst.mockResolvedValue({
      ...driftedSnapshot,
      items: [{ metadataType: 'CustomObject', fullName: 'Extra__c', diffType: 'deleted' }],
    });
    const { service, deploymentService } = createService();

    await expect(service.remediate('mon-1', {}, 'user-1')).rejects.toThrow(
      /nothing to remediate/i,
    );
    expect(deploymentService.deployOrgToOrgMetadata).not.toHaveBeenCalled();
  });
});

describe('DriftService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue({ id: 'org', createdBy: 'user-1' });
  });

  it('computes the next run time when a schedule is enabled', async () => {
    db.driftMonitor.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...monitor(),
      ...data,
    }));
    const { service } = createService();

    await service.create(
      {
        name: 'Prod vs UAT',
        sourceOrgId: '11111111-1111-1111-1111-111111111111',
        targetOrgId: '22222222-2222-2222-2222-222222222222',
        metadataTypes: ['ApexClass'],
        schedule: { frequency: 'daily', minute: 0, hour: 2 },
        scheduleEnabled: true,
      },
      'user-1',
    );

    const createArgs = db.driftMonitor.create.mock.calls[0][0];
    expect(createArgs.data.scheduleEnabled).toBe(true);
    expect(createArgs.data.nextRunAt).toBeInstanceOf(Date);
  });
});
