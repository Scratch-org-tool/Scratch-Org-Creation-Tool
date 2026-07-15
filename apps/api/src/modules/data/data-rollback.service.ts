import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';
import { prisma, Prisma } from '@sfcc/db';
import { escapeSoqlLiteral, serializeBulkCsv } from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertResourceOwner } from '../../common/user-tenancy.util';
import { BulkThrottleService } from './bulk-throttle.service';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const DEFAULT_MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
const QUERY_KEY_CHUNK = 200;
const ROLLBACK_SOURCE_TERMINAL_STATUSES = ['completed', 'failed', 'partial'];

export interface DataRollbackPayload {
  version: 1;
  objectName: string;
  externalIdField: string;
  previousRows: Array<Record<string, unknown>>;
  insertedExternalIds: string[];
}

export interface EncryptedRollbackArtifact {
  version: 1;
  storage: 'database';
  artifactId: string;
  algorithm: 'aes-256-gcm+gzip';
  iv: string;
  authTag: string;
  sha256: string;
  compressedBytes: number;
  uncompressedBytes: number;
  previousCount: number;
  insertedCount: number;
  expiresAt: string;
}

type DurableArtifactRow = {
  id: string;
  ciphertext: Uint8Array;
  algorithm: string;
  iv: string;
  authTag: string;
  sha256: string;
  compressedBytes: number;
  uncompressedBytes: number;
  previousCount: number;
  insertedCount: number;
  expiresAt: Date;
};

function parseCsv(text: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted && char === '"' && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      record.push(value);
      value = '';
    } else if (char === '\n' && !quoted) {
      record.push(value.replace(/\r$/, ''));
      records.push(record);
      record = [];
      value = '';
    } else value += char;
  }
  if (record.length || value) {
    record.push(value.replace(/\r$/, ''));
    records.push(record);
  }
  const headers = records.shift() ?? [];
  return records
    .filter((row) => row.some((entry) => entry !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

@Injectable()
export class DataRollbackService {
  private readonly sfCli = createSfCliClient();

  constructor(private readonly bulkThrottle: BulkThrottleService) {}

  ensureConfigured(): void {
    this.encryptionKey();
  }

  async getMovementRollbackStatus(movementId: string, userId: string) {
    const movement = await prisma.dataMovement.findUnique({
      where: { id: movementId },
      select: {
        id: true,
        createdBy: true,
        rollbackStatus: true,
        rollbackReport: true,
        rollbackArtifact: true,
      },
    });
    if (!movement) throw new NotFoundException('Data movement not found');
    assertResourceOwner(movement, userId, 'Data movement');
    return {
      movementId,
      status: movement.rollbackStatus ?? 'not_available',
      available: Boolean(movement.rollbackArtifact),
      report: movement.rollbackReport,
    };
  }

  private encryptionKey(): Buffer {
    const configured = process.env.DATA_ROLLBACK_ENCRYPTION_KEY?.trim();
    if (!configured) {
      throw new BadRequestException(
        'Rollback capture requires DATA_ROLLBACK_ENCRYPTION_KEY (32-byte base64 or 64-character hex)',
      );
    }
    const key = /^[a-fA-F0-9]{64}$/.test(configured)
      ? Buffer.from(configured, 'hex')
      : Buffer.from(configured, 'base64');
    if (key.length !== 32) throw new BadRequestException('DATA_ROLLBACK_ENCRYPTION_KEY must decode to 32 bytes');
    return key;
  }

  private maxBytes(override?: number): number {
    const configured = override ?? Number.parseInt(process.env.DATA_ROLLBACK_MAX_BYTES ?? '', 10);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_ARTIFACT_BYTES;
  }

  private expiresAt(): Date {
    const configured = Number.parseInt(process.env.DATA_ROLLBACK_RETENTION_DAYS ?? '', 10);
    const days = Number.isFinite(configured) && configured > 0
      ? Math.min(configured, 3650)
      : 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private metadata(row: DurableArtifactRow): EncryptedRollbackArtifact {
    return {
      version: 1,
      storage: 'database',
      artifactId: row.id,
      algorithm: 'aes-256-gcm+gzip',
      iv: row.iv,
      authTag: row.authTag,
      sha256: row.sha256,
      compressedBytes: row.compressedBytes,
      uncompressedBytes: row.uncompressedBytes,
      previousCount: row.previousCount,
      insertedCount: row.insertedCount,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async writeArtifact(
    movementId: string,
    payload: DataRollbackPayload,
    maxBytes?: number,
  ): Promise<EncryptedRollbackArtifact> {
    const existing = await prisma.dataRollbackArtifact.findUnique({
      where: { movementId },
    });
    if (existing) return this.metadata(existing);

    const plain = Buffer.from(JSON.stringify(payload), 'utf8');
    const limit = this.maxBytes(maxBytes);
    if (plain.byteLength > limit) {
      throw new BadRequestException(`Rollback artifact exceeds configured ${limit}-byte limit`);
    }
    const compressed = await gzipAsync(plain);
    if (compressed.byteLength > limit) {
      throw new BadRequestException(`Compressed rollback artifact exceeds configured ${limit}-byte limit`);
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    try {
      const created = await prisma.dataRollbackArtifact.create({
        data: {
          movementId,
          ciphertext: encrypted,
          iv: iv.toString('base64'),
          authTag: cipher.getAuthTag().toString('base64'),
          sha256: createHash('sha256').update(encrypted).digest('hex'),
          compressedBytes: compressed.byteLength,
          uncompressedBytes: plain.byteLength,
          previousCount: payload.previousRows.length,
          insertedCount: payload.insertedExternalIds.length,
          expiresAt: this.expiresAt(),
        },
      });
      return this.metadata(created);
    } catch (error) {
      // A concurrent retry may have won the unique movementId insert. Its
      // immutable snapshot is authoritative; never replace it.
      const winner = await prisma.dataRollbackArtifact.findUnique({
        where: { movementId },
      });
      if (winner) return this.metadata(winner);
      throw error;
    }
  }

  async readArtifact(metadata: EncryptedRollbackArtifact): Promise<DataRollbackPayload> {
    if (metadata.storage !== 'database') {
      throw new Error('Rollback artifact is not in durable database storage');
    }
    const stored = await prisma.dataRollbackArtifact.findUnique({
      where: { id: metadata.artifactId },
    });
    if (!stored) throw new Error('Rollback artifact is missing or was removed by retention');
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new Error('Rollback artifact retention period has expired');
    }
    const encrypted = Buffer.from(stored.ciphertext);
    const checksum = createHash('sha256').update(encrypted).digest('hex');
    if (checksum !== metadata.sha256 || checksum !== stored.sha256) {
      throw new Error('Rollback artifact checksum mismatch');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(stored.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(stored.authTag, 'base64'));
    const compressed = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const plain = await gunzipAsync(compressed);
    return JSON.parse(plain.toString('utf8')) as DataRollbackPayload;
  }

  async captureUpsertSnapshot(input: {
    movementId: string;
    targetAlias: string;
    objectName: string;
    externalIdField: string;
    csvPath: string;
    maxBytes?: number;
  }): Promise<EncryptedRollbackArtifact> {
    const movement = await prisma.dataMovement.findUnique({
      where: { id: input.movementId },
      include: { durableRollback: true },
    });
    if (!movement) throw new NotFoundException('Data movement not found');
    if (movement.durableRollback) {
      const artifact = this.metadata(movement.durableRollback);
      await prisma.dataMovement.update({
        where: { id: input.movementId },
        data: {
          rollbackArtifact: artifact as unknown as Prisma.InputJsonValue,
          rollbackStatus: 'captured',
        },
      });
      return artifact;
    }
    if (movement.rollbackArtifact) {
      throw new Error('Rollback artifact metadata exists but durable ciphertext is missing');
    }

    const sourceRows = parseCsv(await readFile(input.csvPath, 'utf8'));
    const fields = [...new Set(sourceRows.flatMap((row) => Object.keys(row)))]
      .filter((field) => field.toLowerCase() !== 'id');
    if (!fields.some((field) => field.toLowerCase() === input.externalIdField.toLowerCase())) {
      throw new Error(`Rollback capture CSV is missing ${input.externalIdField}`);
    }
    const keys = [...new Set(sourceRows.map((row) => row[input.externalIdField]?.trim()).filter(Boolean) as string[])];
    const previousRows = await this.queryByKeys(
      input.targetAlias,
      input.objectName,
      input.externalIdField,
      keys,
      ['Id', ...fields],
    );
    const existing = new Set(previousRows.map((row) => String(row[input.externalIdField] ?? '')));
    const payload: DataRollbackPayload = {
      version: 1,
      objectName: input.objectName,
      externalIdField: input.externalIdField,
      previousRows,
      insertedExternalIds: keys.filter((key) => !existing.has(key)),
    };
    const artifact = await this.writeArtifact(input.movementId, payload, input.maxBytes);
    await prisma.dataMovement.update({
      where: { id: input.movementId },
      data: {
        rollbackArtifact: artifact as unknown as Prisma.InputJsonValue,
        rollbackStatus: 'captured',
      },
    });
    return artifact;
  }

  async rollbackMovement(
    movementId: string,
    userId: string,
    policy: { deleteInserted: boolean },
  ) {
    const movement = await prisma.dataMovement.findUnique({
      where: { id: movementId },
      include: { targetOrg: true },
    });
    if (!movement) throw new NotFoundException('Data movement not found');
    assertResourceOwner(movement, userId, 'Data movement');
    if (!ROLLBACK_SOURCE_TERMINAL_STATUSES.includes(movement.status)) {
      throw new ConflictException(
        `Rollback is unavailable while the source movement is ${movement.status}`,
      );
    }
    if (movement.rollbackStatus === 'completed' && movement.rollbackReport) {
      return {
        ...(movement.rollbackReport as Record<string, unknown>),
        idempotent: true,
      };
    }
    if (movement.operation !== 'upsert' || !movement.idempotent || !movement.rollbackArtifact) {
      const report = {
        safe: false,
        reason: 'Automatic rollback is available only for idempotent upserts with a complete capture artifact',
      };
      await prisma.dataMovement.update({
        where: { id: movementId },
        data: { rollbackStatus: 'blocked', rollbackReport: report },
      });
      throw new BadRequestException(report.reason);
    }

    const claimed = await prisma.dataMovement.updateMany({
      where: {
        id: movementId,
        OR: [
          { rollbackStatus: null },
          { rollbackStatus: { notIn: ['running', 'completed'] } },
        ],
      },
      data: { rollbackStatus: 'running' },
    });
    if (claimed.count === 0) {
      throw new ConflictException('Rollback is already running or completed');
    }

    const artifact = movement.rollbackArtifact as unknown as EncryptedRollbackArtifact;
    let workDir: string | undefined;
    try {
      const payload = await this.readArtifact(artifact);
      const targetAlias = movement.targetOrg.username ?? movement.targetOrg.alias;
      workDir = join(tmpdir(), 'sfcc-data-rollback', `restore-${movementId}`);
      await mkdir(workDir, { recursive: true });
      let deleted = 0;

      // Restoring rows that existed before the deployment is always the safe
      // first action. Deletion of newly inserted rows remains separately gated.
      if (payload.previousRows.length) {
        const path = join(workDir, 'restore.csv');
        await writeFile(path, serializeBulkCsv(payload.previousRows), 'utf8');
        const slot = await this.bulkThrottle.acquire(targetAlias);
        try {
          const result = await this.sfCli.updateBulk(payload.objectName, path, targetAlias, 30, { cwd: workDir });
          if (!result.success) throw new Error(result.error ?? 'Rollback restore failed');
        } finally {
          await slot.release();
        }
      }
      if (payload.insertedExternalIds.length && policy.deleteInserted) {
        const inserted = await this.queryByKeys(
          targetAlias,
          payload.objectName,
          payload.externalIdField,
          payload.insertedExternalIds,
          ['Id'],
        );
        const path = join(workDir, 'delete.csv');
        await writeFile(path, serializeBulkCsv(inserted.map((row) => ({ Id: row.Id }))), 'utf8');
        if (inserted.length) {
          const slot = await this.bulkThrottle.acquire(targetAlias);
          try {
            const result = await this.sfCli.deleteBulk(payload.objectName, path, targetAlias, 30, { cwd: workDir });
            if (!result.success) throw new Error(result.error ?? 'Rollback delete failed');
            deleted = inserted.length;
          } finally {
            await slot.release();
          }
        }
      }
      if (payload.insertedExternalIds.length && !policy.deleteInserted) {
        const report = {
          safe: true,
          status: 'awaiting_delete_confirmation',
          restored: payload.previousRows.length,
          deleted: 0,
          insertedCount: payload.insertedExternalIds.length,
          requiresDeleteInsertedConfirmation: true,
          reason: 'Existing rows were restored; set deleteInserted=true to delete records inserted by the deployment',
        };
        await prisma.dataMovement.update({
          where: { id: movementId },
          data: {
            rollbackStatus: 'awaiting_delete_confirmation',
            rollbackReport: report,
          },
        });
        return report;
      }
      const report = {
        safe: true,
        status: 'completed',
        restored: payload.previousRows.length,
        deleted,
      };
      await prisma.dataMovement.update({
        where: { id: movementId },
        data: { rollbackStatus: 'completed', rollbackReport: report },
      });
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.dataMovement.update({
        where: { id: movementId },
        data: {
          rollbackStatus: 'failed',
          rollbackReport: { safe: false, status: 'failed', reason: message },
        },
      }).catch(() => undefined);
      throw error;
    } finally {
      if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async rollbackBatch(batchId: string, userId: string, policy: { deleteInserted: boolean }) {
    const batch = await prisma.dataDeployBatch.findUnique({
      where: { id: batchId },
      include: {
        movements: { orderBy: { chunkIndex: 'desc' } },
        chunks: {
          select: {
            movementId: true,
            status: true,
            jobId: true,
            recordCount: true,
            afterId: true,
            endId: true,
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Data deploy batch not found');
    assertResourceOwner(batch, userId, 'Data deploy batch');
    if (!ROLLBACK_SOURCE_TERMINAL_STATUSES.includes(batch.status)) {
      throw new ConflictException(
        `Rollback is unavailable while the source batch is ${batch.status}`,
      );
    }
    const chunksByMovement = new Map(
      batch.chunks
        .filter((chunk) => chunk.movementId)
        .map((chunk) => [chunk.movementId!, chunk]),
    );
    const rollbackEligible = batch.movements.filter((movement) => {
      const chunk = chunksByMovement.get(movement.id);
      return Boolean(
        movement.rollbackArtifact
        || (movement.recordCount != null && movement.recordCount > 0)
        || ['running', 'completed'].includes(movement.status)
        || chunk?.jobId,
      );
    });
    const nonTerminal = rollbackEligible.filter(
      (movement) => !ROLLBACK_SOURCE_TERMINAL_STATUSES.includes(movement.status),
    );
    if (nonTerminal.length) {
      throw new ConflictException(
        `Rollback is unavailable while source movement(s) are active: ${
          nonTerminal.map((movement) => movement.id).join(', ')
        }`,
      );
    }
    const unsafe = rollbackEligible.filter((movement) =>
      movement.operation !== 'upsert' || !movement.idempotent || !movement.rollbackArtifact);
    if (unsafe.length) {
      const report = {
        safe: false,
        reason: 'One or more chunks lack a complete idempotent rollback artifact',
        unsafeMovementIds: unsafe.map((movement) => movement.id),
      };
      await prisma.dataDeployBatch.update({
        where: { id: batchId },
        data: { rollbackStatus: 'blocked', rollbackReport: report },
      });
      throw new BadRequestException(report.reason);
    }
    const results = [];
    for (const movement of rollbackEligible) {
      results.push(await this.rollbackMovement(movement.id, userId, policy));
    }
    const awaitingConfirmation = results.some(
      (result) => (result as Record<string, unknown>).status === 'awaiting_delete_confirmation',
    );
    await prisma.dataDeployBatch.update({
      where: { id: batchId },
      data: {
        rollbackStatus: awaitingConfirmation ? 'awaiting_delete_confirmation' : 'completed',
        rollbackReport: {
          safe: true,
          status: awaitingConfirmation ? 'awaiting_delete_confirmation' : 'completed',
          results,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      batchId,
      status: awaitingConfirmation ? 'awaiting_delete_confirmation' : 'completed',
      results,
    };
  }

  private async queryByKeys(
    alias: string,
    objectName: string,
    externalIdField: string,
    keys: string[],
    fields: string[],
  ): Promise<Array<Record<string, unknown>>> {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(objectName)
      || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(externalIdField)
      || fields.some((field) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field))) {
      throw new Error('Invalid rollback object or field identifier');
    }
    const records: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < keys.length; offset += QUERY_KEY_CHUNK) {
      const literals = keys.slice(offset, offset + QUERY_KEY_CHUNK)
        .map((key) => `'${escapeSoqlLiteral(key)}'`)
        .join(', ');
      const result = await this.sfCli.query(
        alias,
        `SELECT ${[...new Set(fields)].join(', ')} FROM ${objectName} `
        + `WHERE ${externalIdField} IN (${literals})`,
      );
      if (!result.success) throw new Error(result.error ?? 'Rollback target snapshot query failed');
      records.push(...((result.data?.result?.records ?? []) as Array<Record<string, unknown>>).map(
        ({ attributes: _attributes, ...record }) => record,
      ));
    }
    return records;
  }
}
