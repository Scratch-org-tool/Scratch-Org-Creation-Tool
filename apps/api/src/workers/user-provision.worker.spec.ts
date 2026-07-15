import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
  job: { findUnique: vi.fn() },
  provisioningBatch: { findUnique: vi.fn(), update: vi.fn() },
  provisionedUser: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));
const sf = vi.hoisted(() => ({
  describeSObject: vi.fn(),
  query: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  assignPermissionSet: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sf }));

import { UserProvisionWorker } from './user-provision.worker';

const profileId = '00e000000000001AAA';

function worker() {
  return new UserProvisionWorker(
    { addLog: vi.fn() } as never,
    { publishJobLog: vi.fn() } as never,
  );
}

function job(users: Array<Record<string, unknown>>, failurePolicy: 'fail_fast' | 'continue') {
  return {
    data: {
      orgId: 'org-1',
      batchId: 'batch-1',
      dbJobId: 'job-1',
      users,
      conaMode: true,
      strictMetadata: true,
      discoveryPolicy: 'disabled',
      discoveryFailurePolicy: 'continue',
      failurePolicy,
    },
  } as never;
}

function user(username: string) {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: username,
    username,
    role: 'Rep',
    bottler: '5000',
    profile: profileId,
    permissionSets: [],
  };
}

describe('UserProvisionWorker provisioning policies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue({
      id: 'org-1',
      alias: 'target',
      username: null,
      createdBy: 'owner',
    });
    db.job.findUnique.mockResolvedValue({
      createdBy: 'owner',
      payload: { orgId: 'org-1', batchId: 'batch-1' },
      parentRun: null,
    });
    db.provisioningBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      orgId: 'org-1',
      createdBy: 'owner',
    });
    db.provisionedUser.findFirst.mockImplementation(async ({ where }) => ({
      id: `row-${where.username}`,
      status: 'failed',
      sfUserId: `sf-${where.username}`,
    }));
    db.provisionedUser.update.mockResolvedValue({});
    db.provisionedUser.updateMany.mockResolvedValue({ count: 1 });
    db.provisioningBatch.update.mockResolvedValue({});
    sf.query.mockResolvedValue({ success: true, data: { result: { records: [] } } });
    sf.updateUser.mockResolvedValue({ success: true });
    sf.assignPermissionSet.mockResolvedValue({ success: true });
    sf.createUser.mockResolvedValue({
      success: true,
      data: { result: { id: 'new-user-id' } },
    });
  });

  it('honors disabled discovery while still requiring directly resolvable V2 profile ids', async () => {
    db.provisionedUser.findMany.mockResolvedValue([{ status: 'completed' }]);
    await expect(worker().process(job([user('one@example.com')], 'fail_fast')))
      .resolves.toEqual({ successCount: 1, failCount: 0, partial: false });
    expect(sf.describeSObject).not.toHaveBeenCalled();
  });

  it.each([
    '00e000000000001',
    '00e000000000001AAA',
  ])('passes an explicit profile id through with disabled discovery (%s)', async (explicitId) => {
    const input = user('id@example.com');
    input.profile = explicitId;
    db.provisionedUser.findFirst.mockResolvedValue({
      id: 'row-id',
      status: 'failed',
      sfUserId: null,
    });
    sf.query.mockResolvedValue({ success: true, data: { result: { records: [] } } });
    db.provisionedUser.findMany.mockResolvedValue([{ status: 'completed' }]);

    await worker().process(job([input], 'fail_fast'));

    expect(sf.createUser).toHaveBeenCalledWith(
      'target',
      expect.objectContaining({ ProfileId: explicitId }),
    );
  });

  it('resolves a profile name to its target id even when custom discovery is disabled', async () => {
    const input = user('named@example.com');
    input.profile = 'Standard User';
    db.provisionedUser.findFirst.mockResolvedValue({
      id: 'row-named',
      status: 'failed',
      sfUserId: null,
    });
    sf.query.mockImplementation(async (_alias: string, soql: string) => ({
      success: true,
      data: {
        result: {
          records: soql.includes('FROM Profile')
            ? [{ Id: profileId, Name: 'Standard User' }]
            : [],
        },
      },
    }));
    db.provisionedUser.findMany.mockResolvedValue([{ status: 'completed' }]);

    await worker().process(job([input], 'fail_fast'));

    expect(sf.describeSObject).not.toHaveBeenCalled();
    expect(sf.createUser).toHaveBeenCalledWith(
      'target',
      expect.objectContaining({ ProfileId: profileId }),
    );
  });

  it('continues after row failures and returns a partial result', async () => {
    sf.updateUser
      .mockResolvedValueOnce({ success: false, error: 'first failed' })
      .mockResolvedValueOnce({ success: true });
    db.provisionedUser.findMany.mockResolvedValue([
      { status: 'failed' },
      { status: 'completed' },
    ]);

    await expect(worker().process(job([
      user('first@example.com'),
      user('second@example.com'),
    ], 'continue'))).resolves.toEqual({
      successCount: 1,
      failCount: 1,
      partial: true,
    });
    expect(sf.updateUser).toHaveBeenCalledTimes(2);
  });

  it('stops fail-fast execution and marks unattempted rows retryable as failed', async () => {
    sf.updateUser.mockResolvedValueOnce({ success: false, error: 'stop' });
    db.provisionedUser.findMany.mockResolvedValue([
      { status: 'failed' },
      { status: 'failed' },
    ]);

    await expect(worker().process(job([
      user('first@example.com'),
      user('second@example.com'),
    ], 'fail_fast'))).rejects.toThrow('only failed rows will be retried');
    expect(sf.updateUser).toHaveBeenCalledTimes(1);
    expect(db.provisionedUser.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        username: { in: ['second@example.com'] },
      }),
    }));
  });
});
