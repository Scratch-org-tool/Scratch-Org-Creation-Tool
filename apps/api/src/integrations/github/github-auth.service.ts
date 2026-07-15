import { Inject, Injectable } from '@nestjs/common';
import { createSign } from 'crypto';
import { IntegrationError } from '../foundation/adapter.errors';
import {
  githubApiBase,
  type GitHubCredentials,
  type GitHubIdentity,
  type GitHubToken,
} from './github.types';

type FetchLike = typeof fetch;
export const GITHUB_AUTH_FETCH = Symbol('GITHUB_AUTH_FETCH');

interface CachedToken {
  token: GitHubToken;
  refreshAt: number;
}

@Injectable()
export class GitHubAuthService {
  private readonly cache = new Map<string, CachedToken>();

  constructor(@Inject(GITHUB_AUTH_FETCH) private readonly fetchImpl: FetchLike) {}

  createAppJwt(credentials: Pick<GitHubCredentials, 'appId' | 'privateKey'>): string {
    const now = Math.floor(Date.now() / 1000);
    const header = this.base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = this.base64Url(
      JSON.stringify({
        // Backdating tolerates small clock skew. GitHub App JWTs may live at most ten minutes.
        iat: now - 60,
        exp: now + 9 * 60,
        iss: credentials.appId,
      }),
    );
    const unsigned = `${header}.${payload}`;
    try {
      const signer = createSign('RSA-SHA256');
      signer.update(unsigned);
      signer.end();
      const signature = signer.sign(credentials.privateKey.replace(/\\n/g, '\n'));
      return `${unsigned}.${signature.toString('base64url')}`;
    } catch (cause) {
      throw new IntegrationError('authentication_failed', 'Invalid GitHub App private key', {
        provider: 'github',
        cause,
      });
    }
  }

  async getToken(credentials: GitHubCredentials, forceRefresh = false): Promise<GitHubToken> {
    const key = `${credentials.baseUrl}:${credentials.appId}:${credentials.installationId}`;
    const cached = this.cache.get(key);
    if (!forceRefresh && cached && cached.refreshAt > Date.now()) return cached.token;

    try {
      const jwt = this.createAppJwt(credentials);
      const response = await this.fetchImpl(
        `${githubApiBase(credentials.baseUrl)}/app/installations/${encodeURIComponent(credentials.installationId)}/access_tokens`,
        {
          method: 'POST',
          headers: this.headers(jwt),
        },
      );
      if (!response.ok) {
        throw await this.authError(response, 'GitHub installation token generation failed');
      }
      const body = (await response.json()) as { token?: unknown; expires_at?: unknown };
      if (typeof body.token !== 'string' || body.token.length === 0) {
        throw new IntegrationError(
          'authentication_failed',
          'GitHub returned an invalid installation token',
          { provider: 'github' },
        );
      }
      const expiresAt =
        typeof body.expires_at === 'string' && Number.isFinite(Date.parse(body.expires_at))
          ? new Date(body.expires_at)
          : new Date(Date.now() + 60 * 60 * 1000);
      const token: GitHubToken = {
        token: body.token,
        expiresAt,
        source: 'installation',
      };
      this.cache.set(key, {
        token,
        refreshAt: Math.max(Date.now(), expiresAt.getTime() - 5 * 60 * 1000),
      });
      return token;
    } catch (error) {
      // A PAT is an explicit encrypted admin fallback, never the primary credential.
      if (credentials.pat) {
        return { token: credentials.pat, expiresAt: null, source: 'pat' };
      }
      throw error;
    }
  }

  async verify(credentials: GitHubCredentials): Promise<GitHubIdentity> {
    const appJwt = this.createAppJwt(credentials);
    const apiBase = githubApiBase(credentials.baseUrl);
    const [appResponse, installationResponse] = await Promise.all([
      this.fetchImpl(`${apiBase}/app`, { headers: this.headers(appJwt) }),
      this.fetchImpl(
        `${apiBase}/app/installations/${encodeURIComponent(credentials.installationId)}`,
        { headers: this.headers(appJwt) },
      ),
    ]);
    if (!appResponse.ok) throw await this.authError(appResponse, 'GitHub App identity verification failed');
    if (!installationResponse.ok) {
      throw await this.authError(
        installationResponse,
        'GitHub App installation verification failed',
      );
    }
    const app = (await appResponse.json()) as { id?: number; slug?: string };
    const installation = (await installationResponse.json()) as {
      id?: number;
      account?: { id?: number; login?: string; type?: string };
    };
    if (String(app.id) !== String(credentials.appId)) {
      throw new IntegrationError(
        'authentication_failed',
        'The private key does not belong to the configured GitHub App id',
        { provider: 'github' },
      );
    }
    if (String(installation.id) !== String(credentials.installationId) || !installation.account) {
      throw new IntegrationError(
        'authentication_failed',
        'The configured GitHub App installation could not be verified',
        { provider: 'github' },
      );
    }

    // Generate an installation token and validate its installation identity. The token remains opaque.
    const token = await this.getToken(credentials, true);
    const identityResponse = await this.fetchImpl(`${apiBase}/installation`, {
      headers: this.headers(token.token),
    });
    if (!identityResponse.ok) {
      // PAT fallback cannot answer /installation. Its user identity is still verified explicitly.
      if (token.source !== 'pat') {
        throw await this.authError(identityResponse, 'GitHub installation identity verification failed');
      }
      const userResponse = await this.fetchImpl(`${apiBase}/user`, {
        headers: this.headers(token.token),
      });
      if (!userResponse.ok) throw await this.authError(userResponse, 'GitHub PAT verification failed');
    }

    return {
      appId: String(app.id),
      appSlug: app.slug || `app-${app.id}`,
      installationId: String(installation.id),
      accountId: String(installation.account.id ?? ''),
      accountLogin: installation.account.login || 'unknown',
      accountType: installation.account.type || 'Unknown',
      baseUrl: credentials.baseUrl,
    };
  }

  clear(credentials: Pick<GitHubCredentials, 'baseUrl' | 'appId' | 'installationId'>): void {
    this.cache.delete(`${credentials.baseUrl}:${credentials.appId}:${credentials.installationId}`);
  }

  private headers(token: string): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sfcc-github-integration',
    };
  }

  private async authError(response: Response, prefix: string): Promise<IntegrationError> {
    const requestId = response.headers.get('x-github-request-id');
    return new IntegrationError(
      response.status === 403 ? 'authorization_failed' : 'authentication_failed',
      `${prefix} (${response.status})${requestId ? ` [request ${requestId}]` : ''}`,
      {
        provider: 'github',
        statusCode: response.status,
        retryable: response.status >= 500,
      },
    );
  }

  private base64Url(value: string): string {
    return Buffer.from(value).toString('base64url');
  }
}
