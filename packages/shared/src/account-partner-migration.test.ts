import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
  accountPartnerMigrationSchema,
  buildAccountPartnerMigrationRows,
  resolveAccountPartnerMigrationSoql,
} from './account-partner-migration.js';

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const validSoql = `SELECT
  cfs_ob__AccountPartnerExternalId__c,
  cfs_ob__PartnerRole__c,
  cfs_ob__Bottler__c,
  cfs_ob__Sales_Office__c,
  cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c,
  cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c
FROM cfs_ob__AccountPartner__c
WHERE cfs_ob__Bottler__c = '5000'`;

describe('Account Partner migration contract', () => {
  it('validates required mapping fields and applies the selected upper bound', () => {
    const input = accountPartnerMigrationSchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      bottler: '5000',
      partnerSoql: `${validSoql} LIMIT 5`,
      recordLimit: 250,
    });
    assert.match(resolveAccountPartnerMigrationSoql(input), /LIMIT 250$/);

    const invalid = accountPartnerMigrationSchema.safeParse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      bottler: '5000',
      partnerSoql: 'SELECT Name FROM Account',
      recordLimit: 10,
    });
    assert.equal(invalid.success, false);
  });

  it('joins nested relationship keys to target Accounts and Employee Masters', () => {
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccountKeys: new Set(['123']),
      targetEmployeeKeys: new Set(['E-1']),
      records: [{
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        cfs_ob__Account__r: { cfs_ob__u_CustomerNumber__c: '000123' },
        cfs_ob__EmployeeMaster__r: { cfs_ob__EmployeeNo__c: 'E-1' },
      }],
    });

    assert.equal(result.stats.ready, 1);
    assert.deepEqual(result.rows[0], {
      [ACCOUNT_PARTNER_EXTERNAL_ID_FIELD]: '5000-S003-E-1-ZR-123',
      cfs_ob__PartnerRole__c: 'ZR',
      cfs_ob__Bottler__c: '5000',
      [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
      [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
    });
  });

  it('preserves source external IDs and reports invalid or duplicate mappings', () => {
    const valid = {
      cfs_ob__AccountPartnerExternalId__c: 'SOURCE-AP-1',
      cfs_ob__Bottler__c: '5000',
      cfs_ob__Sales_Office__c: 'S003',
      cfs_ob__PartnerFunction__c: 'ZR',
      [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
      [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
    };
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccountKeys: new Set(['123']),
      targetEmployeeKeys: new Set(['E-1']),
      records: [
        valid,
        { ...valid, cfs_ob__AccountPartnerExternalId__c: 'DUPLICATE' },
        { ...valid, cfs_ob__Bottler__c: '4900' },
        { ...valid, [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: 'missing' },
        { ...valid, [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'missing' },
      ],
    });

    assert.equal(result.rows[0]?.[ACCOUNT_PARTNER_EXTERNAL_ID_FIELD], 'SOURCE-AP-1');
    assert.deepEqual(result.stats, {
      total: 5,
      ready: 1,
      duplicates: 1,
      skippedWrongBottler: 1,
      skippedMissingOffice: 0,
      skippedMissingAccountKey: 0,
      skippedMissingEmployeeKey: 0,
      skippedMissingRole: 0,
      skippedTargetAccount: 1,
      skippedTargetEmployee: 1,
    });
  });
});
