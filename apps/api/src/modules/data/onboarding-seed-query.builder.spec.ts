import { describe, expect, it } from 'vitest';
import { ONBOARDING_OBJECT } from '@sfcc/shared';
import { resolveManualOnboardingSeedQuery } from './onboarding-seed-query.builder';

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
});
