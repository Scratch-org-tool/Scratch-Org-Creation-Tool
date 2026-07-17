import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { z } from 'zod';
import { assertOrgOwned, assertResourceOwner } from '../../common/user-tenancy.util';
import { DataService } from '../data/data.service';
import { NotificationsService } from '../notifications/notifications.service';

export const sandboxRefreshCreateSchema = z
  .object({
    /** Production org connection that owns the sandbox. */
    orgConnectionId: z.string().uuid(),
    sandboxName: z.string().trim().min(1).max(80),
    /** trigger = call the Salesforce CLI now; track = record a refresh done elsewhere. */
    mode: z.enum(['trigger', 'track']).default('track'),
    notes: z.string().trim().max(1000).optional(),
    cadenceDays: z.number().int().min(1).max(365).optional(),
    postRefreshConfig: z
      .object({
        /** Re-seed data into the refreshed sandbox once marked complete. */
        dataSeed: z
          .object({
            sourceOrgId: z.string().uuid(),
            targetOrgId: z.string().uuid(),
            datasets: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .strict();

export const sandboxRefreshUpdateSchema = z
  .object({
    notes: z.string().trim().max(1000).nullable().optional(),
    cadenceDays: z.number().int().min(1).max(365).nullable().optional(),
    status: z.enum(['requested', 'refreshing', 'completed', 'failed']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

@Injectable()
export class SandboxRefreshService {
  private readonly logger = new Logger(SandboxRefreshService.name);
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly dataService: DataService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, isAdmin: boolean, orgId?: string) {
    const rows = await prisma.sandboxRefresh.findMany({
      where: {
        ...(orgId ? { orgConnectionId: orgId } : {}),
        ...(isAdmin ? {} : { requestedBy: userId }),
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
    const orgIds = [...new Set(rows.map((row) => row.orgConnectionId))];
    const orgs = orgIds.length
      ? await prisma.orgConnection.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, alias: true },
        })
      : [];
    const aliasById = new Map(orgs.map((org) => [org.id, org.alias]));
    return rows.map((row) => this.toRecord(row, aliasById.get(row.orgConnectionId)));
  }

  async create(body: unknown, userId: string, isAdmin: boolean) {
    const input = sandboxRefreshCreateSchema.parse(body);
    const org = isAdmin
      ? await prisma.orgConnection.findUnique({ where: { id: input.orgConnectionId } })
      : await assertOrgOwned(input.orgConnectionId, userId, prisma);
    if (!org) throw new NotFoundException('Org connection not found');

    let status = 'requested';
    let notes = input.notes ?? null;
    if (input.mode === 'trigger') {
      const alias = org.username ?? org.alias;
      const result = await this.sfCli.refreshSandbox(alias, input.sandboxName);
      if (!result.success) {
        throw new BadRequestException(
          result.error || 'Salesforce refused the sandbox refresh request',
        );
      }
      status = 'refreshing';
      notes = notes ?? 'Refresh requested via Salesforce CLI (runs async on Salesforce side).';
    }

    const row = await prisma.sandboxRefresh.create({
      data: {
        orgConnectionId: org.id,
        sandboxName: input.sandboxName,
        status,
        notes,
        cadenceDays: input.cadenceDays ?? null,
        nextRefreshDueAt: this.nextDue(input.cadenceDays),
        postRefreshConfig: (input.postRefreshConfig ?? undefined) as Prisma.InputJsonValue | undefined,
        requestedBy: userId,
      },
    });
    return this.toRecord(row, org.alias);
  }

  /**
   * Mark a refresh completed. Computes the next due date from the cadence and
   * fires the configured post-refresh automation (data seed) against the
   * refreshed org.
   */
  async complete(id: string, userId: string, isAdmin: boolean) {
    const row = await this.requireOwned(id, userId, isAdmin);
    if (row.status === 'completed') {
      throw new BadRequestException('This refresh is already completed');
    }

    const config = (row.postRefreshConfig ?? {}) as {
      dataSeed?: { sourceOrgId: string; targetOrgId: string; datasets?: string[] };
    };

    let automationNote: string | null = null;
    if (config.dataSeed) {
      try {
        const seed = await this.dataService.enqueueConaSeed(
          {
            sourceOrgId: config.dataSeed.sourceOrgId,
            targetOrgId: config.dataSeed.targetOrgId,
            datasets: config.dataSeed.datasets,
          } as never,
          userId,
        );
        automationNote = `Post-refresh data seed queued (job ${seed.jobId}).`;
      } catch (error) {
        automationNote = `Post-refresh data seed failed to enqueue: ${error instanceof Error ? error.message : String(error)}`;
        this.logger.warn(automationNote);
      }
    }

    const updated = await prisma.sandboxRefresh.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        nextRefreshDueAt: this.nextDue(row.cadenceDays),
        notes: automationNote
          ? [row.notes, automationNote].filter(Boolean).join('\n')
          : row.notes,
      },
    });

    await this.notifications
      .notify({
        userId,
        category: 'environment',
        level: 'success',
        title: `Sandbox ${row.sandboxName} refresh completed`,
        body: automationNote ?? undefined,
        link: '/sandbox-refresh',
      })
      .catch(() => undefined);

    return this.toRecord(updated);
  }

  async update(id: string, body: unknown, userId: string, isAdmin: boolean) {
    const input = sandboxRefreshUpdateSchema.parse(body);
    await this.requireOwned(id, userId, isAdmin);
    const updated = await prisma.sandboxRefresh.update({
      where: { id },
      data: {
        notes: input.notes,
        cadenceDays: input.cadenceDays,
        status: input.status,
        ...(input.cadenceDays !== undefined
          ? { nextRefreshDueAt: this.nextDue(input.cadenceDays) }
          : {}),
      },
    });
    return this.toRecord(updated);
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    await this.requireOwned(id, userId, isAdmin);
    await prisma.sandboxRefresh.delete({ where: { id } });
    return { deleted: true };
  }

  private nextDue(cadenceDays: number | null | undefined): Date | null {
    if (!cadenceDays) return null;
    return new Date(Date.now() + cadenceDays * 86_400_000);
  }

  private async requireOwned(id: string, userId: string, isAdmin: boolean) {
    const row = await prisma.sandboxRefresh.findUnique({ where: { id } });
    if (isAdmin) {
      if (!row) throw new NotFoundException('Sandbox refresh not found');
      return row;
    }
    assertResourceOwner(
      row ? { createdBy: row.requestedBy } : null,
      userId,
      'Sandbox refresh',
    );
    return row!;
  }

  private toRecord(
    row: {
      id: string;
      orgConnectionId: string;
      sandboxName: string;
      status: string;
      notes: string | null;
      cadenceDays: number | null;
      nextRefreshDueAt: Date | null;
      postRefreshConfig: Prisma.JsonValue | null;
      requestedBy: string;
      requestedAt: Date;
      completedAt: Date | null;
    },
    orgAlias?: string,
  ) {
    const dueMs = row.nextRefreshDueAt?.getTime() ?? null;
    return {
      id: row.id,
      orgConnectionId: row.orgConnectionId,
      orgAlias: orgAlias ?? null,
      sandboxName: row.sandboxName,
      status: row.status,
      notes: row.notes,
      cadenceDays: row.cadenceDays,
      nextRefreshDueAt: row.nextRefreshDueAt?.toISOString() ?? null,
      overdue: dueMs !== null && dueMs < Date.now(),
      postRefreshConfig: (row.postRefreshConfig as Record<string, unknown> | null) ?? null,
      requestedBy: row.requestedBy,
      requestedAt: row.requestedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
