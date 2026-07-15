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
import { buildPicklistDependencies } from '../modules/provisioning/picklist-dependency.util';

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
  profile?: string;
}

@Injectable()
export class UserProvisionWorker {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const { orgId, batchId, users, dbJobId, conaMode, strictMetadata } = job.data as {
      orgId: string;
      batchId?: string;
      users: ConaUserInput[];
      dbJobId: string;
      conaMode?: boolean;
      strictMetadata?: boolean;
    };

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    const org = await this.assertPayloadBinding({ orgId, batchId, dbJobId });

    const alias = org.username ?? org.alias;
    let successCount = 0;
    let failCount = 0;

    let metadata: { profileIds: Map<string, string> } | undefined;
    try {
      metadata = conaMode ? await this.preflightUsers(alias, users, Boolean(strictMetadata)) : undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (batchId) {
        await prisma.provisionedUser.updateMany({
          where: { batchId, status: { not: 'completed' } },
          data: { status: 'failed', error: message },
        });
        await prisma.provisioningBatch.update({
          where: { id: batchId },
          data: { status: 'failed', failCount: users.length, successCount: 0 },
        });
      }
      await log('stderr', `Provisioning preflight failed: ${message}`);
      throw error;
    }

    for (const user of users) {
      const username = user.username?.trim() || buildStableProvisioningUsername(user, org.id);
      const provisioned = batchId
        ? await prisma.provisionedUser.findFirst({
            where: {
              batchId,
              username,
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
          TimeZoneSidKey: 'America/New_York',
          LocaleSidKey: 'en_US',
          EmailEncodingKey: 'UTF-8',
          LanguageLocaleKey: 'en_US',
          cfs_ob__Bottler__c: user.bottler,
        };
        const profileId = metadata?.profileIds.get(user.profile ?? '');
        if (profileId) createFields.ProfileId = profileId;

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
          await this.applyOnboardingFields(alias, userId, user, log);
        }

        const permSets = [...(user.permissionSets ?? (strictMetadata ? [] : [CONA_ADMIN_EXTENSION_PERMSET]))];
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

    if (failCount > 0) {
      throw new Error(
        failCount === users.length
          ? `All ${failCount} user(s) failed provisioning`
          : `${failCount} of ${users.length} user(s) failed provisioning; completed users will be skipped on resume`,
      );
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

  private async preflightUsers(alias: string, users: ConaUserInput[], strict: boolean) {
    const describe = await this.sfCli.describeSObject(alias, 'User');
    if (!describe.success || !describe.data?.result?.fields) {
      throw new Error(describe.error ?? 'Failed to discover target User metadata');
    }
    const fields = describe.data.result.fields;
    const fieldNames = [
      'cfs_ob__Onboarding_Role__c',
      'cfs_ob__Bottler__c',
      'cfs_ob__Modules__c',
      'cfs_ob__u_Locations__c',
    ];
    const missing = fieldNames.filter((name) => !fields.some((field) => field.name === name));
    if (strict && missing.length) throw new Error(`Target User fields are missing: ${missing.join(', ')}`);

    const [profilesResult, permissionSetsResult] = await Promise.all([
      this.sfCli.query(alias, 'SELECT Id, Name FROM Profile ORDER BY Name LIMIT 500'),
      this.sfCli.query(alias, 'SELECT Name FROM PermissionSet WHERE IsOwnedByProfile = false LIMIT 2000'),
    ]);
    if (!profilesResult.success || !permissionSetsResult.success) {
      throw new Error(profilesResult.error ?? permissionSetsResult.error ?? 'Profile/permission-set preflight failed');
    }
    const profiles = (profilesResult.data?.result?.records ?? []) as Array<{ Id: string; Name: string }>;
    const profileIds = new Map(profiles.flatMap((profile) => [
      [profile.Name, profile.Id] as const,
      [profile.Id, profile.Id] as const,
    ]));
    const permissionSets = new Set(
      ((permissionSetsResult.data?.result?.records ?? []) as Array<{ Name: string }>).map((row) => row.Name),
    );
    const picklists = new Map(fields.map((field) => [
      field.name,
      new Set((field.picklistValues ?? []).filter((value) => value.active).map((value) => value.value)),
    ]));
    const userValue = (user: ConaUserInput, fieldName: string): string[] => {
      if (fieldName === 'cfs_ob__Onboarding_Role__c') return [user.role];
      if (fieldName === 'cfs_ob__Bottler__c') return [user.bottler];
      if (fieldName === 'cfs_ob__Modules__c') return user.modules ?? [];
      if (fieldName === 'cfs_ob__u_Locations__c') return user.locations ?? [];
      return [];
    };
    for (const user of users) {
      if (strict && !user.profile) throw new Error(`Profile is required for ${user.username ?? user.email}`);
      if (user.profile && !profileIds.has(user.profile)) throw new Error(`Unknown profile: ${user.profile}`);
      for (const permissionSet of user.permissionSets ?? []) {
        if (!permissionSets.has(permissionSet)) throw new Error(`Unknown permission set: ${permissionSet}`);
      }
      for (const fieldName of fieldNames) {
        const allowed = picklists.get(fieldName);
        for (const value of userValue(user, fieldName)) {
          if (allowed && !allowed.has(value)) throw new Error(`Invalid ${fieldName} value "${value}"`);
        }
        const field = fields.find((candidate) => candidate.name === fieldName);
        if (!field?.controllerName) continue;
        const controller = fields.find((candidate) => candidate.name === field.controllerName);
        const controllerValues = (controller?.picklistValues ?? [])
          .filter((value) => value.active)
          .map((value) => value.value);
        const dependencies = buildPicklistDependencies(field.picklistValues ?? [], controllerValues);
        const selectedControllerValues = new Set(userValue(user, field.controllerName));
        for (const selected of userValue(user, fieldName)) {
          const dependency = dependencies.find((candidate) => candidate.value === selected);
          if (
            dependency?.validFor.length
            && !dependency.validFor.some((controllerValue) => selectedControllerValues.has(controllerValue))
          ) {
            throw new Error(
              `Value "${selected}" for ${fieldName} is invalid for ${field.controllerName}`,
            );
          }
        }
      }
    }
    return { profileIds };
  }

  private async applyOnboardingFields(
    alias: string,
    userId: string,
    user: ConaUserInput,
    log: (stream: 'stdout' | 'stderr', line: string) => Promise<void>,
  ) {
    const fields: Record<string, string> = {
      cfs_ob__Onboarding_Role__c: user.role,
      cfs_ob__Bottler__c: user.bottler,
      ...(user.modules?.length ? { cfs_ob__Modules__c: user.modules.join(';') } : {}),
      ...(user.locations?.length ? { cfs_ob__u_Locations__c: user.locations.join(';') } : {}),
    };
    const update = await this.sfCli.updateUser(alias, userId, fields);
    if (!update.success) {
      throw new Error(update.error ?? `Failed to set onboarding fields for ${user.username ?? user.email}`);
    }
    await log('stdout', `Set CONA picklists for ${user.firstName} ${user.lastName}`);
  }
}
