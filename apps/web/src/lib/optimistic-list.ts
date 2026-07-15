export interface IndexedSnapshot<T> {
  item: T;
  index: number;
}

export function removeAtId<T extends { id: string }>(
  items: readonly T[],
  id: string,
): { items: T[]; snapshot: IndexedSnapshot<T> | null } {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { items: [...items], snapshot: null };
  return {
    items: [...items.slice(0, index), ...items.slice(index + 1)],
    snapshot: { item: items[index]!, index },
  };
}

export function restoreAtIndex<T extends { id: string }>(
  items: readonly T[],
  snapshot: IndexedSnapshot<T> | null,
): T[] {
  if (!snapshot || items.some((item) => item.id === snapshot.item.id)) return [...items];
  const index = Math.min(Math.max(snapshot.index, 0), items.length);
  return [...items.slice(0, index), snapshot.item, ...items.slice(index)];
}

export function replaceAtId<T extends { id: string }>(
  items: readonly T[],
  id: string,
  replacement: T,
): T[] {
  return items.map((item) => item.id === id ? replacement : item);
}

export function replaceOrAppendAtId<T extends { id: string }>(
  items: readonly T[],
  id: string,
  replacement: T,
): T[] {
  const withoutServerDuplicate = items.filter(
    (item) => item.id !== replacement.id || item.id === id,
  );
  const index = withoutServerDuplicate.findIndex((item) => item.id === id);
  if (index < 0) return [...withoutServerDuplicate, replacement];
  return [
    ...withoutServerDuplicate.slice(0, index),
    replacement,
    ...withoutServerDuplicate.slice(index + 1),
  ];
}

export function insertAfterId<T extends { id: string }>(
  items: readonly T[],
  id: string,
  inserted: T,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items, inserted];
  return [...items.slice(0, index + 1), inserted, ...items.slice(index + 1)];
}

export function replaceOrInsertAfterId<T extends { id: string }>(
  items: readonly T[],
  provisionalId: string,
  sourceId: string,
  replacement: T,
): T[] {
  const withoutServerDuplicate = items.filter(
    (item) => item.id !== replacement.id || item.id === provisionalId,
  );
  if (withoutServerDuplicate.some((item) => item.id === provisionalId)) {
    return replaceAtId(withoutServerDuplicate, provisionalId, replacement);
  }
  return insertAfterId(withoutServerDuplicate, sourceId, replacement);
}

export function appendMissingById<T extends { id: string }>(
  items: readonly T[],
  overlay: readonly T[],
): T[] {
  const ids = new Set(items.map((item) => item.id));
  return [...items, ...overlay.filter((item) => !ids.has(item.id))];
}

export function withoutIds<T extends { id: string }>(
  items: readonly T[],
  ids: ReadonlySet<string>,
): T[] {
  return ids.size === 0 ? [...items] : items.filter((item) => !ids.has(item.id));
}

export class EntityRequestGate {
  private readonly busy = new Set<string>();
  private readonly tokens = new Map<string, number>();

  begin(id: string): number | null {
    if (this.busy.has(id)) return null;
    const token = (this.tokens.get(id) ?? 0) + 1;
    this.tokens.set(id, token);
    this.busy.add(id);
    return token;
  }

  isLatest(id: string, token: number): boolean {
    return this.tokens.get(id) === token;
  }

  finish(id: string, token: number): boolean {
    if (!this.isLatest(id, token)) return false;
    this.busy.delete(id);
    return true;
  }

  invalidate(id: string): void {
    this.tokens.set(id, (this.tokens.get(id) ?? 0) + 1);
    this.busy.delete(id);
  }
}

export interface MutationAwareRequest {
  generation: number;
  mutationVersion: number;
}

export class MutationAwareRequestGate {
  private generation = 0;
  private mutationVersion = 0;

  beginRequest(): MutationAwareRequest {
    return {
      generation: ++this.generation,
      mutationVersion: this.mutationVersion,
    };
  }

  isLatest(request: MutationAwareRequest): boolean {
    return request.generation === this.generation
      && request.mutationVersion === this.mutationVersion;
  }

  isLatestGeneration(request: MutationAwareRequest): boolean {
    return request.generation === this.generation;
  }

  beginMutation(): void {
    this.mutationVersion += 1;
  }

  finishMutation(): void {
    this.mutationVersion += 1;
  }
}
