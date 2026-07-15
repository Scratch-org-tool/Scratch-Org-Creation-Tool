import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GitSourceConfig,
  Namespace,
  Repository,
  ScmConnectionStatus,
} from '@sfcc/shared';
import { execFile } from 'child_process';
import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import type {
  AdapterContext,
  CheckoutResult,
  RepositoryQuery,
  ScmAdapter,
} from '../foundation/adapter.contracts';
import { IntegrationError } from '../foundation/adapter.errors';
import { AtlassianConnectionStore } from '../atlassian/atlassian-connection.store';
import {
  ATLASSIAN_FETCH,
  AtlassianHttpClient,
  collectPages,
  type FetchLike,
} from '../atlassian/atlassian-http.client';
import {
  assertCloud,
  type AtlassianCredential,
  type BitbucketConnectionConfig,
  type StoredAtlassianConnection,
} from '../atlassian/atlassian.types';

const execFileAsync = promisify(execFile);
export const BITBUCKET_EXEC_FILE = Symbol('BITBUCKET_EXEC_FILE');
export type BitbucketExecFile = (
  file: string,
  args: readonly string[],
  options: {
    env: NodeJS.ProcessEnv;
    maxBuffer: number;
  },
) => Promise<unknown>;

const BITBUCKET_CAPABILITIES = {
  repositories: true,
  branches: true,
  checkout: true,
  pipelines: false,
  pullRequests: false,
  webhooks: true,
} as const;

interface BitbucketUser {
  uuid: string;
  display_name: string;
  username?: string;
  nickname?: string;
  links?: { html?: { href?: string } };
}

interface BitbucketWorkspace {
  uuid: string;
  name: string;
  slug: string;
  links?: { html?: { href?: string } };
}

interface BitbucketRepository {
  uuid: string;
  name: string;
  full_name: string;
  is_private?: boolean;
  mainbranch?: { name?: string } | null;
  workspace?: { slug?: string };
  links?: {
    html?: { href?: string };
    clone?: Array<{ name?: string; href?: string }>;
  };
}

interface BitbucketPage<T> {
  values?: T[];
  next?: string;
}

@Injectable()
export class BitbucketScmAdapter implements ScmAdapter {
  readonly provider = 'bitbucket' as const;
  readonly capabilities = BITBUCKET_CAPABILITIES;

  constructor(
    private readonly store: AtlassianConnectionStore,
    @Optional() @Inject(ATLASSIAN_FETCH) fetchImpl?: FetchLike,
    @Optional() @Inject(BITBUCKET_EXEC_FILE) exec?: BitbucketExecFile,
  ) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.exec = exec ?? ((file, args, options) => execFileAsync(file, [...args], options));
  }

  private readonly fetchImpl: FetchLike;
  private readonly exec: BitbucketExecFile;

  async verifyConnection(
    credential: AtlassianCredential,
    config: BitbucketConnectionConfig,
  ): Promise<{ account: BitbucketUser; workspace: BitbucketWorkspace | null }> {
    assertCloud(config.deployment);
    const client = this.client(credential, config);
    const account = await client.json<BitbucketUser>('user');
    const workspace = config.workspace
      ? await client.json<BitbucketWorkspace>(
          `workspaces/${encodeURIComponent(config.workspace)}`,
        )
      : null;
    return { account, workspace };
  }

  async getConnectionStatus(context: AdapterContext = {}): Promise<ScmConnectionStatus> {
    const stored = await this.store.getBitbucket(context.connectionId);
    const connection = stored ? await this.refreshConnection(stored) : null;
    if (!connection) {
      return {
        provider: this.provider,
        state: 'disconnected',
        connected: false,
        source: null,
        displayName: null,
        namespace: null,
        error: null,
        capabilities: this.capabilities,
      };
    }
    try {
      await this.verifyConnection(connection.credential, connection.config);
      return this.status(connection, 'connected', null);
    } catch (error) {
      return this.status(
        connection,
        'degraded',
        error instanceof Error ? error.message : 'Verification failed',
      );
    }
  }

  async listNamespaces(context: AdapterContext = {}): Promise<Namespace[]> {
    const connection = await this.requireConnection(context.connectionId);
    const client = this.connectionClient(connection);
    const workspaces = await collectPages<BitbucketWorkspace>(
      'workspaces?pagelen=100',
      (url) => client.json<BitbucketPage<BitbucketWorkspace>>(url),
    );
    return workspaces.map((workspace) => ({
      id: workspace.uuid,
      name: workspace.name,
      slug: workspace.slug,
      url: workspace.links?.html?.href ?? null,
    }));
  }

  async listRepositories(query: RepositoryQuery = {}): Promise<Repository[]> {
    const connection = await this.requireConnection(query.connectionId);
    const client = this.connectionClient(connection);
    const workspace = query.namespace ?? query.project ?? connection.config.workspace;
    const first = workspace
      ? `repositories/${encodeURIComponent(workspace)}?pagelen=100`
      : 'repositories?role=member&pagelen=100';
    const repositories = await collectPages<BitbucketRepository>(
      first,
      (url) => client.json<BitbucketPage<BitbucketRepository>>(url),
    );
    return repositories.map((repository) => ({
      id: repository.uuid,
      name: repository.name,
      fullName: repository.full_name,
      namespace: repository.workspace?.slug ?? repository.full_name.split('/')[0] ?? '',
      defaultBranch: repository.mainbranch?.name ?? null,
      url: repository.links?.html?.href ?? null,
      isPrivate: repository.is_private ?? true,
    }));
  }

  async listBranches(source: GitSourceConfig): Promise<string[]> {
    this.assertSource(source);
    const connection = await this.requireConnection(source.connectionId);
    const workspace = source.namespace ?? source.project ?? connection.config.workspace;
    if (!workspace) {
      throw new IntegrationError('invalid_request', 'Bitbucket workspace is required', {
        provider: this.provider,
      });
    }
    const repo = this.repositorySlug(source.repo);
    const client = this.connectionClient(connection);
    const branches = await collectPages<{ name: string }>(
      `repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}/refs/branches?pagelen=100`,
      (url) => client.json<BitbucketPage<{ name: string }>>(url),
    );
    return branches.map((branch) => branch.name);
  }

  async checkout(source: GitSourceConfig): Promise<CheckoutResult> {
    this.assertSource(source);
    const connection = await this.requireConnection(source.connectionId);
    assertCloud(connection.config.deployment);
    const workspace = source.namespace ?? source.project ?? connection.config.workspace;
    if (!workspace) {
      throw new IntegrationError('invalid_request', 'Bitbucket workspace is required', {
        provider: this.provider,
      });
    }
    const gitBase = new URL(connection.config.gitBaseUrl);
    if (gitBase.protocol !== 'https:') {
      throw new IntegrationError(
        'invalid_request',
        'Bitbucket checkout requires an HTTPS git base URL',
        { provider: this.provider },
      );
    }
    const repo = this.repositorySlug(source.repo);
    const cloneUrl = new URL(
      `${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}.git`,
      `${gitBase.toString().replace(/\/+$/, '')}/`,
    ).toString();
    const authDir = await mkdtemp(join(tmpdir(), 'sfcc-bitbucket-auth-'));
    const workspaceDir = await mkdtemp(join(tmpdir(), 'sfcc-bitbucket-checkout-'));
    const askpass = join(authDir, 'askpass.sh');
    const gitCredential =
      connection.credential.authType === 'oauth2'
        ? { username: 'x-token-auth', password: connection.credential.accessToken }
        : {
            username: connection.credential.email,
            password: connection.credential.apiToken,
          };
    try {
      await writeFile(
        askpass,
        '#!/bin/sh\ncase "$1" in *sername*) printf "%s\\n" "$SFCC_GIT_USERNAME" ;; *) printf "%s\\n" "$SFCC_GIT_PASSWORD" ;; esac\n',
        { mode: 0o700 },
      );
      await chmod(askpass, 0o700);
      await this.exec(
        'git',
        ['clone', '--depth', '1', '--single-branch', '--branch', source.branch, '--', cloneUrl, workspaceDir],
        {
          env: {
            ...process.env,
            GIT_ASKPASS: askpass,
            GIT_TERMINAL_PROMPT: '0',
            GIT_CONFIG_COUNT: '2',
            GIT_CONFIG_KEY_0: 'credential.helper',
            GIT_CONFIG_VALUE_0: '',
            GIT_CONFIG_KEY_1: 'core.askPass',
            GIT_CONFIG_VALUE_1: askpass,
            SFCC_GIT_USERNAME: gitCredential.username,
            SFCC_GIT_PASSWORD: gitCredential.password,
          },
          maxBuffer: 10 * 1024 * 1024,
        },
      );
    } catch (cause) {
      await rm(workspaceDir, { recursive: true, force: true });
      throw new IntegrationError('provider_unavailable', 'Bitbucket checkout failed', {
        provider: this.provider,
        retryable: true,
        cause,
      });
    } finally {
      await rm(authDir, { recursive: true, force: true });
    }
    let cleaned = false;
    return {
      workspaceDir,
      cleanup: async () => {
        if (cleaned) return;
        cleaned = true;
        await rm(workspaceDir, { recursive: true, force: true });
      },
    };
  }

  private async requireConnection(
    connectionId?: string,
  ): Promise<StoredAtlassianConnection<BitbucketConnectionConfig>> {
    const connection = await this.store.getBitbucket(connectionId);
    if (!connection) {
      throw new IntegrationError('not_connected', 'No Bitbucket connection is configured', {
        provider: this.provider,
      });
    }
    assertCloud(connection.config.deployment);
    return this.refreshConnection(connection);
  }

  private async refreshConnection(
    connection: StoredAtlassianConnection<BitbucketConnectionConfig>,
  ): Promise<StoredAtlassianConnection<BitbucketConnectionConfig>> {
    const credential = connection.credential;
    if (
      credential.authType !== 'oauth2' ||
      !credential.expiresAt ||
      Date.parse(credential.expiresAt) > Date.now() + 60_000
    ) {
      return connection;
    }
    if (!credential.refreshToken || !credential.clientId || !credential.clientSecret) {
      throw new IntegrationError(
        'authentication_failed',
        'Bitbucket OAuth token expired and cannot be refreshed',
        { provider: this.provider, retryable: false },
      );
    }
    const response = await this.fetchImpl(
      `${connection.config.oauthBaseUrl.replace(/\/+$/, '')}/site/oauth2/access_token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${credential.clientId}:${credential.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credential.refreshToken,
        }),
      },
    );
    if (!response.ok) {
      throw new IntegrationError(
        'authentication_failed',
        `Bitbucket OAuth refresh failed (${response.status})`,
        { provider: this.provider, statusCode: response.status, retryable: false },
      );
    }
    const token = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) {
      throw new IntegrationError('authentication_failed', 'Bitbucket OAuth refresh returned no token', {
        provider: this.provider,
      });
    }
    const refreshed: AtlassianCredential = {
      ...credential,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? credential.refreshToken,
      expiresAt:
        typeof token.expires_in === 'number'
          ? new Date(Date.now() + token.expires_in * 1_000).toISOString()
          : undefined,
    };
    await this.store.updateBitbucketCredential(connection.id, refreshed, connection.config);
    return { ...connection, credential: refreshed };
  }

  private connectionClient(connection: StoredAtlassianConnection<BitbucketConnectionConfig>) {
    return this.client(connection.credential, connection.config);
  }

  private client(credential: AtlassianCredential, config: BitbucketConnectionConfig) {
    return new AtlassianHttpClient({
      provider: this.provider,
      baseUrl: config.apiBaseUrl,
      credential,
      fetch: this.fetchImpl,
    });
  }

  private status(
    connection: StoredAtlassianConnection<BitbucketConnectionConfig>,
    state: 'connected' | 'degraded',
    error: string | null,
  ): ScmConnectionStatus {
    return {
      id: connection.id,
      provider: this.provider,
      state,
      connected: state === 'connected',
      source: 'database',
      displayName: connection.displayName,
      namespace: connection.namespace,
      error,
      connectedAt: connection.connectedAt,
      lastVerifiedAt: connection.lastVerifiedAt,
      capabilities: this.capabilities,
    };
  }

  private repositorySlug(repo: string): string {
    const slug = repo.split('/').filter(Boolean).at(-1)?.replace(/\.git$/i, '');
    if (!slug) {
      throw new IntegrationError('invalid_request', 'Bitbucket repository is required', {
        provider: this.provider,
      });
    }
    return slug;
  }

  private assertSource(source: GitSourceConfig): void {
    if (source.provider !== this.provider) {
      throw new IntegrationError(
        'invalid_request',
        `Bitbucket adapter cannot handle provider "${source.provider}"`,
        { provider: this.provider },
      );
    }
  }
}
