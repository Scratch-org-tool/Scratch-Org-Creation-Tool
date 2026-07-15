import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  orgConnection: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}));
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { EnvironmentService } from './environment.service';

describe('EnvironmentService default Dev Hub', () => {
  let service: EnvironmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(
      (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );
    tx.orgConnection.updateMany.mockResolvedValue({ count: 2 });
    service = new EnvironmentService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('returns the mapped ConnectedOrg DTO and scopes the atomic update', async () => {
    const row = {
      id: 'org-2',
      alias: 'hub-b',
      username: 'hub@example.com',
      type: 'production',
      status: 'active',
      instanceUrl: 'https://example.my.salesforce.com',
      isDevHub: true,
      isDefaultDevHub: true,
      createdAt: new Date('2026-07-15T12:00:00.000Z'),
      createdBy: 'user-1',
    };
    tx.orgConnection.findFirst.mockResolvedValue(row);
    tx.orgConnection.update.mockResolvedValue(row);

    await expect(service.setDefaultDevHub('hub-b', 'user-1')).resolves.toEqual({
      id: 'org-2',
      alias: 'hub-b',
      username: 'hub@example.com',
      orgType: 'Dev Hub',
      type: 'production',
      status: 'Connected',
      instanceUrl: 'https://example.my.salesforce.com',
      isDevHub: true,
      isDefaultDevHub: true,
      createdAt: '2026-07-15T12:00:00.000Z',
    });
    expect(tx.orgConnection.findFirst).toHaveBeenCalledWith({
      where: {
        alias: 'hub-b',
        createdBy: 'user-1',
        type: { not: 'scratch' },
        status: 'active',
        isDevHub: true,
      },
    });
    expect(tx.orgConnection.updateMany).toHaveBeenCalledWith({
      where: { createdBy: 'user-1' },
      data: { isDefaultDevHub: false },
    });
    expect(tx.orgConnection.update).toHaveBeenCalledWith({
      where: { id: 'org-2' },
      data: { isDefaultDevHub: true },
    });
  });
});
