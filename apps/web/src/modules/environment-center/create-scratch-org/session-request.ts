const requests = new Map<string, Promise<unknown>>();

/**
 * Shares a side-effecting bootstrap request across React Strict Mode's
 * mount/unmount/remount cycle for the lifetime of this browser module session.
 */
export function sessionRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = Promise.resolve().then(request);
  requests.set(key, pending);
  void pending.catch(() => {
    if (requests.get(key) === pending) requests.delete(key);
  });
  return pending;
}
