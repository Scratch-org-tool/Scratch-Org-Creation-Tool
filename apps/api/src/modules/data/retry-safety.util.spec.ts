import { describe, expect, it } from 'vitest';
import { isUnsafeInsertChunkRetry } from './retry-safety.util';

describe('isUnsafeInsertChunkRetry', () => {
  it('blocks insert retries that could duplicate committed records', () => {
    expect(isUnsafeInsertChunkRetry('insert')).toBe(true);
  });

  it('allows idempotent upsert retries', () => {
    expect(isUnsafeInsertChunkRetry('upsert')).toBe(false);
  });

  it('only allows generic retries when an upsert match field exists', () => {
    expect(isUnsafeInsertChunkRetry('generic')).toBe(true);
    expect(isUnsafeInsertChunkRetry('generic', true)).toBe(false);
  });
});
