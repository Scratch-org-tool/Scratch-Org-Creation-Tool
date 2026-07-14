import { z } from 'zod';
import { ORG_TO_ORG_RECORD_LIMIT_MAX, stripLimitOffset } from './org-to-org-data.js';

export const querySetEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  object: z.string().min(1),
  soql: z.string().min(1),
  limit: z.number().int().positive().optional(),
  variables: z.record(z.string()).optional(),
});

export const querySetSchema = z.object({
  version: z.literal(1).default(1),
  defaultLimit: z.number().int().positive().default(200),
  source: z.enum(['builder', 'upload', 'merged']).default('builder'),
  queries: z.array(querySetEntrySchema).min(1),
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
  let query = input.soql?.trim();
  if (!query || !/\bFROM\b/i.test(query)) {
    query = `SELECT Name FROM ${input.objectName}`;
  }
  query = stripIdFromSelect(query);
  if (input.recordLimit != null) {
    return replaceOrApplyLimit(query, input.recordLimit);
  }
  if (extractLimitFromSoql(query) != null) {
    return query.trim().replace(/;+\s*$/, '');
  }
  return `${query.trim().replace(/;+\s*$/, '')} LIMIT 200`;
}

export function stripIdFromSelect(soql: string): string {
  let query = soql.trim();
  query = query.replace(/\bSELECT\s+Id\s*,\s*/i, 'SELECT ');
  query = query.replace(/,\s*Id\b(?=\s*,|\s+FROM)/gi, '');
  return query;
}

export function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value.replace(/'/g, "\\'"));
  }
  return result;
}

export function extractObjectFromSoql(soql: string): string | null {
  const match = soql.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
  return match?.[1] ?? null;
}

export function extractFieldsFromSoql(soql: string): string[] {
  const selectMatch = soql.match(/\bSELECT\s+(.+?)\s+FROM\b/is);
  if (!selectMatch) return [];
  return selectMatch[1]
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
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
  const queries = parsed.queries.map((q) => {
    const perQueryLimit = q.limit ?? limit;
    let soql = stripIdFromSelect(q.soql);
    soql = replaceOrApplyLimit(soql, perQueryLimit);
    const object = q.object || extractObjectFromSoql(soql) || 'Unknown';
    return { ...q, object, soql, limit: perQueryLimit };
  });

  return { ...parsed, defaultLimit: limit, queries };
}

export interface QueryTemplate {
  id: string;
  label: string;
  object: string;
  soqlTemplate: string;
  requiredVariables?: string[];
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
