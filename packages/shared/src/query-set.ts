import { z } from 'zod';
import { ORG_TO_ORG_RECORD_LIMIT_MAX, stripLimitOffset } from './org-to-org-data.js';
import {
  assertSoqlIdentifier,
  escapeSoqlLiteral,
  findTopLevelKeyword,
  flattenSoql,
  splitTopLevelFields,
} from './soql.js';
import {
  resolveDataWriteOperation,
  topologicallySortDataDependencies,
  type DataWriteOperation,
} from './data-runtime.js';

export const querySetEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  object: z.string().min(1),
  soql: z.string().min(1),
  limit: z.number().int().positive().optional(),
  variables: z.record(z.string()).optional(),
  operation: z.enum(['insert', 'upsert']).optional(),
  externalIdField: z.string().trim().min(1).optional(),
  dependsOn: z.array(z.string().min(1)).default([]),
  order: z.number().int().nonnegative().optional(),
});

export const querySetBaseSchema = z.object({
  version: z.literal(1).default(1),
  defaultLimit: z.number().int().positive().default(200),
  source: z.enum(['builder', 'upload', 'merged']).default('builder'),
  queries: z.array(querySetEntrySchema).min(1),
});

export const querySetSchema = querySetBaseSchema.superRefine((querySet, context) => {
  try {
    topologicallySortDataDependencies(querySet.queries);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : String(error),
      path: ['queries'],
    });
  }
  querySet.queries.forEach((query, index) => {
    try {
      resolveDataWriteOperation(query.operation, query.externalIdField);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : String(error),
        path: ['queries', index, 'externalIdField'],
      });
    }
  });
});

export type QuerySetEntry = z.infer<typeof querySetEntrySchema>;
export type QuerySetJson = z.infer<typeof querySetSchema>;

const LIMIT_RE = /\bLIMIT\s+\d+\s*$/i;

export function hasLimitClause(soql: string): boolean {
  return LIMIT_RE.test(soql.trim());
}

export function applyLimit(soql: string, limit: number): string {
  const trimmed = soql.trim().replace(/;+\s*$/, '');
  if (hasLimitClause(trimmed)) return trimmed;
  return `${trimmed} LIMIT ${limit}`;
}

export function replaceOrApplyLimit(soql: string, limit: number): string {
  const capped = Math.min(Math.max(limit, 1), ORG_TO_ORG_RECORD_LIMIT_MAX);
  const base = stripLimitOffset(soql.trim().replace(/;+\s*$/, ''));
  return `${base} LIMIT ${capped}`;
}

export function extractLimitFromSoql(soql: string): number | null {
  const match = soql.trim().replace(/;+\s*$/, '').match(/\bLIMIT\s+(\d+)(?:\s+OFFSET\s+\d+)?\s*$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildGenericDeployQuery(input: {
  soql?: string;
  objectName: string;
  recordLimit?: number;
}): string {
  // Multi-line SOQL from the custom editor must be collapsed to one line so
  // downstream CLI invocations and clause rewrites behave predictably.
  let query = input.soql ? flattenSoql(input.soql) : '';
  if (!query || findTopLevelKeyword(query, 'FROM') === -1) {
    query = `SELECT Name FROM ${assertSoqlIdentifier(input.objectName, 'object name')}`;
  }
  // Relationship subqueries cannot be exported to flat CSV (Bulk API rejects
  // them) — related objects deploy as their own step in dependency order.
  query = stripSelectSubqueries(query);
  query = stripIdFromSelect(query);
  if (input.recordLimit != null) {
    return replaceOrApplyLimit(query, input.recordLimit);
  }
  if (extractLimitFromSoql(query) != null) {
    return query.trim().replace(/;+\s*$/, '');
  }
  return `${query.trim().replace(/;+\s*$/, '')} LIMIT 200`;
}

/**
 * Remove relationship subqueries `(SELECT … FROM …)` from the top-level
 * SELECT list. Falls back to `Id` when the list would otherwise be empty.
 */
export function stripSelectSubqueries(soql: string): string {
  const query = soql.trim();
  const selectMatch = query.match(/^\s*SELECT\s+/i);
  if (!selectMatch) return query;
  const fieldsStart = selectMatch[0].length;
  const fromIndex = findTopLevelKeyword(query, 'FROM', fieldsStart);
  if (fromIndex === -1) return query;
  const fields = splitTopLevelFields(query.slice(fieldsStart, fromIndex));
  const scalarFields = fields.filter((field) => !field.startsWith('('));
  if (scalarFields.length === fields.length) return query;
  const kept = scalarFields.length > 0 ? scalarFields : ['Id'];
  return `${query.slice(0, fieldsStart)}${kept.join(', ')} ${query.slice(fromIndex)}`;
}

export function stripIdFromSelect(soql: string): string {
  const query = soql.trim();
  const selectMatch = query.match(/^\s*SELECT\s+/i);
  if (!selectMatch) return query;
  const fieldsStart = selectMatch[0].length;
  const fromIndex = findTopLevelKeyword(query, 'FROM', fieldsStart);
  if (fromIndex === -1) return query;
  const fields = splitTopLevelFields(query.slice(fieldsStart, fromIndex))
    .filter((field) => field.toLowerCase() !== 'id');
  if (fields.length === 0) return query;
  return `${query.slice(0, fieldsStart)}${fields.join(', ')} ${query.slice(fromIndex)}`;
}

export function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'),
      escapeSoqlLiteral(value),
    );
  }
  return result;
}

export function extractObjectFromSoql(soql: string): string | null {
  // The first FROM inside a relationship subquery must not win — resolve the
  // driving object from the top-level FROM clause only.
  const fromIndex = findTopLevelKeyword(soql, 'FROM');
  if (fromIndex === -1) return null;
  const match = soql.slice(fromIndex).match(/^FROM\s+([a-zA-Z0-9_]+)/i);
  return match?.[1] ?? null;
}

export function extractFieldsFromSoql(soql: string): string[] {
  const selectMatch = soql.match(/^\s*SELECT\s+/i);
  if (!selectMatch) return [];
  const fieldsStart = selectMatch[0].length;
  const fromIndex = findTopLevelKeyword(soql, 'FROM', fieldsStart);
  if (fromIndex === -1) return [];
  return splitTopLevelFields(soql.slice(fieldsStart, fromIndex));
}

export function normalizeQuerySet(
  input: unknown,
  defaultLimit = 200,
): QuerySetJson {
  const parsed = querySetSchema.parse({
    version: 1,
    defaultLimit,
    ...(typeof input === 'object' && input !== null ? input : {}),
  });

  const limit = parsed.defaultLimit;
  const queries = topologicallySortDataDependencies(parsed.queries).map((q) => {
    const perQueryLimit = q.limit ?? limit;
    let soql = stripIdFromSelect(q.soql);
    soql = replaceOrApplyLimit(soql, perQueryLimit);
    const object = q.object || extractObjectFromSoql(soql) || 'Unknown';
    const runtime = resolveDataWriteOperation(q.operation, q.externalIdField);
    return { ...q, ...runtime, object, soql, limit: perQueryLimit };
  });

  return { ...parsed, defaultLimit: limit, queries };
}

export interface QueryTemplate {
  id: string;
  label: string;
  object: string;
  soqlTemplate: string;
  requiredVariables?: string[];
  operation?: DataWriteOperation;
  externalIdField?: string;
  dependsOn?: string[];
  order?: number;
}

export function compileQuerySetFromTemplates(
  templates: QueryTemplate[],
  enabledIds: string[],
  variables: Record<string, string>,
  defaultLimit = 200,
  source: QuerySetJson['source'] = 'builder',
): QuerySetJson {
  const enabled = templates.filter((t) => enabledIds.includes(t.id));
  if (enabled.length === 0) {
    throw new Error('At least one query template must be enabled');
  }

  for (const t of enabled) {
    for (const v of t.requiredVariables ?? []) {
      if (!variables[v]?.trim()) {
        throw new Error(`Missing required variable: ${v} for template ${t.id}`);
      }
    }
  }

  const queries: QuerySetEntry[] = enabled.map((t) => {
    const soql = substituteVariables(t.soqlTemplate, variables);
    return {
      id: t.id,
      label: t.label,
      object: t.object,
      soql,
      limit: defaultLimit,
      variables,
      operation: t.operation,
      externalIdField: t.externalIdField,
      dependsOn: t.dependsOn ?? [],
      order: t.order,
    };
  });

  return normalizeQuerySet({ version: 1, defaultLimit, source, queries }, defaultLimit);
}

export function mergeQuerySets(
  base: QuerySetJson,
  upload: QuerySetJson,
): QuerySetJson {
  const byId = new Map(base.queries.map((q) => [q.id, q]));
  for (const q of upload.queries) {
    byId.set(q.id, q);
  }
  return normalizeQuerySet({
    version: 1,
    defaultLimit: upload.defaultLimit ?? base.defaultLimit,
    source: 'merged',
    queries: Array.from(byId.values()),
  });
}
