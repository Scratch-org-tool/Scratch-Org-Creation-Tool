import { Inject, Injectable } from '@nestjs/common';
import { IntegrationError } from '../foundation/adapter.errors';
import { GitHubAuthService } from './github-auth.service';
import {
  githubApiBase,
  githubGraphqlUrl,
  type GitHubCredentials,
} from './github.types';

export const GITHUB_FETCH = Symbol('GITHUB_FETCH');
export const GITHUB_SLEEP = Symbol('GITHUB_SLEEP');
type FetchLike = typeof fetch;
type SleepLike = (milliseconds: number) => Promise<void>;

@Injectable()
export class GitHubApiClient {
  constructor(
    private readonly auth: GitHubAuthService,
    @Inject(GITHUB_FETCH) private readonly fetchImpl: FetchLike,
    @Inject(GITHUB_SLEEP) private readonly sleep: SleepLike,
  ) {}

  async request<T>(
    credentials: GitHubCredentials,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    let forceRefresh = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const auth = await this.auth.getToken(credentials, forceRefresh);
      const response = await this.fetchImpl(this.resolveUrl(credentials, path), {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'sfcc-github-integration',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.headers ?? {}),
        },
      });

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return response.json() as Promise<T>;
      }
      if (response.status === 401 && auth.source === 'installation' && !forceRefresh) {
        forceRefresh = true;
        continue;
      }
      const delay = this.retryDelay(response, attempt);
      if (delay !== null && attempt < 2) {
        await this.sleep(delay);
        continue;
      }
      throw this.toError(response);
    }
    throw new IntegrationError('provider_unavailable', 'GitHub request retries exhausted', {
      provider: 'github',
      retryable: true,
    });
  }

  async paginate<T>(
    credentials: GitHubCredentials,
    path: string,
    init: RequestInit = {},
  ): Promise<T[]> {
    const all: T[] = [];
    let url: string | null = this.withPerPage(this.resolveUrl(credentials, path));
    const trustedBase = githubApiBase(credentials.baseUrl);
    while (url) {
      const token = await this.auth.getToken(credentials);
      const response = await this.fetchWithRetry(credentials, url, token.token, init);
      const body = (await response.json()) as T[] | { items?: T[]; repositories?: T[] };
      if (Array.isArray(body)) all.push(...body);
      else all.push(...(body.items ?? body.repositories ?? []));
      const next = this.nextLink(response.headers.get('link'));
      if (next && !next.startsWith(`${trustedBase}/`)) {
        throw new IntegrationError('provider_unavailable', 'GitHub returned an untrusted pagination URL', {
          provider: 'github',
        });
      }
      url = next;
    }
    return all;
  }

  async graphql<T>(
    credentials: GitHubCredentials,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const result = await this.request<{ data?: T; errors?: Array<{ message?: string; type?: string }> }>(
      credentials,
      githubGraphqlUrl(credentials.baseUrl),
      { method: 'POST', body: JSON.stringify({ query, variables }) },
    );
    if (result.errors?.length) {
      throw new IntegrationError(
        result.errors.some((error) => error.type === 'RATE_LIMITED')
          ? 'rate_limited'
          : 'provider_unavailable',
        `GitHub GraphQL request failed: ${result.errors[0]?.message ?? 'unknown error'}`,
        { provider: 'github', retryable: true },
      );
    }
    if (!result.data) {
      throw new IntegrationError('provider_unavailable', 'GitHub GraphQL returned no data', {
        provider: 'github',
      });
    }
    return result.data;
  }

  private async fetchWithRetry(
    credentials: GitHubCredentials,
    url: string,
    initialToken: string,
    init: RequestInit,
  ): Promise<Response> {
    let token = initialToken;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'sfcc-github-integration',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.headers ?? {}),
        },
      });
      if (response.ok) return response;
      if (response.status === 401 && attempt === 0) {
        token = (await this.auth.getToken(credentials, true)).token;
        continue;
      }
      const delay = this.retryDelay(response, attempt);
      if (delay !== null && attempt < 2) {
        await this.sleep(delay);
        continue;
      }
      throw this.toError(response);
    }
    throw new IntegrationError('provider_unavailable', 'GitHub pagination retries exhausted', {
      provider: 'github',
      retryable: true,
    });
  }

  private resolveUrl(credentials: GitHubCredentials, path: string): string {
    if (/^https?:\/\//.test(path)) return path;
    return `${githubApiBase(credentials.baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private withPerPage(url: string): string {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('per_page')) parsed.searchParams.set('per_page', '100');
    return parsed.toString();
  }

  private nextLink(link: string | null): string | null {
    if (!link) return null;
    for (const part of link.split(',')) {
      const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
      if (match?.[2] === 'next') return match[1];
    }
    return null;
  }

  private retryDelay(response: Response, attempt: number): number | null {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
      const date = Date.parse(retryAfter);
      if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    }
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    if ((response.status === 429 || response.status === 403) && remaining === '0') {
      return Number.isFinite(reset)
        ? Math.max(0, reset * 1000 - Date.now())
        : 1000 * 2 ** attempt;
    }
    if (response.status >= 500) return 500 * 2 ** attempt;
    return null;
  }

  private toError(response: Response): IntegrationError {
    const rateLimited =
      response.status === 429 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
    const code =
      rateLimited
        ? 'rate_limited'
        : response.status === 401
          ? 'authentication_failed'
          : response.status === 403
            ? 'authorization_failed'
            : response.status === 404
              ? 'not_found'
              : response.status >= 500
                ? 'provider_unavailable'
                : 'invalid_request';
    const requestId = response.headers.get('x-github-request-id');
    return new IntegrationError(
      code,
      `GitHub request failed (${response.status})${requestId ? ` [request ${requestId}]` : ''}`,
      {
        provider: 'github',
        statusCode: response.status,
        retryable: rateLimited || response.status >= 500,
      },
    );
  }
}
