import {
  substituteVariables,
  topologicallySortDataDependencies,
  type QuerySetEntry,
} from '@sfcc/shared';
import type {
  OrgToOrgObjectDeployConfig,
  OrgToOrgObjectMeta,
} from './types';

export type DataOperation = 'insert' | 'upsert';

export interface DataPreflightReport {
  ok: boolean;
  dryRun: boolean;
  operation: DataOperation;
  externalIdField?: string;
  idempotent: boolean;
  sourceCount: number | null;
  estimatedChunks: number | null;
  estimatedBulkBatches: number | null;
  sample: unknown[];
  mappings: Array<{
    sourceField: string;
    targetField: string;
    createable: boolean;
    updateable: boolean;
  }>;
  bulkApi: {
    dailyBatchesRemaining: number | null;
    dailyBatchesMax: number | null;
    sufficient: boolean;
    confidence: 'known' | 'unknown';
    unknownPolicy: 'block' | 'warn';
  };
  fieldIssues: Array<{ field: string; issue: string; detail: string }>;
  errors: string[];
  warnings: string[];
}

export interface QueryTemplateApi {
  id: string;
  label: string;
  object: string;
  soqlTemplate: string;
  requiredVariables: string[];
  operation: DataOperation;
  externalIdField?: string;
  dependsOn: string[];
  order?: number;
}

export interface ReplicationQuery extends QuerySetEntry {
  operation: DataOperation;
  dependsOn: string[];
}

export const DATA_CENTER_ADD_QUERY_EVENT = 'sfcc:data-center:add-query';

export function externalIdOptions(meta: OrgToOrgObjectMeta | null): string[] {
  if (!meta) return [];
  const declared = meta.externalIdFields ?? [];
  const fields = new Set(declared.filter(Boolean));
  for (const field of meta.deployableFields) {
    if (field.externalId || field.idLookup) fields.add(field.name);
  }
  if (
    meta.matchField
    && !['Id', 'Name', meta.nameField].includes(meta.matchField)
  ) {
    fields.add(meta.matchField);
  }
  return [...fields].sort((a, b) => a.localeCompare(b));
}

export function defaultOperationForMeta(meta: OrgToOrgObjectMeta | null): {
  operation: DataOperation;
  externalIdField?: string;
} {
  const [externalIdField] = externalIdOptions(meta);
  return externalIdField
    ? { operation: 'upsert', externalIdField }
    : { operation: 'insert' };
}

export function buildGenericDeployPayload(input: {
  sourceOrgId: string;
  targetOrgId: string;
  objectName: string;
  soql?: string;
  recordLimit: number;
  operation: DataOperation;
  externalIdField?: string;
  dryRun: boolean;
  rollbackEnabled?: boolean;
  maxParallelChunks?: number;
}) {
  return {
    sourceOrgId: input.sourceOrgId,
    targetOrgId: input.targetOrgId,
    objectName: input.objectName.trim(),
    soql: input.soql?.trim() || undefined,
    recordLimit: input.recordLimit,
    operation: input.operation,
    externalIdField: input.operation === 'upsert'
      ? input.externalIdField?.trim() || undefined
      : undefined,
    dryRun: input.dryRun,
    unknownQuotaPolicy: 'block' as const,
    maxParallelChunks: input.maxParallelChunks,
    rollback: input.operation === 'upsert' && input.rollbackEnabled
      ? { enabled: true }
      : undefined,
  };
}

export function preflightKey(payload: Record<string, unknown>): string {
  const normalized = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(normalized);
}

export function isRetrySafe(batch: {
  operation?: string;
  idempotent?: boolean;
  externalIdField?: string | null;
}): boolean {
  return batch.operation === 'upsert'
    && batch.idempotent === true
    && Boolean(batch.externalIdField?.trim());
}

export function isBatchCancellable(status: string): boolean {
  return ['pending', 'queued', 'planning', 'running', 'paused'].includes(status);
}

export function rollbackInsertedCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + rollbackInsertedCount(item), 0);
  }
  const record = value as Record<string, unknown>;
  const direct = record.insertedCount;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  return Object.values(record).reduce<number>(
    (total, item) => total + rollbackInsertedCount(item),
    0,
  );
}

export function normalizeTemplates(input: unknown): QueryTemplateApi[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== 'string'
      || typeof item.label !== 'string'
      || typeof item.object !== 'string'
      || typeof item.soqlTemplate !== 'string'
    ) return [];
    return [{
      id: item.id,
      label: item.label,
      object: item.object,
      soqlTemplate: item.soqlTemplate,
      requiredVariables: Array.isArray(item.requiredVariables)
        ? item.requiredVariables.filter((v): v is string => typeof v === 'string')
        : [],
      operation: item.operation === 'upsert' ? 'upsert' : 'insert',
      externalIdField: typeof item.externalIdField === 'string'
        ? item.externalIdField
        : undefined,
      dependsOn: Array.isArray(item.dependsOn)
        ? item.dependsOn.filter((v): v is string => typeof v === 'string')
        : [],
      order: typeof item.order === 'number' ? item.order : undefined,
    }];
  });
}

export function templateToQuery(
  template: QueryTemplateApi,
  variables: Record<string, string>,
): ReplicationQuery {
  for (const variable of template.requiredVariables) {
    if (!variables[variable]?.trim()) {
      throw new Error(`Missing required variable: ${variable}`);
    }
  }
  return {
    id: template.id,
    label: template.label,
    object: template.object,
    soql: substituteVariables(template.soqlTemplate, variables),
    variables,
    operation: template.operation,
    externalIdField: template.externalIdField,
    dependsOn: template.dependsOn,
    order: template.order,
  };
}

export function moveByIndex<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function dependencyError(
  objects: Array<Pick<OrgToOrgObjectDeployConfig, 'objectName' | 'dependsOn' | 'order'> & { id?: string }>,
): string | null {
  try {
    topologicallySortDataDependencies(objects.map((object, index) => ({
      id: object.id ?? object.objectName,
      dependsOn: object.dependsOn ?? [],
      order: object.order ?? index,
    })));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function orderDeploymentObjects(
  objects: Array<OrgToOrgObjectDeployConfig & { id?: string }>,
): Array<OrgToOrgObjectDeployConfig & { id?: string }> {
  const byId = new Map(objects.map((object) => [object.id ?? object.objectName, object]));
  return topologicallySortDataDependencies(objects.map((object, index) => ({
    id: object.id ?? object.objectName,
    dependsOn: object.dependsOn ?? [],
    order: object.order ?? index,
  }))).map((node) => byId.get(node.id)!);
}

export function buildReplicationPayload(input: {
  sourceOrgId: string;
  targetOrgId: string;
  queries: ReplicationQuery[];
  defaultLimit: number;
  dryRun: boolean;
  maxParallelChunks: number;
}) {
  return {
    sourceOrgId: input.sourceOrgId,
    targetOrgId: input.targetOrgId,
    recordLimit: input.defaultLimit,
    dryRun: input.dryRun,
    unknownQuotaPolicy: 'block' as const,
    maxParallelChunks: input.maxParallelChunks,
    querySet: {
      version: 1 as const,
      defaultLimit: input.defaultLimit,
      source: 'builder' as const,
      queries: input.queries.map((query, order) => ({
        ...query,
        limit: query.limit ?? input.defaultLimit,
        operation: query.operation,
        externalIdField: query.operation === 'upsert' ? query.externalIdField : undefined,
        dependsOn: query.dependsOn ?? [],
        order,
      })),
    },
  };
}
