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
    const rows = await prisma.gitHubAttachment.findMany({
      where: {
        workItemConnectionId: scope.workItemConnectionId,
        externalProjectId: scope.externalProjectId,
        externalItemId: scope.workItemId,
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
    const row = await prisma.gitHubAttachment.create({
      data: {
        workItemConnectionId: input.scope.workItemConnectionId,
        externalProjectId: input.scope.externalProjectId,
        externalItemId: input.scope.workItemId,
        fileName: name,
        contentType,
        sizeBytes: input.content.length,
        sha256: createHash('sha256').update(input.content).digest('hex'),
        encryptedBlob: Buffer.from(encrypt(input.content.toString('base64')), 'utf8'),
        createdBy: input.authorId ?? null,
      },
    });
    return this.metadata(row);
  }

  async get(
    scope: GitHubAttachmentScope,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; attachment: WorkItemAttachment }> {
    await this.assertScope(scope);
    const row = await prisma.gitHubAttachment.findFirst({
      where: {
        id: attachmentId,
        workItemConnectionId: scope.workItemConnectionId,
        externalProjectId: scope.externalProjectId,
        externalItemId: scope.workItemId,
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
