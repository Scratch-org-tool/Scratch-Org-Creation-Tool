import { buildApiUrl } from '@/lib/api-base-url';

let getIdToken: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: (forceRefresh?: boolean) => Promise<string | null>) {
  getIdToken = getter;
}

async function resolveToken(forceRefresh = false): Promise<string | null> {
  if (!getIdToken) return null;
  return getIdToken(forceRefresh);
}

export async function buildAuthHeaders(
  extra?: Record<string, string>,
  forceRefresh = false,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  const token = await resolveToken(forceRefresh);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function api<T>(path: string, options?: RequestInit, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = await resolveToken(false);
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'Cannot reach API. Make sure `npm run dev` is running on the host machine (web + API).',
    );
  }

  if (res.status === 401 && !retried && getIdToken) {
    const refreshed = await resolveToken(true);
    if (refreshed) {
      return api<T>(path, options, true);
    }
    throw new Error('Session expired — please sign in again.');
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text || `API error: ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      }
    } catch { /* use raw text */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function apiBlob(path: string, options?: RequestInit, retried = false): Promise<Blob> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = await resolveToken(false);
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'Cannot reach API. Make sure `npm run dev` is running on the host machine (web + API).',
    );
  }

  if (res.status === 401 && !retried && getIdToken) {
    const refreshed = await resolveToken(true);
    if (refreshed) {
      return apiBlob(path, options, true);
    }
    throw new Error('Session expired — please sign in again.');
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text || `API error: ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      }
    } catch { /* use raw text */ }
    throw new Error(message);
  }

  return res.blob();
}

export async function getStreamUrl(types?: string[], forceRefresh = false): Promise<string> {
  const params = new URLSearchParams();
  if (types?.length) params.set('types', types.join(','));
  const token = await resolveToken(forceRefresh);
  if (token) params.set('token', token);
  const qs = params.toString();
  return buildApiUrl(`/stream/events${qs ? `?${qs}` : ''}`);
}
