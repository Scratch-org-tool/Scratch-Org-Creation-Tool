import { describe, expect, it } from 'vitest';
import {
  buildGenericDeployPayload,
  buildReplicationPayload,
  aggregateDeployStatus,
  defaultOperationForMeta,
  dependencyError,
  externalIdOptions,
  isBatchCancellable,
  isCurrentConfigurationRequest,
  isRetrySafe,
  isTerminalDeployStatus,
  moveByIndex,
  normalizeTemplates,
  orderDeploymentObjects,
  preflightKey,
  rollbackInsertedCount,
  templateToQuery,
  type ReplicationQuery,
} from './data-center-contracts';
import type { OrgToOrgObjectMeta } from './types';

const meta = (overrides: Partial<OrgToOrgObjectMeta> = {}): OrgToOrgObjectMeta => ({
  objectName: 'Account',
  label: 'Account',
  nameField: 'Name',
  matchField: 'External__c',
  externalIdFields: ['External__c'],
  displayFields: ['Id', 'Name'],
  filterableFields: [],
  deployableFields: [{
    name: 'External__c',
    label: 'External',
    type: 'string',
    required: false,
    createable: true,
    reference: false,
    custom: true,
    selected: true,
    externalId: true,
  }],
  referenceFields: [],
  ...overrides,
});

describe('Data Center payload contracts', () => {
  it('sends explicit safe upsert and strict preflight fields', () => {
    expect(buildGenericDeployPayload({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      objectName: 'Account',
      soql: ' SELECT Name, External__c FROM Account ',
      recordLimit: 100,
      operation: 'upsert',
      externalIdField: 'External__c',
      dryRun: true,
      rollbackEnabled: true,
      maxParallelChunks: 3,
    })).toEqual({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      objectName: 'Account',
      soql: 'SELECT Name, External__c FROM Account',
      recordLimit: 100,
      operation: 'upsert',
      externalIdField: 'External__c',
      dryRun: true,
      unknownQuotaPolicy: 'block',
      maxParallelChunks: 3,
      rollback: { enabled: true },
    });
  });

  it('does not leak upsert or rollback fields into insert payloads', () => {
    const payload = buildGenericDeployPayload({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      objectName: 'Account',
      recordLimit: 20,
      operation: 'insert',
      externalIdField: 'External__c',
      dryRun: false,
      rollbackEnabled: true,
    });
    expect(payload.operation).toBe('insert');
    expect(payload.externalIdField).toBeUndefined();
    expect(payload.rollback).toBeUndefined();
  });

  it('invalidates preflight gating whenever configuration changes', () => {
    const first = buildGenericDeployPayload({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      objectName: 'Account',
      recordLimit: 20,
      operation: 'insert',
      dryRun: false,
    });
    expect(preflightKey(first)).not.toBe(preflightKey({ ...first, recordLimit: 21 }));
    expect(preflightKey(first)).toBe(preflightKey({ ...first }));
  });

  it('rejects stale preflight successes, errors, and finalizers after configuration changes', () => {
    expect(isCurrentConfigurationRequest(4, 4, 'config-a', 'config-a')).toBe(true);
    expect(isCurrentConfigurationRequest(3, 4, 'config-a', 'config-a')).toBe(false);
    expect(isCurrentConfigurationRequest(4, 4, 'config-a', 'config-b')).toBe(false);
  });

  it('selects metadata external IDs and defaults to upsert only when available', () => {
    expect(externalIdOptions(meta())).toEqual(['External__c']);
    expect(defaultOperationForMeta(meta())).toEqual({
      operation: 'upsert',
      externalIdField: 'External__c',
    });
    expect(defaultOperationForMeta(meta({
      matchField: 'Name',
      externalIdFields: [],
      deployableFields: [],
    }))).toEqual({ operation: 'insert' });
  });

  it('includes per-query operations, external IDs, dependencies and chunk bounds', () => {
    const queries: ReplicationQuery[] = [{
      id: 'accounts',
      label: 'Accounts',
      object: 'Account',
      soql: 'SELECT Name, External__c FROM Account',
      operation: 'upsert',
      externalIdField: 'External__c',
      dependsOn: [],
    }, {
      id: 'contacts',
      label: 'Contacts',
      object: 'Contact',
      soql: 'SELECT LastName FROM Contact',
      operation: 'insert',
      dependsOn: ['accounts'],
    }];
    const payload = buildReplicationPayload({
      sourceOrgId: 'source',
      targetOrgId: 'target',
      queries,
      defaultLimit: 500,
      dryRun: true,
      maxParallelChunks: 2,
    });
    expect(payload.dryRun).toBe(true);
    expect(payload.unknownQuotaPolicy).toBe('block');
    expect(payload.querySet.queries).toMatchObject([
      { operation: 'upsert', externalIdField: 'External__c', order: 0 },
      { operation: 'insert', externalIdField: undefined, dependsOn: ['accounts'], order: 1 },
    ]);
  });
});

describe('Data Center dependency and recovery safety', () => {
  const config = (objectName: string, dependsOn: string[] = []) => ({
    id: objectName,
    objectName,
    recordLimit: 10,
    filters: [],
    selectedReferenceFields: [],
    selectedDeployFields: [],
    matchField: 'External__c',
    dependsOn,
  });

  it('detects dependency cycles and returns accessible error text', () => {
    const error = dependencyError([
      config('Account', ['Contact']),
      config('Contact', ['Account']),
    ]);
    expect(error).toMatch(/cycle/i);
  });

  it('orders dependencies before dependents regardless of visual input order', () => {
    const ordered = orderDeploymentObjects([
      config('Contact', ['Account']),
      config('Account'),
    ]);
    expect(ordered.map((item) => item.objectName)).toEqual(['Account', 'Contact']);
  });

  it('supports bounded accessible reorder without mutating input', () => {
    const original = ['a', 'b', 'c'];
    expect(moveByIndex(original, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveByIndex(original, 0, -1)).toBe(original);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('allows retry only for explicit idempotent upserts', () => {
    expect(isRetrySafe({
      operation: 'upsert',
      idempotent: true,
      externalIdField: 'External__c',
    })).toBe(true);
    expect(isRetrySafe({
      operation: 'insert',
      idempotent: false,
      externalIdField: null,
    })).toBe(false);
    expect(isRetrySafe({
      operation: 'upsert',
      idempotent: true,
      externalIdField: null,
    })).toBe(false);
  });

  it('shows cancellation only while a batch can still release or run work', () => {
    expect(['pending', 'queued', 'planning', 'running', 'paused'].every(isBatchCancellable))
      .toBe(true);
    expect(['completed', 'partial', 'failed', 'cancelled'].some(isBatchCancellable))
      .toBe(false);
  });

  it('does not report success until every object batch completes', () => {
    expect(aggregateDeployStatus([])).toBe('queued');
    expect(aggregateDeployStatus(['planning'])).toBe('running');
    expect(aggregateDeployStatus(['completed', 'running'])).toBe('running');
    expect(aggregateDeployStatus(['completed', 'completed'])).toBe('completed');
    expect(aggregateDeployStatus(['completed', 'failed'])).toBe('partial');
    expect(aggregateDeployStatus(['failed'])).toBe('failed');
    expect(aggregateDeployStatus(['cancelled'])).toBe('cancelled');
    expect(isTerminalDeployStatus('planning')).toBe(false);
    expect(isTerminalDeployStatus('partial')).toBe(true);
  });

  it('requires a second explicit delete confirmation when rollback reports inserts', () => {
    expect(rollbackInsertedCount({
      safe: false,
      results: [{ insertedCount: 2 }, { nested: { insertedCount: 3 } }],
    })).toBe(5);
    expect(rollbackInsertedCount({ safe: true, restored: 4 })).toBe(0);
  });
});

describe('Query Templates API contract', () => {
  it('consumes the API shape and substitutes required variables', () => {
    const [template] = normalizeTemplates([{
      id: 'bottler',
      label: 'Bottler accounts',
      object: 'Account',
      soqlTemplate: "SELECT Name FROM Account WHERE Bottler__c = '{{bottler}}'",
      requiredVariables: ['bottler'],
      operation: 'insert',
      externalIdField: undefined,
      dependsOn: [],
    }]);
    expect(template.label).toBe('Bottler accounts');
    expect(templateToQuery(template, { bottler: "O'Hare" }).soql)
      .toContain("O\\'Hare");
  });

  it('blocks adding a template until required variables are supplied', () => {
    const [template] = normalizeTemplates([{
      id: 'required',
      label: 'Required',
      object: 'Account',
      soqlTemplate: 'SELECT Name FROM Account WHERE Name = {{name}}',
      requiredVariables: ['name'],
      operation: 'insert',
      dependsOn: [],
    }]);
    expect(() => templateToQuery(template, {})).toThrow(/Missing required variable/);
  });
});
