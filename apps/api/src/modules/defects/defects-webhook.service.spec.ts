import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  workItemChangeNotification: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  appUser: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { DefectsWebhookService } from './defects-webhook.service';

function createService() {
  const notifications = { notify: vi.fn().mockResolvedValue({ id: 'n1' }) };
  const service = new DefectsWebhookService(notifications as never);
  return { service, notifications };
}

function azurePayload(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'workitem.updated',
    resource: {
      workItemId: 180,
      rev: 3,
      fields: {
        'System.Rev': { oldValue: '2', newValue: '3' },
        'System.State': { oldValue: 'New', newValue: 'Active' },
      },
      revision: {
        id: 180,
        rev: 3,
        fields: {
          'System.TeamProject': 'Fabrikam',
          'System.Title': 'Fix login bug',
          'System.State': 'Active',
          'System.ChangedDate': '2026-07-17T02:00:00.000Z',
          'System.AssignedTo': 'Jamal Hartnett <jamal@example.test>',
        },
      },
      ...overrides,
    },
    resourceContainers: { project: { id: 'proj-1' } },
  };
}

describe('DefectsWebhookService.verifySecret', () => {
  afterEach(() => {
    delete process.env.DEFECTS_WEBHOOK_SECRET;
  });

  it('rejects everything until the secret env var is set', () => {
    const { service } = createService();
    expect(service.isEnabled()).toBe(false);
    expect(service.verifySecret('anything')).toBe(false);
  });

  it('accepts only the exact configured secret', () => {
    process.env.DEFECTS_WEBHOOK_SECRET = 's3cret';
    const { service } = createService();
    expect(service.isEnabled()).toBe(true);
    expect(service.verifySecret('s3cret')).toBe(true);
    expect(service.verifySecret('wrong')).toBe(false);
    expect(service.verifySecret(undefined)).toBe(false);
  });
});

describe('DefectsWebhookService.normalize', () => {
  it('parses an Azure DevOps workitem.updated service hook payload', () => {
    const { service } = createService();
    const event = service.normalize(azurePayload());
    expect(event).toMatchObject({
      provider: 'azure_boards',
      projectId: 'proj-1',
      projectName: 'Fabrikam',
      workItemId: '180',
      title: 'Fix login bug',
      state: 'Active',
      revision: 3,
      assigneeEmail: 'jamal@example.test',
    });
    expect(event?.changedFields).toContain('System.State');
    expect(event?.changedFields).not.toContain('System.Rev');
  });

  it('parses identity-object AssignedTo values', () => {
    const payload = azurePayload();
    (payload.resource.revision.fields as Record<string, unknown>)['System.AssignedTo'] = {
      displayName: 'Jamal',
      uniqueName: 'jamal@example.test',
    };
    const { service } = createService();
    expect(service.normalize(payload)?.assigneeEmail).toBe('jamal@example.test');
  });

  it('parses the simplified custom payload shape', () => {
    const { service } = createService();
    const event = service.normalize({
      projectId: 'P1',
      workItemId: 42,
      title: 'Task',
      assigneeEmail: 'dev@example.test',
      revision: 7,
      changedFields: ['State'],
    });
    expect(event).toMatchObject({
      provider: 'custom',
      projectId: 'P1',
      workItemId: '42',
      revision: 7,
      assigneeEmail: 'dev@example.test',
    });
  });

  it('returns null for unrecognized payloads', () => {
    const { service } = createService();
    expect(service.normalize({ hello: 'world' })).toBeNull();
    expect(service.normalize(null)).toBeNull();
  });
});

describe('DefectsWebhookService.process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.workItemChangeNotification.upsert.mockResolvedValue({});
  });

  it('notifies the registered assignee and records the revision', async () => {
    db.workItemChangeNotification.findUnique.mockResolvedValue(null);
    db.appUser.findFirst.mockResolvedValue({ id: 'DPT_dev', status: 'active' });
    const { service, notifications } = createService();

    const event = service.normalize(azurePayload())!;
    const result = await service.process(event);

    expect(result.status).toBe('notified');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'DPT_dev',
        category: 'defects',
        title: expect.stringContaining('#180'),
        link: expect.stringContaining('/defects-command-centre?id=180'),
      }),
      { email: true },
    );
    expect(db.workItemChangeNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ lastRevision: 3 }),
      }),
    );
  });

  it('skips duplicate revisions without notifying again', async () => {
    db.workItemChangeNotification.findUnique.mockResolvedValue({
      lastRevision: 3,
      lastChangedDate: new Date('2026-07-17T02:00:00.000Z'),
      lastEmailAt: null,
    });
    const { service, notifications } = createService();

    const result = await service.process(service.normalize(azurePayload())!);
    expect(result).toEqual({ status: 'skipped', reason: 'duplicate_revision' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('skips silently when the assignee has no app account', async () => {
    db.workItemChangeNotification.findUnique.mockResolvedValue(null);
    db.appUser.findFirst.mockResolvedValue(null);
    const { service, notifications } = createService();

    const result = await service.process(service.normalize(azurePayload())!);
    expect(result).toEqual({ status: 'skipped', reason: 'assignee_not_registered' });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(db.workItemChangeNotification.upsert).toHaveBeenCalled();
  });

  it('throttles emails per item while still notifying in-app', async () => {
    db.workItemChangeNotification.findUnique.mockResolvedValue({
      lastRevision: 2,
      lastChangedDate: new Date('2026-07-17T01:00:00.000Z'),
      lastEmailAt: new Date(),
    });
    db.appUser.findFirst.mockResolvedValue({ id: 'DPT_dev', status: 'active' });
    const { service, notifications } = createService();

    const result = await service.process(service.normalize(azurePayload())!);
    expect(result.status).toBe('notified');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.anything(),
      { email: false },
    );
  });
});
