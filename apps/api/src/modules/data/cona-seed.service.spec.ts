import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_OBJECT } from '@sfcc/shared';
import { ACCOUNT_SEED_EXTERNAL_ID } from './account-seed-query.builder';

const mocks = vi.hoisted(() => ({
  sfCli: {
    query: vi.fn(),
    exportBulk: vi.fn(),
    importBulk: vi.fn(),
    upsertBulk: vi.fn(),
  },
  orgConnection: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: () => mocks.sfCli,
}));

vi.mock('@sfcc/db', () => ({
  prisma: {
    orgConnection: mocks.orgConnection,
  },
}));

import { ConaSeedService } from './cona-seed.service';

const manualQuery = {
  id: 'priority',
  label: 'Priority accounts',
  soql: `SELECT Id, Name, ${ACCOUNT_SEED_EXTERNAL_ID} FROM Account WHERE Rating = 'Hot' LIMIT 5`,
  limit: 25,
};

const manualOnboardingQuery = {
  id: 'primary-groups',
  label: 'Primary groups',
  soql: `SELECT Id, RecordTypeId, cfs_ob__Bottler__c FROM ${ONBOARDING_OBJECT} `
    + "WHERE cfs_ob__Record_Category__c = 'Primary Group'",
  limit: 50,
};

describe('ConaSeedService manual Account queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orgConnection.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        alias: where.id === 'source-id' ? 'source' : 'target',
        username: null,
      }),
    );
    mocks.sfCli.query.mockResolvedValue({
      success: true,
      data: { result: { totalSize: 12 } },
    });
    mocks.sfCli.exportBulk.mockResolvedValue({ success: true });
    mocks.sfCli.importBulk.mockResolvedValue({ success: true });
    mocks.sfCli.upsertBulk.mockResolvedValue({ success: true });
  });

  it('previews the normalized bounded query and matching count', async () => {
    const service = new ConaSeedService({ buildMappings: vi.fn() } as never);

    const result = await service.validate(
      'source-id',
      ['Accounts'],
      undefined,
      'manual',
      [manualQuery],
    );

    expect(result.ok).toBe(true);
    expect(result.manualQueries).toEqual([
      expect.objectContaining({
        id: 'priority',
        availableCount: 12,
        selectedCount: 12,
        soql: expect.stringMatching(/LIMIT 25$/),
      }),
    ]);
    expect(mocks.sfCli.query).toHaveBeenCalledWith(
      'source',
      expect.stringMatching(/^SELECT COUNT\(\) FROM Account WHERE Rating = 'Hot'/),
    );
  });

  it('exports and upserts each manual query with the safe Account external ID', async () => {
    const service = new ConaSeedService({ buildMappings: vi.fn() } as never);
    const logs: string[] = [];

    await expect(service.runSeed({
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      datasets: ['Accounts'],
      accountQueryMode: 'manual',
      manualAccountQueries: [manualQuery],
      onLog: async (line) => {
        logs.push(line);
      },
    })).resolves.toEqual({ success: true });

    expect(mocks.sfCli.exportBulk).toHaveBeenCalledWith(
      expect.stringMatching(/LIMIT 25$/),
      'source',
      expect.stringContaining('manual-accounts-0.csv'),
      10,
      expect.any(Object),
    );
    expect(mocks.sfCli.upsertBulk).toHaveBeenCalledWith(
      'Account',
      expect.stringContaining('manual-accounts-0.csv'),
      ACCOUNT_SEED_EXTERNAL_ID,
      'target',
      15,
      expect.any(Object),
    );
    expect(logs).toContain('Seed complete');
  });

  it('previews and imports a manual OnboardingConfig query with record type mapping', async () => {
    const recordTypeMapper = {
      buildMappings: vi.fn().mockResolvedValue({ sourceRt: 'targetRt' }),
    };
    const service = new ConaSeedService(recordTypeMapper as never);
    const applyMappings = vi.spyOn(
      service as unknown as { applyRecordTypeMappings: () => Promise<void> },
      'applyRecordTypeMappings',
    ).mockResolvedValue();

    const preview = await service.validate(
      'source-id',
      ['OnboardingConfig'],
      undefined,
      'guided',
      undefined,
      'manual',
      [manualOnboardingQuery],
    );
    expect(preview.manualOnboardingQueries).toEqual([
      expect.objectContaining({
        id: 'primary-groups',
        availableCount: 12,
        selectedCount: 12,
        soql: expect.stringMatching(/LIMIT 50$/),
      }),
    ]);

    await service.runSeed({
      sourceOrgId: 'source-id',
      targetOrgId: 'target-id',
      datasets: ['OnboardingConfig'],
      onboardingQueryMode: 'manual',
      manualOnboardingQueries: [manualOnboardingQuery],
    });

    expect(recordTypeMapper.buildMappings).toHaveBeenCalledWith(
      'source-id',
      'target-id',
      ONBOARDING_OBJECT,
    );
    expect(applyMappings).toHaveBeenCalledOnce();
    expect(mocks.sfCli.exportBulk).toHaveBeenCalledWith(
      expect.stringMatching(/LIMIT 50$/),
      'source',
      expect.stringContaining('manual-onboarding-0.csv'),
      10,
      expect.any(Object),
    );
    expect(mocks.sfCli.importBulk).toHaveBeenCalledWith(
      ONBOARDING_OBJECT,
      expect.stringContaining('manual-onboarding-0.csv'),
      'target',
      10,
      expect.any(Object),
    );
  });
});
