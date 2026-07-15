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

  it('keeps an explicit template custom-settings source when only runtime data is selected', () => {
    const result = new ScratchTemplatesService().mergeTemplateWithLaunch({
      dataDeploymentOrgId: templateSource,
      customSettingsOrgId: runtimeSettingsSource,
    }, {
      alias: 'sources',
      devHubAlias: 'devhub',
      dataDeploymentOrgId: runtimeDataSource,
      sourceOrgId: runtimeDataSource,
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    });
    expect(result.dataDeploymentOrgId).toBe(runtimeDataSource);
    expect(result.customSettingsOrgId).toBe(runtimeSettingsSource);
  });

  it('validates and applies runtime email pools after server-side V2 migration', async () => {
    const service = new ScratchTemplatesService();
    vi.spyOn(service, 'get').mockResolvedValue({
      id: templateId,
      name: 'Email pool',
      config: {
        gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
        userProvisioning: {
          teams: [{
            id: 'sales',
            emailPool: { emails: ['template@example.com'] },
          }],
          userGenerators: [{
            id: 'sales-users',
            count: 1,
            role: 'Rep',
            bottler: '5000',
            teamId: 'sales',
          }],
        },
      },
    } as never);

    const result = await service.resolveLaunch({
      templateId,
      alias: 'pool',
      devHubAlias: 'devhub',
      runtimeEmailPool: 'runtime.one@example.com\nruntime.two@example.com',
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner');
    expect(result.userProvisioning?.teams?.[0].emailPool.emails).toEqual([
      'runtime.one@example.com',
      'runtime.two@example.com',
    ]);

    await expect(service.resolveLaunch({
      templateId,
      alias: 'pool',
      devHubAlias: 'devhub',
      runtimeEmailPool: ['not', 'a string'],
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner')).rejects.toThrow('must be a string');
  });
});
