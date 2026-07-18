import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  bulkDataUpdateConfigSchema,
  escapeSoqlLiteral,
  serializeBulkCsv,
  type BulkDataUpdateConfig,
} from '@sfcc/shared';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import { removeTempDir } from '../../common/temp-cleanup.util';
import { BulkThrottleService } from './bulk-throttle.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_WORKBOOK_ROWS = 50_000;
const MAX_WORKBOOK_COLUMNS = 200;
const TARGET_QUERY_CHUNK_SIZE = 200;
const TARGET_QUERY_CONCURRENCY = 4;
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
}

interface WorkbookRow {
  rowNumber: number;
  values: Record<string, string>;
}

interface ParsedSheet {
  name: string;
  headers: string[];
  rowCount: number;
  rows: WorkbookRow[];
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
      this.parseSheet(workbook, name, true));
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
    await this.prepareContext(buffer, fileName, config, userId);
  }

  async preview(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
  ) {
    const plan = await this.buildPlan(buffer, fileName, config, userId);
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
      throw new BadRequestException('Workbook exceeds the 10 MB upload limit');
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

  private parseSheet(workbook: XLSX.WorkBook, sheetName: string, allowEmpty = false): ParsedSheet {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) throw new BadRequestException(`Workbook sheet was not found: ${sheetName}`);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    }) as unknown[][];
    const headerIndex = matrix.findIndex((row) => row.some((value) => this.cellValue(value) !== ''));
    if (headerIndex < 0) {
      if (allowEmpty) return { name: sheetName, headers: [], rowCount: 0, rows: [] };
      throw new BadRequestException(`Workbook sheet "${sheetName}" is empty`);
    }

    if (matrix.length - headerIndex - 1 > MAX_WORKBOOK_ROWS) {
      throw new BadRequestException(
        `Workbook sheet "${sheetName}" exceeds the ${MAX_WORKBOOK_ROWS.toLocaleString()} row limit`,
      );
    }

    let lastUsedColumn = -1;
    for (const row of matrix) {
      for (let index = row.length - 1; index >= 0; index -= 1) {
        if (this.cellValue(row[index]) !== '') {
          lastUsedColumn = Math.max(lastUsedColumn, index);
          break;
        }
      }
    }
    if (lastUsedColumn + 1 > MAX_WORKBOOK_COLUMNS) {
      throw new BadRequestException(
        `Workbook sheet "${sheetName}" exceeds the ${MAX_WORKBOOK_COLUMNS} column limit`,
      );
    }

    const headerRow = matrix[headerIndex] ?? [];
    const headers: string[] = [];
    const headerByColumn = new Map<number, string>();
    const seenHeaders = new Set<string>();
    for (let index = 0; index <= lastUsedColumn; index += 1) {
      const header = this.cellValue(headerRow[index]);
      const columnHasData = matrix
        .slice(headerIndex + 1)
        .some((row) => this.cellValue(row[index]) !== '');
      if (!header) {
        if (columnHasData) {
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

    const rows: WorkbookRow[] = [];
    matrix.slice(headerIndex + 1).forEach((row, index) => {
      const values: Record<string, string> = {};
      for (const [column, header] of headerByColumn) {
        values[header] = this.cellValue(row[column]);
      }
      if (Object.values(values).some((value) => value !== '')) {
        rows.push({ rowNumber: headerIndex + index + 2, values });
      }
    });
    if (!allowEmpty && rows.length === 0) {
      throw new BadRequestException(`Workbook sheet "${sheetName}" does not contain data rows`);
    }
    return { name: sheetName, headers, rowCount: rows.length, rows };
  }

  private cellValue(value: unknown): string {
    if (value == null) return '';
    return String(value).trim();
  }

  private async prepareContext(
    buffer: Buffer,
    fileName: string | undefined,
    config: BulkDataUpdateConfig,
    userId: string,
  ): Promise<PreparedContext> {
    const workbook = this.readWorkbook(buffer, fileName);
    const sheetName = config.sheetName ?? workbook.SheetNames[0]!;
    const sheet = this.parseSheet(workbook, sheetName);
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
      return { sourceColumn, targetField };
    });

    return {
      alias,
      objectName: schema.name,
      objectLabel: schema.label,
      sheet,
      matchColumn,
      matchField,
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

    const candidatesByKey = new Map<string, Array<{
      row: WorkbookRow;
      matchValue: string;
      proposedValues: Map<string, string>;
    }>>();
    for (const row of context.sheet.rows) {
      const matchValue = row.values[context.matchColumn]?.trim() ?? '';
      if (!matchValue) {
        stats.missingMatchRows += 1;
        continue;
      }
      const key = this.normalizeMatchKey(matchValue, context.matchField);
      if (!key) {
        stats.invalidRows += 1;
        continue;
      }

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
      const candidates = candidatesByKey.get(key) ?? [];
      candidates.push({ row, matchValue, proposedValues });
      candidatesByKey.set(key, candidates);
    }

    const candidates = new Map<string, {
      row: WorkbookRow;
      matchValue: string;
      proposedValues: Map<string, string>;
    }>();
    for (const [key, rows] of candidatesByKey) {
      if (rows.length > 1) {
        stats.duplicateSourceRows += rows.length;
      } else {
        candidates.set(key, rows[0]!);
      }
    }

    await onLog?.(
      `Matching ${candidates.size.toLocaleString()} unique spreadsheet keys to existing `
      + `${context.objectLabel} records...`,
    );
    const targetRecords = await this.queryTargetRecords(
      context,
      [...candidates.values()].map((candidate) => candidate.matchValue),
    );
    const targetsByKey = new Map<string, Record<string, unknown>>();
    const ambiguousKeys = new Set<string>();
    for (const record of targetRecords) {
      const rawKey = this.salesforceValue(record[context.matchField.name]);
      const key = this.normalizeMatchKey(rawKey, context.matchField);
      if (!key || ambiguousKeys.has(key)) continue;
      if (targetsByKey.has(key)) {
        targetsByKey.delete(key);
        ambiguousKeys.add(key);
      } else {
        targetsByKey.set(key, record);
      }
    }

    const plannedRecords: PlannedRecord[] = [];
    for (const [key, candidate] of candidates) {
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
        rowNumber: candidate.row.rowNumber,
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
    matchValues: string[],
  ): Promise<Array<Record<string, unknown>>> {
    const uniqueValues = [...new Set(matchValues.filter(Boolean))];
    const chunks: string[][] = [];
    for (let offset = 0; offset < uniqueValues.length; offset += TARGET_QUERY_CHUNK_SIZE) {
      chunks.push(uniqueValues.slice(offset, offset + TARGET_QUERY_CHUNK_SIZE));
    }
    if (chunks.length === 0) return [];

    const selectedFields = [
      'Id',
      context.matchField.name,
      ...context.mappings.map((mapping) => mapping.targetField.name),
    ].filter((field, index, all) => all.indexOf(field) === index);
    const recordsByChunk: Array<Array<Record<string, unknown>>> = new Array(chunks.length);
    let nextChunk = 0;
    const worker = async () => {
      while (nextChunk < chunks.length) {
        const chunkIndex = nextChunk;
        nextChunk += 1;
        const literals = chunks[chunkIndex]!
          .map((value) => this.soqlLiteral(value, context.matchField))
          .join(', ');
        const soql = `SELECT ${selectedFields.join(', ')} FROM ${context.objectName} `
          + `WHERE ${context.matchField.name} IN (${literals})`;
        const result = await this.sfCli.query(context.alias, soql);
        if (!result.success) {
          throw new BadRequestException(
            result.error
            ?? `Could not match target records by ${context.matchField.name}`,
          );
        }
        recordsByChunk[chunkIndex] = (result.data?.result?.records ?? []) as Array<
          Record<string, unknown>
        >;
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(TARGET_QUERY_CONCURRENCY, chunks.length) },
        () => worker(),
      ),
    );
    return recordsByChunk.flat();
  }

  private normalizeMatchKey(value: string, field: DescribedField): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
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
    return trimmed.toLocaleLowerCase();
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
