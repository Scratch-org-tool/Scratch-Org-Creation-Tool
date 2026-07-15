import { describe, expect, it, vi } from 'vitest';
import type { GitHubAuthService } from './github-auth.service';
import { GitHubApiClient } from './github-api.client';
import type { GitHubCredentials } from './github.types';

const credentials: GitHubCredentials = {
  appId: '1',
  privateKey: 'unused',
  installationId: '2',
  baseUrl: 'https://github.example.test',
};

function auth(): GitHubAuthService {
  return {
    getToken: vi.fn().mockResolvedValue({
      token: 'opaque-token',
      expiresAt: new Date(Date.now() + 60_000),
      source: 'installation',
    }),
  } as unknown as GitHubAuthService;
}

describe('GitHubApiClient', () => {
  it('follows trusted Link pagination until exhausted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: {
            link: '<https://github.example.test/api/v3/items?page=2&per_page=100>; rel="next"',
          },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2 }]), { status: 200 }));
    const client = new GitHubApiClient(auth(), fetchMock as never, vi.fn());
    await expect(client.paginate(credentials, '/items')).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After before retrying a rate-limited request', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 429,
          headers: { 'retry-after': '2', 'x-ratelimit-remaining': '0' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new GitHubApiClient(auth(), fetchMock as never, sleep);
    await expect(client.request(credentials, '/rate-limited')).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('rejects cross-origin pagination links so credentials cannot be forwarded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { link: '<https://evil.example/items?page=2>; rel="next"' },
      }),
    );
    const client = new GitHubApiClient(auth(), fetchMock as never, vi.fn());
    await expect(client.paginate(credentials, '/items')).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
