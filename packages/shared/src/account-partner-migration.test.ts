import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
  ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD,
  ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
  accountPartnerMigrationSchema,
  buildAccountPartnerMigrationRows,
  resolveAccountPartnerMigrationSoql,
} from './account-partner-migration.js';

const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const targetAccounts = new Map([
  ['123', { id: '001-account-id', key: '000123', name: 'North Market' }],
]);
const targetEmployees = new Map([
  ['E-1', { id: '001-employee-id', key: 'E-1', name: 'Alex Employee' }],
]);
const validSoql = `SELECT
  cfs_ob__AccountPartnerExternalId__c,
  cfs_ob__PartnerRole__c,
  cfs_ob__Bottler__c,
  cfs_ob__Sales_Office__c,
  cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c,
  cfs_ob__Account__r.AccountNumber,
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
      targetAccounts,
      targetEmployees,
      nameWriteConfig: { fieldName: 'Name', maxLength: 80 },
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
      [ACCOUNT_PARTNER_EXTERNAL_ID_FIELD]: '5000-123-E-1-ZR',
      cfs_ob__PartnerRole__c: 'ZR',
      cfs_ob__Bottler__c: '5000',
      [ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD]: '001-account-id',
      [ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD]: '001-employee-id',
      Name: 'Alex Employee',
    });
    assert.equal(result.previewRows[0]?.accountKey, '000123');
    assert.equal(result.previewRows[0]?.accountName, 'North Market');
    assert.equal(result.previewRows[0]?.employeeKey, 'E-1');
    assert.equal(result.previewRows[0]?.employeeName, 'Alex Employee');
    assert.equal(result.previewRows[0]?.partnerName, 'Alex Employee');
    assert.equal(result.previewRows[0]?.action, 'create');
    assert.equal(result.stats.toCreate, 1);
    assert.equal(result.stats.toUpdate, 0);
  });

  it('matches target Accounts by customer number or account number', () => {
    const byAccountNumber = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts: new Map([
        ['456', { id: '001-account-id', key: '000456', name: 'South Market' }],
      ]),
      targetEmployees,
      records: [{
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        cfs_ob__Account__r: { AccountNumber: '000456' },
        cfs_ob__EmployeeMaster__r: { cfs_ob__EmployeeNo__c: 'E-1' },
      }],
    });

    assert.equal(byAccountNumber.stats.ready, 1);
    assert.equal(byAccountNumber.previewRows[0]?.accountKey, '000456');
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
      targetAccounts,
      targetEmployees,
      existingExternalIds: new Set(['SOURCE-AP-1']),
      records: [
        valid,
        { ...valid, cfs_ob__AccountPartnerExternalId__c: 'DUPLICATE' },
        { ...valid, cfs_ob__Bottler__c: '4900' },
        { ...valid, [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: 'missing' },
        { ...valid, [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'missing' },
      ],
    });

    assert.equal(result.rows[0]?.[ACCOUNT_PARTNER_EXTERNAL_ID_FIELD], 'SOURCE-AP-1');
    assert.equal(result.previewRows[0]?.action, 'update');
    assert.deepEqual(result.stats, {
      total: 5,
      ready: 1,
      toCreate: 0,
      toUpdate: 1,
      duplicates: 1,
      externalIdCollisions: 0,
      skippedWrongBottler: 1,
      skippedMissingOffice: 0,
      skippedMissingAccountKey: 0,
      skippedMissingEmployeeKey: 0,
      skippedMissingRole: 0,
      skippedTargetAccount: 1,
      skippedTargetEmployee: 1,
    });
  });

  it('rejects one external ID being assigned to different partner mappings', () => {
    const base = {
      cfs_ob__AccountPartnerExternalId__c: 'SHARED-ID',
      cfs_ob__Bottler__c: '5000',
      cfs_ob__Sales_Office__c: 'S003',
      cfs_ob__PartnerRole__c: 'ZR',
      [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
    };
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts,
      targetEmployees: new Map([
        ['E-1', { id: '001-employee-1', key: 'E-1', name: 'Alex Employee' }],
        ['E-2', { id: '001-employee-2', key: 'E-2', name: 'Blair Employee' }],
      ]),
      records: [
        { ...base, [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1' },
        { ...base, [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-2' },
      ],
    });

    assert.equal(result.stats.ready, 1);
    assert.equal(result.stats.externalIdCollisions, 1);
  });

  it('fits generated or source external IDs to the described target length', () => {
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts,
      targetEmployees,
      externalIdMaxLength: 32,
      records: [{
        cfs_ob__AccountPartnerExternalId__c: 'X'.repeat(300),
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
      }],
    });

    assert.equal(result.rows[0]?.[ACCOUNT_PARTNER_EXTERNAL_ID_FIELD].length, 32);
    assert.match(
      result.rows[0]?.[ACCOUNT_PARTNER_EXTERNAL_ID_FIELD] ?? '',
      /-[0-9a-f]{16}$/,
    );
  });
});
