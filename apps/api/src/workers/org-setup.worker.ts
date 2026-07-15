import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import type { OrgSetupAssignScope } from '@sfcc/shared';
import { OrgConfigLoaderService } from '../modules/environment/org-config-loader.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';

@Injectable()
export class OrgSetupWorker {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly orgConfigLoader: OrgConfigLoaderService,
  ) {}

  async process(job: Job) {
    const data = job.data as {
      orgId: string;
      setupType?: string;
      config?: Record<string, unknown>;
      orgConfig?: { upsertQueueIds?: boolean; upsertDomainFields?: boolean; upsertRequestId?: boolean };
      runId?: string;
      dbJobId: string;
    };
    const org = await this.assertPayloadBinding(data);

    if (job.name === 'pipeline_load_org_config') {
      const log = async (stream: 'stdout' | 'stderr', line: string) => {
        await this.jobsService.addLog(data.dbJobId, stream, line);
        await this.streamService.publishJobLog(data.dbJobId, stream, line);
      };
      await log('stdout', 'Loading org configuration...');
      const result = await this.orgConfigLoader.loadForOrg(data.orgId, data.orgConfig ?? {});
      for (const line of result.logs) await log('stdout', line);
      await log('stdout', 'Org config load complete');
      return { loadOrgConfigCompleted: true, recordId: result.recordId };
    }

    const { orgId, setupType, config, dbJobId, runId } = data;

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    const markRun = async (status: 'completed' | 'failed') => {
      if (!runId) return;
      await prisma.orgSetupRun.update({
        where: { id: runId },
        data: { status },
      });
    };

    try {
      const alias = org.username ?? org.alias;
      await log('stdout', `Running org setup: ${setupType} (org: ${alias})`);

      switch (setupType) {
        case 'permission_sets':
          await this.assignPermissionSets(
            alias,
            (config?.permissionSets as string[]) ?? [],
            (config?.assignScope as OrgSetupAssignScope | undefined) ?? 'all_active_users',
            log,
          );
          break;
        case 'theme':
          await log('stdout', `Theme configured: ${config?.theme}`);
          break;
        case 'named_credentials':
        case 'custom_settings':
        case 'custom_metadata':
        case 'queues':
          await log('stdout', `Configured ${setupType}: ${JSON.stringify(config).substring(0, 200)}`);
          break;
        default:
          throw new Error(`Unknown setup type: ${setupType}`);
      }

      await markRun('completed');
      return { setupType, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await log('stderr', message);
      await markRun('failed');
      throw error;
    }
  }

  private async assertPayloadBinding(data: {
    orgId: string;
    runId?: string;
    dbJobId: string;
  }) {
    const [org, dbJob, setupRun] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: data.orgId } }),
      prisma.job.findUnique({
        where: { id: data.dbJobId },
        select: {
          createdBy: true,
          payload: true,
          parentRun: { select: { createdBy: true } },
        },
      }),
      data.runId
        ? prisma.orgSetupRun.findUnique({ where: { id: data.runId } })
        : Promise.resolve(null),
    ]);
    if (!org || !dbJob) throw new Error('Org setup job resource not found');

    const ownerId =
      dbJob.createdBy !== 'system'
        ? dbJob.createdBy
        : dbJob.parentRun?.createdBy;
    const storedPayload = dbJob.payload as Record<string, unknown>;
    if (
      !ownerId
      || ownerId === 'system'
      || org.createdBy !== ownerId
      || storedPayload.orgId !== data.orgId
      || (data.runId && storedPayload.runId !== data.runId)
      || (data.runId && (!setupRun || setupRun.orgId !== data.orgId))
    ) {
      throw new Error('Org setup job ownership validation failed');
    }
    return org;
  }

  private async assignPermissionSets(
    alias: string,
    permissionSets: string[],
    assignScope: OrgSetupAssignScope,
    log: (stream: 'stdout' | 'stderr', line: string) => Promise<void>,
  ) {
    if (permissionSets.length === 0) {
      throw new Error('No permission sets specified');
    }

    const usernames =
      assignScope === 'all_active_users'
        ? await this.listActiveUsernames(alias)
        : [undefined];

    await log(
      'stdout',
      assignScope === 'all_active_users'
        ? `Assigning ${permissionSets.length} permission set(s) to ${usernames.length} active user(s)`
        : `Assigning ${permissionSets.length} permission set(s) to connected default user`,
    );

    for (const username of usernames) {
      for (const ps of permissionSets) {
        const label = username ? `${ps} → ${username}` : ps;
        const result = await this.sfCli.assignPermissionSet(alias, ps, {
          onBehalfOf: username,
        });
        if (result.stdout) await log('stdout', result.stdout.trim());
        if (result.stderr) await log('stderr', result.stderr.trim());
        if (!result.success) {
          throw new Error(
            result.error ?? `Failed to assign permission set ${label}`,
          );
        }
        await log('stdout', `Assigned ${label}`);
      }
    }
  }

  private async listActiveUsernames(alias: string): Promise<string[]> {
    const result = await this.sfCli.query(
      alias,
      `SELECT Username FROM User
       WHERE IsActive = true
         AND UserType = 'Standard'
         AND Profile.UserLicense.Name IN ('Salesforce', 'Salesforce Platform')
         AND NOT Username LIKE 'insightssecurity@%'
       ORDER BY Username`,
    );
    const records =
      (result.data as { result?: { records?: Array<{ Username: string }> } })?.result?.records ?? [];
    const usernames = records.map((r) => r.Username).filter(Boolean);
    if (usernames.length === 0) {
      throw new Error('No active standard users found in org');
    }
    return usernames;
  }
}
