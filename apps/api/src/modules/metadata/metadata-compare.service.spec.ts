import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const db = vi.hoisted(() => ({
  metadataComparison: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
}));

const tenancy = vi.hoisted(() => ({
  assertOrgOwned: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('../../common/user-tenancy.util', () => tenancy);
vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: () => ({
    retrieveMetadataMember: vi.fn(),
  }),
}));

import { MetadataCompareService } from './metadata-compare.service';

describe('MetadataCompareService automatic catalog comparison', () => {
  const userId = 'user-1';
  const sourceOrgId = randomUUID();
  const targetOrgId = randomUUID();
  const listTypesRaw = vi.fn();
  const listComponentsRaw = vi.fn();
  let service: MetadataCompareService;

  beforeEach(() => {
    vi.clearAllMocks();
    tenancy.assertOrgOwned.mockResolvedValue({ id: sourceOrgId, alias: 'org' });
    db.metadataComparison.findFirst.mockResolvedValue(null);
    db.metadataComparison.create.mockResolvedValue({ id: 'comparison-1' });
    db.metadataComparison.update.mockResolvedValue({});
    db.$queryRawUnsafe.mockResolvedValue([]);
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    service = new MetadataCompareService({
      listTypesRaw,
      listComponentsRaw,
    } as never);
  });

  it('discovers the union of org metadata types and publishes progressive real items', async () => {
    listTypesRaw.mockImplementation((orgId: string) => Promise.resolve(
      orgId === sourceOrgId
        ? [{ xmlName: 'ApexClass' }]
        : [{ xmlName: 'Flow' }, { xmlName: 'ApexClass' }],
    ));
    listComponentsRaw.mockImplementation((orgId: string, _userId: string, type: string) => {
      if (type === 'ApexClass') {
        return Promise.resolve(orgId === sourceOrgId
          ? [{ fullName: 'SourceOnly', metadataType: type }]
          : []);
      }
      return Promise.resolve(orgId === targetOrgId
        ? [{ fullName: 'TargetOnly', metadataType: type }]
        : []);
    });

    await service.startComparison({ sourceOrgId, targetOrgId }, userId);

    await vi.waitFor(() => {
      const completed = db.metadataComparison.update.mock.calls.find((call) =>
        call[0]?.data?.status === 'completed');
      expect(completed).toBeDefined();
    });

    expect(listTypesRaw).toHaveBeenCalledWith(sourceOrgId, userId);
    expect(listTypesRaw).toHaveBeenCalledWith(targetOrgId, userId);
    expect(listComponentsRaw).toHaveBeenCalledTimes(4);
    const completed = db.metadataComparison.update.mock.calls.find((call) =>
      call[0]?.data?.status === 'completed')?.[0];
    expect(completed.data.items).toEqual([
      expect.objectContaining({ metadataType: 'ApexClass', fullName: 'SourceOnly', diffType: 'new' }),
      expect.objectContaining({ metadataType: 'Flow', fullName: 'TargetOnly', diffType: 'deleted' }),
    ]);
    expect(completed.data.summary.progress).toMatchObject({
      phase: 'completed',
      completedTypes: 2,
      totalTypes: 2,
    });
  });

  it('reuses a recent running comparison for the same owner and org pair', async () => {
    db.metadataComparison.findFirst.mockResolvedValue({ id: 'existing-comparison' });

    await expect(service.startComparison({ sourceOrgId, targetOrgId }, userId)).resolves.toEqual({
      comparisonId: 'existing-comparison',
      status: 'running',
      reused: true,
    });
    expect(db.metadataComparison.create).not.toHaveBeenCalled();
    expect(listTypesRaw).not.toHaveBeenCalled();
  });
});
