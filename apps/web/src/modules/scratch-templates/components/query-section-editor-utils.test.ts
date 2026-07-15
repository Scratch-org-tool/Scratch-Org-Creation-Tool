import { describe, expect, it } from 'vitest';
import type { QuerySectionQuery } from '@sfcc/shared';
import {
  generatedStableQueryId,
  queryReferenceLabels,
  reorderQueries,
} from './query-section-editor-utils';

function query(id: string, stage: number, dependsOn: string[] = []): QuerySectionQuery {
  return {
    id,
    name: id,
    enabled: true,
    order: stage,
    stage,
    category: 'arbitrary',
    object: 'Example__c',
    soql: 'SELECT Name FROM Example__c',
    limit: 10,
    operation: 'upsert',
    externalIdField: 'Name',
    variables: {},
    dependsOn,
  };
}

describe('query section editor contracts', () => {
  it('renumbers stage and order together when visual execution order changes', () => {
    const reordered = reorderQueries(
      [query('first', 0), query('second', 8), query('third', 20)],
      2,
      -1,
    );
    expect(reordered.map(({ id, stage, order }) => ({ id, stage, order }))).toEqual([
      { id: 'first', stage: 0, order: 0 },
      { id: 'third', stage: 1, order: 1 },
      { id: 'second', stage: 2, order: 2 },
    ]);
  });

  it('does not move a query across its direct dependency', () => {
    const original = [query('first', 0), query('second', 1, ['first'])];
    expect(reorderQueries(original, 1, -1)).toEqual(original);
  });

  it('keeps generated IDs stable and reports dependency and partner references', () => {
    expect(generatedStableQueryId('Account rows', ['account-rows'])).toBe('account-rows-2');
    expect(queryReferenceLabels('first', [
      query('first', 0),
      query('second', 1, ['first']),
    ], {
      accountQueryId: 'first',
      employeeMasterQueryId: 'employee',
      accountPartnerQueryId: 'partner',
      accountKeyField: 'Account',
      employeeKeyField: 'Employee',
      mappingAccountKeyField: 'Account',
      mappingEmployeeKeyField: 'Employee',
      mappingRoleField: 'Role',
      externalIdField: 'External__c',
      externalIdPattern: '{{account}}-{{employee}}-{{role}}',
    })).toEqual(['dependency of second', 'Account Partner account query']);
  });
});
