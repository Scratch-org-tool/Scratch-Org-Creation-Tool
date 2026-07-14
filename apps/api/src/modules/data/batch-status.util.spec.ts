import { describe, expect, it } from 'vitest';
import {
  ACTIVE_CHUNK_STATUSES,
  aggregateBatchStatus,
  countChunkStatuses,
} from './batch-status.util';

const counts = (over: Partial<ReturnType<typeof countChunkStatuses>> = {}) => ({
  completed: 0,
  failed: 0,
  cancelled: 0,
  active: 0,
  ...over,
});

describe('countChunkStatuses', () => {
  it('buckets every active status into active', () => {
    const result = countChunkStatuses(
      ACTIVE_CHUNK_STATUSES.map((s) => [s, 1] as [string, number]),
    );
    expect(result.active).toBe(ACTIVE_CHUNK_STATUSES.length);
    expect(result.completed).toBe(0);
  });

  it('counts terminal statuses separately', () => {
    const result = countChunkStatuses([
      ['completed', 3],
      ['failed', 2],
      ['cancelled', 1],
      ['running', 4],
    ]);
    expect(result).toEqual({ completed: 3, failed: 2, cancelled: 1, active: 4 });
  });
});

describe('aggregateBatchStatus', () => {
  it('stays running while any chunk is active, even with failures', () => {
    expect(aggregateBatchStatus(counts({ active: 1, failed: 5, completed: 5 }))).toBe('running');
  });

  it('is completed when all chunks completed', () => {
    expect(aggregateBatchStatus(counts({ completed: 10 }))).toBe('completed');
  });

  it('is partial when some chunks completed and some failed', () => {
    expect(aggregateBatchStatus(counts({ completed: 9, failed: 1 }))).toBe('partial');
  });

  it('is failed when all terminal chunks failed', () => {
    expect(aggregateBatchStatus(counts({ failed: 4 }))).toBe('failed');
  });

  it('is cancelled when only cancelled chunks remain', () => {
    expect(aggregateBatchStatus(counts({ cancelled: 2 }))).toBe('cancelled');
  });

  it('is idempotent — recomputing the same chunk states yields the same status', () => {
    const snapshot = counts({ completed: 3, failed: 1 });
    const first = aggregateBatchStatus(snapshot);
    const second = aggregateBatchStatus(snapshot);
    expect(first).toBe(second);
    expect(second).toBe('partial');
  });
});
