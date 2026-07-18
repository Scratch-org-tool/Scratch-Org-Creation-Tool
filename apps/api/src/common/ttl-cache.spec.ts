import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached values inside the TTL and expires them after', () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set('a', 'value');
    expect(cache.get('a')).toBe('value');
    vi.advanceTimersByTime(999);
    expect(cache.get('a')).toBe('value');
    vi.advanceTimersByTime(2);
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the oldest entry when the cap is exceeded', () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set('first', 1);
    cache.set('second', 2);
    cache.set('third', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('first')).toBeUndefined();
    expect(cache.get('second')).toBe(2);
    expect(cache.get('third')).toBe(3);
  });

  it('computes once and shares the result across concurrent callers', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    let calls = 0;
    const compute = async () => {
      calls += 1;
      return 'computed';
    };
    const [a, b] = await Promise.all([
      cache.getOrCompute('key', compute),
      cache.getOrCompute('key', compute),
    ]);
    expect(a).toBe('computed');
    expect(b).toBe('computed');
    expect(calls).toBe(1);
    expect(await cache.getOrCompute('key', compute)).toBe('computed');
    expect(calls).toBe(1);
  });

  it('does not cache failed computations', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error('boom');
    };
    await expect(cache.getOrCompute('key', failing)).rejects.toThrow('boom');
    await expect(cache.getOrCompute('key', failing)).rejects.toThrow('boom');
    expect(calls).toBe(2);
    expect(await cache.getOrCompute('key', async () => 'recovered')).toBe('recovered');
  });

  it('clear() empties the cache', () => {
    const cache = new TtlCache<number>(60_000, 10);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
