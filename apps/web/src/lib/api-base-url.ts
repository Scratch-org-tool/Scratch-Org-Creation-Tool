const SERVER_API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

const BROWSER_DIRECT_API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || 'http://localhost:3001';

/** In the browser, use same-origin `/api/*` (proxied by Next.js). On the server, call Nest directly. */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return SERVER_API_URL;
}

export function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const suffix = normalized.startsWith('/api') ? normalized : `/api${normalized}`;
  const base = getApiBaseUrl();
  if (!base) return suffix;
  return `${base}${suffix}`;
}

/**
 * Long-running media generation can exceed the Next.js dev proxy timeout.
 * Call the API directly from the browser (CORS is open in dev).
 */
export function buildDirectApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const suffix = normalized.startsWith('/api') ? normalized : `/api${normalized}`;
  return `${BROWSER_DIRECT_API_URL}${suffix}`;
}
