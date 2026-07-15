import { Injectable } from '@nestjs/common';
import type { WorkItemAttachment } from '@sfcc/shared';
import { prisma } from '@sfcc/db';
import { createHash } from 'crypto';
import { basename } from 'path';
import { decrypt, encrypt } from '../../common/crypto.util';
import { IntegrationError } from '../foundation/adapter.errors';

export const GITHUB_ATTACHMENT_STORE = Symbol('GITHUB_ATTACHMENT_STORE');

export interface GitHubAttachmentScope {
  workItemConnectionId: string;
  externalProjectId: string;
  workItemId: string;
}

export interface AppManagedAttachmentInput {
  scope: GitHubAttachmentScope;
  name: string;
  contentType: string;
  content: Buffer;
  authorId?: string;
}

/**
 * Attachment bytes must live in an app-controlled encrypted blob provider. GitHub issue-body
 * links are intentionally not considered attachments because their access controls can differ.
 */
export interface GitHubAttachmentStore {
  readonly available: boolean;
  list(scope: GitHubAttachmentScope): Promise<WorkItemAttachment[]>;
  put(input: AppManagedAttachmentInput): Promise<WorkItemAttachment>;
  get(
    scope: GitHubAttachmentScope,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; attachment: WorkItemAttachment }>;
  delete(
    scope: GitHubAttachmentScope,
    attachmentId: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<void>;
}

@Injectable()
export class DisabledGitHubAttachmentStore implements GitHubAttachmentStore {
  readonly available = false;

  async list(_scope: GitHubAttachmentScope): Promise<WorkItemAttachment[]> {
    return [];
  }

  async put(_input: AppManagedAttachmentInput): Promise<WorkItemAttachment> {
    throw this.unsupported();
  }

  async get(
    _scope: GitHubAttachmentScope,
    _attachmentId: string,
  ): Promise<{ buffer: Buffer; attachment: WorkItemAttachment }> {
    throw this.unsupported();
  }

  async delete(
    _scope: GitHubAttachmentScope,
    _attachmentId: string,
    _actorId: string,
    _isAdmin: boolean,
  ): Promise<void> {
    throw this.unsupported();
  }

  private unsupported(): IntegrationError {
    return new IntegrationError(
      'unsupported_capability',
      'GitHub attachments require an app-managed encrypted attachment provider',
      { provider: 'github_issues' },
    );
  }
}

@Injectable()
export class PrismaGitHubAttachmentStore implements GitHubAttachmentStore {
  readonly available = true;
  static readonly MAX_BYTES = 10 * 1024 * 1024;
  static readonly ISSUE_QUOTA_BYTES = 50 * 1024 * 1024;
  static readonly USER_QUOTA_BYTES = 100 * 1024 * 1024;
  static readonly CONNECTION_QUOTA_BYTES = 500 * 1024 * 1024;
  static readonly RETENTION_DAYS = 90;
  private readonly allowedTypes = new Set([
    'application/json',
    'application/pdf',
    'application/zip',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'text/markdown',
    'text/plain',
  ]);

  async list(scope: GitHubAttachmentScope): Promise<WorkItemAttachment[]> {
    await this.assertScope(scope);
    await this.purgeExpired();
    const rows = await prisma.gitHubAttachment.findMany({
      where: {
        workItemConnectionId: scope.workItemConnectionId,
        externalProjectId: scope.externalProjectId,
        externalItemId: scope.workItemId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.metadata(row));
  }

  async put(input: AppManagedAttachmentInput): Promise<WorkItemAttachment> {
    await this.assertScope(input.scope);
    const name = input.name.trim();
    if (!name || name !== basename(name) || /[\u0000-\u001f\u007f]/.test(name) || name.length > 255) {
      throw this.invalid('Attachment filename is invalid');
    }
    const contentType = input.contentType.toLowerCase().split(';', 1)[0].trim();
    if (!this.allowedTypes.has(contentType)) {
      throw this.invalid(`Attachment type "${contentType || 'unknown'}" is not allowed`);
    }
    if (!input.content.length || input.content.length > PrismaGitHubAttachmentStore.MAX_BYTES) {
      throw this.invalid('GitHub attachment must be between 1 byte and 10 MB');
    }
    if (!input.authorId) throw this.invalid('Authenticated attachment author is required');
    await this.purgeExpired();
    const row = await this.createWithinQuota(input, name, contentType);
    return this.metadata(row);
  }

  async get(
    scope: GitHubAttachmentScope,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; attachment: WorkItemAttachment }> {
    await this.assertScope(scope);
    await this.purgeExpired();
    const row = await prisma.gitHubAttachment.findFirst({
      where: {
        id: attachmentId,
        workItemConnectionId: scope.workItemConnectionId,
        externalProjectId: scope.externalProjectId,
        externalItemId: scope.workItemId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) {
      throw new IntegrationError('not_found', 'Attachment does not belong to this GitHub issue', {
        provider: 'github_issues',
      });
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(
        decrypt(Buffer.from(row.encryptedBlob).toString('utf8')),
        'base64',
      );
    } catch {
      throw new IntegrationError('provider_unavailable', 'Stored attachment could not be decrypted', {
        provider: 'github_issues',
      });
    }
    if (
      buffer.length !== row.sizeBytes ||
      createHash('sha256').update(buffer).digest('hex') !== row.sha256
    ) {
      throw new IntegrationError('provider_unavailable', 'Stored attachment failed integrity validation', {
        provider: 'github_issues',
      });
    }
    return { buffer, attachment: this.metadata(row) };
  }

  async delete(
    scope: GitHubAttachmentScope,
    attachmentId: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await this.assertScope(scope);
    const row = await prisma.gitHubAttachment.findFirst({
      where: {
        id: attachmentId,
        workItemConnectionId: scope.workItemConnectionId,
        externalProjectId: scope.externalProjectId,
        externalItemId: scope.workItemId,
      },
      select: { id: true, createdBy: true },
    });
    if (!row) {
      throw new IntegrationError('not_found', 'Attachment does not belong to this GitHub issue', {
        provider: 'github_issues',
      });
    }
    if (!isAdmin && row.createdBy !== actorId) {
      throw new IntegrationError('authorization_failed', 'Only the uploader or an admin may delete this attachment', {
        provider: 'github_issues',
      });
    }
    await prisma.gitHubAttachment.delete({ where: { id: row.id } });
  }

  async purgeExpired(): Promise<number> {
    const result = await prisma.gitHubAttachment.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  private async createWithinQuota(
    input: AppManagedAttachmentInput,
    name: string,
    contentType: string,
  ) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.limit('GITHUB_ATTACHMENT_RETENTION_DAYS', PrismaGitHubAttachmentStore.RETENTION_DAYS) *
        24 * 60 * 60 * 1_000,
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const active = { expiresAt: { gt: now } };
          const [connection, issue, user] = await Promise.all([
            tx.gitHubAttachment.aggregate({
              where: {
                workItemConnectionId: input.scope.workItemConnectionId,
                ...active,
              },
              _sum: { sizeBytes: true },
            }),
            tx.gitHubAttachment.aggregate({
              where: {
                workItemConnectionId: input.scope.workItemConnectionId,
                externalProjectId: input.scope.externalProjectId,
                externalItemId: input.scope.workItemId,
                ...active,
              },
              _sum: { sizeBytes: true },
            }),
            tx.gitHubAttachment.aggregate({
              where: { createdBy: input.authorId, ...active },
              _sum: { sizeBytes: true },
            }),
          ]);
          this.assertQuota(
            connection._sum.sizeBytes ?? 0,
            input.content.length,
            this.limit('GITHUB_ATTACHMENT_CONNECTION_QUOTA_BYTES', PrismaGitHubAttachmentStore.CONNECTION_QUOTA_BYTES),
            'connection',
          );
          this.assertQuota(
            issue._sum.sizeBytes ?? 0,
            input.content.length,
            this.limit('GITHUB_ATTACHMENT_ISSUE_QUOTA_BYTES', PrismaGitHubAttachmentStore.ISSUE_QUOTA_BYTES),
            'issue',
          );
          this.assertQuota(
            user._sum.sizeBytes ?? 0,
            input.content.length,
            this.limit('GITHUB_ATTACHMENT_USER_QUOTA_BYTES', PrismaGitHubAttachmentStore.USER_QUOTA_BYTES),
            'user',
          );
          return tx.gitHubAttachment.create({
            data: {
              workItemConnectionId: input.scope.workItemConnectionId,
              externalProjectId: input.scope.externalProjectId,
              externalItemId: input.scope.workItemId,
              fileName: name,
              contentType,
              sizeBytes: input.content.length,
              sha256: createHash('sha256').update(input.content).digest('hex'),
              encryptedBlob: Buffer.from(encrypt(input.content.toString('base64')), 'utf8'),
              createdBy: input.authorId,
              expiresAt,
            },
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (
          attempt < 2 &&
          error &&
          typeof error === 'object' &&
          (error as { code?: string }).code === 'P2034'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw this.invalid('Attachment quota transaction could not be completed');
  }

  private assertQuota(current: number, added: number, maximum: number, scope: string): void {
    if (current + added > maximum) {
      throw this.invalid(`GitHub attachment ${scope} quota would be exceeded`);
    }
  }

  private limit(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private async assertScope(scope: GitHubAttachmentScope): Promise<void> {
    if (
      !scope.workItemConnectionId ||
      !scope.externalProjectId ||
      !/^([^/\s]+)\/([^#/\s]+)#\d+$/.test(scope.workItemId)
    ) {
      throw this.invalid('GitHub attachment scope is invalid');
    }
    const repository = scope.workItemId.slice(0, scope.workItemId.lastIndexOf('#'));
    if (
      scope.externalProjectId.includes('/') &&
      scope.externalProjectId.toLowerCase() !== repository.toLowerCase()
    ) {
      throw this.invalid('Attachment project does not own the GitHub issue');
    }
    const connection = await prisma.workItemConnection.findFirst({
      where: {
        id: scope.workItemConnectionId,
        provider: 'github_issues',
        status: { in: ['connected', 'degraded'] },
      },
      select: { id: true },
    });
    if (!connection) {
      throw new IntegrationError('not_connected', 'GitHub Issues connection is not active', {
        provider: 'github_issues',
      });
    }
  }

  private metadata(row: {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    createdAt: Date;
  }): WorkItemAttachment {
    return {
      id: row.id,
      name: row.fileName,
      sizeBytes: row.sizeBytes,
      contentType: row.contentType,
      createdAt: row.createdAt.toISOString(),
      author: null,
      url: '',
    };
  }

  private invalid(message: string): IntegrationError {
    return new IntegrationError('invalid_request', message, { provider: 'github_issues' });
  }
}
