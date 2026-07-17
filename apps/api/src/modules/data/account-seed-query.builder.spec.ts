import { describe, expect, it } from 'vitest';
import { conaSeedRunSchema } from '@sfcc/shared';
import {
  ACCOUNT_SEED_EXTERNAL_ID,
  resolveManualAccountSeedQuery,
} from './account-seed-query.builder';

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

describe('manual CONA Account seed queries', () => {
  it('normalizes a bounded Account query and preserves its filter', () => {
    const resolved = resolveManualAccountSeedQuery({
      id: 'priority-accounts',
      label: 'Priority accounts',
      soql: `SELECT Id, Name, ${ACCOUNT_SEED_EXTERNAL_ID} FROM Account `
        + "WHERE cfs_ob__Bottler__c = '5000' ORDER BY Name LIMIT 10",
      limit: 750,
    });

    expect(resolved.objectName).toBe('Account');
    expect(resolved.externalIdField).toBe(ACCOUNT_SEED_EXTERNAL_ID);
    expect(resolved.soql).not.toMatch(/^SELECT Id,/i);
    expect(resolved.soql).toContain("WHERE cfs_ob__Bottler__c = '5000'");
    expect(resolved.soql).toMatch(/LIMIT 750$/);
  });

  it('rejects a different object, missing upsert key, and relationship expressions', () => {
    expect(() => resolveManualAccountSeedQuery({
      id: 'contacts',
      label: 'Contacts',
      soql: `SELECT LastName, ${ACCOUNT_SEED_EXTERNAL_ID} FROM Contact`,
      limit: 10,
    })).toThrow(/targets Contact/i);

    expect(() => resolveManualAccountSeedQuery({
      id: 'missing-key',
      label: 'Missing key',
      soql: 'SELECT Id, Name FROM Account',
      limit: 10,
    })).toThrow(ACCOUNT_SEED_EXTERNAL_ID);

    expect(() => resolveManualAccountSeedQuery({
      id: 'relationship',
      label: 'Relationship',
      soql: `SELECT Name, Owner.Name, ${ACCOUNT_SEED_EXTERNAL_ID} FROM Account`,
      limit: 10,
    })).toThrow(/unsupported field expression/i);
  });

  it('requires manual queries only when manual Account mode is selected', () => {
    const base = {
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      datasets: ['Accounts'],
    };
    expect(conaSeedRunSchema.safeParse({
      ...base,
      accountQueryMode: 'manual',
    }).success).toBe(false);
    expect(conaSeedRunSchema.parse({
      ...base,
      accountQueryMode: 'manual',
      manualAccountQueries: [{
        id: 'manual-1',
        label: 'Manual 1',
        soql: `SELECT Name, ${ACCOUNT_SEED_EXTERNAL_ID} FROM Account`,
        limit: 500,
      }],
    }).manualAccountQueries).toHaveLength(1);
  });

  it('requires an OnboardingConfig query when its manual mode is selected', () => {
    const base = {
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      datasets: ['OnboardingConfig'],
      onboardingQueryMode: 'manual',
    };
    expect(conaSeedRunSchema.safeParse(base).success).toBe(false);
    expect(conaSeedRunSchema.parse({
      ...base,
      manualOnboardingQueries: [{
        id: 'onboarding-1',
        label: 'Onboarding 1',
        soql: 'SELECT RecordTypeId, cfs_ob__Bottler__c FROM cfs_ob__Onboarding_Config__c',
        limit: 500,
      }],
    }).manualOnboardingQueries).toHaveLength(1);
    expect(conaSeedRunSchema.safeParse({
      ...base,
      manualOnboardingQueries: [
        {
          id: 'duplicate',
          label: 'First',
          soql: 'SELECT RecordTypeId, Name FROM cfs_ob__Onboarding_Config__c',
          limit: 10,
        },
        {
          id: 'duplicate',
          label: 'Second',
          soql: 'SELECT RecordTypeId, Name FROM cfs_ob__Onboarding_Config__c',
          limit: 10,
        },
      ],
    }).success).toBe(false);
  });
});
