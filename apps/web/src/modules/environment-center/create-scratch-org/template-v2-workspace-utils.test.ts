import { describe, expect, it, vi } from 'vitest';
import type { AutomationRunView, ScratchOrgFormState } from '@/components/scratch-org/types';
import {
  buildTemplateLaunchRequest,
  canRequestServerLaunchPlan,
  completedRunAlias,
  formFromRunConfig,
  launchTargetFromRun,
  mergeFormIntoTemplatePreviewConfig,
  metadataSourceFromForm,
  retrieveCredentialsWithRetry,
  runtimeEmailPoolOverride,
} from './template-v2-workspace-utils';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';

describe('Template V2 launch and recovery contracts', () => {
  it('sends a typed runtime email-pool override without changing template config', () => {
    const form: ScratchOrgFormState = {
      devHubAlias: 'devhub',
      alias: 'review',
      duration: 7,
      template: 'config/project-scratch-def.json',
      description: '',
      azureProject: '',
      azureRepo: '',
      azureBranch: '',
      azureManifestPath: '',
      gitProvider: 'github',
      gitConnectionId: '',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '',
      customSettingsOrgId: '',
      runtimeEmailPool: 'ONE@example.com\n two@example.com ',
    };
    expect(runtimeEmailPoolOverride(form.runtimeEmailPool)).toEqual({
      emails: ['one@example.com', 'two@example.com'],
    });
    expect(buildTemplateLaunchRequest(form, { provider: 'github' }, true))
      .toMatchObject({
        mode: 'create_new',
        templateId: 'master-id',
        foundationTemplateId: 'foundation-id',
        runtimeEmailPoolOverride: {
          emails: ['one@example.com', 'two@example.com'],
        },
      });
  });

  it('uses the configure-existing launch contract without create-only fields', () => {
    const form = {
      devHubAlias: 'must-not-send',
      alias: 'must-not-send',
      duration: 7,
      template: 'must-not-send.json',
      description: '',
      azureProject: '',
      azureRepo: 'repo',
      azureBranch: 'main',
      azureManifestPath: 'manifest/package.xml',
      gitProvider: 'github',
      gitConnectionId: '',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;
    const payload = buildTemplateLaunchRequest(form, { provider: 'github' }, true, {
      mode: 'configure_existing',
      existingOrgConnectionId: 'target-id',
      existingOrgOptions: {
        verifyAuthentication: true,
        ensureRequiredPackage: false,
      },
    });
    expect(payload).toMatchObject({
      mode: 'configure_existing',
      existingOrgConnectionId: 'target-id',
      existingOrgOptions: {
        verifyAuthentication: true,
        ensureRequiredPackage: false,
      },
    });
    expect(payload).not.toHaveProperty('alias');
    expect(payload).not.toHaveProperty('devHubAlias');
    expect(payload).not.toHaveProperty('duration');
  });

  it('restores the create-new request contract after configure-existing mode', () => {
    const form = {
      devHubAlias: 'dev-hub',
      alias: 'preserved-create-draft',
      duration: 14,
      template: 'config/project-scratch-def.json',
      description: '',
      azureProject: '',
      azureRepo: '',
      azureBranch: '',
      azureManifestPath: 'manifest/package.xml',
      gitProvider: 'github',
      gitConnectionId: '',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;

    const payload = buildTemplateLaunchRequest(form, { provider: 'github' }, true, {
      mode: 'create_new',
      existingOrgConnectionId: 'stale-existing-target',
      existingOrgOptions: {
        verifyAuthentication: false,
        ensureRequiredPackage: false,
      },
    });

    expect(payload).toMatchObject({
      mode: 'create_new',
      alias: 'preserved-create-draft',
      devHubAlias: 'dev-hub',
      duration: 14,
    });
    expect(payload).not.toHaveProperty('existingOrgConnectionId');
    expect(payload).not.toHaveProperty('existingOrgOptions');
  });

  it('uses only the synchronous saved run alias for credential recovery', () => {
    expect(completedRunAlias({
      id: 'run',
      status: 'completed',
      config: { alias: 'saved-alias' } as never,
    })).toBe('saved-alias');
    expect(completedRunAlias({
      id: 'run',
      status: 'completed',
      config: {},
    } as AutomationRunView)).toBeUndefined();
  });

  it('hydrates metadata source from immutable run config without a session snapshot', () => {
    const fallback = {
      devHubAlias: 'current-hub',
      alias: '',
      duration: 7,
      template: 'current-definition.json',
      description: '',
      azureProject: 'Current',
      azureRepo: 'current-repo',
      azureBranch: 'develop',
      azureManifestPath: 'current-package.xml',
      gitProvider: 'azure_devops',
      gitConnectionId: 'current-connection',
      gitNamespace: 'Current',
      gitRepositoryId: 'current-repository-id',
      templateId: '',
      sourceOrgId: '',
      dataDeploymentOrgId: '',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;
    const restored = formFromRunConfig({
      id: 'run',
      status: 'running',
      config: {
        alias: 'persisted-alias',
        gitSource: {
          provider: 'github',
          connectionId: 'persisted-connection',
          namespace: 'saved-org',
          repositoryId: 'saved-repository-id',
          repo: 'saved-org/saved-repo',
          branch: 'release',
          manifestPath: 'manifest/saved.xml',
        },
      } as never,
    }, fallback);

    expect(metadataSourceFromForm(restored)).toEqual({
      provider: 'github',
      connectionId: 'persisted-connection',
      namespace: 'saved-org',
      project: 'saved-org',
      repositoryId: 'saved-repository-id',
      repo: 'saved-org/saved-repo',
      branch: 'release',
      manifestPath: 'manifest/saved.xml',
    });
  });

  it('hydrates configure-existing mode and target from immutable run config', () => {
    expect(launchTargetFromRun({
      id: 'run',
      status: 'running',
      launchMode: 'configure_existing',
      targetOrgConnectionId: 'database-target',
      config: {
        mode: 'configure_existing',
        existingOrgConnectionId: 'config-target',
        existingOrgOptions: {
          verifyAuthentication: false,
          ensureRequiredPackage: true,
        },
      },
    })).toEqual({
      mode: 'configure_existing',
      existingOrgConnectionId: 'config-target',
      existingOrgOptions: {
        verifyAuthentication: false,
        ensureRequiredPackage: true,
      },
    });
  });

  it('defers server launch-plan until git source and create fields are ready', () => {
    const templateConfig = {
      version: 2,
      customSettings: { enabled: false, mode: 'bundled' },
      pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
    } satisfies ScratchPipelineTemplateConfig;
    const form = {
      devHubAlias: 'devhub',
      alias: 'scratch',
      duration: 7,
      template: 'config/project-scratch-def.json',
      description: '',
      azureProject: '',
      azureRepo: 'repo',
      azureBranch: 'main',
      azureManifestPath: 'manifest/package.xml',
      gitProvider: 'azure_devops',
      gitConnectionId: 'conn',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;
    const gitSource = {
      provider: 'azure_devops' as const,
      repo: 'repo',
      branch: 'main',
    };

    expect(canRequestServerLaunchPlan(form, null, 'create_new', templateConfig)).toBe(false);
    expect(canRequestServerLaunchPlan(
      { ...form, alias: '' },
      gitSource,
      'create_new',
      templateConfig,
    )).toBe(false);
    expect(canRequestServerLaunchPlan(form, gitSource, 'create_new', templateConfig)).toBe(true);
  });

  it('defers server launch-plan until custom settings source org is selected', () => {
    const templateConfig = {
      version: 2,
      customSettings: { enabled: true, mode: 'master' },
      pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
    } satisfies ScratchPipelineTemplateConfig;
    const form = {
      devHubAlias: 'devhub',
      alias: 'scratch',
      duration: 7,
      template: 'config/project-scratch-def.json',
      description: '',
      azureProject: '',
      azureRepo: 'repo',
      azureBranch: 'main',
      azureManifestPath: 'manifest/package.xml',
      gitProvider: 'azure_devops',
      gitConnectionId: 'conn',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;
    const gitSource = {
      provider: 'azure_devops' as const,
      repo: 'repo',
      branch: 'main',
    };

    expect(canRequestServerLaunchPlan(form, gitSource, 'create_new', templateConfig)).toBe(false);
    expect(canRequestServerLaunchPlan(
      { ...form, dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111' },
      gitSource,
      'create_new',
      templateConfig,
    )).toBe(true);
    expect(mergeFormIntoTemplatePreviewConfig(templateConfig, {
      ...form,
      dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
    })).toMatchObject({
      dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
      customSettingsOrgId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('falls back customSettingsOrgId to the data deployment org in launch requests', () => {
    const form = {
      devHubAlias: 'devhub',
      alias: 'scratch',
      duration: 7,
      template: 'config/project-scratch-def.json',
      description: '',
      azureProject: '',
      azureRepo: 'repo',
      azureBranch: 'main',
      azureManifestPath: 'manifest/package.xml',
      gitProvider: 'azure_devops',
      gitConnectionId: 'conn',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;
    expect(buildTemplateLaunchRequest(form, { provider: 'azure_devops', repo: 'repo', branch: 'main' }, true))
      .toMatchObject({
        customSettingsOrgId: '11111111-1111-4111-8111-111111111111',
      });
  });

  it('allows configure-existing data-only launch plan without git source', () => {
    const templateConfig = {
      version: 2,
      customSettings: { enabled: true, mode: 'master' },
      pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
    } satisfies ScratchPipelineTemplateConfig;
    const form = {
      devHubAlias: 'devhub',
      alias: 'scratch',
      duration: 7,
      template: 'config/project-scratch-def.json',
      description: '',
      azureProject: '',
      azureRepo: '',
      azureBranch: 'main',
      azureManifestPath: 'manifest/package.xml',
      gitProvider: 'azure_devops',
      gitConnectionId: '',
      gitNamespace: '',
      gitRepositoryId: '',
      templateId: 'template-id',
      foundationTemplateId: 'foundation-id',
      dataTemplateId: 'master-id',
      pipelineScope: { sourceDeployment: false, dataDeployment: true },
      sourceOrgId: '',
      dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
      customSettingsOrgId: '',
      runtimeEmailPool: '',
    } satisfies ScratchOrgFormState;

    expect(canRequestServerLaunchPlan(
      form,
      null,
      'configure_existing',
      templateConfig,
      '22222222-2222-4222-8222-222222222222',
    )).toBe(true);
  });

  it('retries credentials a bounded number of times and succeeds before handling', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('not ready'))
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValue({ alias: 'saved-alias' });
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(retrieveCredentialsWithRetry('saved-alias', request, {
      attempts: 3,
      wait,
    })).resolves.toEqual({ alias: 'saved-alias' });
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
