import { Inject, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import type {
  GitSourceConfig,
  Namespace,
  Repository,
  ScmConnectionStatus,
} from '@sfcc/shared';
import { removeTempDir } from '../../common/temp-cleanup.util';
import {
  type AdapterContext,
  type CheckoutResult,
  type RepositoryQuery,
  type ScmAdapter,
} from '../foundation/adapter.contracts';
import { IntegrationError } from '../foundation/adapter.errors';
import { GitHubApiClient } from './github-api.client';
import { GitHubAuthService } from './github-auth.service';
import { GitHubIntegrationService } from './github-integration.service';
import { normalizeGitHubBaseUrl, type GitHubCredentials } from './github.types';

type ExecFileLike = (
  file: string,
  args: readonly string[],
  options: {
    env: NodeJS.ProcessEnv;
    timeout: number;
    windowsHide: boolean;
  },
) => Promise<unknown>;

export const GITHUB_EXEC_FILE = Symbol('GITHUB_EXEC_FILE');

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string | null;
  owner: { id: number; login: string; html_url?: string };
}

const CAPABILITIES = {
  repositories: true,
  branches: true,
  checkout: true,
  pipelines: false,
  pullRequests: false,
  webhooks: true,
} as const;

@Injectable()
export class GitHubCheckoutService {
  constructor(
    private readonly auth: GitHubAuthService,
    @Inject(GITHUB_EXEC_FILE) private readonly exec: ExecFileLike,
  ) {}

  async checkout(
    credentials: GitHubCredentials,
    owner: string,
    repository: string,
    branch: string,
  ): Promise<CheckoutResult> {
    this.validateSegment(owner, 'owner');
    this.validateSegment(repository, 'repository');
    if (!branch.trim() || branch.startsWith('-') || /[\0\r\n]/.test(branch)) {
      throw new IntegrationError('invalid_request', 'Invalid GitHub branch name', {
        provider: 'github',
      });
    }
    const token = await this.auth.getToken(credentials);
    const workspaceDir = await mkdtemp(join(tmpdir(), 'sfcc-github-workspace-'));
    const credentialDir = await mkdtemp(join(tmpdir(), 'sfcc-github-credentials-'));
    const askPassPath = join(credentialDir, 'askpass.sh');
    const cloneUrl =
      `${normalizeGitHubBaseUrl(credentials.baseUrl)}/` +
      `${encodeURIComponent(owner)}/${encodeURIComponent(repository)}.git`;

    try {
      await writeFile(
        askPassPath,
        '#!/bin/sh\ncase "$1" in *Username*) printf "%s\\n" "x-access-token";; *) printf "%s\\n" "$GITHUB_ASKPASS_TOKEN";; esac\n',
        { encoding: 'utf8', mode: 0o700 },
      );
      await chmod(askPassPath, 0o700);
      await this.exec(
        'git',
        [
          'clone',
          '--branch',
          branch,
          '--single-branch',
          '--depth',
          '1',
          '--',
          cloneUrl,
          workspaceDir,
        ],
        {
          env: {
            ...process.env,
            GIT_ASKPASS: askPassPath,
            GIT_TERMINAL_PROMPT: '0',
            GITHUB_ASKPASS_TOKEN: token.token,
            GIT_CONFIG_COUNT: '1',
            GIT_CONFIG_KEY_0: 'credential.helper',
            GIT_CONFIG_VALUE_0: '',
          },
          timeout: 900_000,
          windowsHide: true,
        },
      );
    } catch (cause) {
      await rm(workspaceDir, { recursive: true, force: true });
      throw new IntegrationError(
        'provider_unavailable',
        `Failed to clone ${owner}/${repository}@${branch} from GitHub`,
        { provider: 'github', cause },
      );
    } finally {
      // The only file/environment containing the clone credential is gone before this method returns.
      await rm(credentialDir, { recursive: true, force: true });
    }
    return {
      workspaceDir,
      cleanup: () => removeTempDir(workspaceDir),
    };
  }

  private validateSegment(value: string, label: string): void {
    if (!/^[A-Za-z0-9_.-]+$/.test(value) || value.startsWith('-') || value === '.' || value === '..') {
      throw new IntegrationError('invalid_request', `Invalid GitHub ${label}`, {
        provider: 'github',
      });
    }
  }
}

@Injectable()
export class GitHubScmAdapter implements ScmAdapter {
  readonly provider = 'github' as const;
  readonly capabilities = CAPABILITIES;

  constructor(
    private readonly integration: GitHubIntegrationService,
    private readonly api: GitHubApiClient,
    private readonly checkoutService: GitHubCheckoutService,
  ) {}

  async getConnectionStatus(context: AdapterContext = {}): Promise<ScmConnectionStatus> {
    const status = await this.integration.getStatus(context.connectionId);
    return {
      id: status.connectionId ?? undefined,
      provider: this.provider,
      state:
        status.state === 'error'
          ? 'error'
          : status.state === 'degraded'
            ? 'degraded'
            : status.connected
              ? 'connected'
              : 'disconnected',
      connected: status.connected,
      source: status.source,
      displayName: status.account,
      namespace: status.account,
      error: null,
      connectedAt: status.connectedAt,
      lastVerifiedAt: status.lastVerifiedAt,
      capabilities: this.capabilities,
    };
  }

  async listNamespaces(context: AdapterContext = {}): Promise<Namespace[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const repositories = await this.installationRepositories(credentials);
    const owners = new Map<string, Namespace>();
    for (const repository of repositories) {
      owners.set(repository.owner.login.toLowerCase(), {
        id: String(repository.owner.id),
        name: repository.owner.login,
        slug: repository.owner.login,
        url: repository.owner.html_url ?? `${credentials.baseUrl}/${repository.owner.login}`,
      });
    }
    return [...owners.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async listRepositories(query: RepositoryQuery = {}): Promise<Repository[]> {
    const credentials = await this.requireCredentials(query.connectionId);
    const namespace = query.namespace?.toLowerCase();
    return (await this.installationRepositories(credentials))
      .filter((repository) => !namespace || repository.owner.login.toLowerCase() === namespace)
      .map((repository) => ({
        id: String(repository.id),
        name: repository.name,
        fullName: repository.full_name,
        namespace: repository.owner.login,
        defaultBranch: repository.default_branch,
        url: repository.html_url,
        isPrivate: repository.private,
      }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  async listBranches(source: GitSourceConfig): Promise<string[]> {
    this.assertSource(source);
    const credentials = await this.requireCredentials(source.connectionId);
    const { owner, repo } = this.repositoryRef(source);
    const branches = await this.api.paginate<{ name: string }>(
      credentials,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
    );
    return branches.map((branch) => branch.name);
  }

  async checkout(source: GitSourceConfig): Promise<CheckoutResult> {
    this.assertSource(source);
    const credentials = await this.requireCredentials(source.connectionId);
    const { owner, repo } = this.repositoryRef(source);
    return this.checkoutService.checkout(credentials, owner, repo, source.branch);
  }

  private installationRepositories(credentials: GitHubCredentials): Promise<GitHubRepository[]> {
    return this.api.paginate<GitHubRepository>(credentials, '/installation/repositories');
  }

  private async requireCredentials(connectionId?: string): Promise<GitHubCredentials> {
    const credentials = await this.integration.getCredentials(connectionId);
    if (!credentials) {
      throw new IntegrationError('not_connected', 'GitHub is not connected', {
        provider: this.provider,
      });
    }
    return credentials;
  }

  private repositoryRef(source: GitSourceConfig): { owner: string; repo: string } {
    const split = source.repo.split('/');
    if (split.length === 2) return { owner: split[0], repo: split[1] };
    const owner = source.namespace ?? source.project;
    if (!owner) {
      throw new IntegrationError('invalid_request', 'GitHub repository owner is required', {
        provider: this.provider,
      });
    }
    return { owner, repo: source.repo };
  }

  private assertSource(source: GitSourceConfig): void {
    if (source.provider !== this.provider) {
      throw new IntegrationError(
        'invalid_request',
        `GitHub adapter cannot handle provider "${source.provider}"`,
        { provider: this.provider },
      );
    }
  }
}

export const defaultGitHubExecFile: ExecFileLike = promisify(execFile) as ExecFileLike;
