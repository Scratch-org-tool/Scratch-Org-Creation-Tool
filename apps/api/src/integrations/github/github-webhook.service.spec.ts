import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  workItemConnection: { findFirst: vi.fn() },
  webhookDelivery: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  workItemSnapshot: { upsert: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import type { GitHubIntegrationService } from './github-integration.service';
import {
  GitHubWebhookService,
  verifyGitHubWebhookSignature,
} from './github-webhook.service';

const secret = 'a-long-random-webhook-secret';
const payload = Buffer.from(
  JSON.stringify({
    action: 'edited',
    installation: { id: 456 },
    repository: { full_name: 'acme/repo' },
    issue: {
      id: 10,
      number: 7,
      state: 'open',
      updated_at: '2026-01-02T00:00:00Z',
    },
  }),
);
const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

describe('GitHub webhook processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.workItemConnection.findFirst.mockResolvedValue({ id: 'work-connection' });
    db.webhookDelivery.create.mockResolvedValue({
      id: 'delivery-row',
      status: 'received',
      payloadHash: 'unused',
    });
    db.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
    db.webhookDelivery.update.mockResolvedValue({});
    db.workItemSnapshot.upsert.mockResolvedValue({});
  });

  function service() {
    return new GitHubWebhookService({
      getWorkItemCredentials: vi.fn().mockResolvedValue({
        webhookSecret: secret,
      }),
    } as unknown as GitHubIntegrationService);
  }

  it('validates sha256 signatures over exact raw bytes', () => {
    expect(verifyGitHubWebhookSignature(payload, signature, secret)).toBe(true);
    expect(
      verifyGitHubWebhookSignature(
        Buffer.from(`${payload.toString()} `),
        signature,
        secret,
      ),
    ).toBe(false);
    expect(verifyGitHubWebhookSignature(payload, 'sha256=bad', secret)).toBe(false);
  });

  it('stores an idempotent delivery and refreshes its issue snapshot', async () => {
    await expect(
      service().receive({
        rawBody: payload,
        signature,
        deliveryId: 'delivery-1',
        eventType: 'issues',
      }),
    ).resolves.toEqual({
      accepted: true,
      duplicate: false,
      deliveryId: 'delivery-1',
    });
    expect(db.workItemSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workItemConnectionId_externalProjectId_externalItemId: {
            workItemConnectionId: 'work-connection',
            externalProjectId: 'acme/repo',
            externalItemId: 'acme/repo#7',
          },
        },
      }),
    );
    expect(db.webhookDelivery.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'processed' }),
      }),
    );
  });

  it('acknowledges an already processed delivery without processing twice', async () => {
    db.webhookDelivery.create.mockRejectedValue({ code: 'P2002' });
    db.webhookDelivery.findUnique.mockResolvedValue({
      id: 'delivery-row',
      status: 'processed',
      connectionScope: 'work:work-connection',
      workItemConnectionId: 'work-connection',
      payloadHash: await import('crypto').then(({ createHash }) =>
        createHash('sha256').update(payload).digest('hex'),
      ),
    });
    await expect(
      service().receive({
        rawBody: payload,
        signature,
        deliveryId: 'delivery-1',
        eventType: 'issues',
      }),
    ).resolves.toMatchObject({ accepted: true, duplicate: true });
    expect(db.workItemSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('rejects unsigned payloads before creating delivery state', async () => {
    await expect(
      service().receive({
        rawBody: payload,
        signature: 'sha256='.padEnd(71, '0'),
        deliveryId: 'delivery-1',
        eventType: 'issues',
      }),
    ).rejects.toThrow('Invalid GitHub webhook signature');
    expect(db.webhookDelivery.create).not.toHaveBeenCalled();
  });
});
