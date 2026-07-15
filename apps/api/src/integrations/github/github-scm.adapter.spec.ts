import { access } from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { GitHubApiClient } from './github-api.client';
import type { GitHubAuthService } from './github-auth.service';
import type { GitHubIntegrationService } from './github-integration.service';
import { GitHubCheckoutService, GitHubScmAdapter } from './github-scm.adapter';
import type { GitHubCredentials } from './github.types';

const credentials: GitHubCredentials = {
  appId: '1',
  privateKey: 'unused',
  installationId: '2',
  baseUrl: 'https://github.com',
};

describe('GitHubScmAdapter', () => {
  it('normalizes installation repositories into namespaces and repositories', async () => {
    const integration = {
      getCredentials: vi.fn().mockResolvedValue(credentials),
    } as unknown as GitHubIntegrationService;
    const api = {
      paginate: vi.fn().mockResolvedValue([
        {
          id: 10,
          name: 'metadata',
          full_name: 'acme/metadata',
          private: true,
          html_url: 'https://github.com/acme/metadata',
          default_branch: 'main',
          owner: { id: 7, login: 'acme', html_url: 'https://github.com/acme' },
        },
      ]),
    } as unknown as GitHubApiClient;
    const adapter = new GitHubScmAdapter(integration, api, {} as never);
    await expect(adapter.listNamespaces()).resolves.toEqual([
      {
        id: '7',
        name: 'acme',
        slug: 'acme',
        url: 'https://github.com/acme',
      },
    ]);
    await expect(adapter.listRepositories({ namespace: 'ACME' })).resolves.toEqual([
      {
        id: '10',
        name: 'metadata',
        fullName: 'acme/metadata',
        namespace: 'acme',
        defaultBranch: 'main',
        url: 'https://github.com/acme/metadata',
        isPrivate: true,
      },
    ]);
  });
});

describe('GitHubCheckoutService', () => {
  const token = 'installation-token-must-not-appear-in-args';
  const auth = {
    getToken: vi.fn().mockResolvedValue({
      token,
      expiresAt: new Date(Date.now() + 60_000),
      source: 'installation',
    }),
  } as unknown as GitHubAuthService;

  it('uses temporary askpass, keeps credentials out of args/URL, and removes it', async () => {
    let askPassPath = '';
    const exec = vi.fn(async (_file, args: readonly string[], options) => {
      askPassPath = options.env.GIT_ASKPASS;
      expect(args.join(' ')).not.toContain(token);
      expect(args.join(' ')).not.toContain('@github.com');
      expect(options.env.GITHUB_ASKPASS_TOKEN).toBe(token);
      await expect(access(askPassPath)).resolves.toBeUndefined();
    });
    const service = new GitHubCheckoutService(auth, exec);
    const result = await service.checkout(credentials, 'acme', 'metadata', 'main');
    await expect(access(askPassPath)).rejects.toThrow();
    await expect(access(result.workspaceDir)).resolves.toBeUndefined();
    await result.cleanup();
    await expect(access(result.workspaceDir)).rejects.toThrow();
  });

  it('removes both credential and workspace directories when git fails', async () => {
    let askPassPath = '';
    let workspace = '';
    const exec = vi.fn(async (_file, args: readonly string[], options) => {
      askPassPath = options.env.GIT_ASKPASS;
      workspace = args[args.length - 1];
      throw new Error('clone failed');
    });
    const service = new GitHubCheckoutService(auth, exec);
    await expect(service.checkout(credentials, 'acme', 'metadata', 'main')).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
    await expect(access(askPassPath)).rejects.toThrow();
    await expect(access(workspace)).rejects.toThrow();
  });
});
