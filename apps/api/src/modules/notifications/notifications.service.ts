import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  applyNotificationSettingsUpdate,
  isCategoryEnabled,
  isChannelEnabled,
  normalizeNotificationSettings,
  type NotificationInput,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPreferences,
  type NotificationRecord,
  type NotificationSettings,
  type NotificationSettingsUpdateInput,
} from '@sfcc/shared';
import { StreamService } from '../stream/stream.service';
import { MailService } from './mail.service';

const GLOBAL_SETTINGS_ID = 'global';

interface NotificationRow {
  id: string;
  category: string;
  level: string;
  title: string;
  body: string | null;
  link: string | null;
  jobId: string | null;
  metadata: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly stream: StreamService,
    private readonly mail: MailService,
  ) {}

  /** Current global settings, falling back to the (disabled) defaults. */
  async getSettings(): Promise<NotificationSettings> {
    const row = await prisma.notificationSetting
      .findUnique({ where: { id: GLOBAL_SETTINGS_ID } })
      .catch(() => null);
    if (!row) return { ...DEFAULT_NOTIFICATION_SETTINGS };
    return normalizeNotificationSettings({
      enabled: row.enabled,
      channels: row.channels,
      categories: row.categories,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    });
  }

  /** Admin-only: persist a partial settings update on top of current state. */
  async updateSettings(
    update: NotificationSettingsUpdateInput,
    adminUserId: string,
  ): Promise<NotificationSettings> {
    const current = await this.getSettings();
    const next = applyNotificationSettingsUpdate(current, update);
    const saved = await prisma.notificationSetting.upsert({
      where: { id: GLOBAL_SETTINGS_ID },
      create: {
        id: GLOBAL_SETTINGS_ID,
        enabled: next.enabled,
        channels: next.channels as Prisma.InputJsonValue,
        categories: next.categories as Prisma.InputJsonValue,
        updatedBy: adminUserId,
      },
      update: {
        enabled: next.enabled,
        channels: next.channels as Prisma.InputJsonValue,
        categories: next.categories as Prisma.InputJsonValue,
        updatedBy: adminUserId,
      },
    });
    return normalizeNotificationSettings({
      enabled: saved.enabled,
      channels: saved.channels,
      categories: saved.categories,
      updatedAt: saved.updatedAt.toISOString(),
      updatedBy: saved.updatedBy,
    });
  }

  /**
   * Create and deliver a notification, but ONLY when an administrator has
   * enabled notifications and the target category is switched on. Returns the
   * created record, or null when the admin controls suppress it. This method
   * never throws — a delivery failure must not break the originating job.
   */
  async notify(
    input: NotificationInput,
    options?: { email?: boolean },
  ): Promise<NotificationRecord | null> {
    try {
      if (!input.userId || input.userId === 'system') return null;
      const settings = await this.getSettings();
      if (!isCategoryEnabled(settings, input.category)) return null;

      const created = await prisma.notification.create({
        data: {
          userId: input.userId,
          category: input.category,
          level: input.level ?? 'info',
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          jobId: input.jobId ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      const record = this.toRecord(created);
      // Live bell update — delivered only to the owning user (admins see all).
      await this.stream
        .publish('notification', { ...record, userId: input.userId }, input.userId)
        .catch(() => undefined);
      // Outbound email is fire-and-forget: it must never delay or fail the
      // originating job, so errors are swallowed inside deliverEmail.
      if (options?.email !== false) {
        void this.deliverEmail(settings, input);
      }
      return record;
    } catch (error) {
      this.logger.warn(
        `notify failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Send the email copy of a notification when every gate is open: admin
   * master switch + email channel, SMTP configured, and the recipient has
   * personally opted in.
   */
  private async deliverEmail(
    settings: NotificationSettings,
    input: NotificationInput,
  ): Promise<void> {
    try {
      if (!isChannelEnabled(settings, 'email')) return;
      if (!this.mail.isConfigured()) return;
      const user = await prisma.appUser.findUnique({
        where: { id: input.userId },
        select: { email: true, emailNotifications: true, status: true },
      });
      if (!user?.email || !user.emailNotifications || user.status === 'inactive') return;

      const appUrl = (process.env.PUBLIC_APP_URL ?? process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
      const link = input.link ? `${appUrl}${input.link}` : null;
      const lines = [input.body ?? '', link ? `\nOpen: ${link}` : ''].filter(Boolean);
      await this.mail.send({
        to: user.email,
        subject: `[SF DevOps] ${input.title}`,
        text: lines.join('\n') || input.title,
        html: this.renderEmailHtml(input.title, input.body ?? null, link),
      });
    } catch (error) {
      this.logger.warn(
        `email delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private renderEmailHtml(title: string, body: string | null, link: string | null): string {
    const escape = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    return [
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">',
      `<h2 style="margin:0 0 12px;font-size:18px">${escape(title)}</h2>`,
      body ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escape(body)}</p>` : '',
      link
        ? `<p style="margin:0 0 16px"><a href="${escape(link)}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Open in Command Center</a></p>`
        : '',
      '<p style="margin:16px 0 0;font-size:12px;color:#64748b">You are receiving this because email alerts are enabled on your account. You can turn them off under Account &gt; Email alerts.</p>',
      '</div>',
    ].join('');
  }

  /** Per-user delivery preferences shown on the Account page. */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const [user, settings] = await Promise.all([
      prisma.appUser.findUnique({
        where: { id: userId },
        select: { emailNotifications: true },
      }),
      this.getSettings(),
    ]);
    return {
      emailNotifications: user?.emailNotifications ?? false,
      emailConfigured: this.mail.isConfigured(),
      globalEmailEnabled: isChannelEnabled(settings, 'email'),
    };
  }

  async updatePreferences(
    userId: string,
    emailNotifications: boolean,
  ): Promise<NotificationPreferences> {
    await prisma.appUser.update({
      where: { id: userId },
      data: { emailNotifications },
    });
    return this.getPreferences(userId);
  }

  async list(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const [settings, rows, unreadCount] = await Promise.all([
      this.getSettings(),
      prisma.notification.findMany({
        where: { userId, ...(query.unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      notifications: page.map((row) => this.toRecord(row)),
      unreadCount,
      enabled: settings.enabled,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async unreadCount(userId: string): Promise<{ unreadCount: number; enabled: boolean }> {
    const [settings, unreadCount] = await Promise.all([
      this.getSettings(),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { unreadCount, enabled: settings.enabled };
  }

  async markRead(userId: string, id: string): Promise<NotificationRecord> {
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.readAt) return this.toRecord(existing);
    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toRecord(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Admin-only self test — obeys the same gating as any other notification. */
  async sendTest(adminUserId: string): Promise<{ delivered: boolean }> {
    const record = await this.notify({
      userId: adminUserId,
      category: 'system',
      level: 'info',
      title: 'Test notification',
      body: 'Notifications are configured correctly. Recipients will see alerts like this.',
      link: '/admin/notifications',
    });
    return { delivered: record !== null };
  }

  private toRecord(row: NotificationRow): NotificationRecord {
    return {
      id: row.id,
      category: row.category as NotificationRecord['category'],
      level: row.level as NotificationRecord['level'],
      title: row.title,
      body: row.body,
      link: row.link,
      jobId: row.jobId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
