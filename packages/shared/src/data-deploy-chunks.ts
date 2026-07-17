import {
  DATA_DEPLOY_CHUNK_SIZE,
  DATA_RECORD_LIMIT_MAX,
} from './org-to-org-data.js';
import { stripLimitOffset } from './org-to-org-data.js';
import { escapeSoqlLiteral, findTopLevelKeyword } from './soql.js';

export interface DataDeployChunkPlan {
  chunkIndex: number;
  /**
   * SOQL for this chunk. For chunk 0 this is immediately runnable; chunks 1+
   * are placeholders until Id boundaries are resolved by the batch planner
   * (Salesforce caps OFFSET at 2,000, so OFFSET pagination cannot be used).
   */
  soql: string;
  limit: number;
  /** True when the chunk still needs its Id-range bounds resolved. */
  boundsPending: boolean;
}

/** Strip trailing ORDER BY / LIMIT / OFFSET so keyset clauses can be appended safely. */
export function stripOrderByLimitOffset(soql: string): string {
  const withoutLimit = stripLimitOffset(soql);
  // Only strip a TOP-LEVEL ORDER BY — an ORDER BY inside a relationship
  // subquery must survive untouched.
  const orderByIndex = findTopLevelKeyword(withoutLimit, 'ORDER BY');
  if (orderByIndex === -1) return withoutLimit.trim();
  return withoutLimit.slice(0, orderByIndex).trim();
}

/**
 * Inject an extra condition into a SELECT query, respecting an existing
 * top-level WHERE clause. A WHERE inside a relationship subquery or semi-join
 * is ignored when locating the insertion point.
 */
export function injectWhereCondition(soql: string, condition: string): string {
  const whereIndex = findTopLevelKeyword(soql, 'WHERE');
  if (whereIndex !== -1) {
    const before = soql.slice(0, whereIndex + 'WHERE'.length);
    const after = soql.slice(whereIndex + 'WHERE'.length);
    return `${before} (${after.trim()}) AND ${condition}`;
  }
  return `${soql} WHERE ${condition}`;
}

export interface IdRangeBounds {
  /** Exclusive lower bound (Id > afterId). */
  afterId?: string | null;
  /** Inclusive upper bound (Id <= endId). */
  endId?: string | null;
}

/**
 * Build a deterministic, Salesforce-compatible chunk query using Id-range (keyset)
 * pagination: `WHERE ... AND Id > :afterId AND Id <= :endId ORDER BY Id LIMIT n`.
 */
export function buildIdRangeChunkSoql(
  baseSoql: string,
  limit: number,
  bounds: IdRangeBounds = {},
): string {
  let query = stripOrderByLimitOffset(baseSoql.trim().replace(/;+\s*$/, ''));
  const conditions: string[] = [];
  if (bounds.afterId) conditions.push(`Id > '${escapeSoqlLiteral(bounds.afterId)}'`);
  if (bounds.endId) conditions.push(`Id <= '${escapeSoqlLiteral(bounds.endId)}'`);
  for (const condition of conditions) {
    query = injectWhereCondition(query, condition);
  }
  return `${query} ORDER BY Id LIMIT ${limit}`;
}

/** Id-only query used by the batch planner to compute chunk boundaries. */
export function buildIdOnlySoql(baseSoql: string, recordLimit: number): string {
  const stripped = stripOrderByLimitOffset(baseSoql.trim().replace(/;+\s*$/, ''));
  const fromIndex = findTopLevelKeyword(stripped, 'FROM');
  if (fromIndex === -1) {
    return `${stripped} ORDER BY Id LIMIT ${recordLimit}`;
  }
  const fromClause = stripped.slice(fromIndex);
  return `SELECT Id ${fromClause} ORDER BY Id LIMIT ${recordLimit}`;
}

/**
 * Given the ordered Ids covered by the deploy, compute per-chunk Id ranges.
 * Returns one entry per non-empty chunk.
 */
export function computeChunkBoundaries(
  orderedIds: string[],
  chunkSize: number,
): Array<{ chunkIndex: number; afterId: string | null; endId: string; recordCount: number }> {
  const size = Math.max(1, chunkSize);
  const boundaries: Array<{ chunkIndex: number; afterId: string | null; endId: string; recordCount: number }> = [];
  for (let start = 0, index = 0; start < orderedIds.length; start += size, index += 1) {
    const end = Math.min(start + size, orderedIds.length);
    boundaries.push({
      chunkIndex: index,
      afterId: start === 0 ? null : orderedIds[start - 1]!,
      endId: orderedIds[end - 1]!,
      recordCount: end - start,
    });
  }
  return boundaries;
}

export function planDataDeployChunks(
  baseSoql: string,
  recordLimit: number,
  chunkSize = DATA_DEPLOY_CHUNK_SIZE,
): DataDeployChunkPlan[] {
  const cappedLimit = Math.min(Math.max(recordLimit, 1), DATA_RECORD_LIMIT_MAX);
  const size = Math.min(Math.max(chunkSize, 1), DATA_RECORD_LIMIT_MAX);
  const chunks: DataDeployChunkPlan[] = [];
  let consumed = 0;
  let index = 0;
  while (consumed < cappedLimit) {
    const limit = Math.min(size, cappedLimit - consumed);
    chunks.push({
      chunkIndex: index,
      soql: buildIdRangeChunkSoql(baseSoql, limit),
      limit,
      boundsPending: index > 0,
    });
    consumed += limit;
    index += 1;
  }
  return chunks;
}

export function shouldChunkDeploy(recordLimit: number, chunkSize = DATA_DEPLOY_CHUNK_SIZE): boolean {
  return recordLimit > chunkSize;
}

export function chunkCountForLimit(recordLimit: number, chunkSize = DATA_DEPLOY_CHUNK_SIZE): number {
  const cappedLimit = Math.min(Math.max(recordLimit, 1), DATA_RECORD_LIMIT_MAX);
  const size = Math.min(Math.max(chunkSize, 1), DATA_RECORD_LIMIT_MAX);
  return Math.ceil(cappedLimit / size);
}

/** Build SELECT COUNT() query from a SOQL string (strips LIMIT/OFFSET/ORDER BY). */
export function buildCountSoql(soql: string): string {
  const stripped = stripOrderByLimitOffset(soql.trim().replace(/;+\s*$/, ''));
  const fromIndex = findTopLevelKeyword(stripped, 'FROM');
  if (fromIndex === -1) return stripped;
  const fromClause = stripped.slice(fromIndex).trim();
  return `SELECT COUNT() ${fromClause}`;
}
