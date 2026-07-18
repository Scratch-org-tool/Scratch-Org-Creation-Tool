import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { azureGitBranchesUrl, azureGitReposUrl, DEFAULT_AZURE_MANIFEST_PATH, normalizeAzureOrgSlug, normalizeAzureProject } from '@sfcc/shared';
import { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import { removeTempDir } from '../../common/temp-cleanup.util';
import { resolveSfdxWorkspace } from '../../common/sfdx-workspace.util';
import { IntegrationError, type IntegrationErrorCode } from '../foundation/adapter.errors';

const execFileAsync = promisify(execFile);

export interface AzurePipelineVariables {
  targetOrgAlias: string;
  targetOrgUsername: string;
  instanceUrl: string;
}

@Injectable()
export class AzureService {
  constructor(private readonly azureIntegration: AzureIntegrationService) {}

  getDefaults() {
    return {
      project: process.env.AZURE_DEFAULT_PROJECT ?? '',
      repo: process.env.AZURE_DEFAULT_REPO ?? '',
      branch: process.env.AZURE_DEFAULT_BRANCH ?? 'main',
      manifestPath: process.env.AZURE_DEFAULT_MANIFEST_PATH ?? DEFAULT_AZURE_MANIFEST_PATH,
    };
  }

  private authHeader(pat: string) {
    return { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` };
  }

  private resolveProject(
    creds: { project?: string },
    project?: string,
  ): string | undefined {
    return project?.trim() || creds.project || process.env.AZURE_DEFAULT_PROJECT || undefined;
  }

  /** Lists repos org-wide unless an explicit project filter is passed. */
  async listRepos(projectFilter?: string, connectionId?: string) {
    const creds = await this.azureIntegration.getCredentials(connectionId, 'scm');
    if (!creds) return [];
    const project = projectFilter?.trim() || undefined;
    return this.fetchAllRepos(creds.orgSlug, creds.pat, project);
  }

  private async fetchAllRepos(orgSlug: string, pat: string, project?: string) {
    const headers = this.authHeader(pat);
    const all: Array<{ id: string; name: string; project: string; url: string }> = [];
    let url: string | null = azureGitReposUrl(orgSlug, project, 'api-version=7.0&$top=100');

    while (url) {
      const res: Response = await fetch(url, { headers });
      if (!res.ok) break;
      const data = await res.json() as {
        value: Array<{ id: string; name: string; webUrl: string; project?: { name: string } }>;
      };
      const fallbackProject = project ?? '';
      for (const r of data.value ?? []) {
        all.push({
          id: r.id,
          name: r.name,
          project: r.project?.name ?? fallbackProject,
          url: r.webUrl,
        });
      }
      const token: string | null = res.headers.get('x-ms-continuationtoken');
      if (!token) break;
      const base = azureGitReposUrl(orgSlug, project, 'api-version=7.0&$top=100');
      url = `${base}&continuationToken=${encodeURIComponent(token)}`;
    }

    return all;
  }

  async listBranches(project: string | undefined, repo: string, connectionId?: string) {
    const creds = await this.azureIntegration.getCredentials(connectionId, 'scm');
    if (!creds || !repo.trim()) return [];

    let proj = this.resolveProject(creds, project);
    if (!proj) {
      const repos = await this.listRepos(undefined, connectionId);
      const match = repos.find((r) => r.name === repo || r.id === repo);
      proj = match?.project;
    }
    if (!proj) return [];

    const headers = this.authHeader(creds.pat);
    const base = azureGitBranchesUrl(
      creds.orgSlug,
      proj,
      repo,
      'filter=heads/&api-version=7.0&$top=1000',
    );
    const branches: string[] = [];
    const seenTokens = new Set<string>();
    let url: string | null = base;

    while (url) {
      const res: Response = await fetch(url, { headers });
      if (!res.ok) {
        const code: IntegrationErrorCode =
          res.status === 401
            ? 'authentication_failed'
            : res.status === 403
              ? 'authorization_failed'
              : res.status === 404
                ? 'not_found'
                : res.status === 429
                  ? 'rate_limited'
                  : 'provider_unavailable';
        throw new IntegrationError(
          code,
          `Azure DevOps could not list branches (HTTP ${res.status})`,
          {
            provider: 'azure_devops',
            retryable: res.status === 429 || res.status >= 500,
            statusCode: res.status,
          },
        );
      }
      const data = await res.json() as { value?: Array<{ name?: string }> };
      for (const ref of data.value ?? []) {
        if (ref.name?.startsWith('refs/heads/')) {
          branches.push(ref.name.slice('refs/heads/'.length));
        }
      }
      const token = res.headers.get('x-ms-continuationtoken');
      if (!token) break;
      if (seenTokens.has(token)) {
        throw new IntegrationError(
          'provider_unavailable',
          'Azure DevOps returned a repeated branch continuation token',
          { provider: 'azure_devops', retryable: true },
        );
      }
      seenTokens.add(token);
      url = `${base}&continuationToken=${encodeURIComponent(token)}`;
    }

    return [...new Set(branches)];
  }

  async checkoutRepo(
    project: string,
    repo: string,
    branch: string,
    connectionId?: string,
  ): Promise<{ workspaceDir: string; cleanup: () => Promise<void> }> {
    const creds = await this.azureIntegration.getCredentials(connectionId, 'scm');
    if (!creds) throw new Error('Azure DevOps is not connected');

    const org = normalizeAzureOrgSlug(creds.orgSlug);
    const proj = normalizeAzureProject(project) ?? normalizeAzureProject(creds.project);
    if (!proj) throw new Error('Azure project is required to checkout the repository');

    const workspaceDir = await mkdtemp(join(tmpdir(), 'sfcc-azure-'));
    const pat = encodeURIComponent(creds.pat);
    const cloneUrl =
      `https://${pat}@dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}` +
      `/_git/${encodeURIComponent(repo)}`;

    try {
      await execFileAsync(
        'git',
        ['clone', '-b', branch, '--single-branch', '--depth', '1', cloneUrl, workspaceDir],
        {
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
          timeout: 900_000,
        },
      );
    } catch (err) {
      await rm(workspaceDir, { recursive: true, force: true });
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to clone ${repo}@${branch} from Azure DevOps. ` +
          'Check repo name, branch, and PAT Code (Read) scope. ' +
          message,
      );
    }

    return {
      workspaceDir,
      cleanup: () => removeTempDir(workspaceDir),
    };
  }

  prepareManifestDeploy(
    workspaceDir: string,
    manifestPath: string,
  ): { projectRoot: string; manifestRelative: string } {
    return resolveSfdxWorkspace(workspaceDir, manifestPath);
  }

  async triggerPipeline(
    project: string,
    repo: string,
    branch: string,
    variables?: AzurePipelineVariables,
    connectionId?: string,
  ) {
    if (!(await this.azureIntegration.getCredentials(connectionId, 'scm'))) {
      throw new Error('Azure DevOps is not connected');
    }
    console.log('[Azure] Pipeline trigger (stub)', { project, repo, branch, variables });
    return { triggered: true, repo, branch, project, provider: 'azure', variables };
  }
}
