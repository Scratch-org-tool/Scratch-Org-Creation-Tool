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
  applyAccountPartnerPerOfficeLimit,
  sampleAccountPartnerExcelRecordsByOffice,
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

  it('tries each source account key until one matches the target index', () => {
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts: new Map([
        ['123', { id: '001-account-id', key: '000123', name: 'North Market' }],
      ]),
      targetEmployees,
      records: [{
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        cfs_ob__Account__r: {
          cfs_ob__u_CustomerNumber__c: '999999',
          AccountNumber: '000123',
        },
        cfs_ob__EmployeeMaster__r: { cfs_ob__EmployeeNo__c: 'E-1' },
      }],
    });

    assert.equal(result.stats.ready, 1);
    assert.equal(result.previewRows[0]?.accountKey, '000123');
  });

  it('normalizes numeric employee numbers when matching target Employee Masters', () => {
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts,
      targetEmployees: new Map([
        ['123', { id: '001-employee-id', key: '123', name: 'Alex Employee' }],
      ]),
      records: [{
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: '00123',
      }],
    });

    assert.equal(result.stats.ready, 1);
    assert.equal(result.previewRows[0]?.employeeKey, '123');
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
      skippedNoDistributionMatch: 0,
      skippedPerOfficeLimit: 0,
    });
    assert.deepEqual(result.readyExternalIds, ['SOURCE-AP-1']);
  });

  it('samples unique role and employee pairs per sales office before matching', () => {
    const sampled = sampleAccountPartnerExcelRecordsByOffice([
      {
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '1',
      },
      {
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-2',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '2',
      },
      {
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-3',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '3',
      },
      {
        cfs_ob__Sales_Office__c: 'S004',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '4',
      },
    ], 2);
    assert.equal(sampled.records.length, 3);
    assert.equal(sampled.skippedPerOfficeLimit, 1);
  });

  it('preview mode skips upsert row materialization', () => {
    const result = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts,
      targetEmployees,
      mode: 'preview',
      records: [{
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
      }],
    });
    assert.equal(result.stats.ready, 1);
    assert.equal(result.rows.length, 0);
    assert.equal(result.previewRows.length, 1);
    assert.equal(result.readyExternalIds.length, 0);
    assert.equal(result.stats.toCreate, 1);
    assert.equal(result.stats.toUpdate, 0);
  });

  it('limits ready mappings per sales office by unique employee and role', () => {
    const records = [
      {
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-1',
      },
      {
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-2',
      },
      {
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S003',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-3',
      },
      {
        cfs_ob__Bottler__c: '5000',
        cfs_ob__Sales_Office__c: 'S004',
        cfs_ob__PartnerRole__c: 'ZR',
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: '123',
        [ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD]: 'E-4',
      },
    ];
    const mapping = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts,
      targetEmployees: new Map([
        ['E-1', { id: '001-employee-1', key: 'E-1', name: 'Alex' }],
        ['E-2', { id: '001-employee-2', key: 'E-2', name: 'Blair' }],
        ['E-3', { id: '001-employee-3', key: 'E-3', name: 'Casey' }],
        ['E-4', { id: '001-employee-4', key: 'E-4', name: 'Dana' }],
      ]),
      records,
    });
    const limited = applyAccountPartnerPerOfficeLimit(mapping, 2);

    assert.equal(mapping.stats.ready, 4);
    assert.equal(limited.stats.ready, 3);
    assert.equal(limited.stats.skippedPerOfficeLimit, 1);
    assert.deepEqual(
      limited.previewRows.map((row) => row.salesOffice),
      ['S003', 'S003', 'S004'],
    );

    const limitedInline = buildAccountPartnerMigrationRows({
      bottler: '5000',
      targetAccounts,
      targetEmployees: new Map([
        ['E-1', { id: '001-employee-1', key: 'E-1', name: 'Alex' }],
        ['E-2', { id: '001-employee-2', key: 'E-2', name: 'Blair' }],
        ['E-3', { id: '001-employee-3', key: 'E-3', name: 'Casey' }],
        ['E-4', { id: '001-employee-4', key: 'E-4', name: 'Dana' }],
      ]),
      records,
      perOffice: 2,
    });
    assert.equal(limitedInline.stats.ready, 3);
    assert.equal(limitedInline.stats.skippedPerOfficeLimit, 1);
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
