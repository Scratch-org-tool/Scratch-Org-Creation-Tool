import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  orgConnection: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  scratchOrg: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  automationRun: { findMany: vi.fn() },
}));
vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { ExistingScratchOrgService } from './existing-scratch-org.service';
import { ScratchOrgPreparationService } from './scratch-org-preparation.service';
import { EnvironmentController } from './environment.controller';
import { ROLE_KEY } from '../../common/role.guard';

const targetId = '11111111-1111-4111-8111-111111111111';
const target = {
  id: targetId,
  alias: 'existing',
  username: 'existing@scratch.example',
  orgId: '00Dscratch',
  instanceUrl: 'https://example.scratch.my.salesforce.com',
  status: 'active',
  type: 'scratch',
  expiresAt: new Date('2099-08-01T00:00:00Z'),
  createdBy: 'owner',
};
const devHub = {
  ...target,
  id: '22222222-2222-4222-8222-222222222222',
  alias: 'devhub',
  username: 'devhub@example.com',
  orgId: '00Ddevhub',
  type: 'prod',
  isDevHub: true,
  expiresAt: null,
};
const liveOrg = {
  alias: target.alias,
  username: target.username,
  orgId: target.orgId,
  instanceUrl: target.instanceUrl,
  expirationDate: '2099-08-01T00:00:00Z',
  connectedStatus: 'Connected',
  status: 'Active',
  devHubUsername: 'devhub@example.com',
};
const config = {
  mode: 'configure_existing',
  existingOrgConnectionId: targetId,
  existingOrgOptions: {
    verifyAuthentication: true,
    ensureRequiredPackage: true,
  },
  duration: 30,
  template: 'config/project-scratch-def.json',
  definitionFile: 'config/project-scratch-def.json',
  skipSteps: [],
  gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
} as const;

function createService(overrides?: {
  resolveLaunch?: ReturnType<typeof vi.fn>;
  sfCli?: Record<string, unknown>;
}) {
  const preparation = new ScratchOrgPreparationService();
  (preparation as unknown as { sfCli: Record<string, unknown> }).sfCli =
    overrides?.sfCli ?? {
      listOrgs: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { scratchOrgs: [liveOrg] } },
      }),
      displayOrg: vi.fn().mockResolvedValue({
        success: true,
        data: { result: liveOrg },
      }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [{ SubscriberPackageVersionId: '04t4x000000IcRT' }] },
      }),
    };
  return new ExistingScratchOrgService(
    { resolveLaunch: overrides?.resolveLaunch ?? vi.fn().mockResolvedValue(config) } as never,
    { requireActive: vi.fn().mockResolvedValue(config.gitSource) } as never,
    preparation,
  );
}

describe('ExistingScratchOrgService eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue(target);
    db.scratchOrg.findUnique.mockResolvedValue({
      ...target,
      expirationDate: target.expiresAt,
      status: 'Active',
      devHubAlias: 'dev-hub',
    });
    db.automationRun.findMany.mockResolvedValue([]);
  });

  it('returns target and required/skipped steps for an eligible org', async () => {
    const result = await createService().eligibility(config, 'owner');
    expect(result.eligible).toBe(true);
    expect(result.target).toEqual(expect.objectContaining({ id: targetId, alias: 'existing' }));
    expect(result.config).toEqual(expect.objectContaining({ alias: 'existing' }));
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ step: 'authentication', status: 'required' }),
      expect.objectContaining({ step: 'required_package', status: 'skipped' }),
    ]));
  });

  it('does not disclose another caller’s target', async () => {
    const result = await createService().eligibility(config, 'other');
    expect(result.eligible).toBe(false);
    expect(result.errors).toContain('Existing scratch org target was not found');
  });

  it('rejects expired and authentication-failed targets', async () => {
    db.orgConnection.findUnique.mockResolvedValue({
      ...target,
      expiresAt: new Date('2026-01-01T00:00:00Z'),
    });
    let result = await createService().eligibility(config, 'owner');
    expect(result.errors.join(' ')).toContain('expiration is missing or has passed');

    db.orgConnection.findUnique.mockResolvedValue(target);
    result = await createService({
      sfCli: {
        listOrgs: vi.fn().mockResolvedValue({
          success: true,
          data: { result: { scratchOrgs: [liveOrg] } },
        }),
        displayOrg: vi.fn().mockResolvedValue({ success: false, error: 'CLI auth expired' }),
      },
    }).eligibility(config, 'owner');
    expect(result.errors.join(' ')).toContain('not authenticated');
  });

  it('requires a matching caller-owned ScratchOrg row and live proof even when verification is false', async () => {
    db.scratchOrg.findUnique.mockResolvedValueOnce(null);
    let result = await createService().eligibility(config, 'owner');
    expect(result.eligible).toBe(false);
    expect(result.errors.join(' ')).toContain('association was not found');

    const listOrgs = vi.fn().mockResolvedValue({
      success: true,
      data: { result: { scratchOrgs: [liveOrg] } },
    });
    const displayOrg = vi.fn().mockResolvedValue({
      success: true,
      data: { result: liveOrg },
    });
    result = await createService({ sfCli: {
      listOrgs,
      displayOrg,
      listInstalledPackages: vi.fn().mockResolvedValue({ success: true, data: { result: [] } }),
    } }).eligibility({
      ...config,
      existingOrgOptions: {
        verifyAuthentication: false,
        ensureRequiredPackage: false,
      },
    }, 'owner');
    expect(result.eligible).toBe(true);
    expect(listOrgs).toHaveBeenCalled();
    expect(displayOrg).toHaveBeenCalled();
    expect(result.steps).toContainEqual(expect.objectContaining({
      step: 'authentication',
      status: 'required',
    }));
  });

  it('rejects a ScratchOrg row whose username or org ID differs from its connection', async () => {
    db.scratchOrg.findUnique.mockResolvedValue({
      ...target,
      username: 'different@scratch.example',
      expirationDate: target.expiresAt,
      status: 'Active',
      devHubAlias: 'dev-hub',
    });
    const result = await createService().eligibility(config, 'owner');
    expect(result.eligible).toBe(false);
    expect(result.errors.join(' ')).toContain('alias, username, and org ID');
  });

  it('returns the conflicting target run id', async () => {
    db.automationRun.findMany.mockResolvedValue([{
      id: 'run-active',
      targetOrgConnectionId: targetId,
      checkpoint: {},
    }]);
    const result = await createService().eligibility(config, 'owner');
    expect(result.eligible).toBe(false);
    expect(result.conflictRunId).toBe('run-active');
  });

  it('blocks create-new launches before queueing when enabled data steps lack sources', async () => {
    db.orgConnection.findUnique.mockImplementation(({ where }: {
      where: { alias?: string; id?: string };
    }) =>
      Promise.resolve(where.alias === 'devhub' ? devHub : target));
    const createConfig = {
      ...config,
      mode: 'create_new',
      alias: 'new-scratch',
      devHubAlias: 'devhub',
      existingOrgConnectionId: undefined,
      customSettings: { enabled: true, mode: 'bundled' },
      pipelineSteps: {
        autoRunDataSeed: true,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    } as const;
    const result = await createService({
      resolveLaunch: vi.fn().mockResolvedValue(createConfig),
    }).eligibility(createConfig, 'owner');

    expect(result.eligible).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('custom settings source org'),
      expect.stringContaining('data deployment source org'),
    ]));
  });

  it('requires configured create-new source orgs to remain active', async () => {
    db.orgConnection.findUnique.mockImplementation(({ where }: {
      where: { alias?: string; id?: string };
    }) =>
      Promise.resolve(where.alias === 'devhub'
        ? devHub
        : { ...target, status: 'revoked' }));
    const createConfig = {
      ...config,
      mode: 'create_new',
      alias: 'new-scratch',
      devHubAlias: 'devhub',
      existingOrgConnectionId: undefined,
      customSettings: { enabled: true, mode: 'bundled' },
      customSettingsOrgId: targetId,
      pipelineSteps: {
        autoRunDataSeed: false,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    } as const;
    const result = await createService({
      resolveLaunch: vi.fn().mockResolvedValue(createConfig),
    }).eligibility(createConfig, 'owner');

    expect(result.eligible).toBe(false);
    expect(result.errors).toContain('Source org "existing" is not active');
  });

  it('requires an active caller-owned Dev Hub before create-new launch', async () => {
    db.orgConnection.findUnique.mockResolvedValue(null);
    const createConfig = {
      ...config,
      mode: 'create_new',
      alias: 'new-scratch',
      devHubAlias: 'missing-hub',
      existingOrgConnectionId: undefined,
      customSettings: { enabled: false },
      pipelineSteps: {
        autoRunDataSeed: false,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    } as const;
    const result = await createService({
      resolveLaunch: vi.fn().mockResolvedValue(createConfig),
    }).eligibility(createConfig, 'owner');

    expect(result.eligible).toBe(false);
    expect(result.errors).toContain('Dev Hub "missing-hub" was not found');
  });

  it('performs live CLI authentication checks for create-new Dev Hubs and sources', async () => {
    db.orgConnection.findUnique.mockImplementation(({ where }: {
      where: { alias?: string; id?: string };
    }) => Promise.resolve(where.alias === 'devhub' ? devHub : target));
    const displayOrg = vi.fn().mockImplementation((alias: string) => Promise.resolve(
      alias === devHub.username
        ? { success: true, data: { result: { alias: 'devhub' } } }
        : { success: false, error: 'source token expired' },
    ));
    const createConfig = {
      ...config,
      mode: 'create_new',
      alias: 'new-scratch',
      devHubAlias: 'devhub',
      existingOrgConnectionId: undefined,
      customSettings: { enabled: true, mode: 'bundled' },
      customSettingsOrgId: targetId,
      pipelineSteps: {
        autoRunDataSeed: false,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    } as const;

    const result = await createService({
      resolveLaunch: vi.fn().mockResolvedValue(createConfig),
      sfCli: { displayOrg },
    }).eligibility(createConfig, 'owner');

    expect(result.eligible).toBe(false);
    expect(displayOrg).toHaveBeenCalledWith(devHub.username);
    expect(displayOrg).toHaveBeenCalledWith(target.username);
    expect(result.errors).toContain(
      'Salesforce org "existing" is not authenticated in Salesforce CLI',
    );
  });
});

describe('ExistingScratchOrgService adoption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findFirst.mockResolvedValue(null);
    db.scratchOrg.findFirst.mockResolvedValue(null);
    db.scratchOrg.create.mockResolvedValue({ ...target, expirationDate: target.expiresAt });
    db.orgConnection.create.mockResolvedValue(target);
    db.$transaction.mockImplementation(async (callback) => callback(db));
  });

  it('imports authenticated CLI state without creating a Salesforce org', async () => {
    const service = createService();
    const createScratchOrg = vi.fn();
    (service as unknown as {
      preparation: { sfCli: Record<string, unknown> };
    }).preparation.sfCli = {
      listOrgs: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { scratchOrgs: [liveOrg] } },
      }),
      displayOrg: vi.fn().mockResolvedValue({
        success: true,
        data: { result: liveOrg },
      }),
      createScratchOrg,
    };
    await expect(service.adopt({ alias: target.alias }, 'owner')).resolves.toEqual(
      expect.objectContaining({ imported: true, createdSalesforceOrg: false }),
    );
    expect(db.scratchOrg.create).toHaveBeenCalled();
    expect(db.orgConnection.create).toHaveBeenCalled();
    expect(createScratchOrg).not.toHaveBeenCalled();
  });

  it('refuses to adopt a CLI org already associated with another caller', async () => {
    db.orgConnection.findFirst.mockResolvedValue({ ...target, createdBy: 'other-owner' });
    const service = createService();
    (service as unknown as {
      preparation: { sfCli: Record<string, unknown> };
    }).preparation.sfCli = {
      listOrgs: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { scratchOrgs: [liveOrg] } },
      }),
      displayOrg: vi.fn().mockResolvedValue({
        success: true,
        data: { result: liveOrg },
      }),
    };
    await expect(service.adopt({ alias: target.alias }, 'owner')).rejects.toThrow(
      'already associated',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('requires live expiration and Dev Hub proof before adoption', async () => {
    const service = createService({ sfCli: {
      listOrgs: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { scratchOrgs: [{ ...liveOrg, devHubUsername: undefined }] } },
      }),
      displayOrg: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { ...liveOrg, devHubUsername: undefined } },
      }),
    } });
    await expect(service.adopt({ alias: target.alias }, 'owner')).rejects.toThrow('Dev Hub');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('EnvironmentController adoption authorization', () => {
  it('marks global Salesforce CLI adoption as admin-only', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      EnvironmentController.prototype,
      'adoptScratchOrg',
    );
    expect(Reflect.getMetadata(ROLE_KEY, descriptor?.value)).toBe('admin');
  });
});
