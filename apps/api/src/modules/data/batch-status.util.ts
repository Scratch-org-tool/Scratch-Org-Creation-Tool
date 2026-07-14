export const ACTIVE_CHUNK_STATUSES = ['pending', 'queued', 'planning', 'running'] as const;

export type BatchAggregateStatus = 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface ChunkStatusCounts {
  completed: number;
  failed: number;
  cancelled: number;
  active: number;
}

/** Count chunk statuses into the buckets that drive batch state. */
export function countChunkStatuses(statuses: Iterable<[string, number]>): ChunkStatusCounts {
  const counts = new Map(statuses);
  const active = ACTIVE_CHUNK_STATUSES.reduce((sum, s) => sum + (counts.get(s) ?? 0), 0);
  return {
    completed: counts.get('completed') ?? 0,
    failed: counts.get('failed') ?? 0,
    cancelled: counts.get('cancelled') ?? 0,
    active,
  };
}

/**
 * Drift-proof batch status derived purely from current chunk states, so
 * re-running the aggregation (e.g. after a duplicate worker callback) always
 * converges to the same answer instead of double-counting.
 */
export function aggregateBatchStatus(counts: ChunkStatusCounts): BatchAggregateStatus {
  if (counts.active > 0) return 'running';
  if (counts.failed === 0 && counts.completed > 0) return 'completed';
  if (counts.failed > 0 && counts.completed > 0) return 'partial';
  if (counts.failed > 0) return 'failed';
  if (counts.cancelled > 0) return 'cancelled';
  return 'completed';
}
