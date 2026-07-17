import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';

const db = vi.hoisted(() => ({
  freezeWindow: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  orgConnection: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { FreezeWindowService } from './freeze-window.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function activeWindow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'f1',
    name: 'Quarter-end freeze',
    reason: 'Financial close',
    orgConnectionIds: [] as string[],
    startAt: new Date(now - 3_600_000),
    endAt: new Date(now + 3_600_000),
    enabled: true,
    createdBy: 'DPT_admin',
    createdAt: new Date(now - 86_400_000),
    ...overrides,
  };
}

describe('FreezeWindowService.assertDeployAllowed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks deploys to an org covered by an active window', async () => {
    db.freezeWindow.findMany.mockResolvedValue([activeWindow()]);
    const service = new FreezeWindowService();
    await expect(
      service.assertDeployAllowed({ targetOrgId: ORG_ID }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('always allows validation-only deploys', async () => {
    const service = new FreezeWindowService();
    await expect(
      service.assertDeployAllowed({ targetOrgId: ORG_ID, validateOnly: true }),
    ).resolves.toBeUndefined();
    expect(db.freezeWindow.findMany).not.toHaveBeenCalled();
  });

  it('scopes org-specific windows to their orgs only', async () => {
    db.freezeWindow.findMany.mockResolvedValue([
      activeWindow({ orgConnectionIds: ['other-org'] }),
    ]);
    const service = new FreezeWindowService();
    await expect(
      service.assertDeployAllowed({ targetOrgId: ORG_ID }),
    ).resolves.toBeUndefined();
  });

  it('resolves the org from its alias when no id is provided', async () => {
    db.orgConnection.findFirst.mockResolvedValue({ id: ORG_ID });
    db.freezeWindow.findMany.mockResolvedValue([activeWindow({ orgConnectionIds: [ORG_ID] })]);
    const service = new FreezeWindowService();
    await expect(
      service.assertDeployAllowed({ orgAlias: 'prod@example.test' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores disabled or expired windows', async () => {
    // The service queries with enabled+time filters; simulate an empty result.
    db.freezeWindow.findMany.mockResolvedValue([]);
    const service = new FreezeWindowService();
    await expect(
      service.assertDeployAllowed({ targetOrgId: ORG_ID }),
    ).resolves.toBeUndefined();
  });
});
