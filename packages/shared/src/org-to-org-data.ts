import { z } from 'zod';
import {
  assertSoqlIdentifier,
  escapeSoqlLiteral,
  toSoqlLiteral,
} from './soql.js';

export const ORG_TO_ORG_KEY_SCAN_MAX = 10_000;
/** @deprecated Use DATA_RECORD_LIMIT_MAX */
export const ORG_TO_ORG_RECORD_LIMIT_MAX = 100_000;
export const DATA_RECORD_LIMIT_MAX = 100_000;
export const DATA_DEPLOY_CHUNK_SIZE = 25_000;
export const DATA_PREVIEW_MAX_ROWS = 2_000;
export const MAX_PARALLEL_CHUNKS_PER_BATCH = 4;

export type OrgToOrgDeployStrategy = 'insert' | 'upsert';

export interface OrgToOrgObjectInfo {
  apiName: string;
  label: string;
  queryable: boolean;
  custom: boolean;
}

export interface OrgToOrgObjectMeta {
  objectName: string;
  label: string;
  nameField: string;
  matchField: string;
  displayFields: string[];
  filterableFields: Array<{ name: string; label: string; type: string }>;
  deployableFields: OrgToOrgDeployableField[];
  referenceFields: Array<{
    name: string;
    label: string;
    referencedTo: string[];
    deployable: boolean;
    selected: boolean;
  }>;
}

export interface OrgToOrgDeployableField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  createable: boolean;
  reference: boolean;
  custom: boolean;
  selected: boolean;
}

export interface OrgToOrgRecordPage {
  records: unknown[];
  totalSize: number;
  page: number;
  pageSize: number;
  objectName: string;
  displayFields: string[];
}

const recordIdSchema = z.string().min(15).max(18);

const orgToOrgCompareBaseSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  soql: z.string().min(1).optional(),
  selectedRecordIds: z.array(recordIdSchema).optional(),
  displayFields: z.array(z.string()).optional(),
  matchField: z.string().min(1).default('Name'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(ORG_TO_ORG_RECORD_LIMIT_MAX).default(50),
});

export const orgToOrgCompareSchema = orgToOrgCompareBaseSchema.superRefine((data, ctx) => {
  if (data.sourceOrgId === data.targetOrgId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and target org must differ',
      path: ['targetOrgId'],
    });
  }
  const hasSoql = Boolean(data.soql?.trim());
  const hasSelection = Boolean(data.selectedRecordIds?.length);
  if (!hasSoql && !hasSelection) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide soql or at least one selectedRecordId',
      path: ['selectedRecordIds'],
    });
  }
});

const orgToOrgDeployBaseSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  soql: z.string().min(1).optional(),
  selectedRecordIds: z.array(recordIdSchema).optional(),
  displayFields: z.array(z.string()).optional(),
  strategy: z.enum(['insert', 'upsert']),
  matchField: z.string().optional(),
  recordTypeMappings: z.record(z.string(), z.string()).optional(),
});

export const orgToOrgDeploySchema = orgToOrgDeployBaseSchema.superRefine((data, ctx) => {
  if (data.sourceOrgId === data.targetOrgId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and target org must differ',
      path: ['targetOrgId'],
    });
  }
  const hasSoql = Boolean(data.soql?.trim());
  const hasSelection = Boolean(data.selectedRecordIds?.length);
  if (!hasSoql && !hasSelection) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide soql or at least one selectedRecordId',
      path: ['selectedRecordIds'],
    });
  }
});

export type OrgToOrgCompareInput = z.infer<typeof orgToOrgCompareSchema>;
export type OrgToOrgDeployInput = z.infer<typeof orgToOrgDeploySchema>;

export interface OrgToOrgCompareSummary {
  sourceTotal: number;
  targetTotal: number;
  onlyInSource: number;
  onlyInTarget: number;
  inBoth: number;
}

export interface OrgToOrgCompareResult {
  summary: OrgToOrgCompareSummary;
  onlyInSourceKeys: string[];
  onlyInTargetKeys: string[];
  inBothKeys: string[];
  sourceRecords: {
    records: unknown[];
    totalSize: number;
    page: number;
    pageSize: number;
  };
  matchField: string;
  truncated?: boolean;
  warning?: string;
}

export interface OrgToOrgDeployResult {
  movementId: string;
  jobId: string;
  status: string;
  strategy: OrgToOrgDeployStrategy;
  message?: string;
  batchId?: string;
  totalChunks?: number;
}

const LIMIT_OFFSET_RE = /\bLIMIT\s+\d+(\s+OFFSET\s+\d+)?\s*$/i;

const NON_DEPLOYABLE_SUFFIXES = ['History', 'Share', 'Feed', 'ChangeEvent', 'Tag', 'CleanInfo'];

export function isDeployableObjectName(apiName: string): boolean {
  if (!apiName || apiName.endsWith('__mdt') || apiName.endsWith('__e')) return false;
  return !NON_DEPLOYABLE_SUFFIXES.some((suffix) => apiName.endsWith(suffix));
}

export function defaultDisplayFields(matchField: string, nameField: string): string[] {
  const fields = new Set<string>(['Id']);
  if (matchField) fields.add(matchField);
  if (nameField && nameField !== matchField) fields.add(nameField);
  for (const extra of ['CreatedDate', 'LastModifiedDate']) {
    if (fields.size >= 6) break;
    fields.add(extra);
  }
  return Array.from(fields);
}

export function isFieldRequiredForDeploy(field: {
  createable?: boolean;
  nillable?: boolean;
  defaultedOnCreate?: boolean;
  calculated?: boolean;
}): boolean {
  return Boolean(
    field.createable &&
      field.nillable === false &&
      !field.defaultedOnCreate &&
      !field.calculated,
  );
}

export function defaultDeployFieldSelection(
  deployableFields: OrgToOrgDeployableField[],
  matchField: string,
): string[] {
  const selected = new Set<string>();
  for (const f of deployableFields) {
    if (!f.createable) continue;
    if (f.required || f.name === matchField || f.selected) {
      selected.add(f.name);
    }
  }
  if (selected.size === 0) {
    for (const f of deployableFields) {
      if (f.createable) selected.add(f.name);
    }
  }
  return Array.from(selected);
}

export function fieldsForPreviewQuery(fieldNames: string[]): string[] {
  const fields = uniqueFields(fieldNames);
  if (!fields.includes('Id')) return ['Id', ...fields];
  return fields;
}

function uniqueFields(fields: string[]): string[] {
  return [...new Set(fields.filter(Boolean))];
}

function quoteId(id: string): string {
  return toSoqlLiteral(id);
}

function buildIdInClause(selectedIds: string[]): string {
  const ids = selectedIds.map((id) => quoteId(id));
  return `Id IN (${ids.join(', ')})`;
}

export interface BuildListSoqlInput {
  objectName: string;
  fields: string[];
  limit?: number;
  page?: number;
  selectedIds?: string[];
}

export function buildListSoql(input: BuildListSoqlInput): string {
  const objectName = assertSoqlIdentifier(input.objectName, 'object name');
  const fieldList = uniqueFields(input.fields.length > 0 ? input.fields : ['Id', 'Name'])
    .map((field) => assertSoqlIdentifier(field, 'selected field'));
  const limit = input.limit ?? 50;
  const page = input.page ?? 1;
  const offset = (page - 1) * limit;

  let query = `SELECT ${fieldList.join(', ')} FROM ${objectName}`;
  if (input.selectedIds?.length) {
    query += ` WHERE ${buildIdInClause(input.selectedIds)}`;
  }
  query += ` ORDER BY ${fieldList.includes('Name') ? 'Name' : 'Id'}`;
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  return query;
}

export interface BuildDeploySoqlInput {
  objectName: string;
  fields: string[];
  selectedIds: string[];
}

export function buildDeploySoql(input: BuildDeploySoqlInput): string {
  if (input.selectedIds.length === 0) {
    throw new Error('At least one record id is required to build deploy SOQL');
  }
  const objectName = assertSoqlIdentifier(input.objectName, 'object name');
  const fieldList = uniqueFields(input.fields.length > 0 ? input.fields : ['Id', 'Name'])
    .map((field) => assertSoqlIdentifier(field, 'selected field'));
  return `SELECT ${fieldList.join(', ')} FROM ${objectName} WHERE ${buildIdInClause(input.selectedIds)}`;
}

export interface ResolveSoqlInput {
  soql?: string;
  objectName: string;
  displayFields?: string[];
  selectedRecordIds?: string[];
  limit?: number;
  page?: number;
}

export function resolveSoql(input: ResolveSoqlInput): string {
  if (input.soql?.trim()) {
    return input.soql.trim().replace(/;+\s*$/, '');
  }
  if (input.selectedRecordIds?.length) {
    return buildDeploySoql({
      objectName: input.objectName,
      fields: input.displayFields ?? ['Id', 'Name'],
      selectedIds: input.selectedRecordIds,
    });
  }
  return buildListSoql({
    objectName: input.objectName,
    fields: input.displayFields ?? ['Id', 'Name'],
    limit: input.limit,
    page: input.page,
  });
}

/** Strip trailing LIMIT/OFFSET for rebuild */
export function stripLimitOffset(soql: string): string {
  return soql.trim().replace(/;+\s*$/, '').replace(LIMIT_OFFSET_RE, '').trim();
}

export function applySoqlPagination(soql: string, page: number, pageSize: number): string {
  const base = stripLimitOffset(soql);
  const offset = (page - 1) * pageSize;
  if (offset > 2_000) {
    throw new Error(
      'Salesforce supports OFFSET only up to 2,000 rows. Narrow the query or reduce the page size.',
    );
  }
  return `${base} LIMIT ${pageSize} OFFSET ${offset}`;
}

export interface ParsedOrgToOrgSoql {
  fields: string[];
  objectName: string;
  whereClause?: string;
  filters: OrgToOrgFilterRow[];
}

export class OrgToOrgSoqlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgToOrgSoqlParseError';
  }
}

function normalizeSelectField(field: string): string {
  const trimmed = field.trim();
  if (trimmed.toLowerCase() === 'id') return 'Id';
  return trimmed;
}

function splitSelectFields(selectClause: string): string[] {
  return selectClause.split(',').map(normalizeSelectField).filter(Boolean);
}

function parseSimpleWhereFilters(whereClause: string): OrgToOrgFilterRow[] {
  const filters: OrgToOrgFilterRow[] = [];
  const pattern = /([A-Za-z_][\w.]*)\s*=\s*'((?:\\'|[^'])*)'/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(whereClause)) !== null) {
    filters.push({
      field: match[1]!,
      operator: 'eq',
      value: match[2]!.replace(/\\'/g, "'"),
    });
  }
  return filters;
}

export function parseOrgToOrgSoql(soql: string): ParsedOrgToOrgSoql {
  const trimmed = soql.trim().replace(/;+\s*$/, '');
  if (!trimmed) throw new OrgToOrgSoqlParseError('SOQL query is empty');
  if (/;/.test(trimmed)) throw new OrgToOrgSoqlParseError('Multiple SOQL statements are not supported');
  if (!/^\s*SELECT\b/i.test(trimmed)) {
    throw new OrgToOrgSoqlParseError('Only SELECT queries are supported');
  }

  const fromMatch = trimmed.match(/\bFROM\s+([A-Za-z_][\w]*)\b/i);
  if (!fromMatch) throw new OrgToOrgSoqlParseError('Could not find FROM clause in query');

  const objectName = fromMatch[1]!;
  const selectMatch = trimmed.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\b/i);
  if (!selectMatch) throw new OrgToOrgSoqlParseError('Could not parse SELECT fields');

  const fields = splitSelectFields(selectMatch[1]!);
  if (fields.length === 0) throw new OrgToOrgSoqlParseError('SELECT field list is empty');

  const baseWithoutLimit = stripLimitOffset(trimmed);
  const whereMatch = baseWithoutLimit.match(/\bWHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY\b|$)/i);
  const whereClause = whereMatch?.[1]?.trim();
  const filters = whereClause ? parseSimpleWhereFilters(whereClause) : [];

  return { fields, objectName, whereClause, filters };
}

export function validateSoqlForObject(soql: string, expectedObjectName: string): void {
  const parsed = parseOrgToOrgSoql(soql);
  if (parsed.objectName.toLowerCase() !== expectedObjectName.toLowerCase()) {
    throw new OrgToOrgSoqlParseError(
      `Query targets ${parsed.objectName} but selected object is ${expectedObjectName}`,
    );
  }
}

export function deployFieldsFromSoqlSelect(fields: string[]): string[] {
  return fields.filter((f) => f.toLowerCase() !== 'id');
}

export function resolveOrgToOrgPreviewSoql(input: {
  soql: string;
  page: number;
  pageSize: number;
}): string {
  const limit = Math.min(Math.max(input.pageSize, 1), ORG_TO_ORG_RECORD_LIMIT_MAX);
  const page = Math.max(input.page, 1);
  return applySoqlPagination(input.soql.trim(), page, limit);
}

export function resolveOrgToOrgDeploySoql(input: {
  soql: string;
  recordLimit: number;
}): string {
  const base = stripLimitOffset(input.soql.trim());
  const limit = Math.min(Math.max(input.recordLimit, 1), ORG_TO_ORG_RECORD_LIMIT_MAX);
  return `${base} LIMIT ${limit}`;
}

/** Build lightweight key-only SOQL using WHERE from user query */
export function buildKeySoql(soql: string, objectName: string, matchField: string, maxKeys: number): string {
  const base = stripLimitOffset(soql);
  const whereMatch = base.match(/\bWHERE\b([\s\S]+?)(?:\bORDER\s+BY\b|$)/i);
  const whereClause = whereMatch ? ` WHERE ${whereMatch[1].trim()}` : '';
  return `SELECT ${assertSoqlIdentifier(matchField, 'match field')} FROM ${assertSoqlIdentifier(objectName, 'object name')}${whereClause} LIMIT ${maxKeys}`;
}

export interface KeyDiffResult {
  summary: OrgToOrgCompareSummary;
  onlyInSourceKeys: string[];
  onlyInTargetKeys: string[];
  inBothKeys: string[];
}

/** Pure key-set diff for unit tests */
export function computeKeyDiff(
  sourceKeys: string[],
  targetKeys: string[],
  sampleSize = 20,
): KeyDiffResult {
  const sourceSet = new Set(sourceKeys.filter((k) => k != null && String(k).length > 0).map(String));
  const targetSet = new Set(targetKeys.filter((k) => k != null && String(k).length > 0).map(String));

  const onlyInSourceKeys: string[] = [];
  const onlyInTargetKeys: string[] = [];
  const inBothKeys: string[] = [];

  for (const k of sourceSet) {
    if (targetSet.has(k)) inBothKeys.push(k);
    else onlyInSourceKeys.push(k);
  }
  for (const k of targetSet) {
    if (!sourceSet.has(k)) onlyInTargetKeys.push(k);
  }

  const sortAndSample = (arr: string[]) =>
    [...arr].sort((a, b) => a.localeCompare(b)).slice(0, sampleSize);

  return {
    summary: {
      sourceTotal: sourceSet.size,
      targetTotal: targetSet.size,
      onlyInSource: onlyInSourceKeys.length,
      onlyInTarget: onlyInTargetKeys.length,
      inBoth: inBothKeys.length,
    },
    onlyInSourceKeys: sortAndSample(onlyInSourceKeys),
    onlyInTargetKeys: sortAndSample(onlyInTargetKeys),
    inBothKeys: sortAndSample(inBothKeys),
  };
}

export const NON_DEPLOYABLE_REFERENCE_OBJECTS = new Set([
  'User',
  'Group',
  'Profile',
  'UserRole',
  'Organization',
  'RecordType',
]);

export type OrgToOrgFilterOperator = 'eq' | 'neq' | 'contains' | 'not_empty' | 'empty' | 'in';

export interface OrgToOrgFilterRow {
  field: string;
  operator: OrgToOrgFilterOperator;
  value?: string;
}

export interface OrgToOrgObjectDeployConfig {
  objectName: string;
  recordLimit: number;
  filters: OrgToOrgFilterRow[];
  selectedRecordIds?: string[];
  selectedReferenceFields?: string[];
  selectedDeployFields?: string[];
  matchField?: string;
  queryMode?: 'builder' | 'soql';
  soql?: string;
}

export interface OrgToOrgFilterPreviewResult {
  soql: string;
  matchCount: number;
  records: unknown[];
  displayFields: string[];
  objectName: string;
  previewCapped?: boolean;
  deployLimit?: number;
  previewLimit?: number;
}

export interface OrgToOrgDeployBatchResult {
  batchId: string;
  deployments: Array<{
    objectName: string;
    movementId: string;
    jobId: string;
    status: string;
    batchId?: string;
    totalChunks?: number;
  }>;
}

export function normalizeSObjectList(
  raw: unknown,
): Array<{ name: string; label: string; queryable: boolean; custom: boolean }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ name: string; label: string; queryable: boolean; custom: boolean }> = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push({ name: item, label: item, queryable: true, custom: item.endsWith('__c') });
    } else if (item && typeof item === 'object' && 'name' in item) {
      const o = item as { name: string; label?: string; queryable?: boolean; custom?: boolean };
      out.push({
        name: o.name,
        label: o.label ?? o.name,
        queryable: o.queryable ?? true,
        custom: Boolean(o.custom),
      });
    }
  }
  return out;
}

export function resolveFilterFieldName(
  field: string,
  filterableFields: Array<{ name: string; label: string }>,
): string {
  const trimmed = field.trim();
  if (!trimmed) return trimmed;
  if (filterableFields.some((f) => f.name === trimmed)) return trimmed;
  const exactLabel = filterableFields.find((f) => f.label === trimmed);
  if (exactLabel) return exactLabel.name;
  const ciLabel = filterableFields.find(
    (f) => f.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return ciLabel?.name ?? trimmed;
}

export function normalizeOrgToOrgFilters(
  filters: OrgToOrgFilterRow[],
  filterableFields: Array<{ name: string; label: string }>,
): OrgToOrgFilterRow[] {
  return filters.map((row) => ({
    ...row,
    field: resolveFilterFieldName(row.field, filterableFields),
  }));
}

function buildFilterCondition(row: OrgToOrgFilterRow): string | null {
  if (!row.field?.trim()) return null;
  const field = assertSoqlIdentifier(row.field, 'filter field');
  switch (row.operator) {
    case 'eq':
      return `${field} = '${escapeSoqlLiteral(row.value ?? '')}'`;
    case 'neq':
      return `${field} != '${escapeSoqlLiteral(row.value ?? '')}'`;
    case 'contains':
      return `${field} LIKE '%${escapeSoqlLiteral(row.value ?? '')}%'`;
    case 'not_empty':
      return `${field} != null`;
    case 'empty':
      return `${field} = null`;
    case 'in': {
      const parts = (row.value ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(toSoqlLiteral);
      return parts.length ? `${field} IN (${parts.join(', ')})` : null;
    }
    default:
      return null;
  }
}

export interface BuildFilterSoqlInput {
  objectName: string;
  fields: string[];
  recordLimit: number;
  filters?: OrgToOrgFilterRow[];
  filterableFields?: Array<{ name: string; label: string }>;
  selectedRecordIds?: string[];
  page?: number;
  pageSize?: number;
}

export function buildFilterSoql(input: BuildFilterSoqlInput): string {
  const objectName = assertSoqlIdentifier(input.objectName, 'object name');
  const fieldList = uniqueFields(input.fields.length > 0 ? input.fields : ['Id', 'Name'])
    .map((field) => assertSoqlIdentifier(field, 'selected field'));
  const conditions: string[] = [];
  const filters = input.filterableFields
    ? normalizeOrgToOrgFilters(input.filters ?? [], input.filterableFields)
    : (input.filters ?? []);
  for (const filter of filters) {
    const clause = buildFilterCondition(filter);
    if (clause) conditions.push(clause);
  }
  if (input.selectedRecordIds?.length) {
    conditions.push(buildIdInClause(input.selectedRecordIds));
  }

  let query = `SELECT ${fieldList.join(', ')} FROM ${objectName}`;
  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  const orderField = fieldList.includes('Name') ? 'Name' : 'Id';
  query += ` ORDER BY ${orderField}`;

  if (input.page != null && input.pageSize != null) {
    const limit = Math.min(Math.max(input.pageSize, 1), ORG_TO_ORG_RECORD_LIMIT_MAX);
    const offset = (Math.max(input.page, 1) - 1) * limit;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
  } else {
    const limit = Math.min(Math.max(input.recordLimit, 1), ORG_TO_ORG_RECORD_LIMIT_MAX);
    query += ` LIMIT ${limit}`;
  }
  return query;
}

export function resolveFieldsForDeploy(
  displayFields: string[],
  selectedReferenceFields?: string[],
  selectedDeployFields?: string[],
  forPreview = false,
): string[] {
  const base =
    selectedDeployFields && selectedDeployFields.length > 0
      ? selectedDeployFields
      : uniqueFields([...displayFields, ...(selectedReferenceFields ?? [])]);
  return forPreview ? fieldsForPreviewQuery(base) : base;
}

export const orgToOrgFilterRowSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'contains', 'not_empty', 'empty', 'in']),
  value: z.string().optional(),
});

export const orgToOrgPreviewFilterSchema = z.object({
  sourceOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  recordLimit: z.number().int().min(1).max(ORG_TO_ORG_RECORD_LIMIT_MAX).default(200),
  filters: z.array(orgToOrgFilterRowSchema).default([]),
  selectedReferenceFields: z.array(z.string()).optional(),
  selectedDeployFields: z.array(z.string()).optional(),
  soql: z.string().min(1).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(ORG_TO_ORG_RECORD_LIMIT_MAX).default(50),
});

export const orgToOrgObjectDeployConfigSchema = z.object({
  objectName: z.string().min(1),
  recordLimit: z.number().int().min(1).max(ORG_TO_ORG_RECORD_LIMIT_MAX).default(200),
  filters: z.array(orgToOrgFilterRowSchema).default([]),
  selectedRecordIds: z.array(recordIdSchema).optional(),
  selectedReferenceFields: z.array(z.string()).optional(),
  selectedDeployFields: z.array(z.string()).optional(),
  matchField: z.string().optional(),
  queryMode: z.enum(['builder', 'soql']).optional(),
  soql: z.string().min(1).optional(),
});

export const orgToOrgDeployBatchSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  strategy: z.enum(['insert', 'upsert']),
  objects: z.array(orgToOrgObjectDeployConfigSchema).min(1),
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
});

export type OrgToOrgPreviewFilterInput = z.infer<typeof orgToOrgPreviewFilterSchema>;
export type OrgToOrgDeployBatchInput = z.infer<typeof orgToOrgDeployBatchSchema>;
