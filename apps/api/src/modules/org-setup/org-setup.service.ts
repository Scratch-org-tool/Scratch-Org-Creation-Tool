import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { QUEUE_NAMES, orgSetupSchema } from '@sfcc/shared';
import { assertOrgOwned, assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

@Injectable()
export class OrgSetupService {
  private readonly sfCli = createSfCliClient();

  constructor(private readonly orchestrator: OrchestratorService) {}

  async executeSetup(body: unknown, userId: string) {
    const input = orgSetupSchema.parse(body);
    await assertOrgOwned(input.orgId, userId, prisma);
    const jobs = [];

    const setupTypes: Array<{ type: string; config: Record<string, unknown> }> = [];
    if (input.namedCredentials?.length) setupTypes.push({ type: 'named_credentials', config: { items: input.namedCredentials } });
    if (input.customSettings?.length) setupTypes.push({ type: 'custom_settings', config: { items: input.customSettings } });
    if (input.customMetadata?.length) setupTypes.push({ type: 'custom_metadata', config: { items: input.customMetadata } });
    if (input.permissionSets?.length) {
      setupTypes.push({
        type: 'permission_sets',
        config: {
          permissionSets: input.permissionSets,
          assignScope: input.assignScope ?? 'all_active_users',
        },
      });
    }
    if (input.queues?.length) setupTypes.push({ type: 'queues', config: { items: input.queues } });
    if (input.theme) setupTypes.push({ type: 'theme', config: { theme: input.theme } });

    for (const { type, config } of setupTypes) {
      const run = await prisma.orgSetupRun.create({
        data: { orgId: input.orgId, setupType: type, config: config as Prisma.InputJsonValue, status: 'queued' },
      });
      const job = await this.orchestrator.enqueueJob(
        QUEUE_NAMES.ORG_SETUP,
        type,
        {
          orgId: input.orgId,
          setupType: type,
          config,
          runId: run.id,
        },
        { createdBy: userId },
      );
      jobs.push({ runId: run.id, jobId: job.id, type });
    }

    return { jobs };
  }

  async listRuns(userId: string, orgId?: string) {
    if (orgId) {
      await assertOrgOwned(orgId, userId, prisma);
    }
    const ownedOrgs = await prisma.orgConnection.findMany({
      where: userOwnedWhere(userId),
      select: { id: true },
    });
    const ownedOrgIds = ownedOrgs.map((org) => org.id);
    return prisma.orgSetupRun.findMany({
      where: {
        orgId: orgId ?? { in: ownedOrgIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listPermissionSets(orgId: string, userId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    assertResourceOwner(org, userId, 'Org');
    const alias = org!.username ?? org!.alias;
    const result = await this.sfCli.query(
      alias,
      'SELECT Id, Name, Label, IsOwnedByProfile FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Name LIMIT 500',
    );
    if (!result.success) {
      throw new NotFoundException(result.error ?? 'Failed to query permission sets');
    }
    const records =
      (result.data as {
        result?: { records?: Array<{ Name: string; Label: string }> };
      })?.result?.records ?? [];
    return {
      permissionSets: records.map((r) => ({
        name: r.Name,
        label: r.Label,
      })),
    };
  }
}
