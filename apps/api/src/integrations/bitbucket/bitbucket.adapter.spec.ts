import { access } from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { AtlassianConnectionStore } from '../atlassian/atlassian-connection.store';
import type { StoredAtlassianConnection, BitbucketConnectionConfig } from '../atlassian/atlassian.types';
import { BitbucketScmAdapter, type BitbucketExecFile } from './bitbucket.adapter';

function connection(
  credential: StoredAtlassianConnection<BitbucketConnectionConfig>['credential'] = {
    authType: 'oauth2',
    accessToken: 'bb-oauth-secret',
  },
): StoredAtlassianConnection<BitbucketConnectionConfig> {
  return {
    id: 'bb-connection',
    externalAccountId: '{account}',
    displayName: 'Acme Admin',
    namespace: 'acme',
    credential,
    config: {
      deployment: 'cloud',
      apiBaseUrl: 'https://api.bitbucket.test/2.0',
      gitBaseUrl: 'https://bitbucket.test',
      oauthBaseUrl: 'https://bitbucket.test',
      workspace: 'acme',
    },
    connectedAt: '2026-01-01T00:00:00.000Z',
    lastVerifiedAt: null,
  };
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BitbucketScmAdapter', () => {
  it('verifies account/workspace and paginates workspaces, repositories, and branches', async () => {
    const stored = connection({
      authType: 'api_token',
      email: 'admin@example.test',
      apiToken: 'scoped-api-token',
    });
    const store = {
      getBitbucket: vi.fn().mockResolvedValue(stored),
    } as unknown as AtlassianConnectionStore;
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/user')) {
        return response({ uuid: '{account}', display_name: 'Acme Admin' });
      }
      if (url.endsWith('/workspaces/acme')) {
        return response({ uuid: '{workspace}', name: 'Acme', slug: 'acme' });
      }
      if (url.includes('/workspaces?pagelen=100')) {
        return response({
          values: [{ uuid: '{w1}', name: 'Acme', slug: 'acme' }],
          next: 'https://api.bitbucket.test/2.0/workspaces?page=2',
        });
      }
      if (url.includes('/workspaces?page=2')) {
        return response({ values: [{ uuid: '{w2}', name: 'Labs', slug: 'labs' }] });
      }
      if (url.includes('/repositories/acme?')) {
        return response({
          values: [{
            uuid: '{repo}',
            name: 'metadata',
            full_name: 'acme/metadata',
            is_private: true,
            mainbranch: { name: 'main' },
            workspace: { slug: 'acme' },
          }],
        });
      }
      if (url.includes('/refs/branches') && url.includes('page=2')) {
        return response({ values: [{ name: 'release' }] });
      }
      if (url.includes('/refs/branches')) {
        return response({ values: [{ name: 'main' }], next: `${url}&page=2` });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const adapter = new BitbucketScmAdapter(store, fetch);

    await expect(adapter.verifyConnection(stored.credential, stored.config)).resolves.toMatchObject({
      account: { uuid: '{account}' },
      workspace: { slug: 'acme' },
    });
    await expect(adapter.listNamespaces()).resolves.toHaveLength(2);
    await expect(adapter.listRepositories({ namespace: 'acme' })).resolves.toEqual([
      expect.objectContaining({
        id: '{repo}',
        fullName: 'acme/metadata',
        defaultBranch: 'main',
      }),
    ]);
    await expect(adapter.listBranches({
      provider: 'bitbucket',
      namespace: 'acme',
      repo: 'metadata',
      branch: 'main',
    })).resolves.toEqual(['main', 'release']);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('admin@example.test:scoped-api-token').toString('base64')}`,
    });
  });

  it('checks out with temporary askpass credentials and removes every credential artifact', async () => {
    const stored = connection();
    const store = {
      getBitbucket: vi.fn().mockResolvedValue(stored),
    } as unknown as AtlassianConnectionStore;
    let invocation: Parameters<BitbucketExecFile> | undefined;
    const exec: BitbucketExecFile = vi.fn(async (...args: Parameters<BitbucketExecFile>) => {
      invocation = args;
    });
    const adapter = new BitbucketScmAdapter(store, vi.fn(), exec);

    const checkout = await adapter.checkout({
      provider: 'bitbucket',
      connectionId: stored.id,
      namespace: 'acme',
      repo: 'metadata',
      branch: 'feature/safe',
    });
    expect(invocation?.[0]).toBe('git');
    expect(invocation?.[1]).toContain('https://bitbucket.test/acme/metadata.git');
    expect(invocation?.[1].join(' ')).not.toContain('bb-oauth-secret');
    expect(invocation?.[2].env.SFCC_GIT_PASSWORD).toBe('bb-oauth-secret');
    expect(invocation?.[2].env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(invocation?.[2].env.GIT_CONFIG_VALUE_0).toBe('');
    const askpass = invocation?.[2].env.GIT_ASKPASS;
    expect(askpass).toBeTruthy();
    await expect(access(String(askpass))).rejects.toThrow();

    await checkout.cleanup();
    await checkout.cleanup();
    await expect(access(checkout.workspaceDir)).rejects.toThrow();
  });

  it('removes askpass and workspace directories when git fails', async () => {
    const stored = connection();
    let workspaceDir = '';
    let askpass = '';
    const exec: BitbucketExecFile = vi.fn(async (_file, args, options) => {
      workspaceDir = String(args.at(-1));
      askpass = String(options.env.GIT_ASKPASS);
      throw new Error('clone failed');
    });
    const adapter = new BitbucketScmAdapter(
      { getBitbucket: vi.fn().mockResolvedValue(stored) } as unknown as AtlassianConnectionStore,
      vi.fn(),
      exec,
    );

    await expect(adapter.checkout({
      provider: 'bitbucket',
      namespace: 'acme',
      repo: 'metadata',
      branch: 'main',
    })).rejects.toThrow(/checkout failed/);
    await expect(access(workspaceDir)).rejects.toThrow();
    await expect(access(askpass)).rejects.toThrow();
  });

  it('explicitly rejects the Data Center profile instead of calling Cloud routes', async () => {
    const stored = connection();
    stored.config.deployment = 'data_center';
    const adapter = new BitbucketScmAdapter(
      { getBitbucket: vi.fn().mockResolvedValue(stored) } as unknown as AtlassianConnectionStore,
      vi.fn(),
    );

    await expect(adapter.listNamespaces()).rejects.toThrow(/separate API profile/);
  });

  it('refreshes and persists expired OAuth credentials before API calls', async () => {
    const stored = connection({
      authType: 'oauth2',
      accessToken: 'expired',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    const storeMock = {
      getBitbucket: vi.fn().mockResolvedValue(stored),
      updateBitbucketCredential: vi.fn().mockResolvedValue(undefined),
    };
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/site/oauth2/access_token')) {
        return response({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
      }
      if (url.includes('/workspaces?pagelen=100')) return response({ values: [] });
      throw new Error(`Unexpected URL ${url}`);
    });
    const adapter = new BitbucketScmAdapter(
      storeMock as unknown as AtlassianConnectionStore,
      fetch,
    );

    await expect(adapter.listNamespaces()).resolves.toEqual([]);
    expect(storeMock.updateBitbucketCredential).toHaveBeenCalledWith(
      stored.id,
      expect.objectContaining({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
      stored.config,
    );
  });
});
