import { describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '../foundation/adapter.errors';
import { AtlassianHttpClient } from './atlassian-http.client';

describe('AtlassianHttpClient', () => {
  it('uses OAuth bearer auth and honors Retry-After on rate limits', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '2' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    const client = new AtlassianHttpClient({
      provider: 'jira',
      baseUrl: 'https://api.atlassian.test/rest/api/3',
      credential: { authType: 'oauth2', accessToken: 'oauth-secret' },
      fetch,
      sleep,
    });

    await expect(client.json('myself')).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer oauth-secret',
    });
  });

  it('uses email plus scoped API token and rejects cross-origin pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    const client = new AtlassianHttpClient({
      provider: 'bitbucket',
      baseUrl: 'https://api.bitbucket.test/2.0',
      credential: {
        authType: 'api_token',
        email: 'admin@example.test',
        apiToken: 'scoped-token',
      },
      fetch,
    });

    await client.json('user');
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('admin@example.test:scoped-token').toString('base64')}`,
    });
    await expect(client.json('https://attacker.test/steal')).rejects.toMatchObject({
      code: 'invalid_request',
    } satisfies Partial<IntegrationError>);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('maps terminal provider failures without returning credential material', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errorMessages: ['No permission'] }), { status: 403 }),
    );
    const client = new AtlassianHttpClient({
      provider: 'jira',
      baseUrl: 'https://jira.example.test/rest/api/3',
      credential: { authType: 'oauth2', accessToken: 'never-leak-this' },
      fetch,
    });

    const error = await client.json('project').catch((value: unknown) => value);
    expect(error).toMatchObject({ code: 'authorization_failed' });
    expect(String(error)).not.toContain('never-leak-this');
  });
});
