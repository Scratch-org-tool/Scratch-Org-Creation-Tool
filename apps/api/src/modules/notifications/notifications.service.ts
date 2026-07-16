import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  applyNotificationSettingsUpdate,
  isCategoryEnabled,
  normalizeNotificationSettings,
  type NotificationInput,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationRecord,
  type NotificationSettings,
  type NotificationSettingsUpdateInput,
} from '@sfcc/shared';
import { StreamService } from '../stream/stream.service';

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

  constructor(private readonly stream: StreamService) {}

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
  async notify(input: NotificationInput): Promise<NotificationRecord | null> {
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
      return record;
    } catch (error) {
      this.logger.warn(
        `notify failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
