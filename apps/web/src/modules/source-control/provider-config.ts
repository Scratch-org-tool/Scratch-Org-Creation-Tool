import type { GitSourceConfig, ScmProvider } from '@sfcc/shared';

export const SCM_PROVIDER_LABELS: Record<ScmProvider, string> = {
  azure_devops: 'Azure DevOps',
  github: 'GitHub',
  bitbucket: 'Bitbucket Cloud',
};

export const SCM_PROVIDER_SHORT_LABELS: Record<ScmProvider, string> = {
  azure_devops: 'Azure',
  github: 'GitHub',
  bitbucket: 'Bitbucket',
};

export function gitSourceFromLegacy(
  value?: Partial<GitSourceConfig> & {
    azureProject?: string;
    azureRepo?: string;
    azureBranch?: string;
    azureManifestPath?: string;
  },
): Partial<GitSourceConfig> {
  if (!value) return {};
  return {
    provider: value.provider ?? 'azure_devops',
    connectionId: value.connectionId,
    bindingId: value.bindingId,
    namespace: value.namespace ?? value.azureProject,
    project: value.project ?? value.azureProject,
    repositoryId: value.repositoryId,
    repo: value.repo ?? value.azureRepo,
    branch: value.branch ?? value.azureBranch,
    manifestPath: value.manifestPath ?? value.azureManifestPath,
  };
}

export function providerFromDeployment(deployment: {
  provider?: string | null;
  strategy?: string | null;
  metadata?: { provider?: string | null; gitSource?: { provider?: string | null } } | null;
}): ScmProvider | null {
  const provider =
    deployment.provider ??
    deployment.metadata?.provider ??
    deployment.metadata?.gitSource?.provider ??
    (deployment.strategy === 'azure' ? 'azure_devops' : null);
  return provider === 'azure_devops' || provider === 'github' || provider === 'bitbucket'
    ? provider
    : null;
}
