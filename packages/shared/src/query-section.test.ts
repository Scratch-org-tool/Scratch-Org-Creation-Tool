import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compileQuerySectionPlan,
  DEFAULT_EXTERNAL_ID_FIELDS,
  querySectionSchema,
  type QuerySectionQuery,
} from './query-section.js';

function query(overrides: Partial<QuerySectionQuery> = {}): QuerySectionQuery {
  return {
    id: 'account',
    name: 'Accounts',
    enabled: true,
    order: 0,
    stage: 0,
    category: 'account',
    object: 'Account',
    soql: 'SELECT Name, AccountNumber FROM Account LIMIT 999999',
    limit: 250,
    bottler: '5000',
    operation: 'upsert',
    externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.account,
    variables: {},
    dependsOn: [],
    ...overrides,
  };
}

describe('querySectionSchema', () => {
  it('validates account partner plan references and categories', () => {
    const section = {
      name: 'Partners',
      queries: [
        query(),
        query({
          id: 'employee',
          name: 'Employees',
          category: 'employee_master',
          object: 'cfs_ob__EmployeeMaster__c',
          soql: 'SELECT Name FROM cfs_ob__EmployeeMaster__c',
          externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.employee,
        }),
        query({
          id: 'partner',
          name: 'Partners',
          category: 'account_partner',
          object: 'cfs_ob__AccountPartner__c',
          soql: 'SELECT Name FROM cfs_ob__AccountPartner__c',
          externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.partner,
        }),
      ],
      accountPartnerPlan: {
        accountQueryId: 'account',
        employeeMasterQueryId: 'employee',
        accountPartnerQueryId: 'partner',
      },
    };
    assert.equal(querySectionSchema.parse(section).queries.length, 3);
    assert.throws(
      () =>
        querySectionSchema.parse({
          ...section,
          accountPartnerPlan: {
            ...section.accountPartnerPlan,
            employeeMasterQueryId: 'account',
          },
        }),
      /employee_master/,
    );
  });

  it('rejects duplicate ids and missing dependencies', () => {
    assert.throws(
      () =>
        querySectionSchema.parse({
          name: 'Invalid',
          queries: [query(), query({ dependsOn: ['missing'] })],
        }),
      /Duplicate query id|Missing dependency/,
    );
  });

  it('normalizes SFDMU operation casing and boolean sales-office expansion', () => {
    const parsed = querySectionSchema.parse({
      name: 'Normalized',
      queries: [{
        ...query(),
        operation: 'Upsert',
        salesOfficeExpansion: true,
      }],
    });
    assert.equal(parsed.queries[0].operation, 'upsert');
    assert.deepEqual(parsed.queries[0].salesOfficeExpansion, {
      enabled: true,
      variable: 'salesOffice',
    });
  });
});

describe('compileQuerySectionPlan', () => {
  it('uses stable topological ordering and authoritative capped limits', () => {
    const plan = compileQuerySectionPlan({
      name: 'Ordered',
      queries: [
        query({ id: 'third', name: 'Third', order: 0, stage: 2, dependsOn: ['first'] }),
        query({ id: 'second', name: 'Second', order: 2, stage: 0 }),
        query({ id: 'first', name: 'First', order: 1, stage: 0 }),
      ],
    }, { maxLimit: 100 });

    assert.deepEqual(plan.queries.map((item) => item.id), ['first', 'second', 'third']);
    assert.ok(plan.queries.every((item) => item.limit === 100));
    assert.ok(plan.queries.every((item) => item.soql.endsWith('LIMIT 100')));
    assert.ok(plan.queries.every((item) => !item.soql.includes('999999')));
  });

  it('rejects cycles and lets dependencies override stage hints', () => {
    assert.throws(
      () =>
        compileQuerySectionPlan({
          name: 'Cycle',
          queries: [
            query({ id: 'a', dependsOn: ['b'] }),
            query({ id: 'b', dependsOn: ['a'] }),
          ],
        }),
      /cycle/i,
    );
    const plan = compileQuerySectionPlan({
      name: 'Stages',
      queries: [
        query({ id: 'later', stage: 2 }),
        query({ id: 'early', stage: 1, dependsOn: ['later'] }),
      ],
    });
    assert.deepEqual(plan.queries.map((item) => item.id), ['later', 'early']);
  });

  it('validates SELECT-only SOQL and root object consistency', () => {
    assert.throws(
      () => compileQuerySectionPlan({ name: 'Bad', queries: [query({ soql: 'DELETE FROM Account' })] }),
      /SELECT-only/,
    );
    assert.throws(
      () =>
        compileQuerySectionPlan({
          name: 'Bad object',
          queries: [query({ soql: 'SELECT Name FROM Contact' })],
        }),
      /declares object Account/,
    );
    assert.throws(
      () =>
        compileQuerySectionPlan({
          name: 'Multiple',
          queries: [query({ soql: 'SELECT Name FROM Account; SELECT Name FROM Contact' })],
        }),
      /one SELECT statement/,
    );
  });

  it('requires or supplies external ids for upserts', () => {
    const account = compileQuerySectionPlan({
      name: 'Default',
      queries: [query({ externalIdField: undefined })],
    });
    assert.equal(account.queries[0].externalIdField, DEFAULT_EXTERNAL_ID_FIELDS.account);

    assert.throws(
      () =>
        compileQuerySectionPlan({
          name: 'Arbitrary',
          queries: [
            query({
              category: 'arbitrary',
              object: 'Widget__c',
              soql: 'SELECT Name FROM Widget__c',
              externalIdField: undefined,
            }),
          ],
        }),
      /requires externalIdField/,
    );
    assert.throws(
      () =>
        compileQuerySectionPlan({
          name: 'Unsafe update',
          queries: [query({
            category: 'arbitrary',
            object: 'Widget__c',
            soql: 'SELECT Name FROM Widget__c',
            operation: 'update',
            externalIdField: undefined,
          })],
        }),
      /update query .* requires externalIdField/,
    );
  });

  it('expands sales offices deterministically and substitutes variables', () => {
    const plan = compileQuerySectionPlan({
      name: 'Offices',
      queries: [
        query({
          soql: "SELECT Name FROM Account WHERE Office__c = '{{office}}' LIMIT 1",
          salesOfficeExpansion: { enabled: true, variable: 'office' },
        }),
      ],
    }, { salesOfficesByBottler: { '5000': ['S002', 'S001', 'S002'] } });

    assert.deepEqual(plan.queries.map((item) => item.id), ['account:S002', 'account:S001']);
    assert.match(plan.queries[0].soql, /Office__c = 'S002'/);
    assert.ok(plan.queries[0].soql.endsWith('LIMIT 250'));
  });

  it('injects all account-partner support dependencies regardless of stage/order', () => {
    const plan = compileQuerySectionPlan({
      name: 'Partners',
      queries: [
        query({
          id: 'partner',
          name: 'Partners',
          stage: 0,
          category: 'account_partner',
          object: 'Partner__c',
          soql: 'SELECT AccountKey__c, EmployeeKey__c, Role__c FROM Partner__c',
          externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.partner,
        }),
        query({ id: 'account', stage: 9, order: 9 }),
        query({
          id: 'employee',
          stage: 8,
          category: 'employee_master',
          object: 'Employee__c',
          soql: 'SELECT cfs_ob__EmployeeNo__c FROM Employee__c',
          externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.employee,
        }),
        query({
          id: 'role',
          stage: 7,
          category: 'arbitrary',
          object: 'UserRole',
          soql: 'SELECT DeveloperName FROM UserRole',
          externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.role,
        }),
      ],
      accountPartnerPlan: {
        accountQueryId: 'account',
        employeeMasterQueryId: 'employee',
        accountPartnerQueryId: 'partner',
        roleQueryId: 'role',
      },
    });

    assert.deepEqual(plan.queries.map((item) => item.id), ['role', 'employee', 'account', 'partner']);
    assert.deepEqual(
      plan.queries.at(-1)?.dependsOn,
      ['account', 'employee', 'role'],
    );
  });

  it('requires the generated partner external ID to match the mapping query', () => {
    assert.throws(
      () => querySectionSchema.parse({
        name: 'Mismatch',
        queries: [
          query(),
          query({
            id: 'employee',
            category: 'employee_master',
            object: 'Employee__c',
            soql: 'SELECT cfs_ob__EmployeeNo__c FROM Employee__c',
          }),
          query({
            id: 'partner',
            category: 'account_partner',
            object: 'Partner__c',
            soql: 'SELECT Name FROM Partner__c',
            externalIdField: 'WrongExternalId__c',
          }),
        ],
        accountPartnerPlan: {
          accountQueryId: 'account',
          employeeMasterQueryId: 'employee',
          accountPartnerQueryId: 'partner',
          externalIdField: 'GeneratedExternalId__c',
        },
      }),
      /must match accountPartnerPlan\.externalIdField/,
    );
  });

  it('requires roleQueryId to expose a deterministic lookup field', () => {
    assert.throws(
      () => querySectionSchema.parse({
        name: 'Role lookup',
        queries: [
          query(),
          query({
            id: 'employee',
            category: 'employee_master',
            object: 'Employee__c',
            soql: 'SELECT Employee__c FROM Employee__c',
          }),
          query({
            id: 'partner',
            category: 'account_partner',
            object: 'Partner__c',
            soql: 'SELECT Name FROM Partner__c',
            externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.partner,
          }),
          query({
            id: 'role',
            category: 'arbitrary',
            object: 'PartnerRole__c',
            soql: 'SELECT Name FROM PartnerRole__c',
            operation: 'insert',
            externalIdField: undefined,
          }),
        ],
        accountPartnerPlan: {
          accountQueryId: 'account',
          employeeMasterQueryId: 'employee',
          accountPartnerQueryId: 'partner',
          roleQueryId: 'role',
        },
      }),
      /requires externalIdField for deterministic lookup/,
    );
  });
});
