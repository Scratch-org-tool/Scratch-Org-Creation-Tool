import type { GitSourceConfig, PipelineScope, ScratchPipelineTemplateConfig } from '@sfcc/shared';
import {
  composePipelineConfig,
  DEFAULT_CONFIGURE_EXISTING_PIPELINE_SCOPE,
  DEFAULT_CREATE_PIPELINE_SCOPE,
  pipelineScopeRequiresDataSource,
  pipelineScopeRequiresGitSource,
  resolvePipelineScope,
} from '@sfcc/shared';
import type {
  AutomationRunView,
  ExistingOrgOptions,
  ScratchOrgFormState,
  ScratchOrgLaunchMode,
} from '@/components/scratch-org/types';
import type { ScratchCredentials } from './types';
import { parseRuntimeEmailPool } from './template-v2-runtime';

function dataSourceOrgIdFromForm(form: ScratchOrgFormState): string {
  return form.dataDeploymentOrgId || form.sourceOrgId || '';
}

export function defaultPipelineScopeForMode(mode: ScratchOrgLaunchMode): PipelineScope {
  return mode === 'configure_existing'
    ? { ...DEFAULT_CONFIGURE_EXISTING_PIPELINE_SCOPE }
    : { ...DEFAULT_CREATE_PIPELINE_SCOPE };
}

export function mergeFormIntoTemplatePreviewConfig(
  templateConfig: ScratchPipelineTemplateConfig,
  form: ScratchOrgFormState,
): ScratchPipelineTemplateConfig {
  const dataSourceOrgId = dataSourceOrgIdFromForm(form) || undefined;
  return {
    ...templateConfig,
    sourceOrgId: dataSourceOrgId,
    dataDeploymentOrgId: dataSourceOrgId,
    customSettingsOrgId: form.customSettingsOrgId || dataSourceOrgId,
    pipelineScope: form.pipelineScope,
  };
}

/** Avoids launch-plan 400s while the wizard is still missing required runtime inputs. */
export function canRequestServerLaunchPlan(
  form: ScratchOrgFormState,
  gitSource: GitSourceConfig | null,
  mode: ScratchOrgLaunchMode,
  templateConfig: ScratchPipelineTemplateConfig,
  existingOrgConnectionId?: string,
): boolean {
  const scope = resolvePipelineScope(form.pipelineScope, mode);
  if (pipelineScopeRequiresGitSource(scope) && !gitSource) return false;
  if (!form.foundationTemplateId) return false;
  if (mode === 'create_new') {
    if (!form.alias.trim() || !form.devHubAlias.trim()) return false;
  } else if (!existingOrgConnectionId) {
    return false;
  }
  if (!scope.sourceDeployment && !scope.dataDeployment) return false;

  if (!pipelineScopeRequiresDataSource(scope)) return true;

  const dataSourceOrgId = dataSourceOrgIdFromForm(form);
  const customSettingsOrgId = form.customSettingsOrgId || dataSourceOrgId;
  if (templateConfig.customSettings?.enabled === true && !customSettingsOrgId) return false;
  if (templateConfig.pipelineSteps?.autoRunDataSeed && templateConfig.dataSeed && !dataSourceOrgId) {
    return false;
  }
  if (
    templateConfig.pipelineSteps?.autoRunPartners
    && templateConfig.partnerImport?.enabled
    && templateConfig.partnerImport.mode !== 'excel'
    && !dataSourceOrgId
  ) {
    return false;
  }
  const hasUsers = Boolean(
    templateConfig.userProvisioning?.users?.length
    || templateConfig.userProvisioning?.slots?.length
    || templateConfig.userProvisioning?.userGenerators?.length,
  );
  if (templateConfig.pipelineSteps?.autoRunUsers && hasUsers && !dataSourceOrgId) {
    return false;
  }
  return true;
}

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
  const mode = (cfg.mode as ScratchOrgLaunchMode | undefined) ?? 'create_new';
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
    foundationTemplateId:
      (cfg.foundationTemplateId as string | undefined) ?? fallback.foundationTemplateId,
    dataTemplateId: (cfg.dataTemplateId as string | undefined) ?? fallback.dataTemplateId,
    pipelineScope: resolvePipelineScope(
      cfg.pipelineScope as PipelineScope | undefined,
      mode,
    ),
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
  target: {
    mode?: ScratchOrgLaunchMode;
    existingOrgConnectionId?: string;
    existingOrgOptions?: ExistingOrgOptions;
  } = {},
): Record<string, unknown> {
  const mode = target.mode ?? 'create_new';
  const scope = resolvePipelineScope(
    mode === 'create_new'
      ? { sourceDeployment: true, dataDeployment: form.pipelineScope.dataDeployment }
      : form.pipelineScope,
    mode,
  );
  const requiresGit = pipelineScopeRequiresGitSource(scope);
  return {
    mode,
    ...(mode === 'create_new'
      ? {
          alias: form.alias,
          duration: form.duration,
          devHubAlias: form.devHubAlias,
        }
      : {
          existingOrgConnectionId: target.existingOrgConnectionId,
          existingOrgOptions: target.existingOrgOptions,
        }),
    description: form.description || undefined,
    sourceOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    dataDeploymentOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    customSettingsOrgId:
      form.customSettingsOrgId || form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    foundationTemplateId: form.foundationTemplateId || undefined,
    dataTemplateId: scope.dataDeployment ? form.dataTemplateId || undefined : undefined,
    templateId: form.dataTemplateId || form.foundationTemplateId || form.templateId || undefined,
    pipelineScope: scope,
    gitSource: requiresGit ? gitSource : undefined,
    installPackage,
    runtimeEmailPoolOverride: runtimeEmailPoolOverride(form.runtimeEmailPool),
  };
}

export function composeClientTemplateMeta(
  foundation: { id: string; name: string; config: ScratchPipelineTemplateConfig },
  master: { id: string; name: string; config: ScratchPipelineTemplateConfig } | null,
  scope: PipelineScope,
): { name: string; config: ScratchPipelineTemplateConfig } {
  const composed = composePipelineConfig({
    foundation: foundation.config,
    master: scope.dataDeployment ? master?.config : undefined,
    scope,
  });
  const name = scope.dataDeployment && master
    ? `${foundation.name} + ${master.name}`
    : foundation.name;
  return { name, config: composed };
}

export function launchTargetFromRun(run: AutomationRunView): {
  mode: ScratchOrgLaunchMode;
  existingOrgConnectionId: string;
  existingOrgOptions: ExistingOrgOptions;
} {
  const config = run.config;
  const mode = config?.mode
    ?? run.launchMode
    ?? run.checkpoint?.launchMode
    ?? 'create_new';
  return {
    mode,
    existingOrgConnectionId:
      config?.existingOrgConnectionId
      ?? run.targetOrgConnectionId
      ?? run.checkpoint?.targetOrgConnectionId
      ?? '',
    existingOrgOptions: config?.existingOrgOptions ?? {
      verifyAuthentication: true,
      ensureRequiredPackage: true,
    },
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
