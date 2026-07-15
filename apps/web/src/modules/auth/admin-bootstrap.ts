export const ADMIN_BOOTSTRAP_STORAGE_KEY = 'sfcc.adminBootstrap';

/** Consume the pending bootstrap token so every authentication attempt is one-shot. */
export function readBootstrapToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = sessionStorage.getItem(ADMIN_BOOTSTRAP_STORAGE_KEY);
    sessionStorage.removeItem(ADMIN_BOOTSTRAP_STORAGE_KEY);
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function storeBootstrapToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    const value = token.trim();
    if (value) {
      sessionStorage.setItem(ADMIN_BOOTSTRAP_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(ADMIN_BOOTSTRAP_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearBootstrapToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_BOOTSTRAP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
