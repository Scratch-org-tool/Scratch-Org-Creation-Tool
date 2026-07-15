import { generateKeyPairSync } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { GitHubAuthService } from './github-auth.service';
import type { GitHubCredentials } from './github.types';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function credentials(overrides: Partial<GitHubCredentials> = {}): GitHubCredentials {
  return {
    appId: '123',
    privateKey: pem,
    installationId: '456',
    baseUrl: 'https://github.com',
    ...overrides,
  };
}

describe('GitHubAuthService', () => {
  it('creates a short-lived RS256 app JWT without credential claims', () => {
    const auth = new GitHubAuthService(vi.fn() as never);
    const jwt = auth.createAppJwt(credentials());
    const [header, payload] = jwt.split('.').slice(0, 2).map((part) =>
      JSON.parse(Buffer.from(part, 'base64url').toString('utf8')),
    );
    expect(header.alg).toBe('RS256');
    expect(payload.iss).toBe('123');
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(600);
    expect(payload).not.toHaveProperty('privateKey');
  });

  it('generates and caches an opaque one-hour installation token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'opaque.not-a-jwt.secret',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const auth = new GitHubAuthService(fetchMock as never);
    const first = await auth.getToken(credentials());
    const second = await auth.getToken(credentials());
    expect(first).toMatchObject({ token: 'opaque.not-a-jwt.secret', source: 'installation' });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses only an explicitly configured PAT when installation auth fails', async () => {
    const auth = new GitHubAuthService(
      vi.fn().mockResolvedValue(new Response('', { status: 401 })) as never,
    );
    await expect(auth.getToken(credentials({ pat: 'github_pat_fallback_value' }))).resolves.toEqual({
      token: 'github_pat_fallback_value',
      expiresAt: null,
      source: 'pat',
    });
    await expect(auth.getToken(credentials())).rejects.toMatchObject({
      code: 'authentication_failed',
    });
  });

  it('verifies the app id, installation, account, and installation token identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 123, slug: 'sfcc-app' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 456,
            account: { id: 789, login: 'acme', type: 'Organization' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'installation-token',
            expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 456 }), { status: 200 }));
    const identity = await new GitHubAuthService(fetchMock as never).verify(credentials());
    expect(identity).toMatchObject({
      appId: '123',
      appSlug: 'sfcc-app',
      installationId: '456',
      accountId: '789',
      accountLogin: 'acme',
    });
  });
});
