import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  scratchOrgRenewal: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  scratchOrgRenewalRun: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  scratchOrg: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  orgConnection: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  automationRun: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { ScratchOrgRenewalService } from './scratch-org-renewal.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-17T12:00:00Z');

function pipelineConfig(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'create_new',
    alias: 'demo-org',
    devHubAlias: 'DevHub',
    duration: 30,
    gitSource: { provider: 'github', repo: 'acme/sf-project', branch: 'main' },
    pipelineSteps: { autoRunDataSeed: true, autoRunPartners: true, autoRunUsers: false },
    ...overrides,
  };
}

function scratchOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    alias: 'demo-org',
    username: 'demo-org@scratch.com',
    devHubAlias: 'DevHub',
    status: 'Active',
    expirationDate: new Date(NOW.getTime() + 10 * DAY_MS),
    createdBy: 'user-1',
    createdAt: new Date(NOW.getTime() - 20 * DAY_MS),
    ...overrides,
  };
}

function renewal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'renewal-1',
    name: 'Auto-renew demo-org',
    scratchOrgAlias: 'demo-org',
    configSnapshot: pipelineConfig(),
    sourceAutomationRunId: 'run-src',
    daysBeforeExpiry: 2,
    enabled: true,
    nextRunAt: new Date(NOW.getTime() - 60_000),
    trackedExpirationDate: new Date(NOW.getTime() + 10 * DAY_MS),
    activeAutomationRunId: null,
    activeRunAlias: null,
    lastRunAt: null,
    lastRunStatus: null,
    lastError: null,
    createdBy: 'user-1',
    createdAt: new Date(NOW.getTime() - DAY_MS),
    updatedAt: new Date(NOW.getTime() - DAY_MS),
    ...overrides,
  };
}

function createService() {
  const orchestrator = {
    startPipeline: vi.fn().mockResolvedValue({
      automationRunId: 'pipeline-run-1',
      jobId: 'job-1',
      status: 'running',
    }),
  };
  const notifications = { notify: vi.fn().mockResolvedValue(null) };
  const eligibility = {
    requireEligible: vi.fn().mockImplementation(
      (launch: Record<string, unknown>) => Promise.resolve({ config: launch }),
    ),
  };
  const service = new ScratchOrgRenewalService(
    orchestrator as never,
    notifications as never,
    eligibility as never,
  );
  return { service, orchestrator, notifications, eligibility };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Alias availability checks: nothing is taken unless a test overrides these.
  db.scratchOrg.findUnique.mockResolvedValue(null);
  db.orgConnection.findUnique.mockResolvedValue(null);
  db.scratchOrgRenewal.findUnique.mockResolvedValue(null);
});

describe('ScratchOrgRenewalService.create', () => {
  it('creates a rule armed N days before the tracked expiration', async () => {
    const org = scratchOrg();
    db.scratchOrg.findUnique.mockResolvedValue(org);
    db.automationRun.findFirst.mockResolvedValue({
      id: 'run-src',
      status: 'completed',
      createdAt: NOW,
      createdBy: 'user-1',
      intent: 'scratch_org_pipeline',
      config: pipelineConfig(),
    });
    db.scratchOrgRenewal.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(renewal({ ...data, id: 'renewal-1' })),
    );
    db.scratchOrg.findMany.mockResolvedValue([org]);
    const { service } = createService();

    const created = await service.create(
      { scratchOrgAlias: 'demo-org', daysBeforeExpiry: 2 },
      'user-1',
    );

    const createArgs = db.scratchOrgRenewal.create.mock.calls[0][0];
    expect(createArgs.data.scratchOrgAlias).toBe('demo-org');
    expect(createArgs.data.nextRunAt).toEqual(
      new Date(org.expirationDate.getTime() - 2 * DAY_MS),
    );
    expect(createArgs.data.configSnapshot.mode).toBe('create_new');
    expect(created.summary.metadataSource).toBe('acme/sf-project@main');
  });

  it('sanitizes a configure_existing source config into a replayable create_new launch', async () => {
    db.scratchOrg.findUnique.mockResolvedValue(scratchOrg({ devHubAlias: 'OrgDevHub' }));
    db.automationRun.findFirst.mockResolvedValue({
      id: 'run-src',
      status: 'completed',
      createdAt: NOW,
      createdBy: 'user-1',
      intent: 'scratch_org_pipeline',
      config: pipelineConfig({
        mode: 'configure_existing',
        existingOrgConnectionId: '4dfa04e8-6a26-4d8c-8b1c-000000000001',
        devHubAlias: undefined,
        alias: undefined,
      }),
    });
    db.scratchOrgRenewal.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(renewal({ ...data, id: 'renewal-1' })),
    );
    db.scratchOrg.findMany.mockResolvedValue([scratchOrg()]);
    const { service } = createService();

    await service.create({ scratchOrgAlias: 'demo-org' }, 'user-1');

    const snapshot = db.scratchOrgRenewal.create.mock.calls[0][0].data.configSnapshot;
    expect(snapshot.mode).toBe('create_new');
    expect(snapshot.existingOrgConnectionId).toBeUndefined();
    // Dev Hub falls back to the scratch org record when the source run has none.
    expect(snapshot.devHubAlias).toBe('OrgDevHub');
  });

  it('rejects orgs without a known expiration date', async () => {
    db.scratchOrg.findUnique.mockResolvedValue(scratchOrg({ expirationDate: null }));
    db.orgConnection.findUnique.mockResolvedValue({ expiresAt: null });
    const { service } = createService();

    await expect(
      service.create({ scratchOrgAlias: 'demo-org' }, 'user-1'),
    ).rejects.toThrow(/no known expiration date/i);
  });

  it('rejects orgs that were never created through the pipeline', async () => {
    db.scratchOrg.findUnique.mockResolvedValue(scratchOrg());
    db.orgConnection.findUnique.mockResolvedValue(null);
    db.automationRun.findFirst.mockResolvedValue(null);
    const { service } = createService();

    await expect(
      service.create({ scratchOrgAlias: 'demo-org' }, 'user-1'),
    ).rejects.toThrow(/No completed creation pipeline/i);
  });

  it('rejects a foreign scratch org', async () => {
    db.scratchOrg.findUnique.mockResolvedValue(scratchOrg({ createdBy: 'someone-else' }));
    const { service } = createService();

    await expect(
      service.create({ scratchOrgAlias: 'demo-org' }, 'user-1'),
    ).rejects.toThrow(/not found/i);
  });
});

describe('ScratchOrgRenewalService.runScheduledRenewal', () => {
  it('claims a due rule and starts the replacement pipeline with a fresh -r2 alias', async () => {
    const rule = renewal({
      configSnapshot: pipelineConfig({
        templateId: '11111111-1111-4111-8111-111111111111',
      }),
    });
    db.scratchOrgRenewal.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; scratchOrgAlias?: string } }) =>
        Promise.resolve(where.id === 'renewal-1' ? rule : null),
    );
    db.scratchOrgRenewal.updateMany.mockResolvedValue({ count: 1 });
    db.scratchOrgRenewalRun.create.mockResolvedValue({ id: 'rr-1' });
    db.scratchOrgRenewalRun.update.mockResolvedValue({});
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, orchestrator, eligibility } = createService();

    const result = await service.runScheduledRenewal('renewal-1', NOW);

    expect(result.claimed).toBe(true);
    expect(eligibility.requireEligible).toHaveBeenCalledWith(
      expect.not.objectContaining({ templateId: expect.anything() }),
      'user-1',
    );
    expect(eligibility.requireEligible.mock.calls[0][0]).toEqual(expect.objectContaining({
      alias: 'demo-org-r2',
      mode: 'create_new',
    }));
    expect(orchestrator.startPipeline).toHaveBeenCalledTimes(1);
    const [launch, owner] = orchestrator.startPipeline.mock.calls[0];
    expect(owner).toBe('user-1');
    expect(launch.mode).toBe('create_new');
    expect(launch.alias).toBe('demo-org-r2');
    expect(launch.devHubAlias).toBe('DevHub');
    // The rule now watches the started pipeline instead of a next fire time.
    const watchUpdate = db.scratchOrgRenewal.update.mock.calls.at(-1)![0];
    expect(watchUpdate.data.activeAutomationRunId).toBe('pipeline-run-1');
    expect(watchUpdate.data.activeRunAlias).toBe('demo-org-r2');
    expect(watchUpdate.data.nextRunAt).toBeNull();
  });

  it('increments the -rN suffix when renewing an already renewed org', async () => {
    const rule = renewal({ scratchOrgAlias: 'demo-org-r2' });
    db.scratchOrgRenewal.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; scratchOrgAlias?: string } }) =>
        Promise.resolve(where.id === 'renewal-1' ? rule : null),
    );
    db.scratchOrgRenewal.updateMany.mockResolvedValue({ count: 1 });
    db.scratchOrgRenewalRun.create.mockResolvedValue({ id: 'rr-1' });
    db.scratchOrgRenewalRun.update.mockResolvedValue({});
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, orchestrator } = createService();

    await service.runScheduledRenewal('renewal-1', NOW);

    expect(orchestrator.startPipeline.mock.calls[0][0].alias).toBe('demo-org-r3');
  });

  it('skips aliases that are already taken', async () => {
    const rule = renewal();
    db.scratchOrgRenewal.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; scratchOrgAlias?: string } }) =>
        Promise.resolve(where.id === 'renewal-1' ? rule : null),
    );
    db.scratchOrg.findUnique.mockImplementation(
      ({ where }: { where: { alias?: string } }) =>
        Promise.resolve(where.alias === 'demo-org-r2' ? { id: 'taken' } : null),
    );
    db.scratchOrgRenewal.updateMany.mockResolvedValue({ count: 1 });
    db.scratchOrgRenewalRun.create.mockResolvedValue({ id: 'rr-1' });
    db.scratchOrgRenewalRun.update.mockResolvedValue({});
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, orchestrator } = createService();

    await service.runScheduledRenewal('renewal-1', NOW);

    expect(orchestrator.startPipeline.mock.calls[0][0].alias).toBe('demo-org-r3');
  });

  it('does nothing when the claim is lost to another replica', async () => {
    db.scratchOrgRenewal.findUnique.mockResolvedValue(renewal());
    db.scratchOrgRenewal.updateMany.mockResolvedValue({ count: 0 });
    const { service, orchestrator } = createService();

    const result = await service.runScheduledRenewal('renewal-1', NOW);

    expect(result.claimed).toBe(false);
    expect(orchestrator.startPipeline).not.toHaveBeenCalled();
  });

  it('skips rules that already watch an in-flight pipeline', async () => {
    db.scratchOrgRenewal.findUnique.mockResolvedValue(
      renewal({ activeAutomationRunId: 'pipeline-run-0' }),
    );
    const { service } = createService();

    const result = await service.runScheduledRenewal('renewal-1', NOW);

    expect(result.claimed).toBe(false);
    expect(db.scratchOrgRenewal.updateMany).not.toHaveBeenCalled();
  });

  it('re-arms a retry and notifies the owner when the pipeline cannot start', async () => {
    const rule = renewal();
    db.scratchOrgRenewal.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; scratchOrgAlias?: string } }) =>
        Promise.resolve(where.id === 'renewal-1' ? rule : null),
    );
    db.scratchOrgRenewal.updateMany.mockResolvedValue({ count: 1 });
    db.scratchOrgRenewalRun.create.mockResolvedValue({ id: 'rr-1' });
    db.scratchOrgRenewalRun.update.mockResolvedValue({});
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, orchestrator, notifications } = createService();
    orchestrator.startPipeline.mockRejectedValue(new Error('Dev Hub not authenticated'));

    const result = await service.runScheduledRenewal('renewal-1', NOW);

    expect(result.claimed).toBe(true);
    const failureUpdate = db.scratchOrgRenewal.update.mock.calls.at(-1)![0];
    expect(failureUpdate.data.lastRunStatus).toBe('failed');
    // Tracked org is still alive, so the rule retries instead of disabling.
    expect(failureUpdate.data.nextRunAt).toEqual(new Date(NOW.getTime() + 6 * 60 * 60 * 1000));
    expect(failureUpdate.data.enabled).toBeUndefined();
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'environment', level: 'error', userId: 'user-1' }),
    );
  });

  it('runs the shared live eligibility gate before starting a renewal pipeline', async () => {
    const rule = renewal();
    db.scratchOrgRenewal.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; scratchOrgAlias?: string } }) =>
        Promise.resolve(where.id === 'renewal-1' ? rule : null),
    );
    db.scratchOrgRenewal.updateMany.mockResolvedValue({ count: 1 });
    db.scratchOrgRenewalRun.create.mockResolvedValue({ id: 'rr-1' });
    db.scratchOrgRenewalRun.update.mockResolvedValue({});
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, orchestrator, eligibility } = createService();
    eligibility.requireEligible.mockRejectedValue(new Error('Dev Hub CLI authentication expired'));

    await expect(service.runScheduledRenewal('renewal-1', NOW)).resolves.toEqual({
      claimed: true,
    });

    expect(eligibility.requireEligible).toHaveBeenCalledTimes(1);
    expect(orchestrator.startPipeline).not.toHaveBeenCalled();
    expect(db.scratchOrgRenewal.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastRunStatus: 'failed' }),
    }));
  });
});

describe('ScratchOrgRenewalService.finalizeActiveRuns', () => {
  it('rolls the rule forward to the replacement org and re-arms the next cycle', async () => {
    const rule = renewal({
      activeAutomationRunId: 'pipeline-run-1',
      activeRunAlias: 'demo-org-r2',
      lastRunStatus: 'started',
      nextRunAt: null,
    });
    const newExpiration = new Date(NOW.getTime() + 30 * DAY_MS);
    db.scratchOrgRenewal.findMany.mockResolvedValue([rule]);
    db.automationRun.findUnique.mockResolvedValue({ status: 'completed', lastError: null });
    db.scratchOrg.findUnique.mockResolvedValue(
      scratchOrg({ alias: 'demo-org-r2', expirationDate: newExpiration }),
    );
    db.scratchOrgRenewal.update.mockResolvedValue({});
    db.scratchOrgRenewalRun.updateMany.mockResolvedValue({ count: 1 });
    const { service, notifications } = createService();

    const finalized = await service.finalizeActiveRuns(NOW);

    expect(finalized).toBe(1);
    const update = db.scratchOrgRenewal.update.mock.calls[0][0];
    expect(update.data.scratchOrgAlias).toBe('demo-org-r2');
    expect(update.data.nextRunAt).toEqual(new Date(newExpiration.getTime() - 2 * DAY_MS));
    expect(update.data.activeAutomationRunId).toBeNull();
    expect(update.data.lastRunStatus).toBe('succeeded');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'success', userId: 'user-1' }),
    );
  });

  it('leaves in-flight pipelines alone', async () => {
    db.scratchOrgRenewal.findMany.mockResolvedValue([
      renewal({ activeAutomationRunId: 'pipeline-run-1', activeRunAlias: 'demo-org-r2' }),
    ]);
    db.automationRun.findUnique.mockResolvedValue({ status: 'running', lastError: null });
    const { service } = createService();

    const finalized = await service.finalizeActiveRuns(NOW);

    expect(finalized).toBe(0);
    expect(db.scratchOrgRenewal.update).not.toHaveBeenCalled();
  });

  it('keeps awaiting-input renewals active and notifies the owner once', async () => {
    db.scratchOrgRenewal.findMany.mockResolvedValue([
      renewal({
        activeAutomationRunId: 'pipeline-run-1',
        activeRunAlias: 'demo-org-r2',
        lastRunStatus: 'started',
      }),
    ]);
    db.automationRun.findUnique.mockResolvedValue({
      status: 'awaiting_input',
      lastError: null,
    });
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, notifications } = createService();

    const finalized = await service.finalizeActiveRuns(NOW);

    expect(finalized).toBe(0);
    expect(db.scratchOrgRenewal.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'renewal-1' },
      data: { lastRunStatus: 'awaiting_input', lastError: null },
    }));
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warning',
      userId: 'user-1',
    }));
  });

  it('notifies once when the replacement pipeline pauses, and keeps watching', async () => {
    db.scratchOrgRenewal.findMany.mockResolvedValue([
      renewal({
        activeAutomationRunId: 'pipeline-run-1',
        activeRunAlias: 'demo-org-r2',
        lastRunStatus: 'started',
      }),
    ]);
    db.automationRun.findUnique.mockResolvedValue({
      status: 'paused',
      lastError: 'Metadata deploy failed',
    });
    db.scratchOrgRenewal.update.mockResolvedValue({});
    const { service, notifications } = createService();

    await service.finalizeActiveRuns(NOW);

    const update = db.scratchOrgRenewal.update.mock.calls[0][0];
    expect(update.data.lastRunStatus).toBe('paused');
    expect(update.data.activeAutomationRunId).toBeUndefined();
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('disables the rule when the pipeline fails after the tracked org is long gone', async () => {
    db.scratchOrgRenewal.findMany.mockResolvedValue([
      renewal({
        activeAutomationRunId: 'pipeline-run-1',
        activeRunAlias: 'demo-org-r2',
        trackedExpirationDate: new Date(NOW.getTime() - 3 * DAY_MS),
      }),
    ]);
    db.automationRun.findUnique.mockResolvedValue({
      status: 'failed',
      lastError: 'scratch org limit reached',
    });
    db.scratchOrgRenewal.update.mockResolvedValue({});
    db.scratchOrgRenewalRun.updateMany.mockResolvedValue({ count: 1 });
    const { service, notifications } = createService();

    await service.finalizeActiveRuns(NOW);

    const update = db.scratchOrgRenewal.update.mock.calls[0][0];
    expect(update.data.enabled).toBe(false);
    expect(update.data.nextRunAt).toBeNull();
    expect(update.data.lastRunStatus).toBe('failed');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error' }),
    );
  });
});

describe('ScratchOrgRenewalService.update', () => {
  it('re-arms from the tracked org expiration when enabling', async () => {
    const expiration = new Date(NOW.getTime() + 8 * DAY_MS);
    db.scratchOrgRenewal.findUnique.mockResolvedValue(
      renewal({ enabled: false, nextRunAt: null }),
    );
    db.scratchOrg.findUnique.mockResolvedValue(scratchOrg({ expirationDate: expiration }));
    db.scratchOrgRenewal.update.mockResolvedValue(renewal());
    db.scratchOrg.findMany.mockResolvedValue([scratchOrg()]);
    const { service } = createService();

    await service.update('renewal-1', { enabled: true, daysBeforeExpiry: 5 }, 'user-1');

    const update = db.scratchOrgRenewal.update.mock.calls[0][0];
    expect(update.data.enabled).toBe(true);
    expect(update.data.nextRunAt).toEqual(new Date(expiration.getTime() - 5 * DAY_MS));
  });

  it('clears the fire time when disabling', async () => {
    db.scratchOrgRenewal.findUnique.mockResolvedValue(renewal());
    db.scratchOrgRenewal.update.mockResolvedValue(renewal({ enabled: false }));
    db.scratchOrg.findMany.mockResolvedValue([scratchOrg()]);
    const { service } = createService();

    await service.update('renewal-1', { enabled: false }, 'user-1');

    const update = db.scratchOrgRenewal.update.mock.calls[0][0];
    expect(update.data.enabled).toBe(false);
    expect(update.data.nextRunAt).toBeNull();
  });

  it('rejects a foreign rule', async () => {
    db.scratchOrgRenewal.findUnique.mockResolvedValue(renewal({ createdBy: 'someone-else' }));
    const { service } = createService();

    await expect(
      service.update('renewal-1', { enabled: false }, 'user-1'),
    ).rejects.toThrow(/not found/i);
  });
});
