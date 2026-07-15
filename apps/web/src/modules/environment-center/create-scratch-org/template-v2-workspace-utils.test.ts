import { describe, expect, it, vi } from 'vitest';
import type { AutomationRunView, ScratchOrgFormState } from '@/components/scratch-org/types';
import {
  buildTemplateLaunchRequest,
  completedRunAlias,
  formFromRunConfig,
  launchTargetFromRun,
  metadataSourceFromForm,
  retrieveCredentialsWithRetry,
  runtimeEmailPoolOverride,
} from './template-v2-workspace-utils';

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
        templateId: 'template-id',
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
