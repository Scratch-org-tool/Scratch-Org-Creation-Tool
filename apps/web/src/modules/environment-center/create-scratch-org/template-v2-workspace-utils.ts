import type { AutomationRunView, ScratchOrgFormState } from '@/components/scratch-org/types';
import type { ScratchCredentials } from './types';
import { parseRuntimeEmailPool } from './template-v2-runtime';

export function formFromRunConfig(
  run: AutomationRunView,
  fallback: ScratchOrgFormState,
): ScratchOrgFormState {
  const cfg = run.config as Record<string, unknown> | undefined;
  if (!cfg) return fallback;
  const azure = cfg.azureDeploy as
    | { project?: string; repo?: string; branch?: string; manifestPath?: string }
    | undefined;
  const git = cfg.gitSource as
    | {
        provider?: ScratchOrgFormState['gitProvider'];
        connectionId?: string;
        namespace?: string;
        project?: string;
        repositoryId?: string;
        repo?: string;
        branch?: string;
        manifestPath?: string;
      }
    | undefined;
  const scratchJob = run.jobs?.find((job) => job.type === 'scratch_org_workflow');
  const alias =
    (scratchJob && 'alias' in scratchJob ? (scratchJob as { alias?: string }).alias : undefined)
    ?? (cfg.alias as string | undefined);
  return {
    ...fallback,
    alias: alias ?? fallback.alias,
    duration: (cfg.duration as number | undefined) ?? fallback.duration,
    devHubAlias: (cfg.devHubAlias as string | undefined) ?? fallback.devHubAlias,
    template: (cfg.template as string | undefined) ?? fallback.template,
    description: (cfg.description as string | undefined) ?? fallback.description,
    sourceOrgId: (cfg.sourceOrgId as string | undefined) ?? fallback.sourceOrgId,
    dataDeploymentOrgId:
      (cfg.dataDeploymentOrgId as string | undefined)
      ?? (cfg.sourceOrgId as string | undefined)
      ?? fallback.dataDeploymentOrgId,
    customSettingsOrgId:
      (cfg.customSettingsOrgId as string | undefined)
      ?? fallback.customSettingsOrgId,
    runtimeEmailPool: fallback.runtimeEmailPool,
    templateId: (cfg.templateId as string | undefined) ?? fallback.templateId,
    gitProvider: git?.provider ?? (azure ? 'azure_devops' : fallback.gitProvider),
    gitConnectionId: git?.connectionId ?? fallback.gitConnectionId,
    gitNamespace: git?.namespace ?? git?.project ?? azure?.project ?? fallback.gitNamespace,
    gitRepositoryId: git?.repositoryId ?? fallback.gitRepositoryId,
    azureProject: git?.project ?? git?.namespace ?? azure?.project ?? fallback.azureProject,
    azureRepo: git?.repo ?? azure?.repo ?? fallback.azureRepo,
    azureBranch: git?.branch ?? azure?.branch ?? fallback.azureBranch,
    azureManifestPath: git?.manifestPath ?? azure?.manifestPath ?? fallback.azureManifestPath,
  };
}

export function metadataSourceFromForm(form: ScratchOrgFormState) {
  return {
    provider: form.gitProvider,
    connectionId: form.gitConnectionId,
    namespace: form.gitNamespace,
    project: form.azureProject,
    repositoryId: form.gitRepositoryId,
    repo: form.azureRepo,
    branch: form.azureBranch,
    manifestPath: form.azureManifestPath,
  };
}

export function runtimeEmailPoolOverride(value: string): { emails: string[] } | undefined {
  if (!value.trim()) return undefined;
  return { emails: parseRuntimeEmailPool(value) };
}

export function completedRunAlias(run: AutomationRunView): string | undefined {
  const alias = (run.config as { alias?: unknown } | undefined)?.alias;
  return typeof alias === 'string' && alias.trim() ? alias : undefined;
}

export function buildTemplateLaunchRequest(
  form: ScratchOrgFormState,
  gitSource: unknown,
  installPackage: boolean,
): Record<string, unknown> {
  return {
    alias: form.alias,
    duration: form.duration,
    devHubAlias: form.devHubAlias,
    description: form.description || undefined,
    sourceOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    dataDeploymentOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    customSettingsOrgId: form.customSettingsOrgId || undefined,
    templateId: form.templateId || undefined,
    gitSource,
    installPackage,
    runtimeEmailPoolOverride: runtimeEmailPoolOverride(form.runtimeEmailPool),
  };
}

export async function retrieveCredentialsWithRetry(
  alias: string,
  request: (alias: string) => Promise<ScratchCredentials>,
  options: { attempts?: number; delayMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<ScratchCredentials> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 500;
  const wait = options.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request(alias);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await wait(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}
