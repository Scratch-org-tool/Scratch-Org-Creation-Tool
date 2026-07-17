import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  notificationChannelWebhook: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { notificationWebhookCreateSchema } from '@sfcc/shared';
import { encrypt } from '../../common/crypto.util';
import { ChannelWebhookService } from './channel-webhook.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    type: 'slack',
    name: 'Deploys',
    encryptedUrl: encrypt('https://hooks.slack.com/services/T0/B0/xyz'),
    enabled: true,
    categories: [] as string[],
    createdAt: new Date('2026-07-17T00:00:00.000Z'),
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    ...overrides,
  };
}

describe('notificationWebhookCreateSchema', () => {
  it('accepts a Slack webhook only from hooks.slack.com over https', () => {
    expect(
      notificationWebhookCreateSchema.safeParse({
        type: 'slack',
        name: 'Deploys',
        url: 'https://hooks.slack.com/services/T0/B0/xyz',
      }).success,
    ).toBe(true);
    expect(
      notificationWebhookCreateSchema.safeParse({
        type: 'slack',
        name: 'Deploys',
        url: 'https://evil.example.com/services/T0/B0/xyz',
      }).success,
    ).toBe(false);
    expect(
      notificationWebhookCreateSchema.safeParse({
        type: 'teams',
        name: 'Deploys',
        url: 'http://insecure.example.com/webhook',
      }).success,
    ).toBe(false);
  });

  it('accepts Teams webhooks from office or Power Automate hosts', () => {
    expect(
      notificationWebhookCreateSchema.safeParse({
        type: 'teams',
        name: 'Ops',
        url: 'https://contoso.webhook.office.com/webhookb2/abc',
        categories: ['deployment'],
      }).success,
    ).toBe(true);
  });
});

describe('ChannelWebhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('never returns the raw webhook URL, only a redacted preview', async () => {
    db.notificationChannelWebhook.findMany.mockResolvedValue([row()]);
    const service = new ChannelWebhookService();
    const [record] = await service.list();
    expect(record.urlPreview).toContain('hooks.slack.com');
    expect(JSON.stringify(record)).not.toContain('xyz');
  });

  it('dispatches to matching category filters only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    db.notificationChannelWebhook.findMany.mockResolvedValue([
      row({ id: 'all', categories: [] }),
      row({ id: 'deploys-only', categories: ['deployment'] }),
      row({ id: 'data-only', categories: ['data'] }),
    ]);
    db.notificationChannelWebhook.update.mockResolvedValue({});

    const service = new ChannelWebhookService();
    await service.dispatch({
      userId: 'DPT_user',
      category: 'deployment',
      title: 'Deploy finished',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('records delivery failures without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    db.notificationChannelWebhook.findMany.mockResolvedValue([row()]);
    db.notificationChannelWebhook.update.mockResolvedValue({});

    const service = new ChannelWebhookService();
    await expect(
      service.dispatch({ userId: 'DPT_user', category: 'system', title: 'x' }),
    ).resolves.toBeUndefined();

    expect(db.notificationChannelWebhook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: expect.stringContaining('HTTP 500') }),
      }),
    );
  });

  it('formats Slack Block Kit and Teams MessageCard payloads', () => {
    process.env.PUBLIC_APP_URL = 'https://devops.example.test';
    const service = new ChannelWebhookService();
    const input = {
      userId: 'DPT_user',
      category: 'deployment' as const,
      level: 'error' as const,
      title: 'Deploy failed',
      body: 'Apex tests failed.',
      link: '/monitoring',
    };
    const slack = service.slackPayload(input);
    expect(slack.text).toContain('Deploy failed');
    expect(JSON.stringify(slack.blocks)).toContain('Deploy failed');

    const teams = service.teamsPayload(input) as Record<string, unknown>;
    expect(teams['@type']).toBe('MessageCard');
    expect(teams.title).toBe('Deploy failed');
    expect(JSON.stringify(teams)).toContain('OpenUri');
    expect(JSON.stringify(teams)).toContain('https://devops.example.test/monitoring');
    delete process.env.PUBLIC_APP_URL;
  });
});
