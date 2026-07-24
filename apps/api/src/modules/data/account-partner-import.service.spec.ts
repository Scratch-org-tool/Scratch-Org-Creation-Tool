import { readFile, writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD,
  ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  type AccountPartnerMigrationInput,
} from '@sfcc/shared';

const mocks = vi.hoisted(() => ({
  sfCli: {
    describeSObject: vi.fn(),
    exportBulk: vi.fn(),
    queryAll: vi.fn(),
    upsertBulk: vi.fn(),
  },
  orgConnection: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@sfcc/sf-cli', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sfcc/sf-cli')>();
  return {
    ...actual,
    createSfCliClient: () => mocks.sfCli,
  };
});

vi.mock('@sfcc/db', () => ({
  prisma: {
    orgConnection: mocks.orgConnection,
  },
}));

import { AccountPartnerImportService } from './account-partner-import.service';

const input: AccountPartnerMigrationInput = {
  sourceOrgId: '11111111-1111-4111-8111-111111111111',
  targetOrgId: '22222222-2222-4222-8222-222222222222',
  bottler: '5000',
  recordLimit: 500,
  partnerSoql: `SELECT
    cfs_ob__AccountPartnerExternalId__c,
    cfs_ob__PartnerRole__c,
    cfs_ob__Bottler__c,
    cfs_ob__Sales_Office__c,
    ${ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD},
    ${ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD},
    ${ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD}
  FROM cfs_ob__AccountPartner__c
  WHERE cfs_ob__Bottler__c = '5000'`,
};

const sourceCsv = [
  [
    'cfs_ob__AccountPartnerExternalId__c',
    'cfs_ob__PartnerRole__c',
    'cfs_ob__Bottler__c',
    'cfs_ob__Sales_Office__c',
    ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
    ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD,
    ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  ].join(','),
  'AP-1,ZR,5000,S003,000123,000123,E-1',
  'AP-2,ZR,5000,S003,999,999,E-1',
  '',
].join('\n');

describe('AccountPartnerImportService SOQL mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orgConnection.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        alias: where.id === input.sourceOrgId ? 'source' : 'target',
        username: null,
      }),
    );
    mocks.sfCli.describeSObject.mockImplementation(async (
      _alias: string,
      objectName: string,
    ) => {
      const writable = (name: string, externalId = false, length?: number) => ({
        name,
        externalId,
        createable: true,
        updateable: true,
        length: length ?? (externalId ? 255 : undefined),
        type: 'string',
      });
      const fields = objectName === 'cfs_ob__AccountPartner__c'
        ? [
            writable('cfs_ob__AccountPartnerExternalId__c', true),
            writable('cfs_ob__PartnerRole__c'),
            writable('cfs_ob__Bottler__c'),
            writable('cfs_ob__Account__c'),
            writable('cfs_ob__EmployeeMaster__c'),
            writable('Name', false, 80),
          ]
        : objectName === 'Account'
          ? [
            writable('cfs_ob__u_CustomerNumber__c', true),
            writable('AccountNumber', true),
            writable('Name'),
          ]
          : [writable('cfs_ob__EmployeeNo__c', true), writable('Name')];
      return { success: true, data: { result: { fields } } };
    });
    mocks.sfCli.exportBulk.mockImplementation(async (
      soql: string,
      alias: string,
      file: string,
    ) => {
      if (alias === 'source') {
        await writeFile(file, sourceCsv, 'utf8');
      } else if (soql.includes('FROM Account ')) {
        await writeFile(
          file,
          'Id,Name,cfs_ob__u_CustomerNumber__c,AccountNumber\n'
          + '001ACCOUNT00000001,North Market,000123,000123\n',
          'utf8',
        );
      } else if (soql.includes('FROM cfs_ob__AccountPartner__c ')) {
        await writeFile(
          file,
          'cfs_ob__AccountPartnerExternalId__c\nAP-1\n',
          'utf8',
        );
      } else {
        await writeFile(
          file,
          'Id,Name,cfs_ob__EmployeeNo__c\n'
          + '001EMPLOYEE0000001,Alex Employee,E-1\n',
          'utf8',
        );
      }
      return { success: true };
    });
    mocks.sfCli.upsertBulk.mockResolvedValue({ success: true });
  });

  it('previews only mappings whose Account and Employee exist in the target', async () => {
    const service = new AccountPartnerImportService();

    const preview = await service.previewSoqlMapping(input);

    expect(preview.ok).toBe(true);
    expect(preview.query).toMatch(/LIMIT 500$/);
    expect(preview.stats).toEqual(expect.objectContaining({
      total: 2,
      ready: 1,
      skippedTargetAccount: 1,
      skippedTargetEmployee: 0,
      toCreate: 0,
      toUpdate: 1,
    }));
    expect(preview.nameField).toEqual({
      fieldName: 'Name',
      mode: 'employee-master-name',
    });
    expect(preview.sample).toEqual([
      expect.objectContaining({
        externalId: 'AP-1',
        accountKey: '000123',
        accountName: 'North Market',
        employeeKey: 'E-1',
        employeeName: 'Alex Employee',
        partnerName: 'Alex Employee',
        targetAccountId: '001ACCOUNT00000001',
        targetEmployeeId: '001EMPLOYEE0000001',
      }),
    ]);
    expect(mocks.sfCli.exportBulk).toHaveBeenCalledWith(
      expect.stringContaining("cfs_ob__Bottler__c = '5000'"),
      'target',
      expect.stringContaining('target-accounts.csv'),
      15,
      expect.any(Object),
    );
  });

  it('writes and upserts the mapped Account Partner CSV in one queued operation', async () => {
    const service = new AccountPartnerImportService();
    const logs: string[] = [];
    let csv = '';
    mocks.sfCli.upsertBulk.mockImplementation(async (
      _object: string,
      file: string,
    ) => {
      csv = await readFile(file, 'utf8');
      return { success: true };
    });

    const result = await service.migrateSoqlMapping(input, async (line) => {
      logs.push(line);
    });

    expect(result.success).toBe(true);
    expect(result.stats.ready).toBe(1);
    expect(csv).toContain('cfs_ob__AccountPartnerExternalId__c');
    expect(csv).toContain('AP-1');
    expect(csv).toContain('cfs_ob__Account__c');
    expect(csv).toContain('001ACCOUNT00000001');
    expect(csv).toContain('Name');
    expect(csv).toContain('Alex Employee');
    expect(mocks.sfCli.upsertBulk).toHaveBeenCalledWith(
      'cfs_ob__AccountPartner__c',
      expect.stringContaining('account-partners.csv'),
      'cfs_ob__AccountPartnerExternalId__c',
      'target',
      15,
      expect.any(Object),
    );
    expect(logs).toContain(
      '0 Account Partners will be created; 1 existing Account Partners will be updated.',
    );
    expect(logs).toContain(
      'Account Partner Name will be set from the matched target Employee Master name.',
    );
    expect(logs.at(-1)).toBe('Account Partner migration completed');
  });

  it('leaves an auto-number Account Partner Name to Salesforce', async () => {
    mocks.sfCli.describeSObject.mockImplementation(async (
      _alias: string,
      objectName: string,
    ) => {
      const writable = (name: string, externalId = false) => ({
        name,
        externalId,
        createable: true,
        updateable: true,
        type: 'string',
        length: 255,
      });
      const fields = objectName === 'cfs_ob__AccountPartner__c'
        ? [
            writable('cfs_ob__AccountPartnerExternalId__c', true),
            writable('cfs_ob__PartnerRole__c'),
            writable('cfs_ob__Bottler__c'),
            writable('cfs_ob__Account__c'),
            writable('cfs_ob__EmployeeMaster__c'),
            {
              name: 'Name',
              createable: false,
              updateable: false,
              type: 'autonumber',
              length: 80,
            },
          ]
        : objectName === 'Account'
          ? [
            writable('cfs_ob__u_CustomerNumber__c'),
            writable('AccountNumber'),
            writable('Name'),
          ]
          : [writable('cfs_ob__EmployeeNo__c'), writable('Name')];
      return { success: true, data: { result: { fields } } };
    });
    const service = new AccountPartnerImportService();

    const preview = await service.previewSoqlMapping(input);

    expect(preview.nameField.mode).toBe('salesforce-managed');
    expect(preview.sample[0]?.employeeName).toBe('Alex Employee');
  });

  it('falls back to REST query when Bulk Query rejects compound fields', async () => {
    const service = new AccountPartnerImportService();
    mocks.sfCli.exportBulk.mockImplementation(async (
      soql: string,
      alias: string,
      file: string,
    ) => {
      if (alias === 'source') {
        return {
          success: false,
          error: 'Error (1): Selecting compound data not supported in Bulk Query',
          stdout: '',
          stderr: '',
          exitCode: 1,
        };
      }
      if (soql.includes('FROM Account ')) {
        await writeFile(
          file,
          'Id,Name,cfs_ob__u_CustomerNumber__c,AccountNumber\n'
          + '001ACCOUNT00000001,North Market,000123,000123\n',
          'utf8',
        );
      } else if (soql.includes('FROM cfs_ob__AccountPartner__c ')) {
        await writeFile(
          file,
          'cfs_ob__AccountPartnerExternalId__c\nAP-1\n',
          'utf8',
        );
      } else {
        await writeFile(
          file,
          'Id,Name,cfs_ob__EmployeeNo__c\n'
          + '001EMPLOYEE0000001,Alex Employee,E-1\n',
          'utf8',
        );
      }
      return { success: true };
    });
    mocks.sfCli.queryAll.mockResolvedValue({
      success: true,
      data: {
        records: [{
          cfs_ob__AccountPartnerExternalId__c: 'AP-1',
          cfs_ob__PartnerRole__c: 'ZR',
          cfs_ob__Bottler__c: '5000',
          cfs_ob__Sales_Office__c: 'S003',
          cfs_ob__Account__r: { cfs_ob__u_CustomerNumber__c: '000123' },
          cfs_ob__EmployeeMaster__r: { cfs_ob__EmployeeNo__c: 'E-1' },
        }],
      },
    });

    const preview = await service.previewSoqlMapping(input);

    expect(preview.ok).toBe(true);
    expect(mocks.sfCli.queryAll).toHaveBeenCalledTimes(1);
    expect(preview.sample[0]).toEqual(expect.objectContaining({
      externalId: 'AP-1',
      accountKey: '000123',
      employeeKey: 'E-1',
    }));
  });

  it('allows create-only lookup fields that Salesforce marks as not updateable', async () => {
    const service = new AccountPartnerImportService();
    mocks.sfCli.describeSObject.mockImplementation(async (
      _alias: string,
      objectName: string,
    ) => {
      const writable = (name: string, externalId = false, updateable = true) => ({
        name,
        externalId,
        createable: true,
        updateable,
        length: externalId ? 255 : undefined,
      });
      const fields = objectName === 'cfs_ob__AccountPartner__c'
        ? [
            writable('cfs_ob__AccountPartnerExternalId__c', true),
            writable('cfs_ob__PartnerRole__c'),
            writable('cfs_ob__Bottler__c'),
            writable('cfs_ob__Account__c', false, false),
            writable('cfs_ob__EmployeeMaster__c', false, false),
          ]
        : objectName === 'Account'
          ? [
            writable('cfs_ob__u_CustomerNumber__c', true),
            writable('AccountNumber', true),
          ]
          : [writable('cfs_ob__EmployeeNo__c', true)];
      return { success: true, data: { result: { fields } } };
    });

    const preview = await service.previewSoqlMapping(input);

    expect(preview.ok).toBe(true);
  });
});
