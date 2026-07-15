import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows = vi.hoisted(() => new Map<string, any>());
const db = vi.hoisted(() => ({
  oAuthState: {
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `row-${rows.size}`, consumedAt: null, createdAt: new Date(), ...data };
      rows.set(data.tokenHash, row);
      return row;
    }),
    findUnique: vi.fn(async ({ where }: any) => rows.get(where.tokenHash) ?? null),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const row = [...rows.values()].find((candidate) => candidate.id === where.id);
      if (!row || row.consumedAt || row.expiresAt <= where.expiresAt.gt) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
  },
  $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(db)),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import { OAuthStateService } from './oauth-state.service';

describe('OAuthStateService', () => {
  beforeEach(() => {
    rows.clear();
    vi.clearAllMocks();
  });

  it('creates cryptographically strong opaque state and consumes it once', async () => {
    const service = new OAuthStateService();
    const state = await service.create('jira', 'authorize', 'user-1', { verifier: 'secret' });
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...rows.keys()][0]).not.toBe(state);
    await expect(service.consume<{ verifier: string }>(
      state,
      'jira',
      'authorize',
      'user-1',
    )).resolves.toMatchObject({
      appUserId: 'user-1',
      payload: { verifier: 'secret' },
      returnPath: '/environment-center',
    });
    await expect(service.consume(state, 'jira', 'authorize', 'user-1'))
      .rejects.toThrow(/expired, or already used/);
  });

  it('rejects expired state and state bound to another app user', async () => {
    const service = new OAuthStateService();
    const state = await service.create('jira', 'select_site', 'user-1', {});
    await expect(service.inspect(state, 'jira', 'select_site', 'user-2'))
      .rejects.toThrow(/invalid, expired/);
    const row = [...rows.values()][0];
    row.expiresAt = new Date(Date.now() - 1);
    await expect(service.consume(state, 'jira', 'select_site', 'user-1'))
      .rejects.toThrow(/invalid, expired/);
  });

  it('rejects return URLs that could redirect outside the configured app', async () => {
    const service = new OAuthStateService();
    await expect(service.create('jira', 'authorize', 'user-1', {}, '//evil.example'))
      .rejects.toThrow(/return path/);
    await expect(service.create('jira', 'authorize', 'user-1', {}, 'https://evil.example'))
      .rejects.toThrow(/return path/);
  });
});
