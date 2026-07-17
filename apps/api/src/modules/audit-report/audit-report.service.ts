import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { z } from 'zod';

export const auditReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['all', 'auth', 'deployment', 'workbench']).default('all'),
  action: z.string().trim().max(120).optional(),
  actor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export type AuditReportQuery = z.infer<typeof auditReportQuerySchema>;

export interface AuditReportEntry {
  id: string;
  source: 'auth' | 'deployment' | 'workbench';
  action: string;
  actorId: string | null;
  actorName: string | null;
  target: string | null;
  status: string | null;
  createdAt: string;
}

const EXPORT_CAP = 5000;

/** Neutralize spreadsheet formula injection when a cell lands in Excel. */
function csvCell(value: string | null | undefined): string {
  const raw = (value ?? '').replace(/"/g, '""');
  const guarded = /^[=+\-@\t]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded}"`;
}

@Injectable()
export class AuditReportService {
  /**
   * Unified compliance feed across authentication events, classic deployment
   * audits, and Deployment Workbench audits — newest first with paging.
   */
  async report(query: unknown): Promise<{
    entries: AuditReportEntry[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const input = auditReportQuerySchema.parse(query);
    const all = await this.collect(input);
    const entries = all.slice(input.offset, input.offset + input.limit);
    return { entries, total: all.length, limit: input.limit, offset: input.offset };
  }

  /** CSV export of the same filtered feed (capped). */
  async exportCsv(query: unknown): Promise<string> {
    const input = auditReportQuerySchema.parse({ ...(query as object), limit: 200, offset: 0 });
    const all = (await this.collect(input)).slice(0, EXPORT_CAP);
    const header = ['timestamp', 'source', 'action', 'actor_id', 'actor_name', 'target', 'status'];
    const lines = [header.join(',')];
    for (const entry of all) {
      lines.push([
        csvCell(entry.createdAt),
        csvCell(entry.source),
        csvCell(entry.action),
        csvCell(entry.actorId),
        csvCell(entry.actorName),
        csvCell(entry.target),
        csvCell(entry.status),
      ].join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
  }

  private async collect(input: AuditReportQuery): Promise<AuditReportEntry[]> {
    const createdAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
    const dateFilter = Object.keys(createdAt).length > 0 ? { createdAt } : {};
    const wantsSource = (source: AuditReportQuery['source']) =>
      input.source === 'all' || input.source === source;

    const [authEvents, deployAudits, workbenchAudits] = await Promise.all([
      wantsSource('auth')
        ? prisma.authAuditEvent.findMany({
            where: {
              ...dateFilter,
              ...(input.action ? { eventType: { contains: input.action, mode: 'insensitive' } } : {}),
              ...(input.actor ? { userId: { contains: input.actor, mode: 'insensitive' } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: EXPORT_CAP,
          })
        : Promise.resolve([]),
      wantsSource('deployment')
        ? prisma.deploymentAudit.findMany({
            where: {
              ...dateFilter,
              ...(input.action ? { action: { contains: input.action, mode: 'insensitive' } } : {}),
              ...(input.actor
                ? { performedBy: { contains: input.actor, mode: 'insensitive' } }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: EXPORT_CAP,
          })
        : Promise.resolve([]),
      wantsSource('workbench')
        ? prisma.deploymentQualityAudit.findMany({
            where: {
              ...dateFilter,
              ...(input.action ? { action: { contains: input.action, mode: 'insensitive' } } : {}),
              ...(input.actor ? { actorId: { contains: input.actor, mode: 'insensitive' } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: EXPORT_CAP,
          })
        : Promise.resolve([]),
    ]);

    const orgIds = new Set<string>();
    for (const audit of deployAudits) {
      if (audit.sourceOrgId) orgIds.add(audit.sourceOrgId);
      if (audit.targetOrgId) orgIds.add(audit.targetOrgId);
    }
    const orgs = orgIds.size
      ? await prisma.orgConnection.findMany({
          where: { id: { in: [...orgIds] } },
          select: { id: true, alias: true },
        })
      : [];
    const orgAlias = new Map(orgs.map((org) => [org.id, org.alias]));

    const actorIds = new Set<string>();
    for (const event of authEvents) if (event.userId) actorIds.add(event.userId);
    for (const audit of deployAudits) actorIds.add(audit.performedBy);
    for (const audit of workbenchAudits) actorIds.add(audit.actorId);
    const users = actorIds.size
      ? await prisma.appUser.findMany({
          where: { id: { in: [...actorIds] } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(users.map((user) => [user.id, user.displayName]));

    const entries: AuditReportEntry[] = [
      ...authEvents.map((event): AuditReportEntry => ({
        id: `auth:${event.id}`,
        source: 'auth',
        action: event.eventType,
        actorId: event.userId,
        actorName: event.userId ? (nameById.get(event.userId) ?? null) : null,
        target: this.authTarget(event.metadata),
        status: null,
        createdAt: event.createdAt.toISOString(),
      })),
      ...deployAudits.map((audit): AuditReportEntry => ({
        id: `deployment:${audit.id}`,
        source: 'deployment',
        action: audit.action,
        actorId: audit.performedBy,
        actorName: nameById.get(audit.performedBy) ?? null,
        target: [
          audit.repo && audit.branch ? `${audit.repo}/${audit.branch}` : audit.repo,
          audit.targetOrgId ? `→ ${orgAlias.get(audit.targetOrgId) ?? audit.targetOrgId.slice(0, 8)}` : null,
          audit.componentCount ? `${audit.componentCount} components` : null,
        ]
          .filter(Boolean)
          .join(' '),
        status: audit.status,
        createdAt: audit.createdAt.toISOString(),
      })),
      ...workbenchAudits.map((audit): AuditReportEntry => ({
        id: `workbench:${audit.id}`,
        source: 'workbench',
        action: audit.action,
        actorId: audit.actorId,
        actorName: nameById.get(audit.actorId) ?? null,
        target: `workbench run ${audit.runId.slice(0, 8)}`,
        status: null,
        createdAt: audit.createdAt.toISOString(),
      })),
    ];

    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private authTarget(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const record = metadata as Record<string, unknown>;
    const target = record.targetUserId ?? record.subjectId ?? null;
    return typeof target === 'string' ? `user ${target}` : null;
  }
}
