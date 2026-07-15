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
  preparation?: Record<string, unknown>;
}) {
  return new ExistingScratchOrgService(
    { resolveLaunch: overrides?.resolveLaunch ?? vi.fn().mockResolvedValue(config) } as never,
    { requireActive: vi.fn().mockResolvedValue(config.gitSource) } as never,
    (overrides?.preparation ?? {
      verifyAuthentication: vi.fn().mockResolvedValue(undefined),
      isRequiredPackageInstalled: vi.fn().mockResolvedValue(true),
    }) as never,
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
    expect(result.errors).toContain('Selected scratch org has expired');

    db.orgConnection.findUnique.mockResolvedValue(target);
    result = await createService({
      preparation: {
        verifyAuthentication: vi.fn().mockRejectedValue(new Error('CLI auth expired')),
        isRequiredPackageInstalled: vi.fn().mockResolvedValue(false),
      },
    }).eligibility(config, 'owner');
    expect(result.errors).toContain('CLI auth expired');
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ step: 'required_package', status: 'required' }),
    ]));
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
    (service as unknown as { sfCli: Record<string, unknown> }).sfCli = {
      listOrgs: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { scratchOrgs: [{
          alias: target.alias,
          username: target.username,
          orgId: target.orgId,
          instanceUrl: target.instanceUrl,
          expirationDate: '2099-08-01T00:00:00Z',
        }] } },
      }),
      displayOrg: vi.fn().mockResolvedValue({
        success: true,
        data: { result: {
          username: target.username,
          orgId: target.orgId,
          instanceUrl: target.instanceUrl,
          expirationDate: '2099-08-01T00:00:00Z',
        } },
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
    (service as unknown as { sfCli: Record<string, unknown> }).sfCli = {
      listOrgs: vi.fn().mockResolvedValue({
        success: true,
        data: { result: { scratchOrgs: [{
          alias: target.alias,
          username: target.username,
          orgId: target.orgId,
          instanceUrl: target.instanceUrl,
        }] } },
      }),
      displayOrg: vi.fn().mockResolvedValue({
        success: true,
        data: { result: target },
      }),
    };
    await expect(service.adopt({ alias: target.alias }, 'owner')).rejects.toThrow(
      'already associated',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
