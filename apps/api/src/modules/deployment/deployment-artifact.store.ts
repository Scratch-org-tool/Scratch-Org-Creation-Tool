import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { removeTempDir } from '../../common/temp-cleanup.util';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', '.sf', '.sfdx', '.turbo']);
const DEFAULT_RETENTION_DAYS = 90;

interface ArchivedFile {
  path: string;
  content: string;
}

export interface DurableArtifactStore {
  putBytes(kind: string, content: Buffer, metadata?: Record<string, unknown>): Promise<string>;
  putDirectory(kind: string, root: string, metadata?: Record<string, unknown>): Promise<string>;
  readBytes(id: string): Promise<Buffer>;
  materializeDirectory(id: string, prefix: string): Promise<{
    root: string;
    cleanup: () => Promise<void>;
  }>;
}

@Injectable()
export class DeploymentArtifactStore implements DurableArtifactStore {
  async putBytes(kind: string, content: Buffer, metadata: Record<string, unknown> = {}) {
    const checksum = sha256(content);
    const id = `${kind}:${checksum}`;
    const retentionDays = boundedRetentionDays();
    await prisma.deploymentArtifact.upsert({
      where: { id },
      create: {
        id,
        kind,
        checksum,
        content: Uint8Array.from(content),
        sizeBytes: content.byteLength,
        metadata: metadata as Prisma.InputJsonValue,
        retainUntil: new Date(Date.now() + retentionDays * 86_400_000),
      },
      update: {
        retainUntil: new Date(Date.now() + retentionDays * 86_400_000),
      },
    });
    return id;
  }

  async putDirectory(kind: string, root: string, metadata: Record<string, unknown> = {}) {
    const canonical = Buffer.from(JSON.stringify(readDirectory(root)), 'utf8');
    return this.putBytes(kind, gzipSync(canonical), {
      ...metadata,
      encoding: 'canonical-json+gzip',
      contentChecksum: sha256(canonical),
    });
  }

  async readBytes(id: string) {
    const artifact = await prisma.deploymentArtifact.findUnique({ where: { id } });
    if (!artifact) throw new Error(`Durable deployment artifact ${id} is unavailable`);
    const bytes = Buffer.from(artifact.content);
    if (sha256(bytes) !== artifact.checksum) {
      throw new Error(`Durable deployment artifact ${id} failed checksum verification`);
    }
    return bytes;
  }

  async materializeDirectory(id: string, prefix = 'sfcc-artifact-') {
    const bytes = await this.readBytes(id);
    let files: ArchivedFile[];
    try {
      files = JSON.parse(gunzipSync(bytes).toString('utf8')) as ArchivedFile[];
    } catch {
      throw new Error(`Durable deployment artifact ${id} is not a directory archive`);
    }
    const root = fs.mkdtempSync(path.join(tmpdir(), `${prefix}${randomUUID()}-`));
    try {
      for (const file of files) {
        const relative = safeRelative(file.path);
        const destination = path.join(root, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, Buffer.from(file.content, 'base64'), { flag: 'wx' });
      }
    } catch (error) {
      await removeTempDir(root);
      throw error;
    }
    return { root, cleanup: () => removeTempDir(root) };
  }
}

function readDirectory(root: string): ArchivedFile[] {
  const files: ArchivedFile[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Artifact source contains unsupported symlink: ${absolute}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        files.push({
          path: path.relative(root, absolute).split(path.sep).join('/'),
          content: fs.readFileSync(absolute).toString('base64'),
        });
      }
    }
  };
  visit(root);
  return files;
}

function safeRelative(value: string) {
  const normalized = path.posix.normalize(value);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error('Artifact archive contains an unsafe path');
  }
  return normalized.split('/').join(path.sep);
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function boundedRetentionDays() {
  const configured = Number(process.env.DEPLOY_ARTIFACT_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  return Number.isInteger(configured) ? Math.min(Math.max(configured, 1), 3650) : DEFAULT_RETENTION_DAYS;
}
