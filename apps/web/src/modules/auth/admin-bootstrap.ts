export const ADMIN_BOOTSTRAP_STORAGE_KEY = 'sfcc.adminBootstrap';

export function readBootstrapToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = sessionStorage.getItem(ADMIN_BOOTSTRAP_STORAGE_KEY);
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function storeBootstrapToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_BOOTSTRAP_STORAGE_KEY, token.trim());
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
