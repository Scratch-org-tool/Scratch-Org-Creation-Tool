import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

const db = vi.hoisted(() => ({
  release: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  releaseItem: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  releaseApproval: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  deployment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  orgConnection: {
    findUnique: vi.fn(),
  },
  appUser: {
    findMany: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { ReleasesService } from './releases.service';

function createService() {
  const nvidia = { chat: vi.fn().mockResolvedValue({ content: 'Copilot is in dev mode' }) };
  const notifications = { notify: vi.fn().mockResolvedValue(null) };
  const service = new ReleasesService(nvidia as never, notifications as never);
  return { service, nvidia, notifications };
}

function releaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Summer Release',
    version: '1.2.0',
    description: null,
    status: 'draft',
    targetOrgId: null,
    targetOrg: null,
    releaseNotes: null,
    notesGeneratedAt: null,
    scheduledAt: null,
    releasedAt: null,
    createdBy: 'DPT_owner',
    createdAt: new Date('2026-07-17T00:00:00.000Z'),
    updatedAt: new Date('2026-07-17T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ReleasesService lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate name+version pairs with a conflict', async () => {
    db.release.create.mockRejectedValue({ code: 'P2002' });
    const { service } = createService();
    await expect(
      service.create({ name: 'Summer Release', version: '1.2.0' }, 'DPT_owner'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires at least one item before submitting for review', async () => {
    db.release.findUnique.mockResolvedValue(releaseRow());
    db.releaseItem.count.mockResolvedValue(0);
    const { service } = createService();
    await expect(service.submit('r1', 'DPT_owner', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks non-owners from editing and self-approval by the creator', async () => {
    db.release.findUnique.mockResolvedValue(releaseRow({ status: 'in_review' }));
    const { service } = createService();
    await expect(service.submit('r1', 'DPT_other', false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.approve('r1', {}, 'DPT_owner')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('approves through the full transition and notifies the owner', async () => {
    db.release.findUnique.mockResolvedValue(releaseRow({ status: 'in_review' }));
    db.releaseApproval.create.mockResolvedValue({});
    db.release.update.mockResolvedValue(releaseRow({ status: 'approved' }));
    const { service, notifications } = createService();

    const updated = await service.approve('r1', { comment: 'LGTM' }, 'DPT_reviewer');
    expect(updated.status).toBe('approved');
    expect(db.releaseApproval.create).toHaveBeenCalledWith({
      data: { releaseId: 'r1', actorId: 'DPT_reviewer', decision: 'approved', comment: 'LGTM' },
    });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'DPT_owner', level: 'success' }),
    );
  });

  it('refuses invalid transitions', async () => {
    db.release.findUnique.mockResolvedValue(releaseRow({ status: 'draft' }));
    const { service } = createService();
    await expect(service.release('r1', 'DPT_owner', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents duplicate deployment links inside one release', async () => {
    db.release.findUnique.mockResolvedValue(releaseRow());
    db.deployment.findUnique.mockResolvedValue({
      id: 'd1', repo: 'repo', branch: 'main', status: 'completed', targetOrg: { alias: 'qa' },
    });
    db.releaseItem.findFirst.mockResolvedValue({ id: 'existing' });
    const { service } = createService();
    await expect(
      service.addItem('r1', { kind: 'deployment', deploymentId: '11111111-1111-4111-8111-111111111111' }, 'DPT_owner', false),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ReleasesService.generateNotes', () => {
  beforeEach(() => vi.clearAllMocks());

  function primeDetail() {
    db.release.findUnique
      .mockResolvedValueOnce(releaseRow())
      .mockResolvedValueOnce({
        ...releaseRow(),
        targetOrg: null,
        items: [
          {
            id: 'i1', kind: 'deployment', deploymentId: 'd1', workItemProvider: null,
            workItemProjectId: null, workItemExternalId: null, title: 'repo/main',
            metadata: null, addedBy: 'DPT_owner', createdAt: new Date(),
          },
          {
            id: 'i2', kind: 'work_item', deploymentId: null, workItemProvider: 'azure_boards',
            workItemProjectId: 'P1', workItemExternalId: '42', title: 'Fix login',
            metadata: null, addedBy: 'DPT_owner', createdAt: new Date(),
          },
        ],
        approvals: [],
      });
    db.deployment.findMany.mockResolvedValue([
      { id: 'd1', repo: 'repo', branch: 'main', status: 'completed', targetOrg: { alias: 'qa' } },
    ]);
    db.appUser.findMany.mockResolvedValue([]);
  }

  it('falls back to deterministic markdown when AI is in dev mode', async () => {
    primeDetail();
    db.release.update.mockImplementation(async ({ data }: { data: { releaseNotes: string } }) =>
      releaseRow({ releaseNotes: data.releaseNotes, targetOrg: null }),
    );
    const { service } = createService();

    const updated = await service.generateNotes('r1', 'DPT_owner', false);
    expect(updated.releaseNotes).toContain('# Summer Release 1.2.0');
    expect(updated.releaseNotes).toContain('repo/main');
    expect(updated.releaseNotes).toContain('P1#42');
  });

  it('uses the AI answer when the model is configured', async () => {
    primeDetail();
    db.release.update.mockImplementation(async ({ data }: { data: { releaseNotes: string } }) =>
      releaseRow({ releaseNotes: data.releaseNotes, targetOrg: null }),
    );
    const { service, nvidia } = createService();
    nvidia.chat.mockResolvedValue({ content: '## Summary\nGreat release.' });

    const updated = await service.generateNotes('r1', 'DPT_owner', false);
    expect(updated.releaseNotes).toBe('## Summary\nGreat release.');
  });
});
