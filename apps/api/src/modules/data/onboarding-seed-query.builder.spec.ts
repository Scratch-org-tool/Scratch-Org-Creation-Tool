import { describe, expect, it } from 'vitest';
import { ONBOARDING_OBJECT } from '@sfcc/shared';
import {
  prepareManualOnboardingQueryForBulk,
  resolveManualOnboardingSeedQuery,
} from './onboarding-seed-query.builder';

describe('manual CONA OnboardingConfig queries', () => {
  it('normalizes a bounded query and retains its filter', () => {
    const result = resolveManualOnboardingSeedQuery({
      id: 'primary-groups',
      label: 'Primary groups',
      soql: `SELECT Id, RecordTypeId, cfs_ob__Bottler__c FROM ${ONBOARDING_OBJECT} `
        + "WHERE cfs_ob__Record_Category__c = 'Primary Group' LIMIT 10",
      limit: 250,
    });

    expect(result.objectName).toBe(ONBOARDING_OBJECT);
    expect(result.soql).not.toMatch(/^SELECT Id,/i);
    expect(result.soql).toContain("cfs_ob__Record_Category__c = 'Primary Group'");
    expect(result.soql).toMatch(/LIMIT 250$/);
  });

  it('rejects the wrong object, a missing RecordTypeId, and relationship fields', () => {
    expect(() => resolveManualOnboardingSeedQuery({
      id: 'accounts',
      label: 'Accounts',
      soql: 'SELECT RecordTypeId, Name FROM Account',
      limit: 10,
    })).toThrow(/targets Account/i);

    expect(() => resolveManualOnboardingSeedQuery({
      id: 'missing-record-type',
      label: 'Missing record type',
      soql: `SELECT Id, cfs_ob__Bottler__c FROM ${ONBOARDING_OBJECT}`,
      limit: 10,
    })).toThrow(/RecordTypeId/);

    expect(() => resolveManualOnboardingSeedQuery({
      id: 'relationship',
      label: 'Relationship',
      soql: `SELECT RecordTypeId, RecordType.DeveloperName FROM ${ONBOARDING_OBJECT}`,
      limit: 10,
    })).toThrow(/unsupported field expression/i);
  });

  it('expands compound fields and removes target fields that cannot be inserted', () => {
    const resolved = resolveManualOnboardingSeedQuery({
      id: 'compound',
      label: 'Compound fields',
      soql: `SELECT RecordTypeId, cfs_ob__Bottler__c, Geo__c, Address__c, Formula__c `
        + `FROM ${ONBOARDING_OBJECT} WHERE cfs_ob__Bottler__c = '5000'`,
      limit: 100,
    });
    const sourceFields = [
      { name: 'RecordTypeId', type: 'reference' },
      { name: 'cfs_ob__Bottler__c', type: 'string' },
      { name: 'Geo__c', type: 'location' },
      { name: 'Geo__Latitude__s', type: 'double', compoundFieldName: 'Geo__c' },
      { name: 'Geo__Longitude__s', type: 'double', compoundFieldName: 'Geo__c' },
      { name: 'Address__c', type: 'address' },
      { name: 'Address__Street__s', type: 'string', compoundFieldName: 'Address__c' },
      { name: 'Formula__c', type: 'string' },
    ];
    const targetFields = sourceFields.map((field) => ({
      ...field,
      createable: field.name !== 'Formula__c',
      calculated: field.name === 'Formula__c',
    }));

    const prepared = prepareManualOnboardingQueryForBulk(
      resolved,
      sourceFields,
      targetFields,
    );

    expect(prepared.soql).toContain(
      'SELECT RecordTypeId, cfs_ob__Bottler__c, '
      + 'Geo__Latitude__s, Geo__Longitude__s, Address__Street__s',
    );
    expect(prepared.soql).not.toMatch(/\bGeo__c\b/);
    expect(prepared.soql).not.toMatch(/\bAddress__c\b/);
    expect(prepared.soql).not.toContain('Formula__c');
    expect(prepared.soql).toContain("WHERE cfs_ob__Bottler__c = '5000' LIMIT 100");
    expect(prepared.expandedCompoundFields).toEqual([
      {
        field: 'Geo__c',
        components: ['Geo__Latitude__s', 'Geo__Longitude__s'],
      },
      {
        field: 'Address__c',
        components: ['Address__Street__s'],
      },
    ]);
    expect(prepared.excludedFields).toEqual([
      {
        field: 'Formula__c',
        reason: 'target field Formula__c is not createable',
      },
    ]);
  });
});
