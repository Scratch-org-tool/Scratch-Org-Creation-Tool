import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { calendarRangeSchema, type CalendarEvent } from '@sfcc/shared';

/**
 * Aggregates everything date-relevant into one feed for the Environment
 * Calendar: freeze windows, scheduled deployment plans, releases, scheduled
 * drift checks, and sandbox refreshes.
 */
@Injectable()
export class CalendarService {
  async events(query: unknown): Promise<CalendarEvent[]> {
    const { from, to } = calendarRangeSchema.parse(query);
    const rangeStart = new Date(from);
    const rangeEnd = new Date(to);

    const [freezes, plans, releases, driftMonitors, sandboxRefreshes, orgs] = await Promise.all([
      prisma.freezeWindow.findMany({
        where: { startAt: { lte: rangeEnd }, endAt: { gte: rangeStart } },
      }),
      prisma.deploymentPlan.findMany({
        where: {
          scheduleEnabled: true,
          nextRunAt: { not: null, gte: rangeStart, lte: rangeEnd },
        },
        select: { id: true, name: true, planType: true, nextRunAt: true },
      }),
      prisma.release.findMany({
        where: {
          OR: [
            { scheduledAt: { gte: rangeStart, lte: rangeEnd } },
            { releasedAt: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
        include: { targetOrg: { select: { alias: true } } },
      }),
      prisma.driftMonitor.findMany({
        where: {
          scheduleEnabled: true,
          enabled: true,
          nextRunAt: { not: null, gte: rangeStart, lte: rangeEnd },
        },
        select: { id: true, name: true, nextRunAt: true },
      }),
      prisma.sandboxRefresh
        .findMany({
          where: {
            OR: [
              { requestedAt: { gte: rangeStart, lte: rangeEnd } },
              { nextRefreshDueAt: { gte: rangeStart, lte: rangeEnd } },
            ],
          },
          select: {
            id: true,
            sandboxName: true,
            status: true,
            requestedAt: true,
            nextRefreshDueAt: true,
            orgConnectionId: true,
          },
        })
        .catch(() => []),
      prisma.orgConnection.findMany({ select: { id: true, alias: true } }),
    ]);

    const orgAlias = new Map(orgs.map((org) => [org.id, org.alias]));
    const events: CalendarEvent[] = [];

    for (const freeze of freezes) {
      const scope =
        freeze.orgConnectionIds.length === 0
          ? 'all orgs'
          : freeze.orgConnectionIds
              .map((id) => orgAlias.get(id) ?? id.slice(0, 8))
              .join(', ');
      events.push({
        id: `freeze:${freeze.id}`,
        kind: 'freeze',
        title: freeze.name,
        startAt: freeze.startAt.toISOString(),
        endAt: freeze.endAt.toISOString(),
        detail: `${freeze.enabled ? 'Blocks deployments' : 'Disabled'} — ${scope}${freeze.reason ? ` · ${freeze.reason}` : ''}`,
        link: '/calendar',
      });
    }

    for (const plan of plans) {
      events.push({
        id: `plan:${plan.id}`,
        kind: 'scheduled_plan',
        title: plan.name,
        startAt: plan.nextRunAt!.toISOString(),
        endAt: plan.nextRunAt!.toISOString(),
        detail: `${plan.planType} plan`,
        link: '/deployment-center/automations',
      });
    }

    for (const release of releases) {
      const when = release.releasedAt ?? release.scheduledAt;
      if (!when) continue;
      events.push({
        id: `release:${release.id}`,
        kind: 'release',
        title: `${release.name} v${release.version}`,
        startAt: when.toISOString(),
        endAt: when.toISOString(),
        detail: release.releasedAt ? 'Released' : `Planned · ${release.status}`,
        orgAlias: release.targetOrg?.alias ?? null,
        link: `/releases?id=${release.id}`,
      });
    }

    for (const monitor of driftMonitors) {
      events.push({
        id: `drift:${monitor.id}`,
        kind: 'drift_check',
        title: monitor.name,
        startAt: monitor.nextRunAt!.toISOString(),
        endAt: monitor.nextRunAt!.toISOString(),
        detail: 'Scheduled drift check',
        link: `/drift/${monitor.id}`,
      });
    }

    for (const refresh of sandboxRefreshes) {
      const when = refresh.nextRefreshDueAt ?? refresh.requestedAt;
      if (!when) continue;
      events.push({
        id: `sandbox:${refresh.id}`,
        kind: 'sandbox_refresh',
        title: `${refresh.sandboxName} refresh`,
        startAt: when.toISOString(),
        endAt: when.toISOString(),
        detail: refresh.nextRefreshDueAt ? `Due · ${refresh.status}` : refresh.status,
        orgAlias: orgAlias.get(refresh.orgConnectionId) ?? null,
        link: '/sandbox-refresh',
      });
    }

    return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
}
