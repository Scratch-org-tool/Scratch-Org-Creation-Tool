import { describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {}, Prisma: {} }));

import { ScratchTemplatesService } from './scratch-templates.service';

const templateId = '11111111-1111-4111-8111-111111111111';
const templateSource = '22222222-2222-4222-8222-222222222222';
const runtimeDataSource = '33333333-3333-4333-8333-333333333333';
const runtimeSettingsSource = '44444444-4444-4444-8444-444444444444';

describe('ScratchTemplatesService authoritative launch merge', () => {
  it('uses the stored template and lets runtime org and git selections override defaults', async () => {
    const service = new ScratchTemplatesService();
    vi.spyOn(service, 'get').mockResolvedValue({
      id: templateId,
      name: 'V2',
      description: null,
      isSystem: false,
      createdById: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        version: 2,
        duration: 7,
        dataDeploymentOrgId: templateSource,
        customSettingsOrgId: templateSource,
        gitSource: {
          provider: 'github',
          repo: 'template-repo',
          branch: 'template-branch',
          manifestPath: 'manifest/template.xml',
        },
        pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
      },
    } as never);

    const result = await service.resolveLaunch({
      templateId,
      alias: 'v2-scratch',
      devHubAlias: 'devhub',
      dataDeploymentOrgId: runtimeDataSource,
      customSettingsOrgId: runtimeSettingsSource,
      gitSource: {
        provider: 'bitbucket',
        connectionId: 'runtime-connection',
        repo: 'runtime-repo',
        branch: 'release',
        manifestPath: 'manifest/runtime.xml',
      },
      // A client-supplied nested template field must not replace stored config.
      pipelineSteps: { autoRunDataSeed: true, autoRunUsers: true },
    }, 'owner');

    expect(result.dataDeploymentOrgId).toBe(runtimeDataSource);
    expect(result.customSettingsOrgId).toBe(runtimeSettingsSource);
    expect(result.gitSource).toEqual(expect.objectContaining({
      provider: 'bitbucket',
      connectionId: 'runtime-connection',
      repo: 'runtime-repo',
      branch: 'release',
      manifestPath: 'manifest/runtime.xml',
    }));
    expect(result.duration).toBe(7);
    expect(result.pipelineSteps?.autoRunDataSeed).toBe(false);
  });

  it('disables system-template user auto-run when no concrete, slot, or generated users exist', () => {
    const result = new ScratchTemplatesService().mergeTemplateWithLaunch({
      pipelineSteps: { autoRunDataSeed: true, autoRunPartners: false, autoRunUsers: true },
      userProvisioning: { templates: [], slots: [] },
    }, {
      alias: 'empty',
      devHubAlias: 'devhub',
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    });
    expect(result.pipelineSteps.autoRunUsers).toBe(false);
  });
});
