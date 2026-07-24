import { describe, expect, it } from 'vitest';
import {
  addFieldToSoql,
  objectLabel,
  parseSfdmuExportJson,
  serializeSfdmuExportJson,
  updateObjectQuery,
} from './sfdmu-soql-utils';

describe('sfdmu-soql-utils', () => {
  it('adds a field to the SELECT list when missing', () => {
    const soql = 'SELECT Name FROM Account';
    expect(addFieldToSoql(soql, 'cfs_ob__Bottler__c')).toBe(
      'SELECT Name, cfs_ob__Bottler__c FROM Account',
    );
  });

  it('does not duplicate an existing field', () => {
    const soql = 'SELECT Name, cfs_ob__Bottler__c FROM Account';
    expect(addFieldToSoql(soql, 'cfs_ob__Bottler__c')).toBe(soql);
  });

  it('round-trips object edits through JSON serialization', () => {
    const json = serializeSfdmuExportJson([
      { query: 'SELECT Name FROM Account', operation: 'Upsert' },
    ]);
    const objects = parseSfdmuExportJson(json);
    const updated = updateObjectQuery(objects, 0, 'SELECT Name, Id FROM Account');
    expect(objectLabel(updated[0]!, 0)).toBe('Account');
    expect(updated[0]?.query).toContain('Id');
  });
});
