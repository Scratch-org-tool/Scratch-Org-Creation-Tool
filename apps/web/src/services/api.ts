import { buildApiUrl, buildDirectApiUrl } from '@/lib/api-base-url';

let getIdToken: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseErrorResponse(text: string, status: number): ApiError {
  let message = text || `API error: ${status}`;
  let code: string | null = null;
  let details: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    details = parsed;
    const nested = parsed.message;
    if (typeof nested === 'string') message = nested;
    else if (Array.isArray(nested)) message = nested.join(', ');
    else if (nested && typeof nested === 'object') {
      details = { ...parsed, ...(nested as Record<string, unknown>) };
      const nestedMessage = (nested as Record<string, unknown>).message;
      if (typeof nestedMessage === 'string') message = nestedMessage;
      const nestedCode = (nested as Record<string, unknown>).code;
      if (typeof nestedCode === 'string') code = nestedCode;
    }
    if (typeof parsed.error === 'string') code ??= parsed.error;
    if (typeof parsed.code === 'string') code = parsed.code;
  } catch {
    /* use response text */
  }
  return new ApiError(message, status, code, details);
}

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
    ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
    throw parseErrorResponse(text, res.status);
  }
  return res.json() as Promise<T>;
}

export async function apiBlob(
  path: string,
  options?: RequestInit & { direct?: boolean },
  retried = false,
): Promise<Blob> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };

  const token = await resolveToken(false);
  if (token) headers.Authorization = `Bearer ${token}`;

  const { direct, ...fetchOptions } = options ?? {};
  const url = direct ? buildDirectApiUrl(path) : buildApiUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOptions,
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
    throw parseErrorResponse(text, res.status);
  }

  return res.blob();
}

export async function getStreamUrl(types?: string[], forceRefresh = false): Promise<string> {
  const token = await resolveToken(forceRefresh);
  if (!token) throw new Error('Authentication is required for event streams.');
  const response = await fetch(buildApiUrl('/stream/ticket'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Session expired — please sign in again.'
        : 'Unable to open the event stream.',
    );
  }
  const { ticket } = await response.json() as { ticket?: string };
  if (!ticket) throw new Error('Unable to open the event stream.');

  const params = new URLSearchParams();
  if (types?.length) params.set('types', types.join(','));
  params.set('ticket', ticket);
  const qs = params.toString();
  return buildApiUrl(`/stream/events${qs ? `?${qs}` : ''}`);
}
