export type DataWriteOperation = 'insert' | 'upsert';
export type UnknownQuotaPolicy = 'block' | 'warn';

export interface DataDependencyNode {
  id: string;
  dependsOn?: string[];
  order?: number;
}

/**
 * Resolve the write mode without inventing a matching key. Upsert is the safe
 * default only when the caller supplied an external ID; otherwise the caller
 * gets an explicitly non-idempotent insert.
 */
export function resolveDataWriteOperation(
  operation: DataWriteOperation | undefined,
  externalIdField: string | undefined,
): { operation: DataWriteOperation; externalIdField?: string; idempotent: boolean } {
  const externalId = externalIdField?.trim() || undefined;
  const resolved = operation ?? (externalId ? 'upsert' : 'insert');
  if (resolved === 'upsert' && !externalId) {
    throw new Error('Upsert requires externalIdField; no fallback matching field is permitted');
  }
  return {
    operation: resolved,
    externalIdField: externalId,
    idempotent: resolved === 'upsert',
  };
}

/**
 * Stable topological ordering shared by top-level multi-object data deploys.
 * Unknown/self dependencies and cycles are rejected before any work is queued.
 */
export function topologicallySortDataDependencies<T extends DataDependencyNode>(
  nodes: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  const sourceIndex = new Map<string, number>();
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (byId.has(node.id)) throw new Error(`Duplicate data dependency id: ${node.id}`);
    byId.set(node.id, node);
    sourceIndex.set(node.id, index);
  }

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const node of nodes) {
    const dependencies = [...new Set(node.dependsOn ?? [])];
    if (dependencies.length !== (node.dependsOn ?? []).length) {
      throw new Error(`Duplicate dependency for data object ${node.id}`);
    }
    for (const dependency of dependencies) {
      if (dependency === node.id) throw new Error(`Data object ${node.id} cannot depend on itself`);
      if (!byId.has(dependency)) {
        throw new Error(`Missing dependency ${dependency} for data object ${node.id}`);
      }
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), node.id]);
    }
    indegree.set(node.id, dependencies.length);
  }

  const compare = (left: T, right: T) =>
    (left.order ?? 0) - (right.order ?? 0)
    || (sourceIndex.get(left.id) ?? 0) - (sourceIndex.get(right.id) ?? 0)
    || left.id.localeCompare(right.id);
  const ready = nodes.filter((node) => indegree.get(node.id) === 0).sort(compare);
  const result: T[] = [];
  while (ready.length) {
    const node = ready.shift()!;
    result.push(node);
    for (const dependentId of dependents.get(node.id) ?? []) {
      const remaining = (indegree.get(dependentId) ?? 1) - 1;
      indegree.set(dependentId, remaining);
      if (remaining === 0) {
        ready.push(byId.get(dependentId)!);
        ready.sort(compare);
      }
    }
  }
  if (result.length !== nodes.length) {
    const cyclic = nodes.filter((node) => !result.includes(node)).map((node) => node.id);
    throw new Error(`Data object dependency cycle detected: ${cyclic.join(', ')}`);
  }
  return result;
}

export function readyDataDependencyIds(
  nodes: readonly DataDependencyNode[],
  completedIds: ReadonlySet<string>,
  startedIds: ReadonlySet<string> = new Set(),
): string[] {
  // Sorting validates the graph even when the ready set is empty.
  return topologicallySortDataDependencies(nodes)
    .filter((node) => !completedIds.has(node.id) && !startedIds.has(node.id))
    .filter((node) => (node.dependsOn ?? []).every((id) => completedIds.has(id)))
    .map((node) => node.id);
}

export function resolveMaxParallelDataChunks(configured?: number): number {
  if (configured != null && Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.trunc(configured));
  }
  return 4;
}

/** Number of pending chunks that may be released into the queue now. */
export function dataChunkReleaseCount(input: {
  pending: number;
  active: number;
  maxParallel: number;
  quotaRemaining?: number | null;
}): number {
  const capacity = Math.max(0, Math.trunc(input.maxParallel) - Math.max(0, input.active));
  const quotaCapacity = input.quotaRemaining == null
    ? capacity
    : Math.max(0, Math.trunc(input.quotaRemaining));
  return Math.min(Math.max(0, input.pending), capacity, quotaCapacity);
}
