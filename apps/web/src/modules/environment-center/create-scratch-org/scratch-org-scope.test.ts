import { describe, expect, it } from 'vitest';
import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import {
  buildTemplateLaunchRequest,
  defaultPipelineScopeForMode,
} from './template-v2-workspace-utils';

const baseForm = {
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
  templateId: 'legacy-id',
  foundationTemplateId: 'foundation-id',
  dataTemplateId: 'master-id',
  sourceOrgId: '',
  dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
  customSettingsOrgId: '',
  runtimeEmailPool: '',
} satisfies Omit<ScratchOrgFormState, 'pipelineScope'>;

describe('scratch org deployment scope', () => {
  it('defaults create-new scope to foundation plus master data', () => {
    expect(defaultPipelineScopeForMode('create_new')).toEqual({
      sourceDeployment: true,
      dataDeployment: true,
    });
  });

  it('defaults configure-existing scope to source-only until toggled', () => {
    expect(defaultPipelineScopeForMode('configure_existing')).toEqual({
      sourceDeployment: true,
      dataDeployment: false,
    });
  });

  it('omits git source from launch payload when configure-existing source deployment is off', () => {
    const request = buildTemplateLaunchRequest(
      {
        ...baseForm,
        pipelineScope: { sourceDeployment: false, dataDeployment: true },
      },
      { provider: 'azure_devops', repo: 'repo', branch: 'main' },
      false,
      {
        mode: 'configure_existing',
        existingOrgConnectionId: '22222222-2222-4222-8222-222222222222',
      },
    );
    expect(request.pipelineScope).toEqual({
      sourceDeployment: false,
      dataDeployment: true,
    });
    expect(request.gitSource).toBeUndefined();
    expect(request.foundationTemplateId).toBe('foundation-id');
    expect(request.dataTemplateId).toBe('master-id');
  });

  it('omits master template id when data deployment is off', () => {
    const request = buildTemplateLaunchRequest(
      {
        ...baseForm,
        pipelineScope: { sourceDeployment: true, dataDeployment: false },
      },
      { provider: 'azure_devops', repo: 'repo', branch: 'main' },
      true,
    );
    expect(request.dataTemplateId).toBeUndefined();
    expect(request.gitSource).toEqual(expect.objectContaining({ repo: 'repo' }));
  });
});
