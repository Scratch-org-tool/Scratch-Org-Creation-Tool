import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

const db = vi.hoisted(() => ({
  orgConnection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  sandboxRefresh: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const sfCli = vi.hoisted(() => ({
  refreshSandbox: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));

import { SandboxRefreshService } from './sandbox-refresh.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const SEED_SOURCE = '22222222-2222-4222-8222-222222222222';

function createService() {
  const dataService = { enqueueConaSeed: vi.fn().mockResolvedValue({ jobId: 'seed-job' }) };
  const notifications = { notify: vi.fn().mockResolvedValue(null) };
  const service = new SandboxRefreshService(dataService as never, notifications as never);
  return { service, dataService, notifications };
}

function org() {
  return { id: ORG_ID, alias: 'prod', username: 'prod@example.test', createdBy: 'DPT_user' };
}

function refreshRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sr1',
    orgConnectionId: ORG_ID,
    sandboxName: 'UAT',
    status: 'requested',
    notes: null,
    cadenceDays: 30,
    nextRefreshDueAt: null,
    postRefreshConfig: null,
    requestedBy: 'DPT_user',
    requestedAt: new Date('2026-07-17T00:00:00.000Z'),
    completedAt: null,
    updatedAt: new Date('2026-07-17T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SandboxRefreshService.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('triggers a CLI refresh and records the refreshing state', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.sandboxRefresh.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      refreshRow(data),
    );
    sfCli.refreshSandbox.mockResolvedValue({ success: true });
    const { service } = createService();

    const record = await service.create(
      { orgConnectionId: ORG_ID, sandboxName: 'UAT', mode: 'trigger', cadenceDays: 30 },
      'DPT_user',
      false,
    );

    expect(sfCli.refreshSandbox).toHaveBeenCalledWith('prod@example.test', 'UAT');
    expect(record.status).toBe('refreshing');
    expect(record.nextRefreshDueAt).not.toBeNull();
  });

  it('surfaces CLI refusal as a client error', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    sfCli.refreshSandbox.mockResolvedValue({ success: false, error: 'insufficient access' });
    const { service } = createService();

    await expect(
      service.create(
        { orgConnectionId: ORG_ID, sandboxName: 'UAT', mode: 'trigger' },
        'DPT_user',
        false,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.sandboxRefresh.create).not.toHaveBeenCalled();
  });

  it('tracks a refresh without touching the CLI', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.sandboxRefresh.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      refreshRow(data),
    );
    const { service } = createService();

    const record = await service.create(
      { orgConnectionId: ORG_ID, sandboxName: 'UAT', mode: 'track' },
      'DPT_user',
      false,
    );
    expect(sfCli.refreshSandbox).not.toHaveBeenCalled();
    expect(record.status).toBe('requested');
  });
});

describe('SandboxRefreshService.complete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks completion, advances the cadence, and queues the post-refresh seed', async () => {
    db.sandboxRefresh.findUnique.mockResolvedValue(refreshRow({
      postRefreshConfig: {
        dataSeed: { sourceOrgId: SEED_SOURCE, targetOrgId: ORG_ID },
      },
    }));
    db.sandboxRefresh.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      refreshRow({ ...data, status: 'completed' }),
    );
    const { service, dataService, notifications } = createService();

    const record = await service.complete('sr1', 'DPT_user', false);

    expect(dataService.enqueueConaSeed).toHaveBeenCalledWith(
      expect.objectContaining({ sourceOrgId: SEED_SOURCE, targetOrgId: ORG_ID }),
      'DPT_user',
    );
    expect(record.status).toBe('completed');
    expect(record.nextRefreshDueAt).not.toBeNull();
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'environment', level: 'success' }),
    );
  });

  it('rejects double completion', async () => {
    db.sandboxRefresh.findUnique.mockResolvedValue(refreshRow({ status: 'completed' }));
    const { service } = createService();
    await expect(service.complete('sr1', 'DPT_user', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
