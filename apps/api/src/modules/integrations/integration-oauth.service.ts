import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import type {
  AtlassianCredential,
  BitbucketConnectionConfig,
  JiraConnectionConfig,
} from '../../integrations/atlassian/atlassian.types';
import { BitbucketScmAdapter } from '../../integrations/bitbucket/bitbucket.adapter';
import { GitHubIntegrationService } from '../../integrations/github/github-integration.service';
import { normalizeGitHubBaseUrl } from '../../integrations/github/github.types';
import { JiraWorkItemAdapter, type JiraSite } from '../../integrations/jira/jira.adapter';
import { OAuthStateService } from './oauth-state.service';

type FetchLike = typeof fetch;
export const INTEGRATION_OAUTH_FETCH = Symbol('INTEGRATION_OAUTH_FETCH');

interface StartInput {
  returnPath?: string;
}

interface JiraSelectionPayload {
  credential: AtlassianCredential;
  config: JiraConnectionConfig;
  sites: JiraSite[];
}

@Injectable()
export class IntegrationOAuthService {
  constructor(
    private readonly states: OAuthStateService,
    private readonly github: GitHubIntegrationService,
    private readonly store: AtlassianConnectionStore,
    private readonly bitbucket: BitbucketScmAdapter,
    private readonly jira: JiraWorkItemAdapter,
    @Inject(INTEGRATION_OAUTH_FETCH) private readonly fetchImpl: FetchLike,
  ) {}

  async start(provider: string, appUserId: string, input: StartInput = {}) {
    const returnPath = input.returnPath ?? '/environment-center';
    if (provider === 'github') {
      const config = this.githubConfig();
      const state = await this.states.create(
        provider,
        'install',
        appUserId,
        { baseUrl: config.baseUrl },
        returnPath,
      );
      const url = new URL(`/apps/${encodeURIComponent(config.appSlug)}/installations/new`, config.baseUrl);
      url.searchParams.set('state', state);
      return { authorizationUrl: url.toString(), provider };
    }
    if (provider === 'bitbucket') {
      const config = this.bitbucketConfig();
      const state = await this.states.create(
        provider,
        'authorize',
        appUserId,
        {},
        returnPath,
      );
      const url = new URL('/site/oauth2/authorize', config.oauthBaseUrl);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);
      url.searchParams.set('redirect_uri', this.callbackUrl('bitbucket'));
      return { authorizationUrl: url.toString(), provider };
    }
    if (provider === 'jira') {
      const config = this.jiraConfig();
      const verifier = randomBytes(32).toString('base64url');
      const state = await this.states.create(
        provider,
        'authorize',
        appUserId,
        { verifier },
        returnPath,
      );
      const url = new URL('/authorize', config.authBaseUrl);
      url.searchParams.set('audience', 'api.atlassian.com');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('scope', 'read:jira-work write:jira-work read:jira-user offline_access');
      url.searchParams.set('redirect_uri', this.callbackUrl('jira'));
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
      return { authorizationUrl: url.toString(), provider };
    }
    throw new BadRequestException(`OAuth provider "${provider}" is not supported`);
  }

  async callback(provider: string, state: string, code?: string, installationId?: string) {
    if (provider === 'github') {
      const value = await this.states.consume<{ baseUrl: string }>(state, provider, 'install');
      if (!installationId || !/^\d+$/.test(installationId)) {
        return this.resultUrl(value.returnPath, provider, 'error', 'GitHub installation was not completed');
      }
      const config = this.githubConfig();
      await this.github.connect(
        {
          appId: config.appId,
          privateKey: config.privateKey,
          installationId,
          baseUrl: value.payload.baseUrl,
          ...(config.webhookSecret ? { webhookSecret: config.webhookSecret } : {}),
        },
        value.appUserId,
      );
      return this.resultUrl(value.returnPath, provider, 'success', 'GitHub App installed');
    }
    if (provider === 'bitbucket') {
      const value = await this.states.consume<Record<string, never>>(state, provider, 'authorize');
      if (!code) {
        return this.resultUrl(value.returnPath, provider, 'error', 'Bitbucket authorization was not completed');
      }
      const config = this.bitbucketConfig();
      const credential = await this.exchangeBitbucket(code, config);
      await this.saveBitbucket(credential, value.appUserId, config);
      return this.resultUrl(value.returnPath, provider, 'success', 'Bitbucket connected');
    }
    if (provider === 'jira') {
      const value = await this.states.consume<{ verifier: string }>(state, provider, 'authorize');
      if (!code) {
        return this.resultUrl(value.returnPath, provider, 'error', 'Jira authorization was not completed');
      }
      const config = this.jiraConfig();
      const credential = await this.exchangeJira(code, value.payload.verifier, config);
      const connectionConfig = this.jiraConnectionConfig(config);
      const sites = (await this.jira.listSites(credential, connectionConfig))
        .slice()
        .sort((left, right) => left.url.localeCompare(right.url) || left.id.localeCompare(right.id));
      if (!sites.length) throw new BadRequestException('No accessible Jira Cloud site was returned');
      if (sites.length > 1) {
        const selectionState = await this.states.create<JiraSelectionPayload>(
          'jira',
          'select_site',
          value.appUserId,
          { credential, config: connectionConfig, sites },
          value.returnPath,
        );
        return this.resultUrl(
          value.returnPath,
          provider,
          'pending',
          'Select a Jira Cloud site',
          selectionState,
        );
      }
      await this.saveJira(credential, connectionConfig, sites[0], value.appUserId);
      return this.resultUrl(value.returnPath, provider, 'success', 'Jira Cloud connected');
    }
    throw new BadRequestException(`OAuth provider "${provider}" is not supported`);
  }

  async jiraSelection(state: string, appUserId: string) {
    const value = await this.states.inspect<JiraSelectionPayload>(
      state,
      'jira',
      'select_site',
      appUserId,
    );
    return {
      sites: value.payload.sites.map(({ id, name, url }) => ({ id, name, url })),
    };
  }

  async selectJiraSite(state: string, siteId: string, appUserId: string) {
    const value = await this.states.consume<JiraSelectionPayload>(
      state,
      'jira',
      'select_site',
      appUserId,
    );
    const site = value.payload.sites.find((candidate) => candidate.id === siteId);
    if (!site) throw new BadRequestException('Selected Jira site is not accessible');
    await this.saveJira(value.payload.credential, value.payload.config, site, appUserId);
    return {
      redirectUrl: this.resultUrl(value.returnPath, 'jira', 'success', 'Jira Cloud connected'),
    };
  }

  failureUrl(provider: string, message = 'Provider authorization failed'): string {
    return this.resultUrl('/environment-center', provider, 'error', message);
  }

  private async exchangeBitbucket(
    code: string,
    config: ReturnType<IntegrationOAuthService['bitbucketConfig']>,
  ): Promise<AtlassianCredential> {
    const response = await this.fetchImpl(
      new URL('/site/oauth2/access_token', config.oauthBaseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.callbackUrl('bitbucket'),
        }),
      },
    );
    return this.token(response, config.clientId, config.clientSecret, 'Bitbucket');
  }

  private async exchangeJira(
    code: string,
    verifier: string,
    config: ReturnType<IntegrationOAuthService['jiraConfig']>,
  ): Promise<AtlassianCredential> {
    const response = await this.fetchImpl(new URL('/oauth/token', config.authBaseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: this.callbackUrl('jira'),
        code_verifier: verifier,
      }),
    });
    return this.token(response, config.clientId, config.clientSecret, 'Jira');
  }

  private async token(
    response: Response,
    clientId: string,
    clientSecret: string,
    provider: string,
  ): Promise<AtlassianCredential> {
    if (!response.ok) {
      throw new BadRequestException(`${provider} authorization-code exchange failed`);
    }
    const body = await response.json() as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof body.access_token !== 'string' || !body.access_token) {
      throw new BadRequestException(`${provider} token response was invalid`);
    }
    return {
      authType: 'oauth2',
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
      expiresAt: typeof body.expires_in === 'number'
        ? new Date(Date.now() + body.expires_in * 1_000).toISOString()
        : undefined,
      clientId,
      clientSecret,
    };
  }

  private async saveBitbucket(
    credential: AtlassianCredential,
    appUserId: string,
    oauth: ReturnType<IntegrationOAuthService['bitbucketConfig']>,
  ): Promise<void> {
    const config: BitbucketConnectionConfig = {
      deployment: 'cloud',
      apiBaseUrl: oauth.apiBaseUrl,
      gitBaseUrl: oauth.gitBaseUrl,
      oauthBaseUrl: oauth.oauthBaseUrl,
      webhookSecret: process.env.BITBUCKET_WEBHOOK_SECRET?.trim() || undefined,
    };
    const verified = await this.bitbucket.verifyConnection(credential, config);
    await this.store.saveBitbucket({
      externalAccountId: verified.account.uuid,
      displayName: verified.account.display_name,
      namespace: verified.workspace?.slug ?? null,
      baseUrl: config.apiBaseUrl,
      credential,
      config,
      connectedBy: appUserId,
      metadata: { deployment: 'cloud', authMode: 'oauth2' },
    });
  }

  private async saveJira(
    credential: AtlassianCredential,
    config: JiraConnectionConfig,
    site: JiraSite,
    appUserId: string,
  ): Promise<void> {
    const resolved = { ...config, cloudId: site.id, siteUrl: site.url };
    const verified = await this.jira.verifyConnection(credential, resolved);
    await this.store.saveJira({
      externalAccountId: site.id,
      displayName: site.name,
      namespace: site.url,
      baseUrl: site.url,
      credential,
      config: resolved,
      connectedBy: appUserId,
      metadata: {
        deployment: 'cloud',
        authMode: 'oauth2_3lo',
        accountId: verified.user.accountId ?? null,
      },
    });
  }

  private githubConfig() {
    return {
      appId: this.required('GITHUB_APP_ID'),
      appSlug: this.required('GITHUB_APP_SLUG'),
      privateKey: this.required('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n'),
      baseUrl: normalizeGitHubBaseUrl(process.env.GITHUB_BASE_URL),
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim() || undefined,
    };
  }

  private bitbucketConfig() {
    return {
      clientId: this.required('BITBUCKET_OAUTH_CLIENT_ID'),
      clientSecret: this.required('BITBUCKET_OAUTH_CLIENT_SECRET'),
      oauthBaseUrl: this.secureUrl(process.env.BITBUCKET_OAUTH_BASE_URL ?? 'https://bitbucket.org'),
      apiBaseUrl: this.secureUrl(process.env.BITBUCKET_API_BASE_URL ?? 'https://api.bitbucket.org/2.0'),
      gitBaseUrl: this.secureUrl(process.env.BITBUCKET_GIT_BASE_URL ?? 'https://bitbucket.org'),
    };
  }

  private jiraConfig() {
    return {
      clientId: this.required('JIRA_OAUTH_CLIENT_ID'),
      clientSecret: this.required('JIRA_OAUTH_CLIENT_SECRET'),
      authBaseUrl: this.secureUrl(process.env.JIRA_AUTH_BASE_URL ?? 'https://auth.atlassian.com'),
      apiGatewayBaseUrl: this.secureUrl(
        process.env.JIRA_API_GATEWAY_BASE_URL ?? 'https://api.atlassian.com',
      ),
    };
  }

  private jiraConnectionConfig(config: ReturnType<IntegrationOAuthService['jiraConfig']>): JiraConnectionConfig {
    return {
      deployment: 'cloud',
      authBaseUrl: config.authBaseUrl,
      apiGatewayBaseUrl: config.apiGatewayBaseUrl,
      webhookSecret: process.env.JIRA_WEBHOOK_SECRET?.trim() || undefined,
    };
  }

  private callbackUrl(provider: 'bitbucket' | 'jira'): string {
    return new URL(
      `/api/integrations/oauth/${provider}/callback`,
      `${this.publicOrigin()}/`,
    ).toString();
  }

  private resultUrl(
    returnPath: string,
    provider: string,
    status: 'success' | 'error' | 'pending',
    message: string,
    selectionState?: string,
  ): string {
    const url = new URL(returnPath, `${this.publicOrigin()}/`);
    url.searchParams.set('integration_provider', provider);
    url.searchParams.set('integration_status', status);
    url.searchParams.set('integration_message', message);
    if (selectionState) url.searchParams.set('integration_selection_state', selectionState);
    return url.toString();
  }

  private publicOrigin(): string {
    const value =
      process.env.INTEGRATION_PUBLIC_ORIGIN ??
      process.env.WEB_ORIGIN ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:8080';
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('INTEGRATION_PUBLIC_ORIGIN must be an HTTP(S) origin');
    }
    return url.origin;
  }

  private secureUrl(value: string): string {
    const url = new URL(value);
    if (
      (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && url.protocol === 'http:')) ||
      url.username ||
      url.password
    ) {
      throw new Error('Provider URL must be a credential-free HTTPS URL');
    }
    return url.toString().replace(/\/+$/, '');
  }

  private required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new BadRequestException(`${name} is not configured`);
    return value;
  }
}
