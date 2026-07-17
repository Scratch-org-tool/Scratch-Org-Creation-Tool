import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import {
  canTransitionRelease,
  releaseCreateSchema,
  releaseDecisionSchema,
  releaseItemAddSchema,
  releaseUpdateSchema,
  RELEASE_TRANSITIONS,
  type ReleaseApprovalRecord,
  type ReleaseItemRecord,
  type ReleaseRecord,
  type ReleaseStatus,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { NotificationsService } from '../notifications/notifications.service';

type ReleaseRow = Prisma.ReleaseGetPayload<{ include: { targetOrg: true } }>;
type ReleaseItemRow = Prisma.ReleaseItemGetPayload<Record<string, never>>;
type ReleaseApprovalRow = Prisma.ReleaseApprovalGetPayload<Record<string, never>>;

@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);

  constructor(
    private readonly nvidia: NvidiaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(status?: string): Promise<ReleaseRecord[]> {
    const releases = await prisma.release.findMany({
      where: status ? { status } : undefined,
      include: { targetOrg: true, _count: { select: { items: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return releases.map((row) => ({
      ...this.toRecord(row),
      itemCount: row._count.items,
    }));
  }

  async get(id: string): Promise<ReleaseRecord> {
    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        targetOrg: true,
        items: { orderBy: { createdAt: 'asc' } },
        approvals: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!release) throw new NotFoundException('Release not found');

    const deploymentIds = release.items
      .filter((item) => item.kind === 'deployment' && item.deploymentId)
      .map((item) => item.deploymentId as string);
    const deployments = deploymentIds.length
      ? await prisma.deployment.findMany({
          where: { id: { in: deploymentIds } },
          include: { targetOrg: { select: { alias: true } } },
        })
      : [];
    const deploymentsById = new Map(deployments.map((dep) => [dep.id, dep]));

    const actorIds = [...new Set(release.approvals.map((approval) => approval.actorId))];
    const actors = actorIds.length
      ? await prisma.appUser.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const actorsById = new Map(actors.map((actor) => [actor.id, actor.displayName]));

    return {
      ...this.toRecord(release),
      items: release.items.map((item) => this.toItemRecord(item, deploymentsById)),
      approvals: release.approvals.map((approval) =>
        this.toApprovalRecord(approval, actorsById),
      ),
    };
  }

  async create(body: unknown, userId: string): Promise<ReleaseRecord> {
    const input = releaseCreateSchema.parse(body);
    if (input.targetOrgId) await this.assertOrgExists(input.targetOrgId);
    try {
      const release = await prisma.release.create({
        data: {
          name: input.name,
          version: input.version,
          description: input.description ?? null,
          targetOrgId: input.targetOrgId ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          createdBy: userId,
        },
        include: { targetOrg: true },
      });
      return this.toRecord(release);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `Release '${input.name}' version '${input.version}' already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: string, body: unknown, userId: string, isAdmin: boolean): Promise<ReleaseRecord> {
    const input = releaseUpdateSchema.parse(body);
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    if (input.targetOrgId) await this.assertOrgExists(input.targetOrgId);

    const updated = await prisma.release.update({
      where: { id },
      data: {
        name: input.name,
        version: input.version,
        description: input.description,
        targetOrgId: input.targetOrgId,
        scheduledAt:
          input.scheduledAt === undefined
            ? undefined
            : input.scheduledAt === null
              ? null
              : new Date(input.scheduledAt),
        releaseNotes: input.releaseNotes,
      },
      include: { targetOrg: true },
    });
    return this.toRecord(updated);
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<{ deleted: boolean }> {
    const release = await this.requireRelease(id);
    if (!isAdmin && release.createdBy !== userId) {
      throw new ForbiddenException('Only the release owner or an admin can delete it');
    }
    if (release.status !== 'draft' && release.status !== 'cancelled') {
      throw new BadRequestException('Only draft or cancelled releases can be deleted');
    }
    await prisma.release.delete({ where: { id } });
    return { deleted: true };
  }

  async addItem(id: string, body: unknown, userId: string, isAdmin: boolean): Promise<ReleaseItemRecord> {
    const input = releaseItemAddSchema.parse(body);
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);

    if (input.kind === 'deployment') {
      const deployment = await prisma.deployment.findUnique({
        where: { id: input.deploymentId },
        include: { targetOrg: { select: { alias: true } } },
      });
      if (!deployment) throw new NotFoundException('Deployment not found');
      const existing = await prisma.releaseItem.findFirst({
        where: { releaseId: id, deploymentId: input.deploymentId },
      });
      if (existing) throw new ConflictException('Deployment is already linked to this release');
      const item = await prisma.releaseItem.create({
        data: {
          releaseId: id,
          kind: 'deployment',
          deploymentId: deployment.id,
          title: `${deployment.repo}/${deployment.branch}`,
          addedBy: userId,
        },
      });
      return this.toItemRecord(item, new Map([[deployment.id, deployment]]));
    }

    const existing = await prisma.releaseItem.findFirst({
      where: {
        releaseId: id,
        kind: 'work_item',
        workItemProvider: input.provider,
        workItemProjectId: input.projectId,
        workItemExternalId: input.externalId,
      },
    });
    if (existing) throw new ConflictException('Work item is already linked to this release');
    const item = await prisma.releaseItem.create({
      data: {
        releaseId: id,
        kind: 'work_item',
        workItemProvider: input.provider,
        workItemProjectId: input.projectId,
        workItemExternalId: input.externalId,
        title: input.title ?? `#${input.externalId}`,
        addedBy: userId,
      },
    });
    return this.toItemRecord(item, new Map());
  }

  async removeItem(
    id: string,
    itemId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<{ deleted: boolean }> {
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    const item = await prisma.releaseItem.findUnique({ where: { id: itemId } });
    if (!item || item.releaseId !== id) throw new NotFoundException('Release item not found');
    await prisma.releaseItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  async submit(id: string, userId: string, isAdmin: boolean): Promise<ReleaseRecord> {
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    this.assertTransition('submit', release.status as ReleaseStatus);
    const itemCount = await prisma.releaseItem.count({ where: { releaseId: id } });
    if (itemCount === 0) {
      throw new BadRequestException('Add at least one deployment or work item before review');
    }
    return this.transition(id, 'in_review');
  }

  async approve(id: string, body: unknown, userId: string): Promise<ReleaseRecord> {
    const input = releaseDecisionSchema.parse(body ?? {});
    const release = await this.requireRelease(id);
    this.assertTransition('approve', release.status as ReleaseStatus);
    if (release.createdBy === userId) {
      throw new ForbiddenException('A release cannot be approved by its creator');
    }
    await this.recordDecision(id, userId, 'approved', input.comment);
    const updated = await this.transition(id, 'approved');
    await this.notifyOwner(release, `Release ${release.name} ${release.version} approved`, 'success');
    return updated;
  }

  async reject(id: string, body: unknown, userId: string): Promise<ReleaseRecord> {
    const input = releaseDecisionSchema.parse(body ?? {});
    const release = await this.requireRelease(id);
    this.assertTransition('reject', release.status as ReleaseStatus);
    await this.recordDecision(id, userId, 'rejected', input.comment);
    const updated = await this.transition(id, 'draft');
    await this.notifyOwner(
      release,
      `Release ${release.name} ${release.version} was sent back to draft`,
      'warning',
    );
    return updated;
  }

  async release(id: string, userId: string, isAdmin: boolean): Promise<ReleaseRecord> {
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    this.assertTransition('release', release.status as ReleaseStatus);
    const updated = await prisma.release.update({
      where: { id },
      data: { status: 'released', releasedAt: new Date() },
      include: { targetOrg: true },
    });
    await this.notifyOwner(release, `Release ${release.name} ${release.version} is out`, 'success');
    return this.toRecord(updated);
  }

  async reopen(id: string, userId: string, isAdmin: boolean): Promise<ReleaseRecord> {
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    this.assertTransition('reopen', release.status as ReleaseStatus);
    // A new review round starts from scratch: clear previous decisions.
    await prisma.releaseApproval.deleteMany({ where: { releaseId: id } });
    return this.transition(id, 'draft');
  }

  async cancel(id: string, userId: string, isAdmin: boolean): Promise<ReleaseRecord> {
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    this.assertTransition('cancel', release.status as ReleaseStatus);
    return this.transition(id, 'cancelled');
  }

  /**
   * Generate markdown release notes from linked items. Uses the NVIDIA client
   * when configured; otherwise (or on failure) falls back to deterministic
   * notes so the button always produces a useful result.
   */
  async generateNotes(id: string, userId: string, isAdmin: boolean): Promise<ReleaseRecord> {
    const release = await this.requireRelease(id);
    this.assertEditable(release, userId, isAdmin);
    const detail = await this.get(id);

    const deterministic = this.deterministicNotes(detail);
    let notes = deterministic;

    try {
      const result = await this.nvidia.chat({
        messages: [
          {
            role: 'system',
            content:
              'You write concise, professional Salesforce release notes in markdown. ' +
              'Group into "Deployments" and "Work items" sections, one bullet each, ' +
              'and open with a 1-2 sentence summary. Never invent items.',
          },
          {
            role: 'user',
            content:
              `Release: ${detail.name} ${detail.version}\n` +
              (detail.description ? `Description: ${detail.description}\n` : '') +
              (detail.targetOrgAlias ? `Target org: ${detail.targetOrgAlias}\n` : '') +
              `Items:\n${this.itemLines(detail).join('\n') || '(none)'}`,
          },
        ],
        maxTokens: 1200,
      });
      const content = result.content?.trim();
      const isDevMock = !content || /dev mode/i.test(content);
      if (!isDevMock) notes = content;
    } catch (error) {
      this.logger.warn(
        `AI notes generation failed, using deterministic notes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const updated = await prisma.release.update({
      where: { id },
      data: { releaseNotes: notes, notesGeneratedAt: new Date() },
      include: { targetOrg: true },
    });
    return this.toRecord(updated);
  }

  // ---------------------------------------------------------------- helpers

  private itemLines(detail: ReleaseRecord): string[] {
    return (detail.items ?? []).map((item) => {
      if (item.kind === 'deployment') {
        const dep = item.deployment;
        return `- deployment: ${item.title ?? item.deploymentId} (status: ${dep?.status ?? 'unknown'}${dep?.targetOrgAlias ? `, target: ${dep.targetOrgAlias}` : ''})`;
      }
      return `- work item: ${item.workItemProvider} ${item.workItemProjectId}#${item.workItemExternalId} ${item.title ?? ''}`.trim();
    });
  }

  private deterministicNotes(detail: ReleaseRecord): string {
    const deployments = (detail.items ?? []).filter((item) => item.kind === 'deployment');
    const workItems = (detail.items ?? []).filter((item) => item.kind === 'work_item');
    const lines: string[] = [
      `# ${detail.name} ${detail.version}`,
      '',
      detail.description?.trim() || 'This release bundles the changes listed below.',
      '',
    ];
    if (deployments.length > 0) {
      lines.push('## Deployments', '');
      for (const item of deployments) {
        const dep = item.deployment;
        lines.push(
          `- ${item.title ?? item.deploymentId}${dep ? ` — ${dep.status}${dep.targetOrgAlias ? ` to ${dep.targetOrgAlias}` : ''}` : ''}`,
        );
      }
      lines.push('');
    }
    if (workItems.length > 0) {
      lines.push('## Work items', '');
      for (const item of workItems) {
        lines.push(
          `- ${item.workItemProjectId}#${item.workItemExternalId}${item.title ? ` — ${item.title}` : ''}`,
        );
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  private async recordDecision(
    releaseId: string,
    actorId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<void> {
    try {
      await prisma.releaseApproval.create({
        data: { releaseId, actorId, decision, comment: comment ?? null },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('You have already reviewed this release round');
      }
      throw error;
    }
  }

  private async transition(id: string, to: ReleaseStatus): Promise<ReleaseRecord> {
    const updated = await prisma.release.update({
      where: { id },
      data: { status: to },
      include: { targetOrg: true },
    });
    return this.toRecord(updated);
  }

  private assertTransition(
    action: keyof typeof RELEASE_TRANSITIONS,
    from: ReleaseStatus,
  ): void {
    if (!canTransitionRelease(action, from)) {
      throw new BadRequestException(
        `Cannot ${action} a release in status '${from}' (allowed: ${RELEASE_TRANSITIONS[action].from.join(', ')})`,
      );
    }
  }

  private assertEditable(
    release: { createdBy: string; status: string },
    userId: string,
    isAdmin: boolean,
  ): void {
    if (!isAdmin && release.createdBy !== userId) {
      throw new ForbiddenException('Only the release owner or an admin can modify this release');
    }
  }

  private async assertOrgExists(orgId: string): Promise<void> {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Target org connection not found');
  }

  private async requireRelease(id: string) {
    const release = await prisma.release.findUnique({ where: { id } });
    if (!release) throw new NotFoundException('Release not found');
    return release;
  }

  private async notifyOwner(
    release: { createdBy: string; id: string },
    title: string,
    level: 'success' | 'warning',
  ): Promise<void> {
    await this.notifications
      .notify({
        userId: release.createdBy,
        category: 'deployment',
        level,
        title,
        link: `/releases?id=${release.id}`,
      })
      .catch(() => undefined);
  }

  private toRecord(row: ReleaseRow): ReleaseRecord {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      status: row.status as ReleaseStatus,
      targetOrgId: row.targetOrgId,
      targetOrgAlias: row.targetOrg?.alias ?? null,
      releaseNotes: row.releaseNotes,
      notesGeneratedAt: row.notesGeneratedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      releasedAt: row.releasedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toItemRecord(
    item: ReleaseItemRow,
    deploymentsById: Map<string, { id: string; repo: string; branch: string; status: string; targetOrg?: { alias: string } | null }>,
  ): ReleaseItemRecord {
    const deployment = item.deploymentId ? deploymentsById.get(item.deploymentId) : undefined;
    return {
      id: item.id,
      kind: item.kind as ReleaseItemRecord['kind'],
      deploymentId: item.deploymentId,
      workItemProvider: item.workItemProvider,
      workItemProjectId: item.workItemProjectId,
      workItemExternalId: item.workItemExternalId,
      title: item.title,
      metadata: (item.metadata as Record<string, unknown> | null) ?? null,
      addedBy: item.addedBy,
      createdAt: item.createdAt.toISOString(),
      deployment: deployment
        ? {
            id: deployment.id,
            repo: deployment.repo,
            branch: deployment.branch,
            status: deployment.status,
            targetOrgAlias: deployment.targetOrg?.alias ?? null,
          }
        : null,
    };
  }

  private toApprovalRecord(
    approval: ReleaseApprovalRow,
    actorsById: Map<string, string>,
  ): ReleaseApprovalRecord {
    return {
      id: approval.id,
      actorId: approval.actorId,
      actorName: actorsById.get(approval.actorId) ?? null,
      decision: approval.decision as 'approved' | 'rejected',
      comment: approval.comment,
      createdAt: approval.createdAt.toISOString(),
    };
  }
}
