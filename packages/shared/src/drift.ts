import { z } from 'zod';
import { CURATED_COMPARE_TYPES, type MetadataComponentInfo } from './org-to-org-metadata.js';
import { deploymentScheduleSchema, type DeploymentSchedule } from './scheduling.js';

/**
 * Org drift monitoring.
 *
 * A drift monitor periodically compares a source org against a target org for a
 * chosen set of metadata types and records a lightweight snapshot of the
 * differences. Comparison is done at the component-listing level (name presence
 * plus lastModifiedDate) so a check is cheap enough to run on a schedule without
 * retrieving XML for every component.
 */

export const DRIFT_STATUSES = ['clean', 'drifted', 'failed', 'checking'] as const;
export type DriftStatus = (typeof DRIFT_STATUSES)[number];

/** Reuses the metadata comparison vocabulary; `same` items are never stored. */
export type DriftDiffType = 'new' | 'changed' | 'deleted' | 'same';

export interface DriftItem {
  metadataType: string;
  fullName: string;
  diffType: Exclude<DriftDiffType, 'same'>;
  sourceModified?: string;
  targetModified?: string;
  modifiedBy?: string;
}

export interface DriftByType {
  new: number;
  changed: number;
  deleted: number;
  total: number;
}

export interface DriftSummary {
  totalDifferences: number;
  added: number;
  changed: number;
  removed: number;
  byType: Record<string, DriftByType>;
}

/**
 * Classify a source/target pair for drift. Unlike the base metadata comparison
 * (which cannot tell "changed" from "same" without XML), drift uses the
 * lastModifiedDate returned by the list API as a cheap change signal.
 */
export function classifyDriftPair(
  source: MetadataComponentInfo | undefined,
  target: MetadataComponentInfo | undefined,
): DriftDiffType {
  if (source && !target) return 'new';
  if (!source && target) return 'deleted';
  if (!source || !target) return 'same';
  const sourceMod = source.lastModifiedDate ?? '';
  const targetMod = target.lastModifiedDate ?? '';
  if (sourceMod && targetMod && sourceMod !== targetMod) return 'changed';
  return 'same';
}

/**
 * Build the differing items (drift) for one metadata type. Items classified as
 * `same` are omitted so a snapshot only stores actual differences.
 */
export function buildDriftItems(
  metadataType: string,
  sourceList: MetadataComponentInfo[],
  targetList: MetadataComponentInfo[],
): DriftItem[] {
  const sourceMap = new Map(sourceList.map((c) => [c.fullName, c]));
  const targetMap = new Map(targetList.map((c) => [c.fullName, c]));
  const allNames = new Set([...sourceMap.keys(), ...targetMap.keys()]);
  const items: DriftItem[] = [];
  for (const fullName of [...allNames].sort()) {
    const source = sourceMap.get(fullName);
    const target = targetMap.get(fullName);
    const diffType = classifyDriftPair(source, target);
    if (diffType === 'same') continue;
    items.push({
      metadataType,
      fullName,
      diffType,
      sourceModified: source?.lastModifiedDate,
      targetModified: target?.lastModifiedDate,
      modifiedBy: source?.lastModifiedBy ?? target?.lastModifiedBy,
    });
  }
  return items;
}

export function summarizeDrift(items: DriftItem[]): DriftSummary {
  const summary: DriftSummary = {
    totalDifferences: items.length,
    added: 0,
    changed: 0,
    removed: 0,
    byType: {},
  };
  for (const item of items) {
    const bucket = (summary.byType[item.metadataType] ??= {
      new: 0,
      changed: 0,
      deleted: 0,
      total: 0,
    });
    bucket.total += 1;
    bucket[item.diffType] += 1;
    if (item.diffType === 'new') summary.added += 1;
    else if (item.diffType === 'changed') summary.changed += 1;
    else summary.removed += 1;
  }
  return summary;
}

/** Stable identity of a drift item, incorporating the change signal so a new
 * edit to an already-drifted component counts as newly drifted. */
export function driftItemKey(item: DriftItem): string {
  const signature =
    item.diffType === 'changed'
      ? `${item.sourceModified ?? ''}|${item.targetModified ?? ''}`
      : '';
  return `${item.metadataType}:${item.fullName}:${item.diffType}:${signature}`;
}

export interface DriftDelta {
  /** Items present now that were absent (or differently changed) previously. */
  newlyDrifted: DriftItem[];
  /** Items that were drifting previously but are now reconciled. */
  resolved: DriftItem[];
}

/** Compare two snapshots' item lists to find what newly drifted / reconciled. */
export function diffDriftSnapshots(previous: DriftItem[], current: DriftItem[]): DriftDelta {
  const previousKeys = new Set(previous.map(driftItemKey));
  const currentKeys = new Set(current.map(driftItemKey));
  return {
    newlyDrifted: current.filter((item) => !previousKeys.has(driftItemKey(item))),
    resolved: previous.filter((item) => !currentKeys.has(driftItemKey(item))),
  };
}

export function driftStatusFromSummary(summary: DriftSummary): Exclude<DriftStatus, 'checking' | 'failed'> {
  return summary.totalDifferences > 0 ? 'drifted' : 'clean';
}

const metadataTypesSchema = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((types) => [...new Set(types)].sort());

const driftMonitorBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  metadataTypes: metadataTypesSchema.optional(),
  schedule: deploymentScheduleSchema.optional(),
  scheduleEnabled: z.boolean().default(false),
  enabled: z.boolean().default(true),
  notifyOnDrift: z.boolean().default(true),
});

function assertDistinctOrgs(
  data: { sourceOrgId?: string; targetOrgId?: string; scheduleEnabled?: boolean; schedule?: unknown },
  ctx: z.RefinementCtx,
) {
  if (data.sourceOrgId && data.targetOrgId && data.sourceOrgId === data.targetOrgId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and target org must differ',
      path: ['targetOrgId'],
    });
  }
  if (data.scheduleEnabled && !data.schedule) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A schedule is required to enable automatic checks',
      path: ['schedule'],
    });
  }
}

export const driftMonitorCreateSchema = driftMonitorBaseSchema.superRefine(assertDistinctOrgs);

export const driftMonitorUpdateSchema = driftMonitorBaseSchema
  .partial()
  .superRefine(assertDistinctOrgs);

export type DriftMonitorCreateInput = z.infer<typeof driftMonitorCreateSchema>;
export type DriftMonitorUpdateInput = z.infer<typeof driftMonitorUpdateSchema>;

export interface DriftMonitorRecord {
  id: string;
  name: string;
  description: string | null;
  sourceOrgId: string;
  targetOrgId: string;
  metadataTypes: string[];
  schedule: DeploymentSchedule | null;
  scheduleEnabled: boolean;
  enabled: boolean;
  notifyOnDrift: boolean;
  nextRunAt: string | null;
  lastCheckedAt: string | null;
  lastStatus: DriftStatus | null;
  lastDriftCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriftSnapshotRecord {
  id: string;
  monitorId: string;
  status: DriftStatus;
  trigger: 'manual' | 'schedule';
  totalDifferences: number;
  added: number;
  changed: number;
  removed: number;
  byType: Record<string, DriftByType> | null;
  items: DriftItem[] | null;
  newlyDrifted: DriftItem[] | null;
  error: string | null;
  createdAt: string;
}

/** Default set of types a monitor watches when none are specified. */
export const DEFAULT_DRIFT_TYPES: readonly string[] = CURATED_COMPARE_TYPES;
