import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
}));
const sfCli = vi.hoisted(() => ({
  query: vi.fn(),
  listOrgLimits: vi.fn(),
  describeSObject: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));

import { DataPreflightService } from './data-preflight.service';

const sourceId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';

function request(overrides: Record<string, unknown> = {}) {
  return {
    sourceOrgId: sourceId,
    targetOrgId: targetId,
    objectName: 'Account',
    soql: 'SELECT External__c, Name FROM Account',
    operation: 'upsert',
    externalIdField: 'External__c',
    ...overrides,
  };
}

describe('DataPreflightService strict gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique
      .mockResolvedValueOnce({ id: sourceId, alias: 'source', username: null, createdBy: 'owner' })
      .mockResolvedValueOnce({ id: targetId, alias: 'target', username: null, createdBy: 'owner' });
    sfCli.query.mockImplementation(async (_alias: string, soql: string) =>
      soql.includes('COUNT()')
        ? { success: true, data: { result: { totalSize: 30_000 } } }
        : { success: true, data: { result: { records: [{ External__c: 'A', Name: 'One' }] } } });
    sfCli.listOrgLimits.mockResolvedValue({
      success: true,
      data: { result: [{ name: 'DailyBulkApiBatches', remaining: 50, max: 10_000 }] },
    });
    sfCli.describeSObject
      .mockResolvedValueOnce({
        data: { result: { fields: [{ name: 'External__c' }, { name: 'Name' }] } },
      })
      .mockResolvedValueOnce({
        data: {
          result: {
            fields: [
              { name: 'External__c', externalId: true, createable: true, updateable: true },
              { name: 'Name', createable: true, updateable: true },
            ],
          },
        },
      });
  });

  it('returns counts, sample, mappings and estimated batches without writes', async () => {
    const report = await new DataPreflightService().runPreflight(
      request({ dryRun: true }),
      'owner',
    );
    expect(report.ok).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.sourceCount).toBe(30_000);
    expect(report.estimatedBulkBatches).toBe(2);
    expect(report.sample).toHaveLength(1);
    expect(report.mappings.map((mapping) => mapping.targetField)).toEqual(['External__c', 'Name']);
  });

  it('blocks an invalid external ID and non-updateable fields', async () => {
    sfCli.describeSObject.mockReset();
    sfCli.describeSObject
      .mockResolvedValueOnce({
        data: { result: { fields: [{ name: 'External__c' }, { name: 'Name' }] } },
      })
      .mockResolvedValueOnce({
        data: {
          result: {
            fields: [
              { name: 'External__c', externalId: false, createable: true, updateable: true },
              { name: 'Name', createable: true, updateable: false },
            ],
          },
        },
      });
    const report = await new DataPreflightService().runPreflight(request(), 'owner');
    expect(report.ok).toBe(false);
    expect(report.fieldIssues.map((issue) => issue.issue)).toEqual(
      expect.arrayContaining(['not_external_id', 'not_updateable']),
    );
  });

  it('blocks unknown quota by default and permits only an explicit warning policy', async () => {
    sfCli.listOrgLimits.mockRejectedValue(new Error('limits unavailable'));
    const blocked = await new DataPreflightService().runPreflight(request(), 'owner');
    expect(blocked.ok).toBe(false);
    expect(blocked.bulkApi.confidence).toBe('unknown');
    expect(blocked.errors.join(' ')).toContain('strict quota policy');

    db.orgConnection.findUnique
      .mockResolvedValueOnce({ id: sourceId, alias: 'source', username: null, createdBy: 'owner' })
      .mockResolvedValueOnce({ id: targetId, alias: 'target', username: null, createdBy: 'owner' });
    sfCli.describeSObject
      .mockResolvedValueOnce({
        data: { result: { fields: [{ name: 'External__c' }, { name: 'Name' }] } },
      })
      .mockResolvedValueOnce({
        data: {
          result: {
            fields: [
              { name: 'External__c', externalId: true, createable: true, updateable: true },
              { name: 'Name', createable: true, updateable: true },
            ],
          },
        },
      });
    const warned = await new DataPreflightService().runPreflight(
      request({ unknownQuotaPolicy: 'warn' }),
      'owner',
    );
    expect(warned.ok).toBe(true);
    expect(warned.warnings.join(' ')).toContain('quota confidence is unknown');
  });
});
