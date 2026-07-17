import { describe, expect, it } from 'vitest';
import { parseSfdmuOutcome, sfdmuRowFailureMessage } from './sfdmu-outcome.util';

describe('parseSfdmuOutcome', () => {
  it('detects row failures even when SFDMU exits successfully', () => {
    const outcome = parseSfdmuOutcome(
      '[12:00:00.000] [WARN] [Batch# 750xx:Upsert] {Account} '
      + 'Completed. 35,000 records processed, 1,250 records failed.',
    );

    expect(outcome).toEqual({
      processedRecords: 35_000,
      failedRecords: 1_250,
      completedOperations: 1,
    });
    expect(sfdmuRowFailureMessage(outcome)).toContain('1,250 failed record(s)');
  });

  it('keeps the latest cumulative count per operation and sums distinct operations', () => {
    const outcome = parseSfdmuOutcome([
      '[Batch# REST:Insert] {Account} Completed. 200 records processed, 0 records failed.',
      '[Batch# REST:Insert] {Account} Completed. 400 records processed, 2 records failed.',
      '[Batch# REST:Update] {Account} Completed. 600 records processed, 1 records failed.',
    ].join('\n'));

    expect(outcome).toEqual({
      processedRecords: 1_000,
      failedRecords: 3,
      completedOperations: 2,
    });
  });

  it('does not mistake in-progress counters for terminal results', () => {
    expect(parseSfdmuOutcome(
      '[Batch# 750xx:Upsert] {Account} Processing ... 10 records processed, 2 records failed.',
    )).toEqual({
      processedRecords: null,
      failedRecords: 0,
      completedOperations: 0,
    });
  });
});
