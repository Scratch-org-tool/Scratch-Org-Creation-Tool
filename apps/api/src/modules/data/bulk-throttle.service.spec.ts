import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkThrottleService } from './bulk-throttle.service';

describe('BulkThrottleService scheduler fencing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renews an owned scheduler lease and excludes a racing scheduler', async () => {
    vi.useFakeTimers();
    let value: string | null = null;
    const redis = {
      set: vi.fn(async (_key: string, token: string) => {
        if (value !== null) return null;
        value = token;
        return 'OK';
      }),
      get: vi.fn(async () => value),
      eval: vi.fn(async (script: string, _keys: number, _key: string, token: string) => {
        if (script.includes('pexpire')) return value === token ? 1 : 0;
        if (value === token) {
          value = null;
          return 1;
        }
        return 0;
      }),
    };
    const service = new BulkThrottleService({
      getConnection: () => redis,
    } as never);
    let finish!: () => void;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = service.withSchedulerLock('batch', async (lease) => {
      await held;
      await lease.assertOwned();
      return 'first';
    });

    await vi.advanceTimersByTimeAsync(10_001);
    await expect(service.withSchedulerLock('batch', async () => 'racer')).resolves.toBeNull();
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('pexpire'),
      1,
      'sfcc:data-scheduler:batch',
      expect.any(String),
      30_000,
    );

    finish();
    await expect(first).resolves.toBe('first');
    await expect(service.withSchedulerLock('batch', async () => 'next')).resolves.toBe('next');
  });
});
