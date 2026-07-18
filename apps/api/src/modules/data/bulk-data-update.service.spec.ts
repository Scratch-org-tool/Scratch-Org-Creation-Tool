import { readFile, writeFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkDataUpdateConfig } from '@sfcc/shared';

const mocks = vi.hoisted(() => ({
  sfCli: {
    describeSObject: vi.fn(),
    query: vi.fn(),
    queryAll: vi.fn(),
    exportBulk: vi.fn(),
    updateBulk: vi.fn(),
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

import { BulkDataUpdateService } from './bulk-data-update.service';

const userId = 'user-1';
const targetOrgId = '11111111-1111-4111-8111-111111111111';
const objectName = 'cfs_ob__EmployeeMaster__c';
const employeeNumberField = 'cfs_ob__EmployeeNo__c';
const salesOfficeField = 'cfs_ob__u_Sales_Office__c';
const bottlerField = 'cfs_ob__Bottler__c';

const config: BulkDataUpdateConfig = {
  targetOrgId,
  objectName,
  sheetName: 'Employees',
  matchColumn: 'Employee Number',
  matchField: employeeNumberField,
  columnMappings: [
    { sourceColumn: 'Employee Name', targetField: 'Name' },
    { sourceColumn: 'Bottler', targetField: bottlerField },
  ],
  onlyEmptyFields: false,
};

function workbook(rows: unknown[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Employees');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function workbookWithMappedError(): Buffer {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Employee Number', 'Employee Name'],
    ['E-1', 'placeholder'],
  ]);
  sheet.B2 = { t: 'e', v: 0x07 };
  XLSX.utils.book_append_sheet(book, sheet, 'Employees');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function employeeWorkbook() {
  return workbook([
    ['Employee Number', 'Employee Name', 'Bottler'],
    ['E-1', 'Alice Employee', '5000'],
    ['E-2', 'Bob Employee', '5000'],
    ['E-3', 'Missing Employee', '5000'],
    ['', 'No Key', '5000'],
    ['DUP', 'First Duplicate', '5000'],
    ['DUP', 'Second Duplicate', '5000'],
  ]);
}

describe('BulkDataUpdateService', () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const acquire = vi.fn().mockResolvedValue({ release });

  beforeEach(() => {
    vi.clearAllMocks();
    release.mockResolvedValue(undefined);
    acquire.mockResolvedValue({ release });
    mocks.orgConnection.findUnique.mockResolvedValue({
      id: targetOrgId,
      alias: 'target',
      username: null,
      createdBy: userId,
    });
    mocks.sfCli.describeSObject.mockResolvedValue({
      success: true,
      data: {
        result: {
          name: objectName,
          label: 'Employee Master',
          fields: [
            {
              name: 'Id',
              label: 'Record ID',
              type: 'id',
              filterable: true,
              updateable: false,
            },
            {
              name: employeeNumberField,
              label: 'Employee Number',
              type: 'string',
              externalId: true,
              filterable: true,
              updateable: true,
              length: 40,
            },
            {
              name: 'Name',
              label: 'Employee Name',
              type: 'string',
              filterable: true,
              updateable: true,
              length: 80,
            },
            {
              name: bottlerField,
              label: 'Bottler',
              type: 'string',
              filterable: true,
              updateable: true,
              length: 20,
            },
          ],
        },
      },
    });
    mocks.sfCli.query.mockResolvedValue({
      success: true,
      data: {
        result: {
          records: [
            {
              Id: 'a01000000000001AAA',
              [employeeNumberField]: 'E-1',
              Name: 'a01000000000001',
              [bottlerField]: '',
            },
            {
              Id: 'a01000000000002AAA',
              [employeeNumberField]: 'E-2',
              Name: 'Bob Employee',
              [bottlerField]: '5000',
            },
          ],
          totalSize: 2,
        },
      },
    });
    mocks.sfCli.queryAll.mockImplementation(async (_alias, soql) => ({
      success: true,
      data: {
        records: [
          {
            Id: 'a01000000000001AAA',
            [employeeNumberField]: 'E-1',
            Name: 'a01000000000001',
            [bottlerField]: '',
          },
          {
            Id: 'a01000000000002AAA',
            [employeeNumberField]: 'E-2',
            Name: 'Bob Employee',
            [bottlerField]: '5000',
          },
        ].filter((record) => soql.includes(String(record[employeeNumberField]))),
      },
    }));
    mocks.sfCli.exportBulk.mockResolvedValue({ success: false, error: 'not configured' });
    mocks.sfCli.updateBulk.mockResolvedValue({ success: true });
  });

  function service() {
    return new BulkDataUpdateService({ acquire } as never);
  }

  it('inspects workbook sheets without returning employee row values', () => {
    const inspected = service().inspectWorkbook(employeeWorkbook(), 'employees.xlsx');

    expect(inspected).toEqual({
      fileName: 'employees.xlsx',
      defaultSheet: 'Employees',
      sheets: [{
        name: 'Employees',
        headers: ['Employee Number', 'Employee Name', 'Bottler'],
        rowCount: 6,
      }],
    });
    expect(JSON.stringify(inspected)).not.toContain('Alice Employee');
  });

  it('previews differences for existing records and skips every unsafe row', async () => {
    const preview = await service().preview(
      employeeWorkbook(),
      'employees.xlsx',
      config,
      userId,
    );

    expect(preview.ok).toBe(true);
    expect(preview.stats).toEqual({
      totalRows: 6,
      matchedRows: 2,
      recordsToUpdate: 1,
      fieldChanges: 2,
      unchangedRows: 1,
      unmatchedRows: 1,
      missingMatchRows: 1,
      duplicateSourceRows: 2,
      ambiguousTargetRows: 0,
      invalidRows: 0,
    });
    expect(preview.sample).toEqual([{
      rowNumber: 2,
      matchValue: 'E-1',
      changes: [
        {
          field: 'Name',
          label: 'Employee Name',
          currentValue: 'a01000000000001',
          newValue: 'Alice Employee',
        },
        {
          field: bottlerField,
          label: 'Bottler',
          currentValue: '',
          newValue: '5000',
        },
      ],
    }]);
    expect(mocks.sfCli.queryAll).toHaveBeenCalledWith(
      'target',
      expect.stringContaining(`WHERE ${employeeNumberField} IN (`),
    );
  });

  it('uses Salesforce update bulk with Ids and never upserts unmatched rows', async () => {
    let updateCsv = '';
    mocks.sfCli.updateBulk.mockImplementation(async (
      _object: string,
      path: string,
    ) => {
      updateCsv = await readFile(path, 'utf8');
      return { success: true };
    });
    const logs: string[] = [];

    const result = await service().execute(
      employeeWorkbook(),
      'employees.xlsx',
      config,
      userId,
      (line) => {
        logs.push(line);
      },
    );

    expect(result.updatedRecords).toBe(1);
    expect(mocks.sfCli.updateBulk).toHaveBeenCalledWith(
      objectName,
      expect.stringContaining('updates.csv'),
      'target',
      30,
      expect.any(Object),
    );
    expect(updateCsv).toContain('Id,Name,cfs_ob__Bottler__c');
    expect(updateCsv).toContain('a01000000000001AAA,Alice Employee,5000');
    expect(updateCsv).not.toContain('Missing Employee');
    expect(acquire).toHaveBeenCalledWith('target');
    expect(release).toHaveBeenCalledOnce();
    expect(logs.at(-1)).toContain('0 records inserted');
  });

  it('can restrict changes to target fields that are currently empty', async () => {
    const preview = await service().preview(
      employeeWorkbook(),
      'employees.xlsx',
      { ...config, onlyEmptyFields: true },
      userId,
    );

    expect(preview.stats.recordsToUpdate).toBe(1);
    expect(preview.stats.fieldChanges).toBe(1);
    expect(preview.sample[0]?.changes).toEqual([
      expect.objectContaining({ field: bottlerField, newValue: '5000' }),
    ]);
  });

  it('classifies mapped Excel formula errors as invalid instead of update values', async () => {
    const preview = await service().preview(
      workbookWithMappedError(),
      'employees.xlsx',
      {
        ...config,
        columnMappings: [{ sourceColumn: 'Employee Name', targetField: 'Name' }],
      },
      userId,
    );

    expect(preview.stats).toEqual(expect.objectContaining({
      totalRows: 1,
      recordsToUpdate: 0,
      invalidRows: 1,
    }));
    expect(mocks.sfCli.queryAll).not.toHaveBeenCalled();
  });

  it('recommends Employee Number as the Employee Master matching key', async () => {
    const meta = await service().getObjectMeta(targetOrgId, objectName, userId);

    expect(meta.recommendedMatchField).toBe(employeeNumberField);
    expect(meta.fields.map((field) => field.name)).toEqual([
      employeeNumberField,
      'Name',
      bottlerField,
    ]);
  });

  it('matches employee numbers even when Salesforce stores them without leading zeros', async () => {
    mocks.sfCli.describeSObject.mockResolvedValue({
      success: true,
      data: {
        result: {
          name: objectName,
          label: 'Employee Master',
          fields: [
            {
              name: 'Id',
              label: 'Record ID',
              type: 'id',
              filterable: true,
              updateable: false,
            },
            {
              name: employeeNumberField,
              label: 'Employee Number',
              type: 'string',
              externalId: true,
              filterable: true,
              updateable: true,
              length: 40,
            },
            {
              name: salesOfficeField,
              label: 'Sales Office',
              type: 'string',
              filterable: true,
              updateable: true,
              length: 20,
            },
            {
              name: 'Name',
              label: 'Employee Name',
              type: 'string',
              filterable: true,
              updateable: true,
              length: 80,
            },
          ],
        },
      },
    });
    mocks.sfCli.queryAll.mockResolvedValue({
      success: true,
      data: {
        records: [{
          Id: 'a01000000000001AAA',
          [employeeNumberField]: '1003539',
          [salesOfficeField]: 'S003',
          Name: 'Tina Pacheco',
        }],
      },
    });

    const preview = await service().preview(
      workbook([
        ['cfs_ob__EmployeeNo__c', 'Name'],
        ['01003539', 'Tina Pacheco Updated'],
      ]),
      'employees.xlsx',
      {
        ...config,
        matchColumn: 'cfs_ob__EmployeeNo__c',
        matchField: employeeNumberField,
        columnMappings: [{ sourceColumn: 'Name', targetField: 'Name' }],
      },
      userId,
    );

    expect(preview.stats.recordsToUpdate).toBe(1);
    expect(preview.sample[0]?.matchValue).toBe('01003539');
  });

  it('hash-joins large mapping sets from one guarded Bulk API export', async () => {
    const rowCount = 2_100;
    const sourceRows = Array.from({ length: rowCount }, (_, index) => [
      `E-BULK-${index}`,
      `Updated Employee ${index}`,
    ]);
    mocks.sfCli.query.mockResolvedValue({
      success: true,
      data: {
        result: {
          records: [],
          totalSize: rowCount,
        },
      },
    });
    mocks.sfCli.exportBulk.mockImplementation(async (
      soql: string,
      alias: string,
      outputPath: string,
    ) => {
      expect(alias).toBe('target');
      expect(soql).toContain(`WHERE ${employeeNumberField} != null`);
      const targetRows = sourceRows.map(([employeeNumber], index) =>
        `a01${String(index).padStart(15, '0')},${employeeNumber},Original Employee ${index}`);
      await writeFile(
        outputPath,
        `Id,${employeeNumberField},Name\n${targetRows.join('\n')}\n`,
        'utf8',
      );
      return { success: true };
    });

    const preview = await service().preview(
      workbook([
        ['Employee Number', 'Employee Name'],
        ...sourceRows,
      ]),
      'employees.xlsx',
      {
        ...config,
        columnMappings: [{ sourceColumn: 'Employee Name', targetField: 'Name' }],
      },
      userId,
    );

    expect(preview.stats).toEqual(expect.objectContaining({
      totalRows: rowCount,
      matchedRows: rowCount,
      recordsToUpdate: rowCount,
      unmatchedRows: 0,
    }));
    expect(mocks.sfCli.query).toHaveBeenCalledWith(
      'target',
      expect.stringContaining('SELECT COUNT()'),
    );
    expect(mocks.sfCli.exportBulk).toHaveBeenCalledOnce();
    expect(mocks.sfCli.queryAll).not.toHaveBeenCalled();
    expect(acquire).toHaveBeenCalledWith('target', { maxWaitMs: 2_000 });
    expect(release).toHaveBeenCalledOnce();
  });

  it('preserves case-sensitive external IDs in the bulk match index', async () => {
    const rowCount = 2_000;
    const sourceRows = Array.from({ length: rowCount }, (_, index) => [
      `CASE-${index}`,
      `Updated Employee ${index}`,
    ]);
    mocks.sfCli.describeSObject.mockResolvedValue({
      success: true,
      data: {
        result: {
          name: objectName,
          label: 'Employee Master',
          fields: [
            {
              name: 'Id',
              type: 'id',
              filterable: true,
              updateable: false,
            },
            {
              name: employeeNumberField,
              label: 'Employee Number',
              type: 'string',
              externalId: true,
              caseSensitive: true,
              filterable: true,
              updateable: true,
              length: 40,
            },
            {
              name: 'Name',
              label: 'Employee Name',
              type: 'string',
              filterable: true,
              updateable: true,
              length: 80,
            },
          ],
        },
      },
    });
    mocks.sfCli.query.mockResolvedValue({
      success: true,
      data: { result: { records: [], totalSize: rowCount } },
    });
    mocks.sfCli.exportBulk.mockImplementation(async (
      _soql: string,
      _alias: string,
      outputPath: string,
    ) => {
      const targetRows = sourceRows.map(([employeeNumber], index) =>
        `a01${String(index).padStart(15, '0')},${employeeNumber.toLocaleLowerCase()},Original`);
      await writeFile(
        outputPath,
        `Id,${employeeNumberField},Name\n${targetRows.join('\n')}\n`,
        'utf8',
      );
      return { success: true };
    });

    const preview = await service().preview(
      workbook([
        ['Employee Number', 'Employee Name'],
        ...sourceRows,
      ]),
      'employees.xlsx',
      {
        ...config,
        columnMappings: [{ sourceColumn: 'Employee Name', targetField: 'Name' }],
      },
      userId,
    );

    expect(preview.stats).toEqual(expect.objectContaining({
      matchedRows: 0,
      recordsToUpdate: 0,
      unmatchedRows: rowCount,
    }));
    expect(mocks.sfCli.exportBulk).toHaveBeenCalledOnce();
    expect(mocks.sfCli.queryAll).not.toHaveBeenCalled();
  });
});
