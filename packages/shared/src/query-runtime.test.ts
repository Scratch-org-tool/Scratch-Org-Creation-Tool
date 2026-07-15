import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileQuerySectionPlan } from './query-section.js';
import {
  buildAccountPartnerRows,
  createQueryRuntimeCheckpoint,
  pendingQueryIds,
  selectCompiledSupportQueries,
  serializeBulkCsv,
} from './query-runtime.js';

describe('query runtime checkpoints', () => {
  it('preserves deterministic plan order and skips completed queries on resume', () => {
    const plan = compileQuerySectionPlan({
      name: 'resume',
      queries: [
        {
          id: 'second', name: 'Second', enabled: true, order: 2, stage: 1,
          category: 'arbitrary', object: 'Thing__c', soql: 'SELECT Name FROM Thing__c',
          limit: 20, operation: 'upsert', externalIdField: 'Name', variables: {},
          dependsOn: ['first'],
        },
        {
          id: 'first', name: 'First', enabled: true, order: 1, stage: 0,
          category: 'arbitrary', object: 'Other__c', soql: 'SELECT Name FROM Other__c',
          limit: 20, operation: 'upsert', externalIdField: 'Name', variables: {},
          dependsOn: [],
        },
      ],
    });
    const checkpoint = createQueryRuntimeCheckpoint(plan.queries, {
      completedQueryIds: ['first'],
      queries: {
        first: { id: 'first', status: 'completed', exported: 2, loaded: 2, failed: 0 },
      },
    });
    assert.deepEqual(plan.queries.map((query) => query.id), ['first', 'second']);
    assert.deepEqual(pendingQueryIds(plan.queries, checkpoint), ['second']);
    assert.equal(checkpoint.queries.first.loaded, 2);
  });

  it('preserves per-query chunk checkpoints', () => {
    const plan = compileQuerySectionPlan({
      name: 'chunks',
      queries: [{
        id: 'delete', name: 'Delete', enabled: true, order: 0, stage: 0,
        category: 'arbitrary', object: 'Thing__c',
        soql: 'SELECT External__c FROM Thing__c',
        limit: 20, operation: 'delete', externalIdField: 'External__c',
        variables: {}, dependsOn: [],
      }],
    });
    const checkpoint = createQueryRuntimeCheckpoint(plan.queries, {
      completedQueryIds: [],
      queries: {
        delete: {
          id: 'delete',
          status: 'failed',
          exported: 2,
          loaded: 1,
          failed: 1,
          completedChunkIndexes: [0],
          runningChunkIndex: 1,
        },
      },
    });
    assert.deepEqual(checkpoint.queries.delete.completedChunkIndexes, [0]);
    assert.equal(checkpoint.queries.delete.runningChunkIndex, 1);
  });
});

describe('account partner join', () => {
  it('joins only existing account+employee keys, generates IDs, and deduplicates role rows', () => {
    const result = buildAccountPartnerRows({
      plan: {
        accountQueryId: 'accounts',
        employeeMasterQueryId: 'employees',
        accountPartnerQueryId: 'partners',
        accountKeyField: 'Customer',
        employeeKeyField: 'Employee',
        mappingAccountKeyField: 'Account.Customer',
        mappingEmployeeKeyField: 'EmployeeMaster.Employee',
        mappingRoleField: 'Role',
        externalIdField: 'External__c',
        externalIdPattern: '{{account}}:{{employee}}:{{role}}',
      },
      accounts: [{ Customer: 'A-1' }],
      employees: [{ Employee: 'E-1' }],
      mappings: [
        { Account: { Customer: 'A-1' }, EmployeeMaster: { Employee: 'E-1' }, Role: 'ZR' },
        { Account: { Customer: 'A-1' }, EmployeeMaster: { Employee: 'E-1' }, Role: 'ZR' },
        { Account: { Customer: 'missing' }, EmployeeMaster: { Employee: 'E-1' }, Role: 'ZR' },
        { Account: { Customer: 'A-1' }, EmployeeMaster: { Employee: 'missing' }, Role: 'ZR' },
      ],
    });
    assert.deepEqual(result.rows, [{
      External__c: 'A-1:E-1:ZR',
      Role: 'ZR',
      'Account.Customer': 'A-1',
      'EmployeeMaster.Employee': 'E-1',
    }]);
    assert.equal(result.duplicates, 1);
    assert.equal(result.skippedMissingAccount, 1);
    assert.equal(result.skippedMissingEmployee, 1);
    assert.equal(result.skippedMissingRole, 0);
  });

  it('uses roleQueryId rows as a deterministic role lookup', () => {
    const result = buildAccountPartnerRows({
      plan: {
        accountQueryId: 'accounts',
        employeeMasterQueryId: 'employees',
        accountPartnerQueryId: 'partners',
        roleQueryId: 'roles',
        accountKeyField: 'Customer',
        employeeKeyField: 'Employee',
        mappingAccountKeyField: 'Customer',
        mappingEmployeeKeyField: 'Employee',
        mappingRoleField: 'Role',
        externalIdField: 'External__c',
        externalIdPattern: '{{account}}:{{employee}}:{{role}}',
      },
      accounts: [{ Customer: 'A' }],
      employees: [{ Employee: 'E' }],
      roles: [{ DeveloperName: 'ZR' }],
      roleKeyField: 'DeveloperName',
      mappings: [
        { Customer: 'A', Employee: 'E', Role: 'UNKNOWN' },
        { Customer: 'A', Employee: 'E', Role: 'ZR' },
      ],
    });
    assert.equal(result.skippedMissingRole, 1);
    assert.deepEqual(result.rows.map((row) => row.Role), ['ZR']);
  });
});

describe('query runtime CSV and office support', () => {
  it('writes Bulk CLI-compatible LF-only CSV for every write operation', () => {
    const csv = serializeBulkCsv([{ External__c: 'A', Name: 'Comma, quoted' }]);
    assert.equal(csv.endsWith('\n'), true);
    assert.equal(csv.includes('\r\n'), false);
    assert.equal(csv, 'External__c,Name\nA,"Comma, quoted"\n');
  });

  it('selects support rows by compiled query ID and office without overwriting variants', () => {
    const plan = compileQuerySectionPlan({
      name: 'offices',
      queries: [{
        id: 'account', name: 'Accounts', enabled: true, order: 0, stage: 0,
        category: 'account', object: 'Account',
        soql: "SELECT Name FROM Account WHERE Office__c = '{{office}}'",
        limit: 20, operation: 'upsert', externalIdField: 'Name',
        variables: {}, dependsOn: [],
        salesOfficeExpansion: { enabled: true, variable: 'office' },
      }],
    }, { salesOffices: ['S1', 'S2'] });
    assert.deepEqual(
      selectCompiledSupportQueries(plan.queries, 'account', 'S2').map((query) => query.id),
      ['account:S2'],
    );
    assert.deepEqual(
      selectCompiledSupportQueries(plan.queries, 'account').map((query) => query.id),
      ['account:S1', 'account:S2'],
    );
  });
});
