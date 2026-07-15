import { createHash, createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  webhookDelivery: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
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
    db.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
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
      method: 'POST',
      path: '/api/integrations/webhooks/jira/jira-connection',
      query: '',
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
      method: 'POST',
      path: '/api/integrations/webhooks/bitbucket/bb-connection',
      query: '',
    })).rejects.toThrow(/Invalid webhook signature/);
    expect(db.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it('treats repeated provider delivery ids as successful duplicates', async () => {
    db.webhookDelivery.create.mockRejectedValueOnce({ code: 'P2002' });
    const duplicateBody = Buffer.from('{}');
    const duplicateHash = createHash('sha256').update(duplicateBody).digest('hex');
    db.webhookDelivery.findUnique.mockResolvedValueOnce({
      id: 'delivery-row',
      provider: 'bitbucket',
      connectionScope: 'scm:bb-connection',
      externalDeliveryId: 'delivery-2',
      payloadHash: duplicateHash,
      scmConnectionId: 'bb-connection',
      workItemConnectionId: null,
      status: 'processed',
    });
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
        'x-hub-signature': `sha256=${createHmac('sha256', 'shared-secret').update(duplicateBody).digest('hex')}`,
        'x-request-uuid': 'delivery-2',
        'x-event-key': 'repo:push',
      },
      rawBody: duplicateBody,
      payload: {},
      method: 'POST',
      path: '/api/integrations/webhooks/bitbucket/bb-connection',
      query: '',
    })).resolves.toEqual({
      accepted: true,
      duplicate: true,
      deliveryId: 'delivery-2',
    });
  });

  it('atomically reclaims a failed delivery with the same payload and connection', async () => {
    const body = Buffer.from('{}');
    const secret = 'shared-secret';
    const payloadHash = createHash('sha256').update(body).digest('hex');
    db.webhookDelivery.create.mockRejectedValueOnce({ code: 'P2002' });
    db.webhookDelivery.findUnique.mockResolvedValueOnce({
      id: 'delivery-row',
      provider: 'bitbucket',
      connectionScope: 'scm:bb-connection',
      externalDeliveryId: 'delivery-retry',
      payloadHash,
      scmConnectionId: 'bb-connection',
      workItemConnectionId: null,
      status: 'failed',
    });
    const service = new IntegrationWebhookService({
      getBitbucket: vi.fn().mockResolvedValue({
        id: 'bb-connection',
        config: { webhookSecret: secret },
      }),
    } as unknown as AtlassianConnectionStore, {} as JiraWorkItemAdapter);
    await expect(service.receive({
      provider: 'bitbucket',
      connectionId: 'bb-connection',
      headers: {
        'x-request-uuid': 'delivery-retry',
        'x-hub-signature': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      rawBody: body,
      payload: {},
      method: 'POST',
      path: '/api/integrations/webhooks/bitbucket/bb-connection',
      query: '',
    })).resolves.toMatchObject({ accepted: true, duplicate: false });
    expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'delivery-row',
        status: { in: ['received', 'failed'] },
        payloadHash,
        connectionScope: 'scm:bb-connection',
      }),
      data: expect.objectContaining({ status: 'processing' }),
    }));
  });

  it('rejects a reused delivery id with a different payload or connection scope', async () => {
    const body = Buffer.from('{"changed":true}');
    const secret = 'shared-secret';
    db.webhookDelivery.create.mockRejectedValueOnce({ code: 'P2002' });
    db.webhookDelivery.findUnique.mockResolvedValueOnce({
      id: 'delivery-row',
      provider: 'bitbucket',
      connectionScope: 'scm:bb-connection',
      externalDeliveryId: 'delivery-3',
      payloadHash: 'different-hash',
      scmConnectionId: 'bb-connection',
      workItemConnectionId: null,
      status: 'failed',
    });
    const service = new IntegrationWebhookService({
      getBitbucket: vi.fn().mockResolvedValue({
        id: 'bb-connection',
        config: { webhookSecret: secret },
      }),
    } as unknown as AtlassianConnectionStore, {} as JiraWorkItemAdapter);
    await expect(service.receive({
      provider: 'bitbucket',
      connectionId: 'bb-connection',
      headers: {
        'x-request-uuid': 'delivery-3',
        'x-hub-signature': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      rawBody: body,
      payload: { changed: true },
      method: 'POST',
      path: '/api/integrations/webhooks/bitbucket/bb-connection',
      query: '',
    })).rejects.toThrow(/reused with different/);
    expect(db.webhookDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('requires short request- and body-bound Jira JWTs with configured issuer/audience', async () => {
    const secret = 'jwt-secret';
    const rawBody = Buffer.from('{}');
    const request = {
      provider: 'jira',
      connectionId: 'jira-connection',
      rawBody,
      payload: {},
      method: 'POST',
      path: '/api/integrations/webhooks/jira/jira-connection',
      query: 'project=CORE',
    };
    const now = Math.floor(Date.now() / 1_000);
    const qsh = createHash('sha256')
      .update(`POST&${request.path}&project=CORE`)
      .digest('hex');
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'HS256' });
    const claims = encode({
      iat: now,
      exp: now + 120,
      iss: 'jira-addon',
      aud: 'sfcc',
      qsh,
      bodyHash: createHash('sha256').update(rawBody).digest('hex'),
    });
    const jwt = `${header}.${claims}.${createHmac('sha256', secret)
      .update(`${header}.${claims}`)
      .digest('base64url')}`;
    const service = new IntegrationWebhookService({
      getJira: vi.fn().mockResolvedValue({
        id: 'jira-connection',
        config: {
          webhookSecret: secret,
          webhookIssuer: 'jira-addon',
          webhookAudience: 'sfcc',
        },
      }),
    } as unknown as AtlassianConnectionStore, {} as JiraWorkItemAdapter);
    await expect(service.receive({
      ...request,
      headers: { authorization: `JWT ${jwt}` },
    })).resolves.toMatchObject({ accepted: true, duplicate: false });

    const noExpiryClaims = encode({ iat: now, qsh });
    const invalid = `${header}.${noExpiryClaims}.${createHmac('sha256', secret)
      .update(`${header}.${noExpiryClaims}`)
      .digest('base64url')}`;
    await expect(service.receive({
      ...request,
      headers: { authorization: `JWT ${invalid}` },
    })).rejects.toThrow(/requires exp and iat/);
  });
});
