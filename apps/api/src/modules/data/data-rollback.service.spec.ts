import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  dataMovement: { findUnique: vi.fn(), update: vi.fn() },
  dataDeployBatch: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({
  prisma: db,
  Prisma: {},
}));
vi.mock('@sfcc/sf-cli', () => ({
  createSfCliClient: () => ({}),
}));

import { DataRollbackService } from './data-rollback.service';

const roots: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  delete process.env.DATA_ROLLBACK_ENCRYPTION_KEY;
  delete process.env.DATA_ROLLBACK_ARTIFACT_DIR;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('DataRollbackService artifacts', () => {
  it('round-trips bounded gzip+AES-GCM artifacts without plaintext leakage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rollback-artifact-test-'));
    roots.push(root);
    process.env.DATA_ROLLBACK_ARTIFACT_DIR = root;
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
    const ciphertext = await readFile(metadata.path);
    expect(ciphertext.toString('utf8')).not.toContain('SECRET-KEY');
    await expect(service.readArtifact(metadata)).resolves.toEqual(payload);
    expect(metadata.previousCount).toBe(1);
    expect(metadata.insertedCount).toBe(1);
  });

  it('blocks artifacts larger than the explicit safety bound', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rollback-artifact-test-'));
    roots.push(root);
    process.env.DATA_ROLLBACK_ARTIFACT_DIR = root;
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

  it('reports and blocks automatic rollback for non-idempotent inserts', async () => {
    db.dataMovement.findUnique.mockResolvedValue({
      id: 'movement',
      createdBy: 'owner',
      operation: 'insert',
      idempotent: false,
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
      data: {
        rollbackReport: expect.objectContaining({ safe: false }),
      },
    }));
  });
});
