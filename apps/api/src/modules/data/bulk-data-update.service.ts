import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  bulkDataUpdateConfigSchema,
  BULK_DATA_UPDATE_MAX_FILE_BYTES,
  BULK_DATA_UPDATE_MAX_WORKBOOK_ROWS,
  bulkDataUpdateMaxFileSizeLabel,
  escapeSoqlLiteral,
  parseBulkCsv,
  serializeBulkCsv,
  type BulkDataUpdateConfig,
} from '@sfcc/shared';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import { removeTempDir } from '../../common/temp-cleanup.util';
import { BulkThrottleService } from './bulk-throttle.service';

const MAX_FILE_BYTES = BULK_DATA_UPDATE_MAX_FILE_BYTES;
const MAX_WORKBOOK_ROWS = BULK_DATA_UPDATE_MAX_WORKBOOK_ROWS;
const MAX_WORKBOOK_COLUMNS = 200;
const TARGET_QUERY_CHUNK_SIZE = 500;
const TARGET_QUERY_CHUNK_SIZE_WINDOWS = 80;
const MAX_SOQL_COMMAND_CHARS = process.platform === 'win32' ? 6_000 : 12_000;
const TARGET_QUERY_CONCURRENCY = 6;
const TARGET_BULK_INDEX_MIN_KEYS = 500;
const TARGET_BULK_INDEX_MIN_ROW_BUDGET = 10_000;
const TARGET_BULK_INDEX_MAX_ROW_RATIO = 4;
const TARGET_BULK_INDEX_MAX_ROWS = 500_000;
const TARGET_BULK_INDEX_MAX_CELLS = 20_000_000;
const TARGET_BULK_INDEX_MAX_BYTES = 96 * 1024 * 1024;
const TARGET_BULK_QUERY_WAIT_MINUTES = 20;
const TARGET_BULK_SLOT_WAIT_MS = 300_000;
const TARGET_BULK_EXPORT_MIN_KEYS = 10_000;
const PREVIEW_RECORD_LIMIT = 50;
const EMPLOYEE_MASTER_OBJECT = 'cfs_ob__EmployeeMaster__c';
const EMPLOYEE_NUMBER_FIELD = 'cfs_ob__EmployeeNo__c';

const UPDATEABLE_FIELD_TYPES = new Set([
  'boolean',
  'currency',
  'date',
  'datetime',
  'double',
  'email',
  'encryptedstring',
  'id',
  'int',
  'long',
  'multipicklist',
  'percent',
  'phone',
  'picklist',
  'reference',
  'string',
  'textarea',
  'time',
  'url',
]);

const MATCHABLE_FIELD_TYPES = new Set([
  'boolean',
  'currency',
  'date',
  'datetime',
  'double',
  'email',
  'id',
  'int',
  'long',
  'percent',
  'phone',
  'picklist',
  'string',
  'textarea',
  'time',
  'url',
]);

interface DescribedField {
  name: string;
  label?: string;
  type?: string;
  externalId?: boolean;
  idLookup?: boolean;
  filterable?: boolean;
  updateable?: boolean;
  calculated?: boolean;
  compoundFieldName?: string;
  length?: number;
  caseSensitive?: boolean;
}

interface WorkbookRow {
  rowNumber: number;
  values: Record<string, string>;
  errorColumns: Set<string>;
}

interface ParsedSheet {
  name: string;
  headers: string[];
  rowCount: number;
  rows: WorkbookRow[];
}

interface ParseSheetOptions {
  allowEmpty?: boolean;
  includeRows?: boolean;
  selectedColumns?: string[];
}

interface ResolvedMapping {
  sourceColumn: string;
  targetField: DescribedField;
}

interface PreparedContext {
  alias: string;
  objectName: string;
  objectLabel: string;
  sheet: ParsedSheet;
  matchColumn: string;
  matchField: DescribedField;
  secondaryMatchColumn?: string;
  secondaryMatchField?: DescribedField;
  mappings: ResolvedMapping[];
}

export interface PlannedChange {
  field: string;
  label: string;
  currentValue: string;
  newValue: string;
}

interface PlannedRecord {
  rowNumber: number;
  matchValue: string;
  targetId: string;
  values: Record<string, string>;
  changes: PlannedChange[];
}

interface MatchCandidate {
  rowNumber: number;
  matchValue: string;
  primaryValue: string;
  secondaryValue?: string;
  proposedValues: Map<string, string>;
}

export interface BulkDataUpdateStats {
  totalRows: number;
  matchedRows: number;
  recordsToUpdate: number;
  fieldChanges: number;
  unchangedRows: number;
  unmatchedRows: number;
  missingMatchRows: number;
  duplicateSourceRows: number;
  ambiguousTargetRows: number;
  invalidRows: number;
}

interface BulkDataUpdatePlan {
  context: PreparedContext;
  stats: BulkDataUpdateStats;
  updates: Array<Record<string, string>>;
  sample: Array<{
    rowNumber: number;
    matchValue: string;
    changes: PlannedChange[];
  }>;
}

type LogCallback = (line: string) => Promise<void> | void;

@Injectable()
export class BulkDataUpdateService {
  private readonly logger = new Logger(BulkDataUpdateService.name);
  private readonly sfCli = createSfCliClient();

  constructor(private readonly bulkThrottle: BulkThrottleService) {}

  parseConfig(body: Record<string, unknown>): BulkDataUpdateConfig {
    let columnMappings: unknown = body.columnMappings;
    if (typeof columnMappings === 'string') {
      try {
        columnMappings = JSON.parse(columnMappings);
      } catch {
        throw new BadRequestException('Column mappings must be valid JSON');
      }
    }

    const result = bulkDataUpdateConfigSchema.safeParse({
      targetOrgId: body.targetOrgId,
      objectName: body.objectName,
      sheetName: typeof body.sheetName === 'string' && body.sheetName.trim()
        ? body.sheetName
        : undefined,
      matchColumn: body.matchColumn,
      matchField: body.matchField,
      secondaryMatchColumn: typeof body.secondaryMatchColumn === 'string' && body.secondaryMatchColumn.trim()
        ? body.secondaryMatchColumn
        : undefined,
      secondaryMatchField: typeof body.secondaryMatchField === 'string' && body.secondaryMatchField.trim()
        ? body.secondaryMatchField
        : undefined,
      columnMappings,
      onlyEmptyFields:
        body.onlyEmptyFields === true
        || body.onlyEmptyFields === 'true',
    });
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues
          .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
          .join('; '),
      );
    }
    return result.data;
  }

  inspectWorkbook(buffer: Buffer, fileName?: string) {
    const workbook = this.readWorkbook(buffer, fileName);
    const sheets = workbook.SheetNames.map((name) =>
      this.parseSheet(workbook, name, { allowEmpty: true, includeRows: false }));
    return {
      fileName: fileName ?? 'workbook',
      defaultSheet: workbook.SheetNames[0] ?? '',
      sheets: sheets.map(({ name, headers, rowCount }) => ({ name, headers, rowCount })),
    };
  }

  async getObjectMeta(targetOrgId: string, objectName: string, userId: string) {
    const org = await assertOrgOwned(targetOrgId, userId, prisma);
    const schema = await this.describeObject(org.username ?? org.alias, objectName);
    const fields = schema.fields.filter((field) => this.isUpdateableField(field));
    const matchFields = schema.fields.filter((field) => this.isMatchableField(field));
    const recommendedMatchField = this.recommendedMatchField(schema.name, matchFields);
    return {
      objectName: schema.name,
      label: schema.label,
      recommendedMatchField,
      fields: fields.map((field) => this.publicField(field)),
      matchFields: matchFields.map((field) => this.publicField(field)),
    };
  }

  async validateUpload(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
  ): Promise<void> {
    await this.prepareContext(buffer, fileName, config, userId, false);
  }

  async preview(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
  ) {
    const plan = await this.buildPlan(
      buffer,
      fileName,
      config,
      userId,
      undefined,
      TARGET_BULK_SLOT_WAIT_MS,
    );
    return this.toPublicPlan(plan, config);
  }

  async execute(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
    onLog?: LogCallback,
  ) {
    const plan = await this.buildPlan(buffer, fileName, config, userId, onLog);
    if (plan.updates.length === 0) {
      await onLog?.('No matching records contain eligible changes; Salesforce was not modified.');
      return {
        success: true,
        updatedRecords: 0,
        ...this.toPublicPlan(plan, config),
      };
    }

    const workDir = await mkdtemp(join(tmpdir(), 'bulk-data-update-'));
    const csvPath = join(workDir, 'updates.csv');
    await writeFile(csvPath, serializeBulkCsv(plan.updates), 'utf8');
    await onLog?.(
      `Updating ${plan.updates.length.toLocaleString()} existing `
      + `${plan.context.objectLabel} records by Salesforce Id...`,
    );

    let slot: Awaited<ReturnType<BulkThrottleService['acquire']>> | undefined;
    try {
      slot = await this.bulkThrottle.acquire(plan.context.alias);
      const result = await this.sfCli.updateBulk(
        plan.context.objectName,
        csvPath,
        plan.context.alias,
        30,
        { cwd: workDir },
      );
      if (!result.success) {
        throw new Error(result.error ?? 'Salesforce bulk update failed');
      }
      await onLog?.(
        `Bulk data update completed: ${plan.updates.length.toLocaleString()} existing records updated; `
        + '0 records inserted.',
      );
      return {
        success: true,
        updatedRecords: plan.updates.length,
        ...this.toPublicPlan(plan, config),
      };
    } finally {
      await slot?.release();
      await removeTempDir(workDir);
    }
  }

  private readWorkbook(buffer: Buffer, fileName?: string): XLSX.WorkBook {
    if (!buffer.length) throw new BadRequestException('Upload a non-empty workbook');
    if (buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException(`Workbook exceeds the ${bulkDataUpdateMaxFileSizeLabel()} upload limit`);
    }
    if (fileName && !/\.(xlsx|xls|csv)$/i.test(fileName)) {
      throw new BadRequestException('Upload an .xlsx, .xls, or .csv file');
    }
    try {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false,
        dense: true,
      });
      if (workbook.SheetNames.length === 0) {
        throw new Error('Workbook does not contain any sheets');
      }
      return workbook;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? `Workbook could not be read: ${error.message}` : 'Workbook could not be read',
      );
    }
  }

  private parseSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    options: ParseSheetOptions = {},
  ): ParsedSheet {
    const allowEmpty = options.allowEmpty ?? false;
    const includeRows = options.includeRows ?? true;
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) throw new BadRequestException(`Workbook sheet was not found: ${sheetName}`);
    if (!Array.isArray(worksheet)) {
      throw new BadRequestException(`Workbook sheet "${sheetName}" could not be read in dense mode`);
    }
    const denseRows = worksheet as unknown as Array<
      Array<XLSX.CellObject | undefined> | undefined
    >;
    const populatedRowIndexes = Object.keys(worksheet)
      .filter((key) => /^\d+$/.test(key))
      .map(Number)
      .sort((left, right) => left - right);
    const headerIndex = populatedRowIndexes.find((rowIndex) =>
      denseRows[rowIndex]?.some((cell) => this.worksheetCellValue(cell) !== '')) ?? -1;
    if (headerIndex < 0) {
      if (allowEmpty) return { name: sheetName, headers: [], rowCount: 0, rows: [] };
      throw new BadRequestException(`Workbook sheet "${sheetName}" is empty`);
    }

    let lastUsedColumn = -1;
    let rowCount = 0;
    const dataColumns = new Set<number>();
    const dataRowIndexes: number[] = [];
    for (const rowIndex of populatedRowIndexes) {
      if (rowIndex < headerIndex) continue;
      const row = denseRows[rowIndex] ?? [];
      let rowHasData = false;
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (this.worksheetCellValue(row[columnIndex]) === '') continue;
        lastUsedColumn = Math.max(lastUsedColumn, columnIndex);
        if (rowIndex > headerIndex) {
          rowHasData = true;
          dataColumns.add(columnIndex);
        }
      }
      if (rowIndex > headerIndex && rowHasData) {
        rowCount += 1;
        if (rowCount > MAX_WORKBOOK_ROWS) {
          throw new BadRequestException(
            `Workbook sheet "${sheetName}" exceeds the ${MAX_WORKBOOK_ROWS.toLocaleString()} row limit`,
          );
        }
        if (includeRows) dataRowIndexes.push(rowIndex);
      }
    }
    if (lastUsedColumn + 1 > MAX_WORKBOOK_COLUMNS) {
      throw new BadRequestException(
        `Workbook sheet "${sheetName}" exceeds the ${MAX_WORKBOOK_COLUMNS} column limit`,
      );
    }

    const headerRow = denseRows[headerIndex] ?? [];
    const headers: string[] = [];
    const headerByColumn = new Map<number, string>();
    const seenHeaders = new Set<string>();
    for (let index = 0; index <= lastUsedColumn; index += 1) {
      const header = this.worksheetCellValue(headerRow[index]);
      if (!header) {
        if (dataColumns.has(index)) {
          throw new BadRequestException(
            `Workbook sheet "${sheetName}" has data in column ${index + 1} but no header`,
          );
        }
        continue;
      }
      const normalized = header.toLocaleLowerCase();
      if (seenHeaders.has(normalized)) {
        throw new BadRequestException(`Workbook sheet "${sheetName}" has a duplicate header: ${header}`);
      }
      seenHeaders.add(normalized);
      headers.push(header);
      headerByColumn.set(index, header);
    }
    if (headers.length === 0) {
      if (allowEmpty) return { name: sheetName, headers: [], rowCount: 0, rows: [] };
      throw new BadRequestException(`Workbook sheet "${sheetName}" does not contain headers`);
    }

    if (!includeRows) {
      if (!allowEmpty && rowCount === 0) {
        throw new BadRequestException(`Workbook sheet "${sheetName}" does not contain data rows`);
      }
      return { name: sheetName, headers, rowCount, rows: [] };
    }

    const selectedColumns = options.selectedColumns
      ? new Set(options.selectedColumns.map((column) => column.toLocaleLowerCase()))
      : undefined;
    const rowColumns = [...headerByColumn].filter(([, header]) =>
      !selectedColumns || selectedColumns.has(header.toLocaleLowerCase()));
    const rows: WorkbookRow[] = [];
    for (const rowIndex of dataRowIndexes) {
      const row = denseRows[rowIndex] ?? [];
      const values: Record<string, string> = {};
      const errorColumns = new Set<string>();
      for (const [column, header] of rowColumns) {
        const cell = row[column];
        values[header] = this.worksheetCellValue(cell);
        if (cell?.t === 'e') errorColumns.add(header);
      }
      rows.push({ rowNumber: rowIndex + 1, values, errorColumns });
    }
    if (!allowEmpty && rowCount === 0) {
      throw new BadRequestException(`Workbook sheet "${sheetName}" does not contain data rows`);
    }
    return { name: sheetName, headers, rowCount, rows };
  }

  private cellValue(value: unknown): string {
    if (value == null) return '';
    return String(value).trim();
  }

  private worksheetCellValue(cell: XLSX.CellObject | undefined): string {
    if (!cell || cell.v == null) return '';
    return this.cellValue(XLSX.utils.format_cell(cell));
  }

  private async prepareContext(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
    includeRows = true,
  ): Promise<PreparedContext> {
    const workbook = this.readWorkbook(buffer, fileName);
    const sheetName = config.sheetName ?? workbook.SheetNames[0]!;
    const selectedColumns = [
      config.matchColumn,
      ...(config.secondaryMatchColumn ? [config.secondaryMatchColumn] : []),
      ...config.columnMappings.map((mapping) => mapping.sourceColumn),
    ];
    const sheet = this.parseSheet(workbook, sheetName, { includeRows, selectedColumns });
    const org = await assertOrgOwned(config.targetOrgId, userId, prisma);
    const alias = org.username ?? org.alias;
    const schema = await this.describeObject(alias, config.objectName);
    const headerMap = new Map(sheet.headers.map((header) => [header.toLocaleLowerCase(), header]));
    const fieldMap = new Map(schema.fields.map((field) => [field.name.toLocaleLowerCase(), field]));

    const matchColumn = headerMap.get(config.matchColumn.toLocaleLowerCase());
    if (!matchColumn) {
      throw new BadRequestException(`Matching column is not present in the workbook: ${config.matchColumn}`);
    }
    const matchField = fieldMap.get(config.matchField.toLocaleLowerCase());
    if (!matchField || !this.isMatchableField(matchField)) {
      throw new BadRequestException(
        `Salesforce field cannot be used for matching: ${config.matchField}`,
      );
    }

    let secondaryMatchColumn: string | undefined;
    let secondaryMatchField: DescribedField | undefined;
    if (config.secondaryMatchField) {
      secondaryMatchColumn = headerMap.get(config.secondaryMatchColumn!.toLocaleLowerCase());
      if (!secondaryMatchColumn) {
        throw new BadRequestException(
          `Secondary matching column is not present in the workbook: ${config.secondaryMatchColumn}`,
        );
      }
      secondaryMatchField = fieldMap.get(config.secondaryMatchField.toLocaleLowerCase());
      if (!secondaryMatchField || !this.isMatchableField(secondaryMatchField)) {
        throw new BadRequestException(
          `Salesforce field cannot be used for secondary matching: ${config.secondaryMatchField}`,
        );
      }
    }

    const mappings = config.columnMappings.map((mapping) => {
      const sourceColumn = headerMap.get(mapping.sourceColumn.toLocaleLowerCase());
      if (!sourceColumn) {
        throw new BadRequestException(
          `Mapped column is not present in the workbook: ${mapping.sourceColumn}`,
        );
      }
      const targetField = fieldMap.get(mapping.targetField.toLocaleLowerCase());
      if (!targetField || !this.isUpdateableField(targetField)) {
        throw new BadRequestException(
          `Salesforce field is missing or not updateable: ${mapping.targetField}`,
        );
      }
      if (targetField.name.toLocaleLowerCase() === matchField.name.toLocaleLowerCase()) {
        throw new BadRequestException('The matching field cannot also be updated');
      }
      if (
        secondaryMatchField
        && targetField.name.toLocaleLowerCase() === secondaryMatchField.name.toLocaleLowerCase()
      ) {
        throw new BadRequestException('A secondary matching field cannot also be updated');
      }
      return { sourceColumn, targetField };
    });

    return {
      alias,
      objectName: schema.name,
      objectLabel: schema.label,
      sheet,
      matchColumn,
      matchField,
      secondaryMatchColumn,
      secondaryMatchField,
      mappings,
    };
  }

  private async describeObject(alias: string, objectName: string) {
    const result = await this.sfCli.describeSObject(alias, objectName);
    const describe = result.data?.result;
    if (!result.success || !describe) {
      throw new BadRequestException(
        result.error ?? `Could not describe Salesforce object ${objectName}`,
      );
    }
    return {
      name: describe.name ?? objectName,
      label: describe.label ?? objectName,
      fields: (describe.fields ?? []) as DescribedField[],
    };
  }

  private isUpdateableField(field: DescribedField): boolean {
    const type = field.type?.toLocaleLowerCase() ?? '';
    return field.name !== 'Id'
      && field.updateable === true
      && !field.calculated
      && !field.compoundFieldName
      && UPDATEABLE_FIELD_TYPES.has(type);
  }

  private isMatchableField(field: DescribedField): boolean {
    const type = field.type?.toLocaleLowerCase() ?? '';
    return field.filterable !== false
      && !field.compoundFieldName
      && MATCHABLE_FIELD_TYPES.has(type);
  }

  private recommendedMatchField(objectName: string, fields: DescribedField[]): string {
    const byName = new Map(fields.map((field) => [field.name.toLocaleLowerCase(), field.name]));
    if (objectName.toLocaleLowerCase() === EMPLOYEE_MASTER_OBJECT.toLocaleLowerCase()) {
      const employeeNumber = byName.get(EMPLOYEE_NUMBER_FIELD.toLocaleLowerCase());
      if (employeeNumber) return employeeNumber;
    }
    return fields.find((field) => field.externalId)?.name
      ?? fields.find((field) => field.idLookup && field.name !== 'Id')?.name
      ?? byName.get('name')
      ?? byName.get('id')
      ?? fields[0]?.name
      ?? '';
  }

  private publicField(field: DescribedField) {
    return {
      name: field.name,
      label: field.label ?? field.name,
      type: field.type ?? 'string',
      externalId: Boolean(field.externalId),
      idLookup: Boolean(field.idLookup),
      length: field.length,
    };
  }

  private async buildPlan(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
    onLog?: LogCallback,
    bulkSlotWaitMs?: number,
  ): Promise<BulkDataUpdatePlan> {
    const context = await this.prepareContext(buffer, fileName, config, userId);
    await onLog?.(
      `Parsed ${context.sheet.rowCount.toLocaleString()} rows from sheet "${context.sheet.name}".`,
    );

    const stats: BulkDataUpdateStats = {
      totalRows: context.sheet.rowCount,
      matchedRows: 0,
      recordsToUpdate: 0,
      fieldChanges: 0,
      unchangedRows: 0,
      unmatchedRows: 0,
      missingMatchRows: 0,
      duplicateSourceRows: 0,
      ambiguousTargetRows: 0,
      invalidRows: 0,
    };

    // A tombstone marks a duplicated key. This keeps duplicate detection O(1)
    // without allocating one array for every unique workbook row.
    const candidatesByKey = new Map<string, MatchCandidate | null>();
    let uniqueCandidateCount = 0;
    for (const row of context.sheet.rows) {
      if (row.errorColumns.size > 0) {
        stats.invalidRows += 1;
        continue;
      }
      const match = this.resolveRowMatch(context, row.values);
      if (!match) {
        const primary = row.values[context.matchColumn]?.trim() ?? '';
        const secondary = context.secondaryMatchColumn
          ? row.values[context.secondaryMatchColumn]?.trim() ?? ''
          : '';
        if (!primary || (context.secondaryMatchColumn && !secondary)) {
          stats.missingMatchRows += 1;
        } else {
          stats.invalidRows += 1;
        }
        continue;
      }
      const { key, display: matchValue, primary, secondary } = match;

      const proposedValues = new Map<string, string>();
      let invalid = false;
      for (const mapping of context.mappings) {
        const rawValue = row.values[mapping.sourceColumn] ?? '';
        if (!rawValue.trim()) continue;
        const normalized = this.normalizeUpdateValue(rawValue, mapping.targetField);
        if (normalized.error) {
          invalid = true;
          break;
        }
        proposedValues.set(mapping.targetField.name, normalized.value);
      }
      if (invalid) {
        stats.invalidRows += 1;
        continue;
      }
      const candidate: MatchCandidate = {
        rowNumber: row.rowNumber,
        matchValue,
        primaryValue: primary,
        secondaryValue: secondary,
        proposedValues,
      };
      const existing = candidatesByKey.get(key);
      if (existing === undefined) {
        candidatesByKey.set(key, candidate);
        uniqueCandidateCount += 1;
      } else if (existing === null) {
        stats.duplicateSourceRows += 1;
      } else {
        candidatesByKey.set(key, null);
        uniqueCandidateCount -= 1;
        stats.duplicateSourceRows += 2;
      }
    }

    await onLog?.(
      `Matching ${uniqueCandidateCount.toLocaleString()} unique spreadsheet keys to existing `
      + `${context.objectLabel} records...`,
    );
    const targetRecords = await this.queryTargetRecords(
      context,
      [...candidatesByKey.values()]
        .filter((candidate): candidate is MatchCandidate => candidate !== null)
        .map((candidate) => ({
          primary: candidate.primaryValue,
          secondary: candidate.secondaryValue,
        })),
      onLog,
      bulkSlotWaitMs,
    );
    const targetsByKey = new Map<string, Record<string, unknown>>();
    const ambiguousKeys = new Set<string>();
    for (const record of targetRecords) {
      const key = this.recordMatchKey(context, record);
      if (!key || ambiguousKeys.has(key)) continue;
      if (targetsByKey.has(key)) {
        targetsByKey.delete(key);
        ambiguousKeys.add(key);
      } else {
        targetsByKey.set(key, record);
      }
    }

    const plannedRecords: PlannedRecord[] = [];
    for (const [key, candidate] of candidatesByKey) {
      if (!candidate) continue;
      if (ambiguousKeys.has(key)) {
        stats.ambiguousTargetRows += 1;
        continue;
      }
      const target = targetsByKey.get(key);
      if (!target) {
        stats.unmatchedRows += 1;
        continue;
      }
      stats.matchedRows += 1;
      const targetId = this.salesforceValue(target.Id);
      if (!targetId) {
        stats.invalidRows += 1;
        continue;
      }

      const values: Record<string, string> = {};
      const changes: PlannedChange[] = [];
      for (const mapping of context.mappings) {
        const field = mapping.targetField;
        const currentValue = this.salesforceValue(target[field.name]);
        const proposedValue = candidate.proposedValues.get(field.name);
        values[field.name] = currentValue;
        if (proposedValue === undefined) continue;
        if (config.onlyEmptyFields && currentValue.trim() !== '') continue;
        if (this.valuesEqual(currentValue, proposedValue, field)) continue;
        values[field.name] = proposedValue;
        changes.push({
          field: field.name,
          label: field.label ?? field.name,
          currentValue,
          newValue: proposedValue,
        });
      }
      if (changes.length === 0) {
        stats.unchangedRows += 1;
        continue;
      }
      plannedRecords.push({
        rowNumber: candidate.rowNumber,
        matchValue: candidate.matchValue,
        targetId,
        values,
        changes,
      });
      stats.fieldChanges += changes.length;
    }

    const changedFields = new Set(
      plannedRecords.flatMap((record) => record.changes.map((change) => change.field)),
    );
    const updates = plannedRecords.map((record) => ({
      Id: record.targetId,
      ...Object.fromEntries(
        [...changedFields].map((field) => [field, record.values[field] ?? '']),
      ),
    }));
    stats.recordsToUpdate = updates.length;
    await onLog?.(
      `Prepared ${stats.recordsToUpdate.toLocaleString()} matched records with `
      + `${stats.fieldChanges.toLocaleString()} field changes. `
      + `${stats.unmatchedRows.toLocaleString()} unmatched rows will be skipped.`,
    );

    return {
      context,
      stats,
      updates,
      sample: plannedRecords.slice(0, PREVIEW_RECORD_LIMIT).map((record) => ({
        rowNumber: record.rowNumber,
        matchValue: record.matchValue,
        changes: record.changes,
      })),
    };
  }

  private async queryTargetRecords(
    context: PreparedContext,
    matchValues: Array<{ primary: string; secondary?: string }>,
    onLog?: LogCallback,
    bulkSlotWaitMs?: number,
  ): Promise<Array<Record<string, unknown>>> {
    const selectedFields = [...new Set([
      'Id',
      context.matchField.name,
      ...(context.secondaryMatchField ? [context.secondaryMatchField.name] : []),
      ...context.mappings.map((mapping) => mapping.targetField.name),
    ])];
    const indexedRecords = await this.queryTargetRecordsFromIndexedScan(
      context,
      matchValues,
      selectedFields,
      onLog,
      bulkSlotWaitMs,
    );
    if (indexedRecords !== undefined) return indexedRecords;

    const queryChunks = this.buildMatchQueryChunks(context, matchValues, selectedFields);
    if (queryChunks.length === 0) return [];
    this.logger.warn(
      `Bulk update falling back to ${queryChunks.length.toLocaleString()} selective SOQL batches `
      + `for ${matchValues.length.toLocaleString()} keys`,
    );
    if (queryChunks.length > 1) {
      await onLog?.(
        `Looking up matching records in ${queryChunks.length.toLocaleString()} selective query batches...`,
      );
    }

    const recordsByChunk: Array<Array<Record<string, unknown>>> = new Array(queryChunks.length);
    let nextChunk = 0;
    const worker = async () => {
      while (nextChunk < queryChunks.length) {
        const chunkIndex = nextChunk;
        nextChunk += 1;
        const result = await this.sfCli.queryAll(context.alias, queryChunks[chunkIndex]!);
        if (!result.success) {
          throw new BadRequestException(
            result.error
            ?? `Could not match target records by ${context.matchField.name}`,
          );
        }
        recordsByChunk[chunkIndex] = result.data?.records ?? [];
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(TARGET_QUERY_CONCURRENCY, queryChunks.length) },
        () => worker(),
      ),
    );
    return recordsByChunk.flat();
  }

  /**
   * Large key lists are much faster as one paginated SOQL scan (or Bulk API
   * export fallback) followed by a hash join than as hundreds of separate
   * `sf data query` process launches.
   */
  private async queryTargetRecordsFromIndexedScan(
    context: PreparedContext,
    matchValues: Array<{ primary: string; secondary?: string }>,
    selectedFields: string[],
    onLog?: LogCallback,
    bulkSlotWaitMs?: number,
  ): Promise<Array<Record<string, unknown>> | undefined> {
    const scan = await this.prepareTargetScan(context, matchValues, selectedFields);
    if (!scan) return undefined;
    if (scan.targetCount === 0) return [];
    const { targetCount, expectedKeys, predicate } = scan;
    const soql = `SELECT ${selectedFields.join(', ')} FROM ${context.objectName} WHERE ${predicate}`;

    this.logger.log(
      `Bulk update match scan: ${matchValues.length.toLocaleString()} workbook keys, `
      + `${targetCount.toLocaleString()} ${context.objectLabel} records, `
      + `${selectedFields.length} Salesforce fields`,
    );

    if (matchValues.length >= TARGET_BULK_EXPORT_MIN_KEYS) {
      const bulkRecords = await this.queryTargetRecordsFromBulkExport(
        context,
        soql,
        expectedKeys,
        onLog,
      );
      if (bulkRecords !== undefined) return bulkRecords;
      this.logger.warn('Bulk API export match scan failed; falling back to paginated SOQL');
    }
    if (
      context.secondaryMatchField
      && context.secondaryMatchField.name !== 'Id'
      && !context.secondaryMatchField.externalId
      && !context.secondaryMatchField.idLookup
    ) {
      return undefined;
    }

    await onLog?.(
      `Loading ${targetCount.toLocaleString()} ${context.objectLabel} records for matching...`,
    );
    const paged = await this.sfCli.queryAll(context.alias, soql);
    if (paged.success) {
      return (paged.data?.records ?? [])
        .filter((record) => expectedKeys.has(this.recordMatchKey(context, record)));
    }

    this.logger.warn('Paginated SOQL match scan failed; trying Bulk API export');
    return this.queryTargetRecordsFromBulkExport(
      context,
      soql,
      expectedKeys,
      onLog,
    );
  }

  private async prepareTargetScan(
    context: PreparedContext,
    matchValues: Array<{ primary: string; secondary?: string }>,
    selectedFields: string[],
  ): Promise<{
    targetCount: number;
    expectedKeys: Set<string>;
    predicate: string;
  } | undefined> {
    if (matchValues.length < TARGET_BULK_INDEX_MIN_KEYS) return undefined;

    const predicate = this.targetMatchPredicate(context);
    const countResult = await this.sfCli.query(
      context.alias,
      `SELECT COUNT() FROM ${context.objectName} WHERE ${predicate}`,
    );
    const targetCount = this.queryCount(countResult.data?.result);
    if (!countResult.success || targetCount === undefined) return undefined;
    if (targetCount === 0) return { targetCount: 0, expectedKeys: new Set(), predicate };

    const rowBudget = Math.min(
      TARGET_BULK_INDEX_MAX_ROWS,
      Math.max(
        TARGET_BULK_INDEX_MIN_ROW_BUDGET,
        matchValues.length * TARGET_BULK_INDEX_MAX_ROW_RATIO,
      ),
    );
    if (
      targetCount > rowBudget
      || targetCount * selectedFields.length > TARGET_BULK_INDEX_MAX_CELLS
    ) {
      return undefined;
    }

    const expectedKeys = new Set(
      matchValues
        .map((value) => this.inputMatchKey(context, value))
        .filter(Boolean),
    );
    return { targetCount, expectedKeys, predicate };
  }

  private async queryTargetRecordsFromBulkExport(
    context: PreparedContext,
    soql: string,
    expectedKeys: Set<string>,
    onLog?: LogCallback,
  ): Promise<Array<Record<string, unknown>> | undefined> {
    const workDir = await mkdtemp(join(tmpdir(), 'bulk-data-match-index-'));
    const csvPath = join(workDir, 'target-records.csv');
    let slot: Awaited<ReturnType<BulkThrottleService['acquire']>> | undefined;
    try {
      slot = await this.bulkThrottle.acquire(
        context.alias,
        { maxWaitMs: TARGET_BULK_SLOT_WAIT_MS },
      );
      const result = await this.sfCli.exportBulk(
        soql,
        context.alias,
        csvPath,
        TARGET_BULK_QUERY_WAIT_MINUTES,
        { cwd: workDir },
      );
      if (!result.success) {
        await onLog?.('Bulk match indexing was unavailable; using selective query batches instead.');
        return undefined;
      }
      if ((await stat(csvPath)).size > TARGET_BULK_INDEX_MAX_BYTES) {
        await onLog?.(
          'Bulk match index exceeded the safe memory budget; using selective query batches instead.',
        );
        return undefined;
      }
      return parseBulkCsv(await readFile(csvPath, 'utf8'))
        .filter((record) => expectedKeys.has(this.recordMatchKey(context, record)));
    } catch {
      await onLog?.('Bulk match indexing was unavailable; using selective query batches instead.');
      return undefined;
    } finally {
      await slot?.release();
      await removeTempDir(workDir);
    }
  }

  private targetMatchPredicate(context: PreparedContext): string {
    return [
      `${context.matchField.name} != null`,
      ...(context.secondaryMatchField ? [`${context.secondaryMatchField.name} != null`] : []),
    ].join(' AND ');
  }

  private queryCount(
    result: { records?: unknown[]; totalSize?: number } | undefined,
  ): number | undefined {
    const first = result?.records?.[0];
    if (first && typeof first === 'object') {
      const aggregate = Number((first as Record<string, unknown>).expr0);
      if (Number.isSafeInteger(aggregate) && aggregate >= 0) return aggregate;
    }
    const totalSize = Number(result?.totalSize);
    return Number.isSafeInteger(totalSize) && totalSize >= 0 ? totalSize : undefined;
  }

  private inputMatchKey(
    context: PreparedContext,
    value: { primary: string; secondary?: string },
  ): string {
    const primary = this.normalizeMatchKey(value.primary, context.matchField);
    if (!primary) return '';
    if (!context.secondaryMatchField) return primary;
    const secondary = this.normalizeMatchKey(value.secondary ?? '', context.secondaryMatchField);
    return secondary ? `${primary}\u0000${secondary}` : '';
  }

  private buildMatchQueryChunks(
    context: PreparedContext,
    matchValues: Array<{ primary: string; secondary?: string }>,
    selectedFields: string[],
  ): string[] {
    const secondariesByPrimary = new Map<string, Set<string>>();
    for (const value of matchValues) {
      if (!value.primary) continue;
      if (!value.secondary) {
        secondariesByPrimary.set(value.primary, secondariesByPrimary.get(value.primary) ?? new Set());
        continue;
      }
      const secondaries = secondariesByPrimary.get(value.primary) ?? new Set<string>();
      secondaries.add(value.secondary);
      secondariesByPrimary.set(value.primary, secondaries);
    }

    const uniquePrimaries = [...new Set(matchValues.map((value) => value.primary).filter(Boolean))];
    const baseChunkSize = process.platform === 'win32'
      ? TARGET_QUERY_CHUNK_SIZE_WINDOWS
      : TARGET_QUERY_CHUNK_SIZE;
    const queries: string[] = [];

    let index = 0;
    while (index < uniquePrimaries.length) {
      let chunkSize = Math.min(baseChunkSize, uniquePrimaries.length - index);
      let soql = '';

      while (chunkSize > 0) {
        const chunkPrimaries = uniquePrimaries.slice(index, index + chunkSize);
        const primaryLiterals = this.expandMatchValuesForQuery(chunkPrimaries, context.matchField)
          .map((value) => this.soqlLiteral(value, context.matchField));
        const chunkSecondaries = [...new Set(
          chunkPrimaries.flatMap((primary) => [...(secondariesByPrimary.get(primary) ?? [])]),
        )];
        const secondaryLiterals = context.secondaryMatchField
          ? this.expandMatchValuesForQuery(chunkSecondaries, context.secondaryMatchField)
              .map((value) => this.soqlLiteral(value, context.secondaryMatchField!))
          : [];

        soql = `SELECT ${selectedFields.join(', ')} FROM ${context.objectName} `
          + `WHERE ${context.matchField.name} IN (${primaryLiterals.join(', ')})`;
        if (context.secondaryMatchField && secondaryLiterals.length > 0) {
          soql += ` AND ${context.secondaryMatchField.name} IN (${secondaryLiterals.join(', ')})`;
        }

        if (soql.length <= MAX_SOQL_COMMAND_CHARS || chunkSize === 1) break;
        chunkSize = Math.max(1, Math.floor(chunkSize / 2));
      }

      queries.push(soql);
      index += chunkSize;
    }

    return queries;
  }

  private resolveRowMatch(
    context: PreparedContext,
    values: Record<string, string>,
  ): { key: string; display: string; primary: string; secondary?: string } | null {
    const primaryRaw = values[context.matchColumn]?.trim() ?? '';
    if (!primaryRaw || this.isExportMetadataValue(primaryRaw)) return null;
    const primaryKey = this.normalizeMatchKey(primaryRaw, context.matchField);
    if (!primaryKey) return null;
    if (!context.secondaryMatchField || !context.secondaryMatchColumn) {
      return { key: primaryKey, display: primaryRaw, primary: primaryRaw };
    }
    const secondaryRaw = values[context.secondaryMatchColumn]?.trim() ?? '';
    if (!secondaryRaw || this.isExportMetadataValue(secondaryRaw)) return null;
    const secondaryKey = this.normalizeMatchKey(secondaryRaw, context.secondaryMatchField);
    if (!secondaryKey) return null;
    return {
      key: `${primaryKey}\u0000${secondaryKey}`,
      display: `${primaryRaw} / ${secondaryRaw}`,
      primary: primaryRaw,
      secondary: secondaryRaw,
    };
  }

  private recordMatchKey(context: PreparedContext, record: Record<string, unknown>): string {
    const primaryKey = this.normalizeMatchKey(
      this.salesforceValue(record[context.matchField.name]),
      context.matchField,
    );
    if (!primaryKey) return '';
    if (!context.secondaryMatchField) return primaryKey;
    const secondaryKey = this.normalizeMatchKey(
      this.salesforceValue(record[context.secondaryMatchField.name]),
      context.secondaryMatchField,
    );
    if (!secondaryKey) return '';
    return `${primaryKey}\u0000${secondaryKey}`;
  }

  private normalizeMatchKey(value: string, field: DescribedField): string {
    const trimmed = value.trim();
    if (!trimmed || this.isExportMetadataValue(trimmed)) return '';
    const type = field.type?.toLocaleLowerCase();
    if (type === 'boolean') {
      const normalized = this.normalizeBoolean(trimmed);
      return normalized ?? '';
    }
    if (['currency', 'double', 'int', 'long', 'percent'].includes(type ?? '')) {
      return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)
        ? String(Number(trimmed))
        : '';
    }
    if (field.caseSensitive) return trimmed;
    if (/^\d+$/.test(trimmed)) {
      return trimmed.replace(/^0+/, '') || '0';
    }
    return trimmed.toLocaleLowerCase();
  }

  private isExportMetadataValue(value: string): boolean {
    return /^\[[A-Za-z0-9_.]+\]$/.test(value.trim());
  }

  private expandMatchValuesForQuery(values: string[], field: DescribedField): string[] {
    const expanded = new Set<string>();
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed || this.isExportMetadataValue(trimmed)) continue;
      expanded.add(trimmed);
      if (/^\d+$/.test(trimmed)) {
        const unpadded = trimmed.replace(/^0+/, '') || '0';
        expanded.add(unpadded);
        if (unpadded.length < 8) expanded.add(unpadded.padStart(8, '0'));
        if (trimmed.length < 8) expanded.add(trimmed.padStart(8, '0'));
      }
    }
    return [...expanded];
  }

  private soqlLiteral(value: string, field: DescribedField): string {
    const type = field.type?.toLocaleLowerCase();
    if (type === 'boolean') return this.normalizeBoolean(value) ?? 'false';
    if (['currency', 'double', 'int', 'long', 'percent'].includes(type ?? '')) {
      const normalized = this.normalizeMatchKey(value, field);
      if (!normalized) throw new BadRequestException(`Invalid numeric matching value: ${value}`);
      return normalized;
    }
    if (['date', 'datetime', 'time'].includes(type ?? '')) {
      return value.trim();
    }
    return `'${escapeSoqlLiteral(value.trim())}'`;
  }

  private normalizeUpdateValue(
    rawValue: string,
    field: DescribedField,
  ): { value: string; error?: string } {
    const value = rawValue.trim();
    if (field.length && value.length > field.length) {
      return {
        value,
        error: `${field.name} exceeds its ${field.length}-character limit`,
      };
    }
    if (field.type?.toLocaleLowerCase() === 'boolean') {
      const booleanValue = this.normalizeBoolean(value);
      return booleanValue == null
        ? { value, error: `${field.name} requires a true or false value` }
        : { value: booleanValue };
    }
    return { value };
  }

  private normalizeBoolean(value: string): 'true' | 'false' | null {
    const normalized = value.trim().toLocaleLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return 'true';
    if (['false', 'no', 'n', '0'].includes(normalized)) return 'false';
    return null;
  }

  private salesforceValue(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value).trim();
  }

  private valuesEqual(current: string, proposed: string, field: DescribedField): boolean {
    if (field.type?.toLocaleLowerCase() === 'boolean') {
      return this.normalizeBoolean(current) === this.normalizeBoolean(proposed);
    }
    return current.trim() === proposed.trim();
  }

  private toPublicPlan(plan: BulkDataUpdatePlan, config: BulkDataUpdateConfig) {
    return {
      ok: plan.stats.recordsToUpdate > 0,
      objectName: plan.context.objectName,
      objectLabel: plan.context.objectLabel,
      sheetName: plan.context.sheet.name,
      matchColumn: plan.context.matchColumn,
      matchField: plan.context.matchField.name,
      secondaryMatchColumn: plan.context.secondaryMatchColumn,
      secondaryMatchField: plan.context.secondaryMatchField?.name,
      onlyEmptyFields: config.onlyEmptyFields,
      mappedFields: plan.context.mappings.map((mapping) => ({
        sourceColumn: mapping.sourceColumn,
        targetField: mapping.targetField.name,
        targetLabel: mapping.targetField.label ?? mapping.targetField.name,
      })),
      stats: plan.stats,
      sample: plan.sample,
    };
  }
}
