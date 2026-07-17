import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  freezeWindowCoversOrg,
  freezeWindowCreateSchema,
  freezeWindowUpdateSchema,
  isFreezeWindowActive,
  type FreezeWindowRecord,
} from '@sfcc/shared';

interface FreezeWindowRow {
  id: string;
  name: string;
  reason: string | null;
  orgConnectionIds: string[];
  startAt: Date;
  endAt: Date;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
}

@Injectable()
export class FreezeWindowService {
  async list(): Promise<FreezeWindowRecord[]> {
    const rows = await prisma.freezeWindow.findMany({ orderBy: { startAt: 'desc' }, take: 200 });
    return rows.map((row) => this.toRecord(row));
  }

  async create(body: unknown, adminUserId: string): Promise<FreezeWindowRecord> {
    const input = freezeWindowCreateSchema.parse(body);
    const row = await prisma.freezeWindow.create({
      data: {
        name: input.name,
        reason: input.reason ?? null,
        orgConnectionIds: input.orgConnectionIds,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        enabled: input.enabled,
        createdBy: adminUserId,
      },
    });
    return this.toRecord(row);
  }

  async update(id: string, body: unknown): Promise<FreezeWindowRecord> {
    const input = freezeWindowUpdateSchema.parse(body);
    const existing = await prisma.freezeWindow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Freeze window not found');
    const row = await prisma.freezeWindow.update({
      where: { id },
      data: {
        name: input.name,
        reason: input.reason,
        orgConnectionIds: input.orgConnectionIds,
        startAt: input.startAt ? new Date(input.startAt) : undefined,
        endAt: input.endAt ? new Date(input.endAt) : undefined,
        enabled: input.enabled,
      },
    });
    return this.toRecord(row);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const existing = await prisma.freezeWindow.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Freeze window not found');
    await prisma.freezeWindow.delete({ where: { id } });
    return { deleted: true };
  }

  /** Active windows covering an org right now. */
  async activeWindowsForOrg(orgConnectionId: string, now = new Date()): Promise<FreezeWindowRecord[]> {
    const rows = await prisma.freezeWindow.findMany({
      where: { enabled: true, startAt: { lte: now }, endAt: { gte: now } },
    });
    return rows
      .filter((row) => freezeWindowCoversOrg(row, orgConnectionId))
      .map((row) => this.toRecord(row));
  }

  /**
   * Deploy gate: throws when the target org is inside an active freeze window.
   * Validation-only deploys are always allowed (they change nothing).
   */
  async assertDeployAllowed(params: {
    targetOrgId?: string | null;
    orgAlias?: string | null;
    validateOnly?: boolean;
  }): Promise<void> {
    if (params.validateOnly) return;

    let orgId = params.targetOrgId ?? null;
    if (!orgId && params.orgAlias) {
      const org = await prisma.orgConnection.findFirst({
        where: { OR: [{ alias: params.orgAlias }, { username: params.orgAlias }] },
        select: { id: true },
      });
      orgId = org?.id ?? null;
    }
    if (!orgId) return;

    const windows = await this.activeWindowsForOrg(orgId);
    if (windows.length === 0) return;
    const window = windows[0];
    throw new ConflictException(
      `Deployments to this org are frozen by "${window.name}" until ${new Date(window.endAt).toUTCString()}` +
        `${window.reason ? ` (${window.reason})` : ''}. An administrator can end the freeze from the Environment Calendar.`,
    );
  }

  private toRecord(row: FreezeWindowRow): FreezeWindowRecord {
    return {
      id: row.id,
      name: row.name,
      reason: row.reason,
      orgConnectionIds: row.orgConnectionIds,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      enabled: row.enabled,
      active: isFreezeWindowActive(row),
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
