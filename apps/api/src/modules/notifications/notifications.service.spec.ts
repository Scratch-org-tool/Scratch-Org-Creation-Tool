import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  notificationSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  appUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { NotificationsService } from './notifications.service';

function createService() {
  const stream = { publish: vi.fn().mockResolvedValue(undefined) };
  const mail = {
    isConfigured: vi.fn().mockReturnValue(false),
    send: vi.fn().mockResolvedValue(true),
  };
  const webhooks = { dispatch: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(stream as never, mail as never, webhooks as never);
  return { service, stream, mail, webhooks };
}

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    channels: { inApp: true, email: false },
    categories: {
      deployment: true,
      data: true,
      environment: true,
      provisioning: true,
      system: true,
    },
    updatedBy: 'DPT_admin',
    updatedAt: new Date('2026-07-16T00:00:00.000Z'),
    ...overrides,
  };
}

describe('NotificationsService.getSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns disabled defaults when no row exists', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(null);
    const { service } = createService();
    const settings = await service.getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.channels.inApp).toBe(true);
  });

  it('normalizes a stored row', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(
      settingsRow({ categories: { data: false } }),
    );
    const { service } = createService();
    const settings = await service.getSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.categories.data).toBe(false);
    expect(settings.categories.deployment).toBe(true);
  });
});

describe('NotificationsService.notify gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suppresses when notifications are globally disabled', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow({ enabled: false }));
    const { service, stream } = createService();

    const result = await service.notify({
      userId: 'DPT_user',
      category: 'deployment',
      title: 'Deploy done',
    });

    expect(result).toBeNull();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('suppresses when the category is turned off', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(
      settingsRow({ categories: { deployment: false, data: true, environment: true, provisioning: true, system: true } }),
    );
    const { service } = createService();

    const result = await service.notify({
      userId: 'DPT_user',
      category: 'deployment',
      title: 'Deploy done',
    });

    expect(result).toBeNull();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('never notifies the synthetic system user', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow());
    const { service } = createService();

    const result = await service.notify({
      userId: 'system',
      category: 'deployment',
      title: 'Deploy done',
    });

    expect(result).toBeNull();
    expect(db.notificationSetting.findUnique).not.toHaveBeenCalled();
  });

  it('creates and publishes when enabled and category is on', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow());
    db.notification.create.mockResolvedValue({
      id: 'n1',
      category: 'deployment',
      level: 'success',
      title: 'Deploy done',
      body: null,
      link: '/monitoring',
      jobId: 'job1',
      metadata: null,
      readAt: null,
      createdAt: new Date('2026-07-16T01:00:00.000Z'),
    });
    const { service, stream } = createService();

    const result = await service.notify({
      userId: 'DPT_user',
      category: 'deployment',
      level: 'success',
      title: 'Deploy done',
      jobId: 'job1',
      link: '/monitoring',
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('n1');
    expect(result?.read).toBe(false);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(stream.publish).toHaveBeenCalledWith(
      'notification',
      expect.objectContaining({ id: 'n1', userId: 'DPT_user' }),
      'DPT_user',
    );
  });

  it('does not throw when persistence fails', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow());
    db.notification.create.mockRejectedValue(new Error('db down'));
    const { service } = createService();

    await expect(
      service.notify({ userId: 'DPT_user', category: 'system', title: 'x' }),
    ).resolves.toBeNull();
  });
});

describe('NotificationsService email delivery', () => {
  beforeEach(() => vi.clearAllMocks());

  function enabledEmailRow() {
    return settingsRow({ channels: { inApp: true, email: true } });
  }

  it('emails opted-in users when the email channel is on and SMTP configured', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(enabledEmailRow());
    db.notification.create.mockResolvedValue({
      id: 'n1', category: 'defects', level: 'info', title: 'T', body: null,
      link: '/defects-command-centre', jobId: null, metadata: null, readAt: null,
      createdAt: new Date(),
    });
    db.appUser.findUnique.mockResolvedValue({
      email: 'dev@example.test',
      emailNotifications: true,
      status: 'active',
    });
    const { service, mail } = createService();
    mail.isConfigured.mockReturnValue(true);

    await service.notify({
      userId: 'DPT_user',
      category: 'defects',
      title: 'Work item updated',
      link: '/defects-command-centre?id=42',
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dev@example.test',
      subject: expect.stringContaining('Work item updated'),
    }));
  });

  it('skips email for users who have not opted in', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(enabledEmailRow());
    db.notification.create.mockResolvedValue({
      id: 'n1', category: 'defects', level: 'info', title: 'T', body: null,
      link: null, jobId: null, metadata: null, readAt: null, createdAt: new Date(),
    });
    db.appUser.findUnique.mockResolvedValue({
      email: 'dev@example.test',
      emailNotifications: false,
      status: 'active',
    });
    const { service, mail } = createService();
    mail.isConfigured.mockReturnValue(true);

    await service.notify({ userId: 'DPT_user', category: 'defects', title: 'T' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('skips email when the admin email channel is off', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow());
    db.notification.create.mockResolvedValue({
      id: 'n1', category: 'system', level: 'info', title: 'T', body: null,
      link: null, jobId: null, metadata: null, readAt: null, createdAt: new Date(),
    });
    const { service, mail } = createService();
    mail.isConfigured.mockReturnValue(true);

    await service.notify({ userId: 'DPT_user', category: 'system', title: 'T' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(db.appUser.findUnique).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('honours the per-call email suppression flag', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(enabledEmailRow());
    db.notification.create.mockResolvedValue({
      id: 'n1', category: 'defects', level: 'info', title: 'T', body: null,
      link: null, jobId: null, metadata: null, readAt: null, createdAt: new Date(),
    });
    const { service, mail } = createService();
    mail.isConfigured.mockReturnValue(true);

    await service.notify(
      { userId: 'DPT_user', category: 'defects', title: 'T' },
      { email: false },
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.preferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the user opt-in state with global email availability', async () => {
    db.appUser.findUnique.mockResolvedValue({ emailNotifications: true });
    db.notificationSetting.findUnique.mockResolvedValue(
      settingsRow({ channels: { inApp: true, email: true } }),
    );
    const { service, mail } = createService();
    mail.isConfigured.mockReturnValue(true);

    const prefs = await service.getPreferences('DPT_user');
    expect(prefs).toEqual({
      emailNotifications: true,
      emailConfigured: true,
      globalEmailEnabled: true,
    });
  });

  it('persists the opt-in toggle', async () => {
    db.appUser.update.mockResolvedValue({});
    db.appUser.findUnique.mockResolvedValue({ emailNotifications: true });
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow());
    const { service } = createService();

    await service.updatePreferences('DPT_user', true);
    expect(db.appUser.update).toHaveBeenCalledWith({
      where: { id: 'DPT_user' },
      data: { emailNotifications: true },
    });
  });
});

describe('NotificationsService.updateSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges the partial update and persists normalized values', async () => {
    db.notificationSetting.findUnique.mockResolvedValue(settingsRow({ enabled: false }));
    db.notificationSetting.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      ...settingsRow(),
      ...create,
      updatedAt: new Date('2026-07-16T02:00:00.000Z'),
    }));
    const { service } = createService();

    const next = await service.updateSettings(
      { enabled: true, categories: { data: false } },
      'DPT_admin',
    );

    expect(next.enabled).toBe(true);
    expect(next.categories.data).toBe(false);
    const call = db.notificationSetting.upsert.mock.calls[0][0];
    expect(call.update.enabled).toBe(true);
    expect(call.create.updatedBy).toBe('DPT_admin');
  });
});

describe('NotificationsService.markAllRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks unread notifications read for the user', async () => {
    db.notification.updateMany.mockResolvedValue({ count: 3 });
    const { service } = createService();
    const result = await service.markAllRead('DPT_user');
    expect(result.updated).toBe(3);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'DPT_user', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
