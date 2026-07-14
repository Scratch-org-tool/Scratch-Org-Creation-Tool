import { describe, expect, it } from 'vitest';
import {
  buildIdOnlySoql,
  buildIdRangeChunkSoql,
  computeChunkBoundaries,
  planDataDeployChunks,
  escapeSoqlValue,
  assertSoqlIdentifier,
} from '@sfcc/shared';

describe('keyset chunk planning', () => {
  it('never uses OFFSET (Salesforce caps it at 2,000)', () => {
    const chunks = planDataDeployChunks('SELECT Id, Name FROM Account', 75_000, 25_000);
    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) {
      expect(chunk.soql.toUpperCase()).not.toContain('OFFSET');
      expect(chunk.soql).toMatch(/ORDER BY Id LIMIT \d+$/);
    }
  });

  it('marks chunks beyond the first as bounds-pending', () => {
    const chunks = planDataDeployChunks('SELECT Id FROM Contact', 50_000, 25_000);
    expect(chunks[0]!.boundsPending).toBe(false);
    expect(chunks[1]!.boundsPending).toBe(true);
  });

  it('builds Id-range queries that respect an existing WHERE clause', () => {
    const soql = buildIdRangeChunkSoql(
      "SELECT Id, Name FROM Account WHERE Industry = 'Tech' ORDER BY Name LIMIT 99",
      100,
      { afterId: '001A', endId: '001B' },
    );
    expect(soql).toContain("(Industry = 'Tech')");
    expect(soql).toContain("Id > '001A'");
    expect(soql).toContain("Id <= '001B'");
    expect(soql.endsWith('ORDER BY Id LIMIT 100')).toBe(true);
    // The original ORDER BY / LIMIT must be replaced, not duplicated.
    expect(soql.match(/ORDER BY/gi)).toHaveLength(1);
    expect(soql.match(/LIMIT/gi)).toHaveLength(1);
  });

  it('computes non-overlapping, exhaustive chunk boundaries from ordered Ids', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `00${i}`);
    const bounds = computeChunkBoundaries(ids, 4);
    expect(bounds).toEqual([
      { chunkIndex: 0, afterId: null, endId: '003', recordCount: 4 },
      { chunkIndex: 1, afterId: '003', endId: '007', recordCount: 4 },
      { chunkIndex: 2, afterId: '007', endId: '009', recordCount: 2 },
    ]);
    // Exclusive lower bound of chunk N equals inclusive upper bound of chunk N-1.
    expect(bounds[1]!.afterId).toBe(bounds[0]!.endId);
    expect(bounds[2]!.afterId).toBe(bounds[1]!.endId);
  });

  it('builds an Id-only planner query preserving filters', () => {
    const soql = buildIdOnlySoql(
      "SELECT Id, Name, Industry FROM Account WHERE Name != '' LIMIT 10",
      500,
    );
    expect(soql).toBe("SELECT Id FROM Account WHERE Name != '' ORDER BY Id LIMIT 500");
  });
});

describe('SOQL escaping', () => {
  it('escapes quotes and backslashes in values', () => {
    expect(escapeSoqlValue("O'Brien")).toBe("O\\'Brien");
    expect(escapeSoqlValue('a\\b')).toBe('a\\\\b');
  });

  it('accepts valid identifiers and rejects injection attempts', () => {
    expect(assertSoqlIdentifier('Account')).toBe('Account');
    expect(assertSoqlIdentifier('cfs_ob__Config__c')).toBe('cfs_ob__Config__c');
    expect(() => assertSoqlIdentifier("Account'; DELETE")).toThrow(/Invalid SOQL/);
    expect(() => assertSoqlIdentifier('1Account')).toThrow(/Invalid SOQL/);
    expect(() => assertSoqlIdentifier('')).toThrow(/Invalid SOQL/);
  });
});
