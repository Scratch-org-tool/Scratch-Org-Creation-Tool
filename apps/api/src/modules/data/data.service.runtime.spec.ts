import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
  dataMovement: { create: vi.fn() },
}));
vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: () => ({ ensureSfdmuPlugin: vi.fn() }),
}));

import { DataService } from './data.service';

const sourceId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';

describe('DataService runtime gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique
      .mockResolvedValueOnce({ id: sourceId, createdBy: 'owner', alias: 'source' })
      .mockResolvedValueOnce({ id: targetId, createdBy: 'owner', alias: 'target' });
  });

  it('returns dry-run preflight without creating movements or queue jobs', async () => {
    const enqueueJob = vi.fn();
    const createBatch = vi.fn();
    const preflight = {
      ok: true,
      dryRun: true,
      operation: 'upsert',
      externalIdField: 'External__c',
      idempotent: true,
      sourceCount: 10,
      estimatedChunks: 1,
      estimatedBulkBatches: 1,
      sample: [{ External__c: 'A' }],
      mappings: [],
      bulkApi: {
        dailyBatchesRemaining: 100,
        dailyBatchesMax: 10_000,
        sufficient: true,
        confidence: 'known',
        unknownPolicy: 'block',
      },
      fieldIssues: [],
      errors: [],
      warnings: [],
    };
    const service = new DataService(
      { enqueueJob } as never,
      {} as never,
      {} as never,
      { createBatch } as never,
      { runPreflight: vi.fn().mockResolvedValue(preflight) } as never,
      { ensureConfigured: vi.fn() } as never,
    );
    const result = await service.deployData({
      sourceOrgId: sourceId,
      targetOrgId: targetId,
      objectName: 'Account',
      soql: 'SELECT External__c FROM Account',
      operation: 'upsert',
      externalIdField: 'External__c',
      dryRun: true,
    }, 'owner');
    expect(result).toEqual({ dryRun: true, preflight });
    expect(db.dataMovement.create).not.toHaveBeenCalled();
    expect(createBatch).not.toHaveBeenCalled();
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});
