import { IntegrationError } from '../foundation/adapter.errors';
import type { AtlassianCredential } from './atlassian.types';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export const ATLASSIAN_FETCH = Symbol('ATLASSIAN_FETCH');

export interface AtlassianHttpOptions {
  provider: 'bitbucket' | 'jira';
  baseUrl: string;
  credential: AtlassianCredential;
  fetch?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
}

/**
 * Small Cloud HTTP client shared by Bitbucket and Jira. It deliberately accepts
 * a base URL/profile so a future Data Center client can be added without
 * treating Cloud and DC routes as interchangeable.
 */
export class AtlassianHttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxAttempts: number;

  constructor(private readonly options: AtlassianHttpOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 4);
  }

  async json<T>(pathOrUrl: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(pathOrUrl, init);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async buffer(pathOrUrl: string, init: RequestInit = {}): Promise<{
    buffer: Buffer;
    contentType: string;
    disposition: string | null;
  }> {
    const response = await this.request(pathOrUrl, init);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      disposition: response.headers.get('content-disposition'),
    };
  }

  async request(pathOrUrl: string, init: RequestInit = {}): Promise<Response> {
    const url = this.resolveUrl(pathOrUrl);
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          ...init,
          headers: {
            Accept: 'application/json',
            ...this.authHeaders(),
            ...(init.headers ?? {}),
          },
        });
      } catch (cause) {
        if (attempt < this.maxAttempts) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
        throw new IntegrationError(
          'provider_unavailable',
          `${this.options.provider} request failed`,
          { provider: this.options.provider, retryable: true, cause },
        );
      }

      if (response.ok) return response;
      const retryable = response.status === 429 || [502, 503, 504].includes(response.status);
      if (retryable && attempt < this.maxAttempts) {
        await this.sleep(this.retryDelay(response, attempt));
        continue;
      }
      const body = await response.text().catch(() => '');
      throw this.toError(response.status, body, retryable);
    }
    throw new IntegrationError('provider_unavailable', `${this.options.provider} request failed`, {
      provider: this.options.provider,
      retryable: true,
    });
  }

  private resolveUrl(pathOrUrl: string): string {
    const base = this.options.baseUrl.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const target = new URL(pathOrUrl);
      if (target.origin !== new URL(base).origin) {
        throw new IntegrationError(
          'invalid_request',
          `${this.options.provider} pagination redirected to an untrusted origin`,
          { provider: this.options.provider, retryable: false },
        );
      }
      return target.toString();
    }
    return `${base}/${pathOrUrl.replace(/^\/+/, '')}`;
  }

  private authHeaders(): Record<string, string> {
    const credential = this.options.credential;
    if (credential.authType === 'oauth2') {
      return { Authorization: `Bearer ${credential.accessToken}` };
    }
    return {
      Authorization: `Basic ${Buffer.from(`${credential.email}:${credential.apiToken}`).toString('base64')}`,
    };
  }

  private retryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.min(60_000, Math.max(0, seconds * 1_000));
      const date = Date.parse(retryAfter);
      if (Number.isFinite(date)) return Math.min(60_000, Math.max(0, date - Date.now()));
    }
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    if (Number.isFinite(reset) && reset > 0) {
      return Math.min(60_000, Math.max(0, reset * 1_000 - Date.now()));
    }
    return this.backoff(attempt);
  }

  private backoff(attempt: number): number {
    return Math.min(10_000, 250 * 2 ** (attempt - 1));
  }

  private toError(status: number, body: string, retryable: boolean): IntegrationError {
    const code =
      status === 401
        ? 'authentication_failed'
        : status === 403
          ? 'authorization_failed'
          : status === 404
            ? 'not_found'
            : status === 429
              ? 'rate_limited'
              : status >= 500
                ? 'provider_unavailable'
                : 'invalid_request';
    const detail = this.safeProviderMessage(body);
    return new IntegrationError(
      code,
      `${this.options.provider} API request failed (${status})${detail ? `: ${detail}` : ''}`,
      { provider: this.options.provider, retryable, statusCode: status },
    );
  }

  private safeProviderMessage(body: string): string {
    if (!body) return '';
    try {
      const value = JSON.parse(body) as Record<string, unknown>;
      const error = value.error as Record<string, unknown> | undefined;
      const messages = value.errorMessages;
      return String(
        error?.message ??
          (Array.isArray(messages) ? messages.join('; ') : '') ??
          value.message ??
          '',
      ).slice(0, 300);
    } catch {
      return body.replace(/\s+/g, ' ').slice(0, 300);
    }
  }
}

export async function collectPages<T>(
  firstUrl: string,
  load: (url: string) => Promise<{ values?: T[]; next?: string | null }>,
  maxPages = 1_000,
): Promise<T[]> {
  const result: T[] = [];
  let next: string | null | undefined = firstUrl;
  let pages = 0;
  while (next) {
    if (++pages > maxPages) {
      throw new IntegrationError('provider_unavailable', 'Provider pagination limit exceeded', {
        retryable: false,
      });
    }
    const page = await load(next);
    result.push(...(page.values ?? []));
    next = page.next;
  }
  return result;
}
