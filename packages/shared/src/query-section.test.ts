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
    soql: 'SELECT Name, cfs_ob__u_CustomerNumber__c FROM Account LIMIT 999999',
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

  it('rejects cycles and dependencies on later stages', () => {
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
    assert.throws(
      () =>
        compileQuerySectionPlan({
          name: 'Stages',
          queries: [
            query({ id: 'later', stage: 2 }),
            query({ id: 'early', stage: 1, dependsOn: ['later'] }),
          ],
        }),
      /later-stage/,
    );
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
});
