import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileQuerySectionPlan } from './query-section.js';
import {
  buildAccountPartnerRows,
  createQueryRuntimeCheckpoint,
  pendingQueryIds,
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
  });
});
