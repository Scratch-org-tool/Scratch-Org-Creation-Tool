import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  scratchPipelineTemplate: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: prismaMock, Prisma: {} }));

import { ScratchTemplatesService } from './scratch-templates.service';
import {
  scratchPipelineTemplateConfigSchema,
  SYSTEM_SCRATCH_TEMPLATE_PRESETS,
} from '@sfcc/shared';

const templateId = '11111111-1111-4111-8111-111111111111';
const templateSource = '22222222-2222-4222-8222-222222222222';
const runtimeDataSource = '33333333-3333-4333-8333-333333333333';
const runtimeSettingsSource = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
});

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

  it('turns a disabled package setting into an executable worker skip', async () => {
    const service = new ScratchTemplatesService();
    vi.spyOn(service, 'get').mockResolvedValue({
      id: templateId,
      name: 'No package',
      config: {
        version: 2,
        installPackage: false,
        gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
        customSettings: { enabled: false },
        pipelineSteps: {
          autoRunDataSeed: false,
          autoRunPartners: false,
          autoRunUsers: false,
        },
      },
    } as never);

    const result = await service.resolveLaunch({
      templateId,
      alias: 'no-package',
      devHubAlias: 'devhub',
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner');

    expect(result.installPackage).toBe(false);
    expect(result.skipSteps).toContain('installPackages');
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
      runtimeEmailPoolOverride: {
        emails: ['runtime.one@example.com', 'runtime.two@example.com'],
      },
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
      runtimeEmailPoolOverride: { emails: 'not-an-array' },
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner')).rejects.toThrow('must be an array');
  });

  it('preserves authoritative existing-target mode without requiring create fields', async () => {
    const service = new ScratchTemplatesService();
    vi.spyOn(service, 'get').mockResolvedValue({
      id: templateId,
      name: 'Existing',
      config: {
        gitSource: { provider: 'github', repo: 'template-repo', branch: 'main' },
        pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
      },
    } as never);
    const result = await service.resolveLaunch({
      templateId,
      mode: 'configure_existing',
      existingOrgConnectionId: runtimeDataSource,
      gitSource: { provider: 'github', repo: 'runtime-repo', branch: 'main' },
    }, 'owner');
    expect(result).toEqual(expect.objectContaining({
      mode: 'configure_existing',
      existingOrgConnectionId: runtimeDataSource,
      existingOrgOptions: {
        verifyAuthentication: true,
        ensureRequiredPackage: true,
      },
    }));
  });

  it('blocks scoped data deployment until a runtime source org is selected', async () => {
    const foundationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const masterId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const service = new ScratchTemplatesService();
    vi.spyOn(service, 'get')
      .mockResolvedValueOnce({
        id: foundationId,
        config: {
          version: 2,
          customSettings: { enabled: false, mode: 'bundled' },
          pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
        },
      } as never)
      .mockResolvedValueOnce({
        id: masterId,
        config: {
          version: 2,
          customSettings: { enabled: true, mode: 'master' },
          pipelineSteps: {
            autoRunDataSeed: true,
            autoRunPartners: false,
            autoRunUsers: false,
          },
          dataSeed: { mode: 'automatic', datasets: ['Products'] },
        },
      } as never);

    await expect(service.resolveLaunch({
      foundationTemplateId: foundationId,
      dataTemplateId: masterId,
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      alias: 'missing-source',
      devHubAlias: 'devhub',
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner')).rejects.toThrow('custom settings source org is required');
  });

  it('composes foundation and master templates from scoped launch input', async () => {
    const foundationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const masterId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const service = new ScratchTemplatesService();
    const foundationConfig = {
      version: 2,
      installPackage: true,
      customSettings: { enabled: false, mode: 'bundled' },
      pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
    };
    const masterConfig = {
      version: 2,
      customSettings: { enabled: true, mode: 'master' },
      orgConfig: { upsertQueueIds: true },
      pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
    };
    vi.spyOn(service, 'get')
      .mockResolvedValueOnce({ id: foundationId, config: foundationConfig } as never)
      .mockResolvedValueOnce({ id: masterId, config: masterConfig } as never);

    const result = await service.resolveLaunch({
      foundationTemplateId: foundationId,
      dataTemplateId: masterId,
      pipelineScope: { sourceDeployment: true, dataDeployment: true },
      alias: 'scoped',
      devHubAlias: 'devhub',
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
      dataDeploymentOrgId: runtimeDataSource,
      customSettingsOrgId: runtimeSettingsSource,
    }, 'owner');

    expect(result.foundationTemplateId).toBe(foundationId);
    expect(result.dataTemplateId).toBe(masterId);
    expect(result.customSettings).toEqual({ enabled: true, mode: 'master' });
    expect(result.orgConfig?.upsertQueueIds).toBe(true);
    expect(result.dataDeploymentOrgId).toBe(runtimeDataSource);
  });

  it('allows data-only scoped launch without git source', async () => {
    const foundationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const masterId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const service = new ScratchTemplatesService();
    vi.spyOn(service, 'get')
      .mockResolvedValueOnce({
        id: foundationId,
        config: {
          version: 2,
          customSettings: { enabled: false, mode: 'bundled' },
          pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
        },
      } as never)
      .mockResolvedValueOnce({
        id: masterId,
        config: {
          version: 2,
          customSettings: { enabled: true, mode: 'master' },
          pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
        },
      } as never);

    const result = await service.resolveLaunch({
      foundationTemplateId: foundationId,
      dataTemplateId: masterId,
      pipelineScope: { sourceDeployment: false, dataDeployment: true },
      mode: 'configure_existing',
      existingOrgConnectionId: runtimeDataSource,
      dataDeploymentOrgId: runtimeDataSource,
      customSettingsOrgId: runtimeSettingsSource,
    }, 'owner');

    expect(result.gitSource).toBeUndefined();
    expect(result.customSettings?.enabled).toBe(true);
    expect(result.skipSteps).toEqual(expect.arrayContaining(['deployMetadata', 'assignPermissions']));
  });
});

describe('ScratchTemplatesService system presets', () => {
  it('defines exactly two valid system configurations', () => {
    expect(SYSTEM_SCRATCH_TEMPLATE_PRESETS).toHaveLength(2);
    expect(
      SYSTEM_SCRATCH_TEMPLATE_PRESETS.map((preset) =>
        scratchPipelineTemplateConfigSchema.safeParse(preset.config).success),
    ).toEqual([true, true]);
  });

  it('removes legacy presets and upserts the two keyed presets in order', async () => {
    prismaMock.scratchPipelineTemplate.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.scratchPipelineTemplate.upsert.mockResolvedValue({});

    await new ScratchTemplatesService().onModuleInit();

    expect(prismaMock.scratchPipelineTemplate.deleteMany).toHaveBeenCalledWith({
      where: { isSystem: true, systemKey: null },
    });
    expect(prismaMock.scratchPipelineTemplate.deleteMany).toHaveBeenCalledWith({
      where: {
        isSystem: true,
        systemKey: { in: ['data-deployment-queries', 'config-seed-account-partners'] },
      },
    });
    expect(prismaMock.scratchPipelineTemplate.upsert).toHaveBeenCalledTimes(2);
    expect(
      prismaMock.scratchPipelineTemplate.upsert.mock.calls.map(([request]) => ({
        key: request.create.systemKey,
        order: request.create.sortOrder,
      })),
    ).toEqual(
      SYSTEM_SCRATCH_TEMPLATE_PRESETS.map((preset) => ({
        key: preset.key,
        order: preset.sortOrder,
      })),
    );
  });

  it('does not overwrite edited default content during a later bootstrap', async () => {
    prismaMock.scratchPipelineTemplate.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.scratchPipelineTemplate.upsert.mockResolvedValue({});

    await new ScratchTemplatesService().onModuleInit();

    for (const [request] of prismaMock.scratchPipelineTemplate.upsert.mock.calls) {
      expect(request.update).not.toHaveProperty('name');
      expect(request.update).not.toHaveProperty('description');
      expect(request.update).not.toHaveProperty('config');
    }
  });

  it('allows a system default to be edited while retaining its system identity', async () => {
    prismaMock.scratchPipelineTemplate.findUnique.mockResolvedValue({
      id: templateId,
      name: 'Scratch Org & Source Deployment',
      description: null,
      isSystem: true,
      systemKey: 'scratch-source-deployment',
      sortOrder: 1,
      createdById: null,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.scratchPipelineTemplate.update.mockResolvedValue({
      id: templateId,
      name: 'Edited foundation',
    });

    await new ScratchTemplatesService().update(
      templateId,
      { name: 'Edited foundation' },
      'environment-user',
    );

    expect(prismaMock.scratchPipelineTemplate.update).toHaveBeenCalledWith({
      where: { id: templateId },
      data: {
        name: 'Edited foundation',
      },
    });
  });
});
