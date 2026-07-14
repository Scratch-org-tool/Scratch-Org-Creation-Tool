const SERVER_API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

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
