import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueService } from '../queue/queue.service';
import { AuthSecurityService } from './auth-security.service';

describe('AuthSecurityService account action controls', () => {
  let service: AuthSecurityService;

  beforeEach(() => {
    service = new AuthSecurityService({
      getConnection: () => null,
    } as unknown as QueueService);
  });

  it('enforces independent user and IP change-password limits', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.checkAccountRateLimit(
          'DPT_uid-1',
          '203.0.113.50',
          'change-password',
        ),
      ).resolves.toBe(true);
    }
    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(false);
    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.51',
        'change-password',
      ),
    ).resolves.toBe(false);

    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-2',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(false);
  });

  it('keeps progressive user delay when the caller rotates IPs', async () => {
    await service.recordAccountActionFailure(
      'DPT_uid-1',
      '203.0.113.50',
      'change-password',
    );
    await service.recordAccountActionFailure(
      'DPT_uid-1',
      '203.0.113.50',
      'change-password',
    );
    await expect(
      service.getAccountActionDelayMs(
        'DPT_uid-1',
        '203.0.113.99',
        'change-password',
      ),
    ).resolves.toBe(1000);

    await service.clearAccountActionFailures(
      'DPT_uid-1',
      '203.0.113.50',
      'change-password',
    );
    await expect(
      service.getAccountActionDelayMs(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(0);
  });

  it('ignores spoofable forwarding headers and never logs the raw IP', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    expect(
      service.extractClientIp(
        { 'x-forwarded-for': '198.51.100.99' },
        '203.0.113.50',
      ),
    ).toBe('203.0.113.50');

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      );
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain('203.0.113.50');
  });

  it('increments user and IP Redis counters in one atomic operation', async () => {
    const values = new Map<string, number>();
    const evalCall = vi.fn(
      async (
        _script: string,
        keyCount: number,
        ...keysAndArgs: Array<string | number>
      ) => {
        const keys = keysAndArgs.slice(0, keyCount).map(String);
        return keys.map((key) => {
          const next = (values.get(key) ?? 0) + 1;
          values.set(key, next);
          return next;
        });
      },
    );
    service = new AuthSecurityService({
      getConnection: () => ({ eval: evalCall }),
    } as unknown as QueueService);

    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.50',
        'change-password',
      ),
    ).resolves.toBe(true);

    expect(evalCall).toHaveBeenCalledTimes(1);
    const [, keyCount, userKey, ipKey] = evalCall.mock.calls[0]!;
    expect(keyCount).toBe(2);
    expect(userKey).toMatch(/^auth:rl:change-password:user:/);
    expect(ipKey).toMatch(/^auth:rl:change-password:ip:/);
  });

  it('falls back to independent in-memory counters when Redis fails', async () => {
    service = new AuthSecurityService({
      getConnection: () => ({
        eval: vi.fn().mockRejectedValue(new Error('redis unavailable')),
      }),
    } as unknown as QueueService);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.checkAccountRateLimit(
          'DPT_uid-1',
          `203.0.113.${attempt}`,
          'change-password',
        ),
      ).resolves.toBe(true);
    }
    await expect(
      service.checkAccountRateLimit(
        'DPT_uid-1',
        '203.0.113.99',
        'change-password',
      ),
    ).resolves.toBe(false);
  });

  it('serializes same-user profile mutations in the local fallback', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = service.withAccountMutationLock('uid-1', async () => {
      order.push('first-start');
      await firstGate;
      order.push('first-end');
    });
    const second = service.withAccountMutationLock('uid-1', async () => {
      order.push('second-start');
    });

    await vi.waitFor(() => expect(order).toEqual(['first-start']));
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('serializes same-user mutations across instances with a Redis lock', async () => {
    const locks = new Map<string, string>();
    const redis = {
      set: vi.fn(async (key: string, token: string) => {
        if (locks.has(key)) return null;
        locks.set(key, token);
        return 'OK';
      }),
      eval: vi.fn(
        async (script: string, _keyCount: number, key: string, token: string) => {
          if (locks.get(key) !== token) return 0;
          if (script.includes("'DEL'")) locks.delete(key);
          return 1;
        },
      ),
    };
    const firstInstance = new AuthSecurityService({
      getConnection: () => redis,
    } as unknown as QueueService);
    const secondInstance = new AuthSecurityService({
      getConnection: () => redis,
    } as unknown as QueueService);
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = firstInstance.withAccountMutationLock('uid-1', async () => {
      order.push('first-start');
      await firstGate;
      order.push('first-end');
    });
    await vi.waitFor(() => expect(order).toEqual(['first-start']));
    const second = secondInstance.withAccountMutationLock('uid-1', async () => {
      order.push('second-start');
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(order).toEqual(['first-start']);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });
});
