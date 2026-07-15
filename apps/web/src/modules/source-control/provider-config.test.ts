import test from 'node:test';
import assert from 'node:assert/strict';
import { gitSourceFromLegacy, providerFromDeployment } from './provider-config';

test('gitSourceFromLegacy preserves old scratch-org source fields', () => {
  assert.deepEqual(
    gitSourceFromLegacy({
      azureProject: 'Core',
      azureRepo: 'metadata',
      azureBranch: 'main',
      azureManifestPath: 'manifest/package.xml',
    }),
    {
      provider: 'azure_devops',
      connectionId: undefined,
      bindingId: undefined,
      namespace: 'Core',
      project: 'Core',
      repositoryId: undefined,
      repo: 'metadata',
      branch: 'main',
      manifestPath: 'manifest/package.xml',
    },
  );
});

test('providerFromDeployment reads canonical provider before legacy strategy', () => {
  assert.equal(
    providerFromDeployment({
      strategy: 'azure',
      metadata: { gitSource: { provider: 'github' } },
    }),
    'github',
  );
  assert.equal(providerFromDeployment({ strategy: 'azure' }), 'azure_devops');
});
