import { describe, expect, it } from 'vitest';
import {
  gitSourceConnectionId,
  gitSourceFromLegacy,
  providerFromDeployment,
} from './provider-config';

describe('source-control provider config', () => {
  it('gitSourceFromLegacy preserves old scratch-org source fields', () => {
    expect(
      gitSourceFromLegacy({
        azureProject: 'Core',
        azureRepo: 'metadata',
        azureBranch: 'main',
        azureManifestPath: 'manifest/package.xml',
      }),
    ).toEqual({
      provider: 'azure_devops',
      connectionId: undefined,
      bindingId: undefined,
      namespace: 'Core',
      project: 'Core',
      repositoryId: undefined,
      repo: 'metadata',
      branch: 'main',
      manifestPath: 'manifest/package.xml',
    });
  });

  it('providerFromDeployment reads canonical provider before legacy strategy', () => {
    expect(
      providerFromDeployment({
        strategy: 'azure',
        metadata: { gitSource: { provider: 'github' } },
      }),
    ).toBe('github');
    expect(providerFromDeployment({ strategy: 'azure' })).toBe('azure_devops');
  });

  it('gitSourceConnectionId omits only synthetic environment Azure connections', () => {
    expect(gitSourceConnectionId({
      id: 'environment-azure-devops',
      provider: 'azure_devops',
      source: 'environment',
    })).toBeUndefined();
    expect(gitSourceConnectionId({
      id: 'azure-db',
      provider: 'azure_devops',
      source: 'database',
    })).toBe('azure-db');
    expect(gitSourceConnectionId({
      id: 'github-app',
      provider: 'github',
      source: 'environment',
    })).toBe('github-app');
  });
});
