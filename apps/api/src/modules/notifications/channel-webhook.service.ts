import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  type NotificationCategory,
  type NotificationInput,
  type NotificationLevel,
  type NotificationWebhookCreateInput,
  type NotificationWebhookRecord,
  type NotificationWebhookType,
  type NotificationWebhookUpdateInput,
} from '@sfcc/shared';
import { decrypt, encrypt } from '../../common/crypto.util';

const LEVEL_COLORS: Record<NotificationLevel, string> = {
  info: '#0891b2',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
};

interface WebhookRow {
  id: string;
  type: string;
  name: string;
  encryptedUrl: string;
  enabled: boolean;
  categories: string[];
  createdAt: Date;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
}

/**
 * Outbound Slack / Microsoft Teams delivery. Webhook URLs are encrypted at
 * rest and never returned to clients after creation. Dispatch is
 * fire-and-forget: failures are recorded on the row for admin visibility but
 * never propagate to the notification producer.
 */
@Injectable()
export class ChannelWebhookService {
  private readonly logger = new Logger(ChannelWebhookService.name);

  async list(): Promise<NotificationWebhookRecord[]> {
    const rows = await prisma.notificationChannelWebhook.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(
    input: NotificationWebhookCreateInput,
    adminUserId: string,
  ): Promise<NotificationWebhookRecord> {
    const row = await prisma.notificationChannelWebhook.create({
      data: {
        type: input.type,
        name: input.name,
        encryptedUrl: encrypt(input.url),
        categories: input.categories ?? [],
        createdBy: adminUserId,
      },
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    input: NotificationWebhookUpdateInput,
  ): Promise<NotificationWebhookRecord> {
    const existing = await prisma.notificationChannelWebhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook not found');
    const row = await prisma.notificationChannelWebhook.update({
      where: { id },
      data: {
        name: input.name,
        enabled: input.enabled,
        categories: input.categories,
      },
    });
    return this.toRecord(row);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const existing = await prisma.notificationChannelWebhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Webhook not found');
    await prisma.notificationChannelWebhook.delete({ where: { id } });
    return { deleted: true };
  }

  /** Send a test message so admins can verify a webhook end to end. */
  async sendTest(id: string): Promise<{ delivered: boolean; error?: string }> {
    const row = await prisma.notificationChannelWebhook.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Webhook not found');
    const outcome = await this.deliver(row, {
      userId: 'test',
      category: 'system',
      level: 'info',
      title: 'Test notification',
      body: 'This webhook is configured correctly. Alerts will look like this.',
      link: '/admin/notifications',
    });
    return outcome;
  }

  /**
   * Fan a notification out to every enabled webhook whose category filter
   * matches. Called (fire-and-forget) from NotificationsService.notify.
   */
  async dispatch(input: NotificationInput): Promise<void> {
    try {
      const rows = await prisma.notificationChannelWebhook.findMany({
        where: { enabled: true },
      });
      const matching = rows.filter(
        (row) => row.categories.length === 0 || row.categories.includes(input.category),
      );
      await Promise.all(matching.map((row) => this.deliver(row, input)));
    } catch (error) {
      this.logger.warn(
        `webhook dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async deliver(
    row: WebhookRow,
    input: NotificationInput,
  ): Promise<{ delivered: boolean; error?: string }> {
    try {
      const url = decrypt(row.encryptedUrl);
      const payload =
        row.type === 'slack' ? this.slackPayload(input) : this.teamsPayload(input);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await prisma.notificationChannelWebhook
        .update({ where: { id: row.id }, data: { lastSuccessAt: new Date(), lastError: null } })
        .catch(() => undefined);
      return { delivered: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`webhook '${row.name}' delivery failed: ${message}`);
      await prisma.notificationChannelWebhook
        .update({
          where: { id: row.id },
          data: { lastErrorAt: new Date(), lastError: message.slice(0, 500) },
        })
        .catch(() => undefined);
      return { delivered: false, error: message };
    }
  }

  private appLink(path: string | null | undefined): string | null {
    if (!path) return null;
    const base = (process.env.PUBLIC_APP_URL ?? process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
    return base ? `${base}${path}` : null;
  }

  /** Slack incoming-webhook payload (Block Kit with text fallback). */
  slackPayload(input: NotificationInput): Record<string, unknown> {
    const link = this.appLink(input.link);
    const level = input.level ?? 'info';
    const lines = [
      `*${input.title}*`,
      input.body ?? '',
      link ? `<${link}|Open in Command Center>` : '',
    ].filter(Boolean);
    return {
      text: `${input.title}${input.body ? ` — ${input.body}` : ''}`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: lines.join('\n') },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `SF DevOps Command Center · ${input.category} · ${level}`,
            },
          ],
        },
      ],
    };
  }

  /** Teams MessageCard payload (works with Teams + Power Automate webhooks). */
  teamsPayload(input: NotificationInput): Record<string, unknown> {
    const link = this.appLink(input.link);
    const level = (input.level ?? 'info') as NotificationLevel;
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: LEVEL_COLORS[level].replace('#', ''),
      summary: input.title,
      title: input.title,
      text: input.body ?? '',
      sections: [
        {
          facts: [
            { name: 'Category', value: input.category },
            { name: 'Level', value: level },
          ],
        },
      ],
      ...(link
        ? {
            potentialAction: [
              {
                '@type': 'OpenUri',
                name: 'Open in Command Center',
                targets: [{ os: 'default', uri: link }],
              },
            ],
          }
        : {}),
    };
  }

  private toRecord(row: WebhookRow): NotificationWebhookRecord {
    return {
      id: row.id,
      type: row.type as NotificationWebhookType,
      name: row.name,
      urlPreview: this.preview(row),
      enabled: row.enabled,
      categories: row.categories as NotificationCategory[],
      createdAt: row.createdAt.toISOString(),
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
      lastError: row.lastError,
    };
  }

  private preview(row: WebhookRow): string {
    try {
      const url = new URL(decrypt(row.encryptedUrl));
      const tail = url.pathname.slice(0, 18);
      return `${url.hostname}${tail}${url.pathname.length > 18 ? '…' : ''}`;
    } catch {
      return 'configured';
    }
  }
}
