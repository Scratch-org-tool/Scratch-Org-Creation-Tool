import { describe, expect, it, vi } from 'vitest';
import type { AutomationRunView, ScratchOrgFormState } from '@/components/scratch-org/types';
import {
  buildTemplateLaunchRequest,
  completedRunAlias,
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
        templateId: 'template-id',
        runtimeEmailPoolOverride: {
          emails: ['one@example.com', 'two@example.com'],
        },
      });
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
