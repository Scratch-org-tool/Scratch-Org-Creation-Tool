import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  userProvisionSchema,
  conaUserProvisionSchema,
  expandLifecycleUsers,
  generateEmailStyleUsername,
  lifecycleUserGenerationSchema,
  resolveBottlerLabel,
  resolveUserProvisioningPlan,
  userProvisioningConfigSchema,
} from '@sfcc/shared';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { assertOrgOwned, userOwnedWhere } from '../../common/user-tenancy.util';
import { OrgUserMetadataService } from './org-user-metadata.service';
import {
  ProvisioningProfileValidationError,
  provisioningProfileNames,
  resolveProvisioningProfileIds,
} from './provisioning-profile.util';

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly orgUserMetadata: OrgUserMetadataService,
  ) {}

  async previewTemplatePlan(body: unknown, userId: string) {
    const input = body as { orgId?: string; automationRunId?: string; config?: unknown };
    if (!input.orgId) throw new Error('orgId is required');
    const config = userProvisioningConfigSchema.parse(input.config ?? {});
    const runId = input.automationRunId ?? `preview-${input.orgId}`;
    const unresolvedUsers = resolveUserProvisioningPlan(config, runId);
    const discoveryPolicy = config.discoveryPolicy ?? 'best_effort';
    const discoveryFailurePolicy = config.execution?.discoveryFailurePolicy ?? 'fail';
    const warnings: string[] = [];
    const resolveProfiles = async (
      profiles?: Array<{ Id: string; Name: string }>,
    ) => {
      const availableProfiles = profiles ?? (
        provisioningProfileNames(unresolvedUsers).length
          ? await this.orgUserMetadata.discoverProfiles(input.orgId!, userId)
          : []
      );
      return resolveProvisioningProfileIds(unresolvedUsers, availableProfiles, {
        requireProfile: true,
      }).users;
    };
    if (discoveryPolicy === 'disabled') {
      let users = unresolvedUsers;
      const errors: string[] = [];
      try {
        users = await resolveProfiles();
      } catch (error) {
        if (!(error instanceof ProvisioningProfileValidationError)) throw error;
        errors.push(error.message);
      }
      return {
        ok: errors.length === 0,
        users,
        metadata: null,
        errors,
        warnings: ['Target metadata discovery is disabled'],
      };
    }
    let metadata: Awaited<ReturnType<OrgUserMetadataService['discover']>>;
    try {
      metadata = await this.orgUserMetadata.discover(input.orgId, userId);
    } catch (error) {
      if (discoveryPolicy === 'strict' || discoveryFailurePolicy === 'fail') throw error;
      warnings.push(
        `Target metadata discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      let users = unresolvedUsers;
      const errors: string[] = [];
      try {
        users = await resolveProfiles();
      } catch (profileError) {
        if (!(profileError instanceof ProvisioningProfileValidationError)) throw profileError;
        errors.push(profileError.message);
      }
      return { ok: errors.length === 0, users, metadata: null, errors, warnings };
    }
    const picklists = new Map(metadata.picklists.map((field) => [field.name, new Set(field.values)]));
    const permissionSets = new Set(metadata.permissionSets.map((permissionSet) => permissionSet.Name));
    const errors: string[] = [];
    let users = unresolvedUsers;
    try {
      users = await resolveProfiles(metadata.profiles);
    } catch (error) {
      if (!(error instanceof ProvisioningProfileValidationError)) throw error;
      errors.push(error.message);
    }
    for (const user of users) {
      for (const permissionSet of user.permissionSets ?? []) {
        if (!permissionSets.has(permissionSet)) errors.push(`${user.username}: unknown permission set ${permissionSet}`);
      }
      for (const [field, values] of [
        ['cfs_ob__Onboarding_Role__c', [user.role]],
        ['cfs_ob__Bottler__c', [user.bottler]],
        ['cfs_ob__Modules__c', user.modules],
        ['cfs_ob__u_Locations__c', user.locations],
      ] as const) {
        for (const value of values) {
          if (!picklists.get(field)?.has(value)) errors.push(`${user.username}: invalid ${field} value ${value}`);
          const metadataField = metadata.picklists.find((candidate) => candidate.name === field);
          const dependency = metadataField?.dependencies?.find((candidate) => candidate.value === value);
          if (dependency && metadataField?.controllerName) {
            const controllerValues = metadataField.controllerName === 'cfs_ob__Bottler__c'
              ? [user.bottler]
              : metadataField.controllerName === 'cfs_ob__Onboarding_Role__c'
                ? [user.role]
                : [];
            if (!dependency.validFor.some((controllerValue) => controllerValues.includes(controllerValue))) {
              errors.push(
                `${user.username}: ${field} value ${value} is invalid for ${metadataField.controllerName}`,
              );
            }
          }
        }
      }
    }
    if (discoveryPolicy === 'strict' && metadata.missingFields.length) {
      errors.push(`Missing User fields: ${metadata.missingFields.join(', ')}`);
    } else if (metadata.missingFields.length) {
      warnings.push(`Missing User fields: ${metadata.missingFields.join(', ')}`);
    }
    return { ok: errors.length === 0, users, metadata, errors, warnings };
  }

  async provisionConaUsers(body: unknown, userId: string) {
    const input = conaUserProvisionSchema.parse(body);
    await assertOrgOwned(input.orgId, userId, prisma);
    const job = await this.orchestrator.enqueueJob(QUEUE_NAMES.USER_PROVISION, 'cona_user_provision', {
      orgId: input.orgId,
      users: input.users,
      conaMode: true,
    }, { createdBy: userId });
    return { jobId: job.id, totalUsers: input.users.length };
  }

  /**
   * Lifecycle role-based generation: one user per selected Onboarding Role for
   * a single bottler, executed by the existing CONA-mode worker (create user,
   * set role/bottler/modules/locations picklists, assign permission sets).
   */
  async provisionLifecycleUsers(body: unknown, userId: string) {
    const input = lifecycleUserGenerationSchema.parse(body);
    await assertOrgOwned(input.orgId, userId, prisma);

    // Validate and expand before any writes; the seed keeps emails and
    // {unique} deterministic for worker retries of this batch.
    const users = expandLifecycleUsers({
      ...input,
      seed: randomUUID(),
      bottlerLabel: resolveBottlerLabel(input.bottler),
    });

    const batch = await prisma.provisioningBatch.create({
      data: {
        orgId: input.orgId,
        totalRows: users.length,
        status: 'queued',
        createdBy: userId,
        users: {
          create: users.map((user) => ({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            username: user.username,
            profile: user.profile,
            role: user.role,
            permissionSets: user.permissionSets,
            status: 'queued',
          })),
        },
      },
    });

    const job = await this.orchestrator.enqueueJob(QUEUE_NAMES.USER_PROVISION, 'lifecycle_user_provision', {
      orgId: input.orgId,
      batchId: batch.id,
      users,
      conaMode: true,
    }, { createdBy: userId });

    return { batchId: batch.id, jobId: job.id, totalUsers: users.length, users };
  }

  async provisionFromCsv(body: unknown, userId: string) {
    const input = userProvisionSchema.parse(body);
    await assertOrgOwned(input.orgId, userId, prisma);
    const users = input.users.map((user) => ({
      ...user,
      username: user.username?.trim()
        || generateEmailStyleUsername({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          uniqueKey: `${input.orgId}:${user.email}`,
        }),
    }));

    const batch = await prisma.provisioningBatch.create({
      data: {
        orgId: input.orgId,
        totalRows: users.length,
        status: 'queued',
        createdBy: userId,
        users: {
          create: users.map((u) => ({
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            username: u.username,
            profile: u.profile,
            role: u.role,
            permissionSets: u.permissionSets ?? [],
            status: 'queued',
          })),
        },
      },
      include: { users: true },
    });

    const job = await this.orchestrator.enqueueJob(QUEUE_NAMES.USER_PROVISION, 'bulk_provision', {
      orgId: input.orgId,
      batchId: batch.id,
      users,
    }, { createdBy: userId });

    return { batchId: batch.id, jobId: job.id, totalUsers: users.length };
  }

  async listBatches(userId: string) {
    return prisma.provisioningBatch.findMany({
      where: userOwnedWhere(userId),
      include: { users: true, org: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  parseCsv(csv: string) {
    const lines = csv.trim().split('\n');
    const headers = lines[0]?.split(',').map((h) => h.trim()) ?? [];
    const users = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
      return {
        firstName: row.firstName ?? row.FirstName ?? '',
        lastName: row.lastName ?? row.LastName ?? '',
        email: row.email ?? row.Email ?? '',
        username: row.username ?? row.Username ?? '',
        profile: row.profile ?? row.Profile,
        role: row.role ?? row.Role,
        permissionSets: row.permissionSets?.split(';').filter(Boolean),
      };
    });
    return users;
  }
}
