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

export function insertAfterId<T extends { id: string }>(
  items: readonly T[],
  id: string,
  inserted: T,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items, inserted];
  return [...items.slice(0, index + 1), inserted, ...items.slice(index + 1)];
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
