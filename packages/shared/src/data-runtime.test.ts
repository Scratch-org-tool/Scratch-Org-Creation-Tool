import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dataChunkReleaseCount,
  readyDataDependencyIds,
  resolveDataWriteOperation,
  topologicallySortDataDependencies,
} from './data-runtime.js';
import { normalizeQuerySet } from './query-set.js';
import { dataReplicationSchema } from './schemas/index.js';

describe('data runtime contracts', () => {
  it('defaults to idempotent upsert only when an external ID exists', () => {
    assert.deepEqual(resolveDataWriteOperation(undefined, 'External__c'), {
      operation: 'upsert',
      externalIdField: 'External__c',
      idempotent: true,
    });
    assert.deepEqual(resolveDataWriteOperation(undefined, undefined), {
      operation: 'insert',
      externalIdField: undefined,
      idempotent: false,
    });
    assert.throws(
      () => resolveDataWriteOperation('upsert', undefined),
      /no fallback matching field/,
    );
  });

  it('orders dependencies stably, exposes only ready objects, and rejects cycles', () => {
    const nodes = [
      { id: 'contacts', dependsOn: ['accounts'], order: 0 },
      { id: 'accounts', dependsOn: [], order: 1 },
      { id: 'cases', dependsOn: ['contacts'], order: 2 },
    ];
    assert.deepEqual(
      topologicallySortDataDependencies(nodes).map((node) => node.id),
      ['accounts', 'contacts', 'cases'],
    );
    assert.deepEqual(readyDataDependencyIds(nodes, new Set()), ['accounts']);
    assert.deepEqual(readyDataDependencyIds(nodes, new Set(['accounts'])), ['contacts']);
    assert.throws(
      () => topologicallySortDataDependencies([
        { id: 'a', dependsOn: ['b'] },
        { id: 'b', dependsOn: ['a'] },
      ]),
      /cycle/,
    );
  });

  it('caps chunk release by parallel capacity and known quota, then releases the next slot', () => {
    assert.equal(dataChunkReleaseCount({
      pending: 10,
      active: 2,
      maxParallel: 4,
      quotaRemaining: 10,
    }), 2);
    assert.equal(dataChunkReleaseCount({
      pending: 8,
      active: 3,
      maxParallel: 4,
      quotaRemaining: 1,
    }), 1);
    assert.equal(dataChunkReleaseCount({
      pending: 7,
      active: 4,
      maxParallel: 4,
      quotaRemaining: 7,
    }), 0);
  });

  it('preserves replication query order, dependencies, operations, and external IDs', () => {
    const normalized = normalizeQuerySet({
      version: 1,
      source: 'upload',
      defaultLimit: 100,
      queries: [
        {
          id: 'children',
          label: 'Children',
          object: 'Child__c',
          soql: 'SELECT External__c FROM Child__c',
          operation: 'upsert',
          externalIdField: 'External__c',
          dependsOn: ['parents'],
        },
        {
          id: 'parents',
          label: 'Parents',
          object: 'Parent__c',
          soql: 'SELECT Key__c FROM Parent__c',
          operation: 'upsert',
          externalIdField: 'Key__c',
        },
      ],
    });
    assert.deepEqual(normalized.queries.map((query) => query.id), ['parents', 'children']);
    assert.deepEqual(
      normalized.queries.map((query) => [query.operation, query.externalIdField]),
      [['upsert', 'Key__c'], ['upsert', 'External__c']],
    );
  });

  it('does not manufacture a replication-level insert override', () => {
    const parsed = dataReplicationSchema.parse({
      sourceOrgId: '00000000-0000-4000-8000-000000000001',
      targetOrgId: '00000000-0000-4000-8000-000000000002',
      querySet: {
        version: 1,
        source: 'upload',
        defaultLimit: 100,
        queries: [{
          id: 'accounts',
          label: 'Accounts',
          object: 'Account',
          soql: 'SELECT External__c FROM Account',
          externalIdField: 'External__c',
        }],
      },
    });
    assert.equal(parsed.operation, undefined);
    assert.equal(parsed.externalIdField, undefined);
    const normalized = normalizeQuerySet(parsed.querySet!);
    assert.equal(normalized.queries[0]?.operation, 'upsert');
    assert.equal(normalized.queries[0]?.externalIdField, 'External__c');
  });
});
