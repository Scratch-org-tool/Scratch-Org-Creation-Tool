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
  async listRepos(projectFilter?: string) {
    const creds = await this.azureIntegration.getCredentials();
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

  async listBranches(project: string | undefined, repo: string) {
    const creds = await this.azureIntegration.getCredentials();
    if (!creds || !repo.trim()) return [];

    let proj = this.resolveProject(creds, project);
    if (!proj) {
      const repos = await this.listRepos();
      const match = repos.find((r) => r.name === repo || r.id === repo);
      proj = match?.project;
    }
    if (!proj) return [];

    const url = azureGitBranchesUrl(creds.orgSlug, proj, repo);
    const res = await fetch(url, { headers: this.authHeader(creds.pat) });
    if (!res.ok) return [];
    const data = await res.json() as { value: Array<{ name: string }> };
    return data.value.map((r) => r.name.replace('refs/heads/', ''));
  }

  async checkoutRepo(
    project: string,
    repo: string,
    branch: string,
  ): Promise<{ workspaceDir: string; cleanup: () => Promise<void> }> {
    const creds = await this.azureIntegration.getCredentials();
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
  ) {
    console.log('[Azure] Pipeline trigger (stub)', { project, repo, branch, variables });
    return { triggered: true, repo, branch, project, provider: 'azure', variables };
  }
}
