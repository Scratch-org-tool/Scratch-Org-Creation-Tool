import { mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orgConnection: { findUnique: vi.fn() },
  automationRun: { findUnique: vi.fn(), update: vi.fn() },
}));
const sfCli = vi.hoisted(() => ({
  query: vi.fn(),
  describeSObject: vi.fn(),
  exportBulk: vi.fn(),
  upsertBulk: vi.fn(),
  importBulk: vi.fn(),
  updateBulk: vi.fn(),
  deleteBulk: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));

import { QuerySectionRuntimeService } from './query-section-runtime.service';

function service() {
  return new QuerySectionRuntimeService(
    { addLog: vi.fn() } as never,
    { publish: vi.fn() } as never,
  );
}

describe('QuerySectionRuntimeService review fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue({
      id: 'source',
      alias: 'source',
      username: null,
      createdBy: 'owner',
    });
    sfCli.query.mockResolvedValue({
      success: true,
      data: { result: { records: [], totalSize: 0 } },
    });
  });

  it('previews every sales-office variant once from the original query', async () => {
    sfCli.query.mockImplementation(async (_alias: string, soql: string) => ({
      success: true,
      data: {
        result: {
          totalSize: 1,
          records: [{ Office: soql.includes("'S1'") ? 'S1' : 'S2' }],
        },
      },
    }));

    const result = await service().preview({
      sourceOrgId: 'source',
      salesOfficesByBottler: { '5000': ['S1', 'S2'] },
      section: {
        name: 'Office preview',
        queries: [{
          id: 'account',
          name: 'Accounts',
          enabled: true,
          order: 0,
          stage: 0,
          category: 'account',
          object: 'Account',
          soql: "SELECT Name FROM Account WHERE Office__c = '{{office}}'",
          limit: 20,
          bottler: '5000',
          operation: 'upsert',
          externalIdField: 'Name',
          variables: {},
          dependsOn: [],
          salesOfficeExpansion: { enabled: true, variable: 'office' },
        }],
      },
    }, 'owner');

    expect(result.queries.map((query) => query.id)).toEqual(['account:S1', 'account:S2']);
    expect(result.queries.map((query) => (query.records[0] as { Office?: string } | undefined)?.Office)).toEqual(['S1', 'S2']);
    expect(sfCli.query).toHaveBeenCalledTimes(2);
  });

  it('reconciles only required target keys in bounded IN queries without a 100k cap', async () => {
    const runtime = service() as unknown as {
      targetRecordIds(
        alias: string,
        objectName: string,
        field: string,
        keys: Set<string>,
      ): Promise<Map<string, string>>;
    };
    const keys = new Set(Array.from({ length: 401 }, (_, index) => `K-${index}`));

    await runtime.targetRecordIds('target', 'Thing__c', 'External__c', keys);

    expect(sfCli.query).toHaveBeenCalledTimes(3);
    for (const [, soql] of sfCli.query.mock.calls) {
      expect(soql).toContain('External__c IN (');
      expect(soql).not.toContain('LIMIT 100000');
    }
  });

  it('skips completed delete chunks and treats an attempted chunk’s absent rows as deleted', async () => {
    const runtime = service() as unknown as {
      loadChunks(
        objectName: string,
        rows: Array<Record<string, unknown>>,
        operation: string,
        externalId: string,
        targetAlias: string,
        workDir: string,
        queryId: string,
        checkpoint: Record<string, unknown>,
        onCheckpoint: (index: number, running: boolean) => Promise<void>,
      ): Promise<number>;
    };
    const workDir = await mkdtemp(join(tmpdir(), 'query-runtime-test-'));
    try {
      const completed = await runtime.loadChunks(
        'Thing__c',
        [{ External__c: 'already-gone' }],
        'delete',
        'External__c',
        'target',
        workDir,
        'delete-things',
        {
          id: 'delete-things',
          status: 'failed',
          exported: 1,
          loaded: 1,
          failed: 0,
          completedChunkIndexes: [0],
          completedChunkFingerprints: {
            0: createHash('sha256').update('already-gone').digest('hex'),
          },
        },
        async () => undefined,
      );
      expect(completed).toBe(1);
      expect(sfCli.query).not.toHaveBeenCalled();
      await expect(runtime.loadChunks(
        'Thing__c',
        [{ External__c: 'changed-after-checkpoint' }],
        'delete',
        'External__c',
        'target',
        workDir,
        'delete-things',
        {
          id: 'delete-things',
          status: 'failed',
          exported: 1,
          loaded: 1,
          failed: 0,
          completedChunkIndexes: [0],
          completedChunkFingerprints: {
            0: createHash('sha256').update('already-gone').digest('hex'),
          },
        },
        async () => undefined,
      )).rejects.toThrow('source rows changed');

      const checkpoints: Array<[number, boolean]> = [];
      const resumed = await runtime.loadChunks(
        'Thing__c',
        [{ External__c: 'committed-before-stop' }],
        'delete',
        'External__c',
        'target',
        workDir,
        'delete-things',
        {
          id: 'delete-things',
          status: 'failed',
          exported: 1,
          loaded: 0,
          failed: 1,
          runningChunkIndex: 0,
          runningChunkFingerprint: createHash('sha256')
            .update('committed-before-stop')
            .digest('hex'),
        },
        async (index, running) => {
          checkpoints.push([index, running]);
        },
      );
      expect(resumed).toBe(1);
      expect(checkpoints).toEqual([[0, false]]);
      expect(sfCli.deleteBulk).not.toHaveBeenCalled();
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('validates the generated partner external ID on target metadata, not source selection', async () => {
    db.orgConnection.findUnique
      .mockResolvedValueOnce({ alias: 'source', username: null, createdBy: 'owner' })
      .mockResolvedValueOnce({ alias: 'target', username: null, createdBy: 'owner' });
    sfCli.describeSObject
      .mockResolvedValueOnce({
        data: {
          result: {
            fields: [
              { name: 'AccountKey__c' },
              { name: 'EmployeeKey__c' },
              { name: 'Role__c' },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          result: {
            fields: [
              { name: 'AccountKey__c', createable: true, updateable: true },
              { name: 'EmployeeKey__c', createable: true, updateable: true },
              { name: 'Role__c', createable: true, updateable: true },
              {
                name: 'GeneratedExternal__c',
                externalId: false,
                createable: true,
                updateable: true,
              },
            ],
          },
        },
      });

    const result = await service().preflightPlan({
      name: 'partner',
      queries: [{
        id: 'partner',
        sourceQueryId: 'partner',
        name: 'Partner',
        enabled: true,
        order: 0,
        stage: 0,
        category: 'account_partner',
        object: 'Partner__c',
        soql: 'SELECT AccountKey__c, EmployeeKey__c, Role__c FROM Partner__c LIMIT 10',
        limit: 10,
        operation: 'upsert',
        externalIdField: 'GeneratedExternal__c',
        variables: {},
        dependsOn: [],
      }],
      accountPartnerPlan: {
        accountQueryId: 'account',
        employeeMasterQueryId: 'employee',
        accountPartnerQueryId: 'partner',
        accountKeyField: 'AccountKey__c',
        employeeKeyField: 'EmployeeKey__c',
        mappingAccountKeyField: 'AccountKey__c',
        mappingEmployeeKeyField: 'EmployeeKey__c',
        mappingRoleField: 'Role__c',
        externalIdField: 'GeneratedExternal__c',
        externalIdPattern: '{{account}}-{{employee}}-{{role}}',
      },
    }, 'source', 'target', 'owner');

    expect(result.errors).toContain(
      'partner: GeneratedExternal__c is not marked as an external ID or idLookup',
    );
    expect(result.errors.some((error) => error.includes('source external ID'))).toBe(false);
    expect(result.errors.some((error) => error.includes('query must select external ID'))).toBe(false);
  });

  it.each(['Name', 'DeveloperName'])(
    'does not bypass target external-ID metadata for %s',
    async (field) => {
      db.orgConnection.findUnique
        .mockResolvedValueOnce({ alias: 'source', username: null, createdBy: 'owner' })
        .mockResolvedValueOnce({ alias: 'target', username: null, createdBy: 'owner' });
      sfCli.describeSObject
        .mockResolvedValueOnce({
          data: { result: { fields: [{ name: field }] } },
        })
        .mockResolvedValueOnce({
          data: {
            result: {
              fields: [{
                name: field,
                externalId: false,
                idLookup: false,
                createable: true,
                updateable: true,
              }],
            },
          },
        });

      const result = await service().preflightPlan({
        name: 'metadata gate',
        queries: [{
          id: 'query',
          sourceQueryId: 'query',
          name: 'Query',
          enabled: true,
          order: 0,
          stage: 0,
          category: 'arbitrary',
          object: 'Thing__c',
          soql: `SELECT ${field} FROM Thing__c LIMIT 10`,
          limit: 10,
          operation: 'upsert',
          externalIdField: field,
          variables: {},
          dependsOn: [],
        }],
      }, 'source', 'target', 'owner');

      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        `query: ${field} is not marked as an external ID or idLookup`,
      );
    },
  );

  it('accepts a target idLookup field as a Template V2 reconciliation key', async () => {
    db.orgConnection.findUnique
      .mockResolvedValueOnce({ alias: 'source', username: null, createdBy: 'owner' })
      .mockResolvedValueOnce({ alias: 'target', username: null, createdBy: 'owner' });
    sfCli.describeSObject
      .mockResolvedValueOnce({
        data: { result: { fields: [{ name: 'LookupKey__c' }] } },
      })
      .mockResolvedValueOnce({
        data: {
          result: {
            fields: [{
              name: 'LookupKey__c',
              externalId: false,
              idLookup: true,
              createable: true,
              updateable: true,
            }],
          },
        },
      });

    const result = await service().preflightPlan({
      name: 'id lookup',
      queries: [{
        id: 'query',
        sourceQueryId: 'query',
        name: 'Query',
        enabled: true,
        order: 0,
        stage: 0,
        category: 'arbitrary',
        object: 'Thing__c',
        soql: 'SELECT LookupKey__c FROM Thing__c LIMIT 10',
        limit: 10,
        operation: 'upsert',
        externalIdField: 'LookupKey__c',
        variables: {},
        dependsOn: [],
      }],
    }, 'source', 'target', 'owner');

    expect(result.ok).toBe(true);
  });

  it('publishes query progress with the run owner explicitly', async () => {
    const jobs = { addLog: vi.fn() };
    const stream = { publish: vi.fn() };
    const runtime = new QuerySectionRuntimeService(jobs as never, stream as never) as unknown as {
      progress(
        input: { automationRunId: string; dbJobId: string },
        queryId: string,
        status: string,
        details: Record<string, unknown>,
        ownerId: string,
      ): Promise<void>;
    };
    await runtime.progress(
      { automationRunId: 'run', dbJobId: 'job' },
      'query',
      'running',
      {},
      'owner',
    );
    expect(stream.publish).toHaveBeenCalledWith(
      'job_status',
      expect.objectContaining({ jobId: 'job', queryId: 'query' }),
      'owner',
    );
  });
});
