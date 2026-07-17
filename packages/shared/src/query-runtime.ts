import type { AccountPartnerPlan, CompiledQuerySectionQuery } from './query-section.js';

export type QueryCheckpointStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface QueryCheckpointEntry {
  id: string;
  status: QueryCheckpointStatus;
  exported: number;
  loaded: number;
  failed: number;
  completedChunkIndexes?: number[];
  completedChunkFingerprints?: Record<string, string>;
  runningChunkIndex?: number;
  runningChunkFingerprint?: string;
  error?: string;
}

export interface QueryRuntimeCheckpoint {
  currentQueryId?: string;
  completedQueryIds: string[];
  queries: Record<string, QueryCheckpointEntry>;
}

export function createQueryRuntimeCheckpoint(
  queries: readonly CompiledQuerySectionQuery[],
  previous?: QueryRuntimeCheckpoint,
): QueryRuntimeCheckpoint {
  const completed = new Set(previous?.completedQueryIds ?? []);
  return {
    currentQueryId: previous?.currentQueryId,
    completedQueryIds: [...completed],
    queries: Object.fromEntries(queries.map((query) => [
      query.id,
      previous?.queries?.[query.id] ?? {
        id: query.id,
        status: completed.has(query.id) ? 'completed' : 'pending',
        exported: 0,
        loaded: 0,
        failed: 0,
      },
    ])),
  };
}

export function pendingQueryIds(
  queries: readonly CompiledQuerySectionQuery[],
  checkpoint: QueryRuntimeCheckpoint,
): string[] {
  const completed = new Set(checkpoint.completedQueryIds);
  return queries.filter((query) => !completed.has(query.id)).map((query) => query.id);
}

function valueAt(record: Record<string, unknown>, path: string): string {
  if (record[path] != null) return String(record[path]).trim();
  let value: unknown = record;
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[segment];
  }
  return value == null ? '' : String(value).trim();
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Normalize Bulk API CSV bytes to LF and strip a UTF-8 BOM when present. */
export function normalizeBulkCsvLineEndings(content: string): string {
  const withoutBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return withoutBom.replace(/\r\n?/g, '\n');
}

/** Parse Salesforce Bulk API CSV while preserving commas and newlines in quoted values. */
export function parseBulkCsv(text: string): Array<Record<string, string>> {
  text = normalizeBulkCsvLineEndings(text);
  const parsedRows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      parsedRows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    parsedRows.push(row);
  }
  if (quoted) throw new Error('Malformed Bulk CSV: unterminated quoted field');
  const headers = parsedRows.shift() ?? [];
  if (headers[0]) headers[0] = headers[0].replace(/^\uFEFF/, '');
  return parsedRows
    .filter((values) => values.some(Boolean))
    .map((values, index) => {
      if (values.length !== headers.length) {
        throw new Error(
          `Malformed Bulk CSV: row ${index + 2} has ${values.length} columns; `
          + `expected ${headers.length}`,
        );
      }
      return Object.fromEntries(
        headers.map((header, valueIndex) => [header, values[valueIndex] ?? '']),
      );
    });
}

/** Serialize Bulk API input with the LF-only line endings emitted by Salesforce Bulk CLI exports. */
export function serializeBulkCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Select support variants for a compiled mapping query. Office-specific rows
 * never share a cache key, and an unexpanded support query is a valid fallback.
 */
export function selectCompiledSupportQueries(
  queries: readonly CompiledQuerySectionQuery[],
  sourceQueryId: string,
  salesOffice?: string,
): CompiledQuerySectionQuery[] {
  const candidates = queries.filter((query) => query.sourceQueryId === sourceQueryId);
  if (!salesOffice) return candidates;
  const exact = candidates.filter((query) => query.salesOffice === salesOffice);
  if (exact.length > 0) return exact;
  return candidates.filter((query) => !query.salesOffice);
}

export interface AccountPartnerJoinInput {
  plan: AccountPartnerPlan;
  accounts: Array<Record<string, unknown>>;
  employees: Array<Record<string, unknown>>;
  mappings: Array<Record<string, unknown>>;
  roles?: Array<Record<string, unknown>>;
  roleKeyField?: string;
  targetAccountKeys?: ReadonlySet<string>;
  targetEmployeeKeys?: ReadonlySet<string>;
}

export interface AccountPartnerJoinResult {
  rows: Array<Record<string, string>>;
  skippedMissingAccount: number;
  skippedMissingEmployee: number;
  skippedMissingRole: number;
  duplicates: number;
}

/** Build relationship-key partner rows only when both joined records exist. */
export function buildAccountPartnerRows(input: AccountPartnerJoinInput): AccountPartnerJoinResult {
  const { plan } = input;
  const accountKeys = new Set(input.accounts.map((row) => valueAt(row, plan.accountKeyField)).filter(Boolean));
  const employeeKeys = new Set(input.employees.map((row) => valueAt(row, plan.employeeKeyField)).filter(Boolean));
  const targetAccounts = input.targetAccountKeys ?? accountKeys;
  const targetEmployees = input.targetEmployeeKeys ?? employeeKeys;
  const roleKeys = input.roles && input.roleKeyField
    ? new Set(input.roles.map((row) => valueAt(row, input.roleKeyField!)).filter(Boolean))
    : undefined;
  const rows: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  let skippedMissingAccount = 0;
  let skippedMissingEmployee = 0;
  let skippedMissingRole = 0;
  let duplicates = 0;

  for (const mapping of input.mappings) {
    const account = valueAt(mapping, plan.mappingAccountKeyField);
    const employee = valueAt(mapping, plan.mappingEmployeeKeyField);
    const role = valueAt(mapping, plan.mappingRoleField);
    if (!account || !accountKeys.has(account) || !targetAccounts.has(account)) {
      skippedMissingAccount += 1;
      continue;
    }
    if (!employee || !employeeKeys.has(employee) || !targetEmployees.has(employee)) {
      skippedMissingEmployee += 1;
      continue;
    }
    if (roleKeys && (!role || !roleKeys.has(role))) {
      skippedMissingRole += 1;
      continue;
    }
    const dedupeKey = `${account}\u0000${employee}\u0000${role}`;
    if (seen.has(dedupeKey)) {
      duplicates += 1;
      continue;
    }
    seen.add(dedupeKey);
    const externalId = plan.externalIdPattern
      .replace(/\{\{account\}\}/g, account)
      .replace(/\{\{employee\}\}/g, employee)
      .replace(/\{\{role\}\}/g, role)
      .slice(0, 255);
    rows.push({
      [plan.externalIdField]: externalId,
      [plan.mappingRoleField]: role,
      [plan.mappingAccountKeyField]: account,
      [plan.mappingEmployeeKeyField]: employee,
    });
  }
  return {
    rows,
    skippedMissingAccount,
    skippedMissingEmployee,
    skippedMissingRole,
    duplicates,
  };
}
