import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, Prisma, type DriftMonitor } from '@sfcc/db';
import {
  buildDriftItems,
  computeNextRun,
  DEFAULT_DRIFT_TYPES,
  diffDriftSnapshots,
  driftMonitorCreateSchema,
  driftMonitorUpdateSchema,
  driftStatusFromSummary,
  parseSchedule,
  summarizeDrift,
  type DriftItem,
  type DriftMonitorRecord,
  type DriftSnapshotRecord,
  type DriftStatus,
} from '@sfcc/shared';
import { MetadataBrowseService } from '../metadata/metadata-browse.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertOrgOwned, assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';

/** How many metadata types to list in parallel per org during a check. */
const TYPE_CONCURRENCY = 4;
/** Upper bound on differing items persisted per snapshot to keep rows small. */
const MAX_SNAPSHOT_ITEMS = 2000;

@Injectable()
export class DriftService {
  private readonly logger = new Logger(DriftService.name);

  constructor(
    private readonly browseService: MetadataBrowseService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string): Promise<DriftMonitorRecord[]> {
    const rows = await prisma.driftMonitor.findMany({
      where: userOwnedWhere(userId),
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toMonitorRecord(row));
  }

  async get(id: string, userId: string): Promise<DriftMonitorRecord> {
    const monitor = await this.getOwned(id, userId);
    return this.toMonitorRecord(monitor);
  }

  async create(body: unknown, userId: string): Promise<DriftMonitorRecord> {
    const input = driftMonitorCreateSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    const schedule = input.schedule ?? null;
    const nextRunAt = input.scheduleEnabled && schedule ? computeNextRun(schedule) : null;
    const created = await prisma.driftMonitor.create({
      data: {
        name: input.name,
        description: input.description,
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        metadataTypes: input.metadataTypes ?? [],
        schedule: (schedule ?? undefined) as Prisma.InputJsonValue | undefined,
        scheduleEnabled: input.scheduleEnabled,
        enabled: input.enabled,
        notifyOnDrift: input.notifyOnDrift,
        nextRunAt,
        createdBy: userId,
      },
    });
    return this.toMonitorRecord(created);
  }

  async update(id: string, body: unknown, userId: string): Promise<DriftMonitorRecord> {
    const existing = await this.getOwned(id, userId);
    const input = driftMonitorUpdateSchema.parse(body);
    if (input.sourceOrgId) await assertOrgOwned(input.sourceOrgId, userId, prisma);
    if (input.targetOrgId) await assertOrgOwned(input.targetOrgId, userId, prisma);

    const scheduleEnabled = input.scheduleEnabled ?? existing.scheduleEnabled;
    const schedule = input.schedule ?? parseSchedule(existing.schedule);
    const nextRunAt = scheduleEnabled && schedule ? computeNextRun(schedule) : null;

    const updated = await prisma.driftMonitor.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sourceOrgId !== undefined ? { sourceOrgId: input.sourceOrgId } : {}),
        ...(input.targetOrgId !== undefined ? { targetOrgId: input.targetOrgId } : {}),
        ...(input.metadataTypes !== undefined ? { metadataTypes: input.metadataTypes } : {}),
        ...(input.notifyOnDrift !== undefined ? { notifyOnDrift: input.notifyOnDrift } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(schedule ? { schedule: schedule as unknown as Prisma.InputJsonValue } : {}),
        scheduleEnabled,
        nextRunAt,
      },
    });
    return this.toMonitorRecord(updated);
  }

  async remove(id: string, userId: string) {
    await this.getOwned(id, userId);
    await prisma.driftMonitor.delete({ where: { id } });
    return { deleted: true, id };
  }

  async listSnapshots(id: string, userId: string, limit = 20): Promise<DriftSnapshotRecord[]> {
    await this.getOwned(id, userId);
    const rows = await prisma.driftSnapshot.findMany({
      where: { monitorId: id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    // The list view omits the (potentially large) item arrays; the detail
    // endpoint returns them for a single snapshot.
    return rows.map((row) => this.toSnapshotRecord(row, { includeItems: false }));
  }

  async getSnapshot(id: string, snapshotId: string, userId: string): Promise<DriftSnapshotRecord> {
    await this.getOwned(id, userId);
    const snapshot = await prisma.driftSnapshot.findFirst({
      where: { id: snapshotId, monitorId: id },
    });
    if (!snapshot) throw new NotFoundException('Drift snapshot not found');
    return this.toSnapshotRecord(snapshot, { includeItems: true });
  }

  /** Manual "check now": start a check in the background and return immediately. */
  async runNow(id: string, userId: string) {
    const monitor = await this.getOwned(id, userId);
    await prisma.driftMonitor.update({ where: { id }, data: { lastStatus: 'checking' } });
    void this.runCheck(monitor, 'manual').catch((error) => {
      this.logger.warn(`drift check failed for ${id}: ${error instanceof Error ? error.message : error}`);
    });
    return { started: true, monitorId: id };
  }

  async dueMonitorIds(now = new Date(), take = 25): Promise<string[]> {
    const rows = await prisma.driftMonitor.findMany({
      where: { scheduleEnabled: true, enabled: true, nextRunAt: { not: null, lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Claim a due monitor (advancing nextRunAt atomically) and run its check. */
  async runScheduledMonitor(id: string, now = new Date()): Promise<{ claimed: boolean }> {
    const monitor = await prisma.driftMonitor.findUnique({ where: { id } });
    if (!monitor || !monitor.scheduleEnabled || !monitor.enabled) return { claimed: false };
    const schedule = parseSchedule(monitor.schedule);
    const nextRunAt = schedule ? computeNextRun(schedule, now) : null;
    const claim = await prisma.driftMonitor.updateMany({
      where: { id, scheduleEnabled: true, enabled: true, nextRunAt: { not: null, lte: now } },
      data: { nextRunAt },
    });
    if (claim.count !== 1) return { claimed: false };
    await this.runCheck(monitor, 'schedule').catch((error) => {
      this.logger.warn(`scheduled drift check failed for ${id}: ${error instanceof Error ? error.message : error}`);
    });
    return { claimed: true };
  }

  /**
   * Core drift check: list components for each watched type on both orgs, build
   * the differing items, persist a snapshot, and alert the owner when new drift
   * appeared since the last successful check.
   */
  async runCheck(monitor: DriftMonitor, trigger: 'manual' | 'schedule') {
    const owner = monitor.createdBy;
    try {
      await assertOrgOwned(monitor.sourceOrgId, owner, prisma);
      await assertOrgOwned(monitor.targetOrgId, owner, prisma);

      const types = monitor.metadataTypes.length ? monitor.metadataTypes : [...DEFAULT_DRIFT_TYPES];
      const items: DriftItem[] = [];
      const typeErrors: Array<{ metadataType: string; error: string }> = [];

      for (let offset = 0; offset < types.length; offset += TYPE_CONCURRENCY) {
        const batch = types.slice(offset, offset + TYPE_CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (metadataType) => {
            try {
              const [source, target] = await Promise.all([
                this.browseService.listComponentsRaw(monitor.sourceOrgId, owner, metadataType),
                this.browseService.listComponentsRaw(monitor.targetOrgId, owner, metadataType),
              ]);
              return { metadataType, items: buildDriftItems(metadataType, source, target), error: null };
            } catch (error) {
              return {
                metadataType,
                items: [] as DriftItem[],
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        );
        for (const result of results) {
          if (result.error) typeErrors.push({ metadataType: result.metadataType, error: result.error });
          else items.push(...result.items);
        }
      }

      // Every watched type failing to list means the check itself failed rather
      // than "no drift" — otherwise a broken connection would look reconciled.
      if (typeErrors.length === types.length) {
        throw new Error(typeErrors[0]?.error ?? 'All metadata listings failed');
      }

      const summary = summarizeDrift(items);
      const status: DriftStatus = driftStatusFromSummary(summary);
      const previous = await prisma.driftSnapshot.findFirst({
        where: { monitorId: monitor.id, status: { in: ['clean', 'drifted'] } },
        orderBy: { createdAt: 'desc' },
      });
      const previousItems = ((previous?.items as DriftItem[] | null) ?? []) as DriftItem[];
      const delta = diffDriftSnapshots(previousItems, items);

      const snapshot = await prisma.driftSnapshot.create({
        data: {
          monitorId: monitor.id,
          status,
          trigger,
          totalDifferences: summary.totalDifferences,
          added: summary.added,
          changed: summary.changed,
          removed: summary.removed,
          byType: summary.byType as unknown as Prisma.InputJsonValue,
          items: items.slice(0, MAX_SNAPSHOT_ITEMS) as unknown as Prisma.InputJsonValue,
          newlyDrifted: delta.newlyDrifted.slice(0, MAX_SNAPSHOT_ITEMS) as unknown as Prisma.InputJsonValue,
          ...(typeErrors.length
            ? { error: `${typeErrors.length} type(s) could not be listed` }
            : {}),
          createdBy: owner,
        },
      });

      await prisma.driftMonitor.update({
        where: { id: monitor.id },
        data: {
          lastStatus: status,
          lastDriftCount: summary.totalDifferences,
          lastCheckedAt: new Date(),
        },
      });

      if (monitor.notifyOnDrift && delta.newlyDrifted.length > 0) {
        const count = delta.newlyDrifted.length;
        await this.notifications
          .notify({
            userId: owner,
            category: 'deployment',
            level: 'warning',
            title: `Drift detected: ${monitor.name}`,
            body: `${count} newly drifted component${count === 1 ? '' : 's'} (${summary.totalDifferences} total difference${summary.totalDifferences === 1 ? '' : 's'}).`,
            link: `/drift/${monitor.id}`,
            metadata: { monitorId: monitor.id, snapshotId: snapshot.id, newlyDrifted: count },
          })
          .catch(() => undefined);
      }

      return this.toSnapshotRecord(snapshot, { includeItems: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.driftSnapshot
        .create({
          data: {
            monitorId: monitor.id,
            status: 'failed',
            trigger,
            error: message.slice(0, 2000),
            createdBy: owner,
          },
        })
        .catch(() => undefined);
      await prisma.driftMonitor
        .update({
          where: { id: monitor.id },
          data: { lastStatus: 'failed', lastCheckedAt: new Date() },
        })
        .catch(() => undefined);
      return null;
    }
  }

  private async getOwned(id: string, userId: string): Promise<DriftMonitor> {
    const monitor = await prisma.driftMonitor.findUnique({ where: { id } });
    assertResourceOwner(monitor, userId, 'Drift monitor');
    return monitor!;
  }

  private toMonitorRecord(row: DriftMonitor): DriftMonitorRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      sourceOrgId: row.sourceOrgId,
      targetOrgId: row.targetOrgId,
      metadataTypes: row.metadataTypes,
      schedule: parseSchedule(row.schedule),
      scheduleEnabled: row.scheduleEnabled,
      enabled: row.enabled,
      notifyOnDrift: row.notifyOnDrift,
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastStatus: (row.lastStatus as DriftStatus | null) ?? null,
      lastDriftCount: row.lastDriftCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSnapshotRecord(
    row: {
      id: string;
      monitorId: string;
      status: string;
      trigger: string;
      totalDifferences: number;
      added: number;
      changed: number;
      removed: number;
      byType: Prisma.JsonValue | null;
      items: Prisma.JsonValue | null;
      newlyDrifted: Prisma.JsonValue | null;
      error: string | null;
      createdAt: Date;
    },
    options: { includeItems: boolean },
  ): DriftSnapshotRecord {
    return {
      id: row.id,
      monitorId: row.monitorId,
      status: row.status as DriftStatus,
      trigger: row.trigger as 'manual' | 'schedule',
      totalDifferences: row.totalDifferences,
      added: row.added,
      changed: row.changed,
      removed: row.removed,
      byType: (row.byType as DriftSnapshotRecord['byType']) ?? null,
      items: options.includeItems ? ((row.items as DriftItem[] | null) ?? null) : null,
      newlyDrifted: options.includeItems ? ((row.newlyDrifted as DriftItem[] | null) ?? null) : null,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
