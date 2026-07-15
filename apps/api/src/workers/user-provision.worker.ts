import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  CONA_ADMIN_EXTENSION_PERMSET,
  CONA_SUPER_USER_PERMSET,
} from '@sfcc/shared';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';
import {
  buildStableProvisioningUsername,
  deriveProvisioningBatchStatus,
} from '../modules/provisioning/provisioning-status.util';

interface ConaUserInput {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  role: string;
  bottler: string;
  modules?: string[];
  locations?: string[];
  permissionSets?: string[];
}

@Injectable()
export class UserProvisionWorker {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const { orgId, batchId, users, dbJobId, conaMode } = job.data as {
      orgId: string;
      batchId?: string;
      users: ConaUserInput[];
      dbJobId: string;
      conaMode?: boolean;
    };

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    const org = await this.assertPayloadBinding({ orgId, batchId, dbJobId });

    const alias = org.username ?? org.alias;
    let successCount = 0;
    let failCount = 0;

    const allModules = conaMode ? await this.discoverModules(alias) : [];

    for (const user of users) {
      const username = user.username?.trim() || buildStableProvisioningUsername(user, org.id);
      const provisioned = batchId
        ? await prisma.provisionedUser.findFirst({
            where: {
              batchId,
              OR: [{ username }, { email: user.email }],
            },
          })
        : null;

      if (provisioned?.status === 'completed') {
        successCount++;
        await log('stdout', `Skipping completed user: ${username}`);
        continue;
      }

      try {
        if (provisioned) {
          await prisma.provisionedUser.update({
            where: { id: provisioned.id },
            data: { username, status: 'running', error: null },
          });
        }

        const createFields: Record<string, string> = {
          FirstName: user.firstName,
          LastName: user.lastName,
          Email: user.email,
          Username: username,
          Alias: (user.firstName.substring(0, 2) + user.lastName.slice(-2)).substring(0, 8),
          cfs_ob__Bottler__c: user.bottler,
        };

        let userId = provisioned?.sfUserId ?? await this.findExistingUserId(alias, username);
        if (!userId) {
          const result = await this.sfCli.createUser(alias, createFields);
          if (!result.success) throw new Error(result.error);
          userId = (result.data as { result?: { id?: string } })?.result?.id;
          if (!userId) throw new Error(`Salesforce did not return an id for ${username}`);
          await log('stdout', `Created user: ${username}`);
        } else {
          await log('stdout', `Reconciled existing user: ${username}`);
        }

        if (provisioned) {
          await prisma.provisionedUser.update({
            where: { id: provisioned.id },
            data: { sfUserId: userId },
          });
        }
        if (conaMode && userId) {
          await this.applyRestrictedPicklists(alias, userId, user, allModules, log);
        }

        const permSets = [...(user.permissionSets ?? [CONA_ADMIN_EXTENSION_PERMSET])];
        if (conaMode && user.role === 'Master Data') {
          permSets.push(CONA_SUPER_USER_PERMSET);
        }
        for (const ps of [...new Set(permSets)]) {
          const permResult = await this.sfCli.assignPermissionSet(alias, ps, { onBehalfOf: username });
          if (!permResult.success) {
            throw new Error(permResult.error ?? `Failed to assign permission set ${ps} to ${username}`);
          }
        }

        if (provisioned) {
          await prisma.provisionedUser.update({
            where: { id: provisioned.id },
            data: { status: 'completed', error: null, sfUserId: userId, username },
          });
        }
        successCount++;
        await log('stdout', `Provisioned user: ${username}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (provisioned) {
          await prisma.provisionedUser.update({
            where: { id: provisioned.id },
            data: { status: 'failed', error: message },
          });
        }
        failCount++;
        await log('stderr', `Failed user ${username}: ${message}`);
      }
    }

    if (batchId) {
      const rows = await prisma.provisionedUser.findMany({
        where: { batchId },
        select: { status: true },
      });
      successCount = rows.filter((row) => row.status === 'completed').length;
      failCount = rows.filter((row) => row.status === 'failed').length;
      await prisma.provisioningBatch.update({
        where: { id: batchId },
        data: {
          status: deriveProvisioningBatchStatus(successCount, failCount, rows.length),
          successCount,
          failCount,
        },
      });
    }

    return { successCount, failCount };
  }

  private async assertPayloadBinding(input: {
    orgId: string;
    batchId?: string;
    dbJobId: string;
  }) {
    const [org, dbJob, batch] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: input.orgId } }),
      prisma.job.findUnique({
        where: { id: input.dbJobId },
        select: {
          createdBy: true,
          payload: true,
          parentRun: { select: { createdBy: true } },
        },
      }),
      input.batchId
        ? prisma.provisioningBatch.findUnique({ where: { id: input.batchId } })
        : Promise.resolve(null),
    ]);
    if (!org || !dbJob) throw new Error('Provisioning job resource not found');

    const ownerId =
      dbJob.createdBy !== 'system'
        ? dbJob.createdBy
        : dbJob.parentRun?.createdBy;
    const storedPayload = dbJob.payload as Record<string, unknown>;
    if (
      !ownerId
      || ownerId === 'system'
      || org.createdBy !== ownerId
      || storedPayload.orgId !== input.orgId
      || (input.batchId && storedPayload.batchId !== input.batchId)
      || (input.batchId
        && (!batch
          || batch.orgId !== input.orgId
          || batch.createdBy !== ownerId))
    ) {
      throw new Error('Provisioning job ownership validation failed');
    }
    return org;
  }

  private async findExistingUserId(alias: string, username: string): Promise<string | undefined> {
    const escaped = username.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const result = await this.sfCli.query(
      alias,
      `SELECT Id FROM User WHERE Username = '${escaped}' LIMIT 1`,
    );
    if (!result.success) {
      throw new Error(result.error ?? `Failed to reconcile existing user ${username}`);
    }
    const records = (result.data as { result?: { records?: Array<{ Id?: string }> } })
      ?.result?.records ?? [];
    return records[0]?.Id;
  }

  private async discoverModules(alias: string): Promise<string[]> {
    const describe = await this.sfCli.describeSObject(alias, 'User');
    const field = describe.data?.result?.fields?.find((f) => f.name === 'cfs_ob__Modules__c');
    return (field?.picklistValues ?? []).filter((p) => p.active).map((p) => p.value);
  }

  private async applyRestrictedPicklists(
    alias: string,
    userId: string,
    user: ConaUserInput,
    allModules: string[],
    log: (stream: 'stdout' | 'stderr', line: string) => Promise<void>,
  ) {
    let validModules = user.modules?.length ? [...user.modules] : [...allModules];
    let roleValid = true;

    while (validModules.length > 0) {
      const fields: Record<string, string> = {
        cfs_ob__Modules__c: validModules.join(';'),
      };
      if (roleValid) fields.cfs_ob__Onboarding_Role__c = user.role;
      if (user.locations?.length) fields.cfs_ob__u_Locations__c = user.locations.join(';');

      const update = await this.sfCli.updateUser(alias, userId, fields);
      if (update.success) {
        await log('stdout', `Set CONA picklists for ${user.firstName} ${user.lastName}`);
        return;
      }

      const badValue = this.extractBadValue(update.error ?? '');
      if (!badValue) break;
      if (badValue === user.role) {
        roleValid = false;
        await log('stderr', `Role "${user.role}" rejected; setting modules only`);
      } else if (validModules.includes(badValue)) {
        validModules = validModules.filter((m) => m !== badValue);
        await log('stderr', `Removed invalid module "${badValue}"`);
      } else {
        break;
      }
    }
  }

  private extractBadValue(errorMsg: string): string | null {
    const marker = 'bad value for restricted picklist field: ';
    const idx = errorMsg.toLowerCase().indexOf(marker);
    if (idx < 0) return null;
    const remainder = errorMsg.substring(idx + marker.length);
    const colonIdx = remainder.indexOf(':');
    return colonIdx > 0 ? remainder.substring(0, colonIdx).trim() : remainder.trim();
  }
}
