import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  webhookDelivery: {
    create: vi.fn(),
    update: vi.fn(),
  },
  workItemSnapshot: {
    upsert: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import type { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import type { JiraWorkItemAdapter } from '../../integrations/jira/jira.adapter';
import { IntegrationWebhookService } from './integration-webhook.service';

describe('IntegrationWebhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.webhookDelivery.create.mockResolvedValue({ id: 'delivery-row' });
    db.webhookDelivery.update.mockResolvedValue({});
    db.workItemSnapshot.upsert.mockResolvedValue({});
  });

  it('validates HMAC, records delivery idempotently, and refreshes Jira snapshots', async () => {
    const secret = 'webhook-secret';
    const rawBody = Buffer.from(JSON.stringify({
      webhookEvent: 'jira:issue_updated',
      timestamp: 123,
      issue: { key: 'ABC-1' },
    }));
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const store = {
      getJira: vi.fn().mockResolvedValue({
        id: 'jira-connection',
        config: { webhookSecret: secret },
      }),
    } as unknown as AtlassianConnectionStore;
    const jira = {
      getWorkItemForConnection: vi.fn().mockResolvedValue({
        id: 'ABC-1',
        state: { name: 'Done' },
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    } as unknown as JiraWorkItemAdapter;
    const service = new IntegrationWebhookService(store, jira);

    await expect(service.receive({
      provider: 'jira',
      connectionId: 'jira-connection',
      headers: {
        'x-hub-signature-256': signature,
        'x-atlassian-webhook-identifier': 'delivery-1',
      },
      rawBody,
      payload: JSON.parse(rawBody.toString('utf8')),
    })).resolves.toEqual({
      accepted: true,
      duplicate: false,
      deliveryId: 'delivery-1',
    });
    expect(db.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: 'jira:jira-connection:delivery-1',
        eventType: 'jira:issue_updated',
      }),
    });
    expect(db.workItemSnapshot.upsert).toHaveBeenCalledWith({
      where: {
        workItemConnectionId_externalProjectId_externalItemId: {
          workItemConnectionId: 'jira-connection',
          externalProjectId: 'ABC',
          externalItemId: 'ABC-1',
        },
      },
      create: expect.objectContaining({ state: 'Done' }),
      update: expect.objectContaining({ state: 'Done' }),
    });
  });

  it('rejects invalid signatures before persistence', async () => {
    const service = new IntegrationWebhookService(
      {
        getBitbucket: vi.fn().mockResolvedValue({
          id: 'bb-connection',
          config: { webhookSecret: 'correct-secret' },
        }),
      } as unknown as AtlassianConnectionStore,
      {} as JiraWorkItemAdapter,
    );

    await expect(service.receive({
      provider: 'bitbucket',
      connectionId: 'bb-connection',
      headers: { 'x-hub-signature': 'sha256=wrong' },
      rawBody: Buffer.from('{}'),
      payload: {},
    })).rejects.toThrow(/Invalid webhook signature/);
    expect(db.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it('treats repeated provider delivery ids as successful duplicates', async () => {
    db.webhookDelivery.create.mockRejectedValueOnce({ code: 'P2002' });
    const service = new IntegrationWebhookService(
      {
        getBitbucket: vi.fn().mockResolvedValue({
          id: 'bb-connection',
          config: { webhookSecret: 'shared-secret' },
        }),
      } as unknown as AtlassianConnectionStore,
      {} as JiraWorkItemAdapter,
    );

    await expect(service.receive({
      provider: 'bitbucket',
      connectionId: 'bb-connection',
      headers: {
        'x-webhook-secret': 'shared-secret',
        'x-request-uuid': 'delivery-2',
        'x-event-key': 'repo:push',
      },
      rawBody: Buffer.from('{}'),
      payload: {},
    })).resolves.toEqual({
      accepted: true,
      duplicate: true,
      deliveryId: 'delivery-2',
    });
  });
});
