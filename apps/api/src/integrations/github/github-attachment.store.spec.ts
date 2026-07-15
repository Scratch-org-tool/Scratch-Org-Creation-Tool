import { beforeEach, describe, expect, it, vi } from 'vitest';

const attachmentRows = vi.hoisted(() => [] as any[]);
const db = vi.hoisted(() => ({
  workItemConnection: { findFirst: vi.fn() },
  gitHubAttachment: {
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `attachment-${attachmentRows.length + 1}`, createdAt: new Date(), ...data };
      attachmentRows.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where }: any) => attachmentRows.filter((row) =>
      row.workItemConnectionId === where.workItemConnectionId &&
      row.externalProjectId === where.externalProjectId &&
      row.externalItemId === where.externalItemId)),
    findFirst: vi.fn(async ({ where }: any) => attachmentRows.find((row) =>
      row.id === where.id &&
      row.workItemConnectionId === where.workItemConnectionId &&
      row.externalProjectId === where.externalProjectId &&
      row.externalItemId === where.externalItemId) ?? null),
    aggregate: vi.fn(async ({ where }: any) => ({
      _sum: {
        sizeBytes: attachmentRows
          .filter((row) =>
            (!where.workItemConnectionId || row.workItemConnectionId === where.workItemConnectionId) &&
            (!where.externalProjectId || row.externalProjectId === where.externalProjectId) &&
            (!where.externalItemId || row.externalItemId === where.externalItemId) &&
            (!where.createdBy || row.createdBy === where.createdBy))
          .reduce((sum, row) => sum + row.sizeBytes, 0),
      },
    })),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    delete: vi.fn(async ({ where }: any) => {
      const index = attachmentRows.findIndex((row) => row.id === where.id);
      if (index >= 0) attachmentRows.splice(index, 1);
      return {};
    }),
  },
  $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(db)),
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import { PrismaGitHubAttachmentStore } from './github-attachment.store';

const scope = {
  workItemConnectionId: 'github-work-items-1',
  externalProjectId: 'acme/repo',
  workItemId: 'acme/repo#7',
};

describe('PrismaGitHubAttachmentStore', () => {
  beforeEach(() => {
    attachmentRows.length = 0;
    vi.clearAllMocks();
    db.workItemConnection.findFirst.mockResolvedValue({ id: scope.workItemConnectionId });
  });

  it('encrypts bytes and scopes list/download to the owning connection and issue', async () => {
    const store = new PrismaGitHubAttachmentStore();
    const content = Buffer.from('private evidence');
    const attachment = await store.put({
      scope,
      name: 'evidence.txt',
      contentType: 'text/plain',
      content,
      authorId: 'user-1',
    });
    expect(attachment).toMatchObject({
      name: 'evidence.txt',
      sizeBytes: content.length,
      contentType: 'text/plain',
    });
    expect(attachmentRows[0].encryptedBlob.toString()).not.toContain('private evidence');
    await expect(store.list(scope)).resolves.toHaveLength(1);
    await expect(store.get(scope, attachment.id)).resolves.toMatchObject({ buffer: content });
    await expect(store.get({ ...scope, workItemId: 'acme/repo#8' }, attachment.id))
      .rejects.toThrow(/does not belong/);
  });

  it('rejects disallowed types, traversal names, oversized files, and mismatched projects', async () => {
    const store = new PrismaGitHubAttachmentStore();
    await expect(store.put({
      scope,
      name: '../payload.sh',
      contentType: 'application/x-sh',
      content: Buffer.from('x'),
    })).rejects.toThrow(/filename/);
    await expect(store.put({
      scope,
      name: 'payload.bin',
      contentType: 'application/octet-stream',
      content: Buffer.from('x'),
    })).rejects.toThrow(/not allowed/);
    await expect(store.put({
      scope,
      name: 'large.txt',
      contentType: 'text/plain',
      content: Buffer.alloc(PrismaGitHubAttachmentStore.MAX_BYTES + 1),
    })).rejects.toThrow(/10 MB/);
    await expect(store.list({ ...scope, externalProjectId: 'other/repo' }))
      .rejects.toThrow(/does not own/);
  });

  it('rejects inactive or non-GitHub connection scopes', async () => {
    db.workItemConnection.findFirst.mockResolvedValueOnce(null);
    await expect(new PrismaGitHubAttachmentStore().list(scope))
      .rejects.toThrow(/not active/);
  });

  it('enforces aggregate quota and uploader/admin deletion authorization', async () => {
    process.env.GITHUB_ATTACHMENT_USER_QUOTA_BYTES = '20';
    const store = new PrismaGitHubAttachmentStore();
    const attachment = await store.put({
      scope,
      name: 'evidence.txt',
      contentType: 'text/plain',
      content: Buffer.from('1234567890'),
      authorId: 'user-1',
    });
    await expect(store.put({
      scope,
      name: 'more.txt',
      contentType: 'text/plain',
      content: Buffer.from('12345678901'),
      authorId: 'user-1',
    })).rejects.toThrow(/user quota/);
    await expect(store.delete(scope, attachment.id, 'user-2', false))
      .rejects.toThrow(/uploader or an admin/);
    await expect(store.delete(scope, attachment.id, 'admin', true)).resolves.toBeUndefined();
    delete process.env.GITHUB_ATTACHMENT_USER_QUOTA_BYTES;
  });
});
