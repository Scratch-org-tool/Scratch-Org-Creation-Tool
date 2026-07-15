import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import type { BitbucketScmAdapter } from '../../integrations/bitbucket/bitbucket.adapter';
import type { GitHubIntegrationService } from '../../integrations/github/github-integration.service';
import type { JiraWorkItemAdapter } from '../../integrations/jira/jira.adapter';
import { IntegrationOAuthService } from './integration-oauth.service';
import type { OAuthStateService } from './oauth-state.service';

describe('IntegrationOAuthService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.INTEGRATION_PUBLIC_ORIGIN = 'https://app.example.test';
    process.env.BITBUCKET_OAUTH_CLIENT_ID = 'bitbucket-client';
    process.env.BITBUCKET_OAUTH_CLIENT_SECRET = 'bitbucket-secret';
    process.env.JIRA_OAUTH_CLIENT_ID = 'jira-client';
    process.env.JIRA_OAUTH_CLIENT_SECRET = 'jira-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('exchanges a Bitbucket callback code and stores refreshable credentials without returning secrets', async () => {
    const states = {
      consume: vi.fn().mockResolvedValue({
        appUserId: 'user-1',
        payload: {},
        returnPath: '/environment-center',
      }),
    } as unknown as OAuthStateService;
    const store = { saveBitbucket: vi.fn().mockResolvedValue({}) } as unknown as AtlassianConnectionStore;
    const bitbucket = {
      verifyConnection: vi.fn().mockResolvedValue({
        account: { uuid: 'account-1', display_name: 'Ada' },
        workspace: null,
      }),
    } as unknown as BitbucketScmAdapter;
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      expires_in: 3600,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const service = new IntegrationOAuthService(
      states,
      {} as GitHubIntegrationService,
      store,
      bitbucket,
      {} as JiraWorkItemAdapter,
      fetchImpl,
    );

    const redirect = await service.callback('bitbucket', 'state', 'authorization-code');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://bitbucket.org/site/oauth2/access_token' }),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }),
      }),
    );
    expect(store.saveBitbucket).toHaveBeenCalledWith(expect.objectContaining({
      connectedBy: 'user-1',
      credential: expect.objectContaining({
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
        clientId: 'bitbucket-client',
        clientSecret: 'bitbucket-secret',
      }),
    }));
    expect(redirect).toContain('integration_status=success');
    expect(redirect).not.toContain('access-secret');
    expect(redirect).not.toContain('refresh-secret');
    expect(redirect).not.toContain('bitbucket-secret');
  });

  it('uses Jira PKCE and stores only the verifier in encrypted state payload', async () => {
    const states = {
      create: vi.fn().mockResolvedValue('A'.repeat(43)),
    } as unknown as OAuthStateService;
    const service = new IntegrationOAuthService(
      states,
      {} as GitHubIntegrationService,
      {} as AtlassianConnectionStore,
      {} as BitbucketScmAdapter,
      {} as JiraWorkItemAdapter,
      vi.fn(),
    );
    const result = await service.start('jira', 'user-1');
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(states.create).toHaveBeenCalledWith(
      'jira',
      'authorize',
      'user-1',
      { verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) },
      '/environment-center',
    );
    expect(result.authorizationUrl).not.toContain('jira-secret');
  });

  it('finalizes a GitHub installation from server-only app configuration', async () => {
    process.env.GITHUB_APP_ID = '123';
    process.env.GITHUB_APP_SLUG = 'sfcc-app';
    process.env.GITHUB_APP_PRIVATE_KEY = 'server-private-key';
    process.env.GITHUB_BASE_URL = 'https://github.enterprise.test';
    const states = {
      consume: vi.fn().mockResolvedValue({
        appUserId: 'user-1',
        payload: { baseUrl: 'https://github.enterprise.test' },
        returnPath: '/environment-center',
      }),
    } as unknown as OAuthStateService;
    const github = { connect: vi.fn().mockResolvedValue({}) } as unknown as GitHubIntegrationService;
    const service = new IntegrationOAuthService(
      states,
      github,
      {} as AtlassianConnectionStore,
      {} as BitbucketScmAdapter,
      {} as JiraWorkItemAdapter,
      vi.fn(),
    );

    const redirect = await service.callback('github', 'state', undefined, '456');
    expect(github.connect).toHaveBeenCalledWith({
      appId: '123',
      privateKey: 'server-private-key',
      installationId: '456',
      baseUrl: 'https://github.enterprise.test',
    }, 'user-1');
    expect(redirect).not.toContain('server-private-key');
    expect(redirect).toContain('integration_status=success');
  });
});
