export function applyEntityState<
  T extends { id: string; state: { name: string } },
>(items: readonly T[], id: string, state: string): T[] {
  return items.map((item) => item.id === id
    ? { ...item, state: { ...item.state, name: state } }
    : item);
}

export function setExclusiveDefault<
  T extends { alias: string; isDefaultDevHub?: boolean },
>(items: readonly T[], alias: string): T[] {
  return items.map((item) => ({
    ...item,
    isDefaultDevHub: item.alias === alias,
  }));
}

export function restoreDefaultFlags<
  T extends { alias: string; isDefaultDevHub?: boolean },
>(current: readonly T[], snapshot: readonly T[]): T[] {
  const flags = new Map(snapshot.map((item) => [item.alias, item.isDefaultDevHub]));
  return current.map((item) => flags.has(item.alias)
    ? { ...item, isDefaultDevHub: flags.get(item.alias) }
    : item);
}
