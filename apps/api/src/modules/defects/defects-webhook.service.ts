import { createHash, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { NotificationsService } from '../notifications/notifications.service';

/** Minimum gap between outbound emails for the same work item. */
const EMAIL_MIN_INTERVAL_MS = 2 * 60 * 1000;

export interface NormalizedWorkItemEvent {
  provider: string;
  projectId: string;
  projectName: string | null;
  workItemId: string;
  title: string | null;
  state: string | null;
  revision: number | null;
  changedDate: Date | null;
  changedFields: string[];
  assigneeEmail: string | null;
}

export interface WebhookProcessResult {
  status: 'notified' | 'skipped';
  reason?: string;
}

/**
 * Handles inbound work-item webhooks for the Developer Board.
 *
 * The primary producer is an Azure DevOps Service Hook subscribed to
 * `workitem.updated`, but a simplified custom payload shape is accepted too so
 * other providers (or manual pipelines) can push updates.
 */
@Injectable()
export class DefectsWebhookService {
  private readonly logger = new Logger(DefectsWebhookService.name);

  constructor(private readonly notifications: NotificationsService) {}

  isEnabled(): boolean {
    return Boolean(process.env.DEFECTS_WEBHOOK_SECRET);
  }

  verifySecret(provided: string | undefined): boolean {
    const secret = process.env.DEFECTS_WEBHOOK_SECRET;
    if (!secret || !provided) return false;
    // Hash both sides so the comparison is constant-time regardless of length.
    try {
      const a = createHash('sha256').update(provided).digest();
      const b = createHash('sha256').update(secret).digest();
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** Normalize an ADO service-hook payload or the simplified custom shape. */
  normalize(payload: unknown): NormalizedWorkItemEvent | null {
    if (!payload || typeof payload !== 'object') return null;
    const body = payload as Record<string, unknown>;

    // Azure DevOps service hook (`workitem.updated`).
    if (typeof body.eventType === 'string' && body.eventType.startsWith('workitem.')) {
      return this.normalizeAzure(body);
    }

    // Simplified custom shape.
    if (body.workItemId !== undefined && body.projectId !== undefined) {
      const changedDate = this.parseDate(body.changedDate);
      return {
        provider: typeof body.provider === 'string' ? body.provider : 'custom',
        projectId: String(body.projectId),
        projectName: typeof body.projectName === 'string' ? body.projectName : null,
        workItemId: String(body.workItemId),
        title: typeof body.title === 'string' ? body.title : null,
        state: typeof body.state === 'string' ? body.state : null,
        revision: typeof body.revision === 'number' ? body.revision : null,
        changedDate,
        changedFields: Array.isArray(body.changedFields)
          ? body.changedFields.filter((f): f is string => typeof f === 'string')
          : [],
        assigneeEmail: typeof body.assigneeEmail === 'string' ? body.assigneeEmail : null,
      };
    }

    return null;
  }

  private normalizeAzure(body: Record<string, unknown>): NormalizedWorkItemEvent | null {
    const resource = (body.resource ?? {}) as Record<string, unknown>;
    const revisionNode = (resource.revision ?? {}) as Record<string, unknown>;
    const fields = (revisionNode.fields ?? resource.fields ?? {}) as Record<string, unknown>;
    const changedFieldMap = (resource.fields ?? {}) as Record<string, unknown>;

    const workItemId = resource.workItemId ?? revisionNode.id ?? resource.id;
    if (workItemId === undefined || workItemId === null) return null;

    const containers = (body.resourceContainers ?? {}) as Record<string, unknown>;
    const projectContainer = (containers.project ?? {}) as Record<string, unknown>;
    const projectName = this.fieldString(fields['System.TeamProject']);
    const projectId =
      (typeof projectContainer.id === 'string' ? projectContainer.id : null) ?? projectName;
    if (!projectId) return null;

    return {
      provider: 'azure_boards',
      projectId,
      projectName,
      workItemId: String(workItemId),
      title: this.fieldString(fields['System.Title']),
      state: this.fieldString(fields['System.State']),
      revision:
        typeof resource.rev === 'number'
          ? resource.rev
          : typeof revisionNode.rev === 'number'
            ? revisionNode.rev
            : null,
      changedDate: this.parseDate(fields['System.ChangedDate']),
      changedFields: Object.keys(changedFieldMap).filter((key) => key !== 'System.Rev'),
      assigneeEmail: this.identityEmail(fields['System.AssignedTo']),
    };
  }

  /**
   * Process one normalized event: dedupe by revision/changed date, resolve the
   * assignee to an AppUser, and deliver an in-app (+ optionally email) alert.
   */
  async process(event: NormalizedWorkItemEvent): Promise<WebhookProcessResult> {
    const where = {
      provider_externalProjectId_externalItemId: {
        provider: event.provider,
        externalProjectId: event.projectId,
        externalItemId: event.workItemId,
      },
    };
    const existing = await prisma.workItemChangeNotification.findUnique({ where });

    if (existing) {
      const sameOrOlderRevision =
        event.revision !== null &&
        existing.lastRevision !== null &&
        event.revision <= existing.lastRevision;
      const sameOrOlderChange =
        event.revision === null &&
        event.changedDate !== null &&
        existing.lastChangedDate !== null &&
        event.changedDate.getTime() <= existing.lastChangedDate.getTime();
      if (sameOrOlderRevision || sameOrOlderChange) {
        return { status: 'skipped', reason: 'duplicate_revision' };
      }
    }

    if (!event.assigneeEmail) {
      await this.recordNotified(where, event, existing?.lastEmailAt ?? null);
      return { status: 'skipped', reason: 'no_assignee' };
    }

    const user = await prisma.appUser.findFirst({
      where: { email: { equals: event.assigneeEmail, mode: 'insensitive' } },
      select: { id: true, status: true },
    });
    if (!user || user.status === 'inactive') {
      await this.recordNotified(where, event, existing?.lastEmailAt ?? null);
      return { status: 'skipped', reason: 'assignee_not_registered' };
    }

    // Per-item email throttle so bulk updates cannot cause an email storm.
    const now = Date.now();
    const emailAllowed =
      !existing?.lastEmailAt || now - existing.lastEmailAt.getTime() >= EMAIL_MIN_INTERVAL_MS;

    const changed = event.changedFields
      .map((field) => field.replace(/^(System|Microsoft\.VSTS\.[A-Za-z]+)\./, ''))
      .slice(0, 6);
    const project = event.projectName ?? event.projectId;
    const link = `/defects-command-centre?id=${encodeURIComponent(event.workItemId)}&project=${encodeURIComponent(project)}`;

    await this.notifications.notify(
      {
        userId: user.id,
        category: 'defects',
        level: 'info',
        title: `Work item #${event.workItemId} updated${event.title ? `: ${event.title}` : ''}`,
        body: [
          event.state ? `State: ${event.state}.` : null,
          changed.length > 0 ? `Changed: ${changed.join(', ')}.` : null,
        ]
          .filter(Boolean)
          .join(' ') || 'A work item assigned to you was updated.',
        link,
        metadata: {
          provider: event.provider,
          projectId: event.projectId,
          workItemId: event.workItemId,
          revision: event.revision,
        },
      },
      { email: emailAllowed },
    );

    await this.recordNotified(
      where,
      event,
      emailAllowed ? new Date() : (existing?.lastEmailAt ?? null),
    );
    return { status: 'notified' };
  }

  private async recordNotified(
    where: {
      provider_externalProjectId_externalItemId: {
        provider: string;
        externalProjectId: string;
        externalItemId: string;
      };
    },
    event: NormalizedWorkItemEvent,
    lastEmailAt: Date | null,
  ): Promise<void> {
    const data = {
      lastRevision: event.revision,
      lastChangedDate: event.changedDate,
      lastNotifiedAt: new Date(),
      lastEmailAt,
    };
    await prisma.workItemChangeNotification
      .upsert({
        where,
        create: {
          provider: where.provider_externalProjectId_externalItemId.provider,
          externalProjectId: where.provider_externalProjectId_externalItemId.externalProjectId,
          externalItemId: where.provider_externalProjectId_externalItemId.externalItemId,
          ...data,
        },
        update: data,
      })
      .catch((error) => {
        this.logger.warn(
          `failed to record work-item notification: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  private fieldString(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      // Field-change nodes look like { oldValue, newValue }.
      if (typeof node.newValue === 'string') return node.newValue;
    }
    return null;
  }

  /** AssignedTo arrives as `Name <email>` (string) or an identity object. */
  private identityEmail(value: unknown): string | null {
    if (typeof value === 'string') {
      const match = value.match(/<([^<>@\s]+@[^<>\s]+)>/);
      return match?.[1] ?? (value.includes('@') ? value.trim() : null);
    }
    if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      if (typeof node.uniqueName === 'string' && node.uniqueName.includes('@')) {
        return node.uniqueName;
      }
      if (typeof node.newValue !== 'undefined') return this.identityEmail(node.newValue);
    }
    return null;
  }

  private parseDate(value: unknown): Date | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return this.fieldString(value) ? this.parseDate(this.fieldString(value)) : null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
