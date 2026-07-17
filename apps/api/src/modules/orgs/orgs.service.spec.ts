import { ConflictException, Logger } from '@nestjs/common';
import type { SfCommandResult } from '@sfcc/sf-cli';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  scratchOrg: { findUnique: vi.fn(), deleteMany: vi.fn() },
  job: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const sfCli = vi.hoisted(() => ({
  loginWebCancellable: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));
vi.mock('../../common/crypto.util', () => ({
  encrypt: (value: string) => `encrypted:${value}`,
  decrypt: (value: string) => value.replace(/^encrypted:/, ''),
}));

import { OrgsService } from './orgs.service';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const userId = 'user-1';
const input = {
  alias: 'dev3',
  instanceUrl: 'https://test.salesforce.com',
  isDevHub: false,
};
const authorizingOrg = {
  id: 'org-1',
  alias: input.alias,
  instanceUrl: input.instanceUrl,
  type: 'sandbox',
  status: 'authorizing',
  createdBy: userId,
  accessToken: null,
  refreshToken: null,
};

function successResult(): SfCommandResult {
  return {
    success: true,
    data: {
      result: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        instanceUrl: 'https://acme--dev3.sandbox.my.salesforce.com',
        username: 'dev3@example.com',
        orgId: '00D000000000001',
      },
    },
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
}

describe('OrgsService browser authorization', () => {
  const streamService = { publish: vi.fn() };
  let login: Deferred<SfCommandResult>;
  let service: OrgsService;

  beforeEach(() => {
    vi.clearAllMocks();
    login = deferred<SfCommandResult>();
    sfCli.loginWebCancellable.mockReturnValue({
      promise: login.promise,
      kill: vi.fn(),
    });
    sfCli.logout.mockResolvedValue({ success: true });
    streamService.publish.mockResolvedValue(undefined);
    db.orgConnection.findUnique.mockResolvedValue(null);
    db.orgConnection.create.mockResolvedValue({ ...authorizingOrg });
    db.orgConnection.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...authorizingOrg,
      ...data,
    }));
    service = new OrgsService(streamService as never);
  });

  it('returns immediately and persists the successful login in the background', async () => {
    const response = await service.authorize(input, userId);

    expect(response).toMatchObject({ alias: input.alias, status: 'authorizing' });
    expect(db.orgConnection.update).not.toHaveBeenCalled();

    login.resolve(successResult());
    await vi.waitFor(() => {
      expect(db.orgConnection.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: authorizingOrg.id },
        data: expect.objectContaining({
          status: 'active',
          type: 'sandbox',
          accessToken: 'encrypted:access-token',
          refreshToken: 'encrypted:refresh-token',
        }),
      }));
    });
    expect(streamService.publish).toHaveBeenCalledWith(
      'auth_status',
      expect.objectContaining({ alias: input.alias, status: 'authorized' }),
      userId,
    );
  });

  it('does not turn an authorized org into a failure when event publication fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    streamService.publish.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.authorize(input, userId)).resolves.toMatchObject({
      status: 'authorizing',
    });
    login.resolve(successResult());

    await vi.waitFor(() => {
      expect(db.orgConnection.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'active' }),
      }));
    });
    expect(
      db.orgConnection.update.mock.calls.some((call) => call[0]?.data?.status === 'revoked'),
    ).toBe(false);
  });

  it('exposes asynchronous CLI failures through the status endpoint', async () => {
    await service.authorize(input, userId);
    login.resolve({
      success: false,
      error: 'Authorization cancelled by Salesforce',
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await vi.waitFor(() => {
      expect(db.orgConnection.update).toHaveBeenCalledWith({
        where: { id: authorizingOrg.id },
        data: { status: 'revoked' },
      });
    });
    db.orgConnection.findUnique.mockResolvedValue({
      ...authorizingOrg,
      status: 'revoked',
    });

    await expect(service.getAuthorizationStatus(input.alias, userId)).resolves.toEqual({
      alias: input.alias,
      orgId: authorizingOrg.id,
      status: 'failed',
      error: 'Authorization was cancelled.',
    });
  });

  it('returns a conflict for a duplicate in-progress login', async () => {
    await service.authorize(input, userId);

    await expect(service.authorize(input, userId)).rejects.toThrow(ConflictException);
  });

  it('does not revoke an org when cancellation arrives after completion', async () => {
    db.orgConnection.findUnique.mockResolvedValue({
      ...authorizingOrg,
      status: 'active',
    });

    await expect(service.cancelAuthorize(input.alias, userId)).resolves.toEqual({
      cancelled: false,
      alias: input.alias,
      status: 'active',
    });
    expect(sfCli.logout).not.toHaveBeenCalled();
    expect(db.orgConnection.update).not.toHaveBeenCalled();
  });
});
