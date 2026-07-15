import type { AccountPartnerPlan, CompiledQuerySectionQuery } from './query-section.js';

export type QueryCheckpointStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface QueryCheckpointEntry {
  id: string;
  status: QueryCheckpointStatus;
  exported: number;
  loaded: number;
  failed: number;
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

export interface AccountPartnerJoinInput {
  plan: AccountPartnerPlan;
  accounts: Array<Record<string, unknown>>;
  employees: Array<Record<string, unknown>>;
  mappings: Array<Record<string, unknown>>;
  targetAccountKeys?: ReadonlySet<string>;
  targetEmployeeKeys?: ReadonlySet<string>;
}

export interface AccountPartnerJoinResult {
  rows: Array<Record<string, string>>;
  skippedMissingAccount: number;
  skippedMissingEmployee: number;
  duplicates: number;
}

/** Build relationship-key partner rows only when both joined records exist. */
export function buildAccountPartnerRows(input: AccountPartnerJoinInput): AccountPartnerJoinResult {
  const { plan } = input;
  const accountKeys = new Set(input.accounts.map((row) => valueAt(row, plan.accountKeyField)).filter(Boolean));
  const employeeKeys = new Set(input.employees.map((row) => valueAt(row, plan.employeeKeyField)).filter(Boolean));
  const targetAccounts = input.targetAccountKeys ?? accountKeys;
  const targetEmployees = input.targetEmployeeKeys ?? employeeKeys;
  const rows: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  let skippedMissingAccount = 0;
  let skippedMissingEmployee = 0;
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
  return { rows, skippedMissingAccount, skippedMissingEmployee, duplicates };
}
