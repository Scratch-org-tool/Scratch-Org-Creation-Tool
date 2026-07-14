/** In-memory cache for workspace data — survives sidebar navigation within the same tab session. */

const store = new Map<string, { data: unknown; at: number }>();

/** How long cached page data is treated as fresh (no refetch on revisit). */
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function getSessionCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function hasFreshSessionCache(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() - entry.at > ttlMs) {
    store.delete(key);
    return false;
  }
  return true;
}

export function setSessionCache<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

export function clearSessionCache(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
