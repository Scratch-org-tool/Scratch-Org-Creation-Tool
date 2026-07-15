import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  dataMovement: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  dataDeployBatch: { findUnique: vi.fn(), update: vi.fn() },
  dataRollbackArtifact: { findUnique: vi.fn(), create: vi.fn() },
}));
const sfCli = vi.hoisted(() => ({
  query: vi.fn(),
  updateBulk: vi.fn(),
  deleteBulk: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({
  prisma: db,
  Prisma: {},
}));
vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: () => sfCli,
}));

import { DataRollbackService } from './data-rollback.service';

let storedArtifact: Record<string, unknown> | null;

beforeEach(() => {
  storedArtifact = null;
  db.dataRollbackArtifact.findUnique.mockImplementation(async () => storedArtifact);
  db.dataRollbackArtifact.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    storedArtifact = {
      id: 'artifact-1',
      algorithm: 'aes-256-gcm+gzip',
      createdAt: new Date(),
      ...data,
    };
    return storedArtifact;
  });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.DATA_ROLLBACK_ENCRYPTION_KEY;
});

describe('DataRollbackService artifacts', () => {
  it('round-trips bounded gzip+AES-GCM artifacts without plaintext leakage', async () => {
    process.env.DATA_ROLLBACK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const service = new DataRollbackService({ acquire: vi.fn() } as never);
    const payload = {
      version: 1 as const,
      objectName: 'Account',
      externalIdField: 'External__c',
      previousRows: [{ Id: '001000000000001', External__c: 'SECRET-KEY', Name: 'Before' }],
      insertedExternalIds: ['NEW-KEY'],
    };
    const metadata = await service.writeArtifact('movement', payload);
    const ciphertext = Buffer.from(storedArtifact!.ciphertext as Uint8Array);
    expect(ciphertext.toString('utf8')).not.toContain('SECRET-KEY');
    await expect(service.readArtifact(metadata)).resolves.toEqual(payload);
    expect(metadata.storage).toBe('database');
    expect(metadata.previousCount).toBe(1);
    expect(metadata.insertedCount).toBe(1);
  });

  it('blocks artifacts larger than the explicit safety bound', async () => {
    process.env.DATA_ROLLBACK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const service = new DataRollbackService({ acquire: vi.fn() } as never);
    await expect(service.writeArtifact('too-large', {
      version: 1,
      objectName: 'Account',
      externalIdField: 'External__c',
      previousRows: [{ Name: 'x'.repeat(500) }],
      insertedExternalIds: [],
    }, 100)).rejects.toThrow(/exceeds configured/);
  });

  it('keeps the first durable artifact immutable across retries', async () => {
    process.env.DATA_ROLLBACK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const service = new DataRollbackService({ acquire: vi.fn() } as never);
    const firstPayload = {
      version: 1 as const,
      objectName: 'Account',
      externalIdField: 'External__c',
      previousRows: [{ Id: '001', External__c: 'A', Name: 'Before' }],
      insertedExternalIds: [],
    };
    const first = await service.writeArtifact('movement', firstPayload);
    const second = await service.writeArtifact('movement', {
      ...firstPayload,
      previousRows: [{ Id: '001', External__c: 'A', Name: 'After' }],
    });

    expect(second.artifactId).toBe(first.artifactId);
    expect(db.dataRollbackArtifact.create).toHaveBeenCalledTimes(1);
    await expect(service.readArtifact(second)).resolves.toEqual(firstPayload);
  });

  it('restores existing rows before requiring explicit inserted-row deletion', async () => {
    process.env.DATA_ROLLBACK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const acquire = vi.fn().mockResolvedValue({ release: vi.fn() });
    const service = new DataRollbackService({ acquire } as never);
    const artifact = await service.writeArtifact('movement', {
      version: 1,
      objectName: 'Account',
      externalIdField: 'External__c',
      previousRows: [{ Id: '001', External__c: 'A', Name: 'Before' }],
      insertedExternalIds: ['NEW'],
    });
    db.dataMovement.findUnique.mockResolvedValue({
      id: 'movement',
      createdBy: 'owner',
      operation: 'upsert',
      idempotent: true,
      status: 'completed',
      rollbackArtifact: artifact,
      rollbackStatus: 'captured',
      rollbackReport: null,
      targetOrg: { alias: 'target', username: null },
    });
    db.dataMovement.updateMany.mockResolvedValue({ count: 1 });
    db.dataMovement.update.mockResolvedValue({});
    sfCli.updateBulk.mockResolvedValue({ success: true });

    const report = await service.rollbackMovement(
      'movement',
      'owner',
      { deleteInserted: false },
    );

    expect(sfCli.updateBulk).toHaveBeenCalledTimes(1);
    expect(sfCli.deleteBulk).not.toHaveBeenCalled();
    expect(report).toEqual(expect.objectContaining({
      status: 'awaiting_delete_confirmation',
      restored: 1,
      requiresDeleteInsertedConfirmation: true,
    }));
  });

  it('reports and blocks automatic rollback for non-idempotent inserts', async () => {
    db.dataMovement.findUnique.mockResolvedValue({
      id: 'movement',
      createdBy: 'owner',
      operation: 'insert',
      idempotent: false,
      status: 'failed',
      rollbackArtifact: null,
      targetOrg: { alias: 'target', username: null },
    });
    db.dataMovement.update.mockResolvedValue({});
    const service = new DataRollbackService({ acquire: vi.fn() } as never);
    await expect(service.rollbackMovement(
      'movement',
      'owner',
      { deleteInserted: false },
    )).rejects.toThrow(/only for idempotent upserts/);
    expect(db.dataMovement.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rollbackReport: expect.objectContaining({ safe: false }),
      }),
    }));
  });

  it.each(['pending', 'queued', 'running'])(
    'blocks movement rollback while the source deployment is %s',
    async (status) => {
      db.dataMovement.findUnique.mockResolvedValue({
        id: 'movement',
        createdBy: 'owner',
        status,
        operation: 'upsert',
        idempotent: true,
        rollbackArtifact: { artifactId: 'artifact' },
        targetOrg: { alias: 'target', username: null },
      });
      const service = new DataRollbackService({ acquire: vi.fn() } as never);

      await expect(service.rollbackMovement(
        'movement',
        'owner',
        { deleteInserted: false },
      )).rejects.toThrow(`source movement is ${status}`);
      expect(db.dataMovement.updateMany).not.toHaveBeenCalled();
    },
  );

  it('ignores pending, failed, and cancelled placeholders that never received execution work', async () => {
    const service = new DataRollbackService({ acquire: vi.fn() } as never);
    db.dataDeployBatch.findUnique.mockResolvedValue({
      id: 'batch',
      createdBy: 'owner',
      status: 'partial',
      movements: [{
        id: 'executed',
        status: 'completed',
        operation: 'upsert',
        idempotent: true,
        rollbackArtifact: { artifactId: 'artifact' },
        rollbackStatus: 'captured',
        recordCount: 10,
      }, {
        id: 'cancelled-placeholder',
        status: 'cancelled',
        operation: 'upsert',
        idempotent: true,
        rollbackArtifact: null,
        rollbackStatus: null,
        recordCount: null,
      }, {
        id: 'failed-placeholder',
        status: 'failed',
        operation: 'upsert',
        idempotent: true,
        rollbackArtifact: null,
        rollbackStatus: null,
        recordCount: null,
      }, {
        id: 'pending-placeholder',
        status: 'pending',
        operation: 'upsert',
        idempotent: true,
        rollbackArtifact: null,
        rollbackStatus: null,
        recordCount: null,
      }],
      chunks: [{
        movementId: 'executed',
        status: 'completed',
        jobId: 'job',
        recordCount: 10,
        afterId: null,
        endId: '001',
      }, {
        movementId: 'cancelled-placeholder',
        status: 'cancelled',
        jobId: null,
        recordCount: null,
        afterId: null,
        endId: null,
      }, {
        movementId: 'failed-placeholder',
        status: 'failed',
        jobId: null,
        recordCount: 10,
        afterId: '001A',
        endId: '001B',
      }, {
        movementId: 'pending-placeholder',
        status: 'pending',
        jobId: null,
        recordCount: null,
        afterId: null,
        endId: null,
      }],
    });
    db.dataDeployBatch.update.mockResolvedValue({});
    vi.spyOn(service, 'rollbackMovement').mockResolvedValue({
      safe: true,
      status: 'completed',
      restored: 1,
      deleted: 0,
    });

    const result = await service.rollbackBatch(
      'batch',
      'owner',
      { deleteInserted: false },
    );

    expect(service.rollbackMovement).toHaveBeenCalledTimes(1);
    expect(service.rollbackMovement).toHaveBeenCalledWith(
      'executed',
      'owner',
      { deleteInserted: false },
    );
    expect(result.results).toHaveLength(1);
  });

  it('requires a rollback artifact for every movement that reached execution', async () => {
    db.dataDeployBatch.findUnique.mockResolvedValue({
      id: 'batch',
      createdBy: 'owner',
      status: 'failed',
      movements: [{
        id: 'attempted',
        status: 'failed',
        operation: 'upsert',
        idempotent: true,
        rollbackArtifact: null,
        rollbackStatus: null,
        recordCount: null,
      }],
      chunks: [{
        movementId: 'attempted',
        status: 'failed',
        jobId: 'job',
        recordCount: 10,
        afterId: null,
        endId: '001',
      }],
    });
    db.dataDeployBatch.update.mockResolvedValue({});
    const service = new DataRollbackService({ acquire: vi.fn() } as never);

    await expect(service.rollbackBatch(
      'batch',
      'owner',
      { deleteInserted: false },
    )).rejects.toThrow(/lack a complete idempotent rollback artifact/);
    expect(db.dataDeployBatch.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rollbackReport: expect.objectContaining({ unsafeMovementIds: ['attempted'] }),
      }),
    }));
  });

  it.each(['pending', 'queued', 'running'])(
    'blocks batch rollback while the source deployment is %s',
    async (status) => {
      db.dataDeployBatch.findUnique.mockResolvedValue({
        id: 'batch',
        createdBy: 'owner',
        status,
        movements: [],
        chunks: [],
      });
      const service = new DataRollbackService({ acquire: vi.fn() } as never);

      await expect(service.rollbackBatch(
        'batch',
        'owner',
        { deleteInserted: false },
      )).rejects.toThrow(`source batch is ${status}`);
      expect(db.dataDeployBatch.update).not.toHaveBeenCalled();
    },
  );
});
