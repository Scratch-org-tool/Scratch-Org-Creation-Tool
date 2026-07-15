import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gitSourceConfigSchema,
  normalizeGitSourceConfig,
  normalizePipelineCheckpointAliases,
  scmConnectionStatusSchema,
  workItemDetailSchema,
} from './integrations.js';
import { deployNowSchema, scratchOrgPipelineSchema } from './schemas/index.js';

test('canonical provider schemas accept all supported providers', () => {
  for (const provider of ['azure_devops', 'github', 'bitbucket'] as const) {
    assert.equal(gitSourceConfigSchema.parse({ provider, repo: 'repo', branch: 'main' }).provider, provider);
  }
});

test('connection status DTO strips credential material', () => {
  const status = scmConnectionStatusSchema.parse({
    provider: 'azure_devops',
    state: 'connected',
    connected: true,
    source: 'database',
    displayName: 'Acme',
    namespace: 'acme',
    error: null,
    capabilities: {
      repositories: true,
      branches: true,
      checkout: true,
      pipelines: true,
      pullRequests: false,
      webhooks: false,
    },
    pat: 'plaintext-must-not-leak',
    encryptedCredentials: 'ciphertext-must-not-leak',
  });
  assert.equal('pat' in status, false);
  assert.equal('encryptedCredentials' in status, false);
});

test('normalized work-item detail has provider-neutral identifiers', () => {
  const detail = workItemDetailSchema.parse({
    id: '42',
    provider: 'jira',
    project: { id: 'p1', key: 'ENG', name: 'Engineering' },
    title: 'Fix deploy',
    type: 'Bug',
    state: { id: 'open', name: 'Open', category: 'new' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    url: 'https://example.test/browse/ENG-42',
  });
  assert.equal(detail.id, '42');
  assert.deepEqual(detail.labels, []);
  assert.deepEqual(detail.relations, []);
});

test('legacy Azure source and checkpoint names normalize without data loss', () => {
  const config = normalizeGitSourceConfig({
    azureDeploy: {
      project: 'Core',
      repo: 'metadata',
      branch: 'main',
      manifestPath: 'manifest/package.xml',
    },
  });
  assert.deepEqual(config.gitSource, {
    provider: 'azure_devops',
    project: 'Core',
    namespace: 'Core',
    repo: 'metadata',
    branch: 'main',
    manifestPath: 'manifest/package.xml',
  });
  assert.equal(config.azureDeploy.repo, 'metadata');

  const checkpoint = normalizePipelineCheckpointAliases({
    completedSteps: ['scratch_org_create', 'azure_metadata_deploy'],
    resumeFrom: 'azure_metadata_deploy',
    deploymentId: 'dep-1',
  });
  assert.deepEqual(checkpoint.completedSteps, ['scratch_org_create', 'git_metadata_deploy']);
  assert.equal(checkpoint.resumeFrom, 'git_metadata_deploy');
  assert.equal(checkpoint.legacyResumeFrom, 'azure_metadata_deploy');
  assert.equal(checkpoint.deploymentId, 'dep-1');
});

test('legacy scratch pipeline payloads are persisted with canonical gitSource', () => {
  const parsed = scratchOrgPipelineSchema.parse({
    alias: 'foundation-test',
    devHubAlias: 'dev-hub',
    azureDeploy: {
      project: 'Core',
      repo: 'metadata',
      branch: 'main',
    },
  });
  assert.equal(parsed.azureDeploy?.repo, 'metadata');
  assert.deepEqual(parsed.gitSource, {
    provider: 'azure_devops',
    project: 'Core',
    namespace: 'Core',
    repo: 'metadata',
    branch: 'main',
    manifestPath: undefined,
  });
});

test('canonical deploy payloads support every SCM provider and binding context', () => {
  for (const provider of ['azure_devops', 'github', 'bitbucket'] as const) {
    const parsed = deployNowSchema.parse({
      targetOrgId: 'f93ef78c-6881-490f-91a5-2e66ab64d740',
      gitSource: {
        provider,
        connectionId: `${provider}-connection`,
        bindingId: `${provider}-binding`,
        namespace: 'acme',
        repo: 'metadata',
        branch: 'main',
        manifestPath: 'manifest/package.xml',
      },
    });
    assert.equal(parsed.gitSource?.provider, provider);
    assert.equal(parsed.gitSource?.bindingId, `${provider}-binding`);
    assert.equal(parsed.repo, 'metadata');
  }
});

test('canonical source wins safely when a dual legacy payload is submitted', () => {
  const parsed = deployNowSchema.parse({
    targetOrgId: 'f93ef78c-6881-490f-91a5-2e66ab64d740',
    gitSource: {
      provider: 'github',
      namespace: 'acme',
      repo: 'canonical',
      branch: 'main',
    },
    azureDeploy: {
      project: 'Legacy',
      repo: 'legacy',
      branch: 'old',
    },
  });
  assert.equal(parsed.gitSource?.provider, 'github');
  assert.equal(parsed.repo, 'canonical');
  assert.equal(parsed.branch, 'main');
});
