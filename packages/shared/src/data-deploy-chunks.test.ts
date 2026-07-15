import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planDataDeployChunks,
  shouldChunkDeploy,
  chunkCountForLimit,
  buildCountSoql,
  buildIdRangeChunkSoql,
  buildIdOnlySoql,
  computeChunkBoundaries,
  injectWhereCondition,
  stripOrderByLimitOffset,
} from './data-deploy-chunks.js';
import { DATA_DEPLOY_CHUNK_SIZE } from './org-to-org-data.js';

test('planDataDeployChunks splits 100k into four 25k chunks without OFFSET', () => {
  const chunks = planDataDeployChunks('SELECT Id FROM Account', 100_000, 25_000);
  assert.equal(chunks.length, 4);
  assert.equal(chunks[0].limit, 25_000);
  assert.equal(chunks[0].boundsPending, false);
  assert.match(chunks[0].soql, /ORDER BY Id LIMIT 25000$/i);
  // Salesforce caps OFFSET at 2,000 — chunk queries must never use it.
  for (const chunk of chunks) {
    assert.doesNotMatch(chunk.soql, /\bOFFSET\b/i);
  }
  assert.equal(chunks[3].limit, 25_000);
  assert.equal(chunks[3].boundsPending, true);
});

test('planDataDeployChunks handles remainder chunk', () => {
  const chunks = planDataDeployChunks('SELECT Id FROM Account', 30_000, 25_000);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[1].limit, 5_000);
});

test('shouldChunkDeploy is false at chunk size boundary', () => {
  assert.equal(shouldChunkDeploy(DATA_DEPLOY_CHUNK_SIZE), false);
  assert.equal(shouldChunkDeploy(DATA_DEPLOY_CHUNK_SIZE + 1), true);
});

test('chunkCountForLimit matches plan length', () => {
  assert.equal(chunkCountForLimit(100_000), 4);
});

test('buildCountSoql strips limit and order by', () => {
  const q = buildCountSoql(
    'SELECT Id, Name FROM Account WHERE Industry = \'Tech\' ORDER BY Name LIMIT 200',
  );
  assert.equal(q, "SELECT COUNT() FROM Account WHERE Industry = 'Tech'");
});

test('buildIdRangeChunkSoql injects keyset bounds with existing WHERE', () => {
  const q = buildIdRangeChunkSoql(
    "SELECT Id, Name FROM Account WHERE Industry = 'Tech' OR Type = 'Partner'",
    25_000,
    { afterId: '001A', endId: '001B' },
  );
  assert.equal(
    q,
    "SELECT Id, Name FROM Account WHERE ((Industry = 'Tech' OR Type = 'Partner') AND Id > '001A') AND Id <= '001B' ORDER BY Id LIMIT 25000",
  );
});

test('buildIdRangeChunkSoql adds WHERE when none exists and strips stale ORDER BY/LIMIT', () => {
  const q = buildIdRangeChunkSoql(
    'SELECT Id FROM Account ORDER BY Name LIMIT 99 OFFSET 10',
    100,
    { endId: '001B' },
  );
  assert.equal(q, "SELECT Id FROM Account WHERE Id <= '001B' ORDER BY Id LIMIT 100");
});

test('buildIdRangeChunkSoql neutralises quotes in injected ids (no SOQL injection)', () => {
  const q = buildIdRangeChunkSoql('SELECT Id FROM Account', 10, {
    afterId: "001' OR Name != null",
  });
  // The quote is escaped so the payload remains data inside the string literal.
  assert.equal(q.includes("Id > '001\\' OR Name != null'"), true);
});

test('buildIdOnlySoql produces an Id-only ordered query', () => {
  const q = buildIdOnlySoql(
    "SELECT Id, Name, Industry FROM Account WHERE Industry = 'Tech' ORDER BY Name LIMIT 50",
    100_000,
  );
  assert.equal(q, "SELECT Id FROM Account WHERE Industry = 'Tech' ORDER BY Id LIMIT 100000");
});

test('computeChunkBoundaries produces contiguous exclusive/inclusive ranges', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const boundaries = computeChunkBoundaries(ids, 2);
  assert.deepEqual(boundaries, [
    { chunkIndex: 0, afterId: null, endId: 'b', recordCount: 2 },
    { chunkIndex: 1, afterId: 'b', endId: 'd', recordCount: 2 },
    { chunkIndex: 2, afterId: 'd', endId: 'e', recordCount: 1 },
  ]);
});

test('computeChunkBoundaries handles empty id set', () => {
  assert.deepEqual(computeChunkBoundaries([], 100), []);
});

test('injectWhereCondition wraps existing OR conditions in parentheses', () => {
  const q = injectWhereCondition(
    "SELECT Id FROM Account WHERE A = '1' OR B = '2'",
    "Id > '001'",
  );
  assert.equal(q, "SELECT Id FROM Account WHERE (A = '1' OR B = '2') AND Id > '001'");
});

test('stripOrderByLimitOffset removes trailing clauses', () => {
  assert.equal(
    stripOrderByLimitOffset('SELECT Id FROM Account ORDER BY Name DESC LIMIT 10 OFFSET 5'),
    'SELECT Id FROM Account',
  );
});
