import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  userProvisionSchema,
  conaUserProvisionSchema,
  expandUserGenerators,
  generateEmailStyleUsername,
  formatProvisioningUsername,
  resolveRoleBottlerMapping,
  resolveUserProvisionSlots,
  userProvisioningConfigSchema,
} from '@sfcc/shared';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { assertOrgOwned, userOwnedWhere } from '../../common/user-tenancy.util';
import { OrgUserMetadataService } from './org-user-metadata.service';

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
    const users = [
      ...(config.users ?? []),
      ...(config.slots?.length
        ? resolveUserProvisionSlots(config.slots, config.templates ?? [])
        : []),
      ...(config.userGenerators?.length
        ? expandUserGenerators(config.userGenerators, {
            automationRunId: runId,
            teams: config.teams,
            roleBottlerMappings: config.roleBottlerMappings,
            usernamePolicy: config.usernamePolicy,
            emailPolicy: config.emailPolicy,
          })
        : []),
    ].map((user, index) => {
      const mapping = resolveRoleBottlerMapping(
        user.role,
        user.bottler,
        config.roleBottlerMappings ?? [],
      );
      return {
        ...user,
        profile: user.profile ?? mapping?.profile,
        permissionSets: user.permissionSets ?? mapping?.permissionSets ?? [],
        modules: user.modules ?? mapping?.modules ?? [],
        locations: user.locations ?? mapping?.locations ?? [],
        username: user.username ?? formatProvisioningUsername(
          generateEmailStyleUsername({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            domain: config.usernamePolicy?.domain,
            uniqueKey: `${runId}-${index + 1}`,
          }),
          config.usernamePolicy?.pattern,
          { runId, ordinal: index + 1 },
        ),
      };
    });
    const metadata = await this.orgUserMetadata.discover(input.orgId, userId);
    const picklists = new Map(metadata.picklists.map((field) => [field.name, new Set(field.values)]));
    const profiles = new Set(metadata.profiles.flatMap((profile) => [profile.Id, profile.Name]));
    const permissionSets = new Set(metadata.permissionSets.map((permissionSet) => permissionSet.Name));
    const errors: string[] = [];
    for (const user of users) {
      if (!user.profile || !profiles.has(user.profile)) errors.push(`${user.username}: invalid or missing profile`);
      for (const permissionSet of user.permissionSets) {
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
          if (dependency?.validFor.length && metadataField?.controllerName) {
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
    if (metadata.missingFields.length) errors.push(`Missing User fields: ${metadata.missingFields.join(', ')}`);
    return { ok: errors.length === 0, users, metadata, errors };
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

  async provisionFromCsv(body: unknown, userId: string) {
    const input = userProvisionSchema.parse(body);
    await assertOrgOwned(input.orgId, userId, prisma);

    const batch = await prisma.provisioningBatch.create({
      data: {
        orgId: input.orgId,
        totalRows: input.users.length,
        status: 'queued',
        createdBy: userId,
        users: {
          create: input.users.map((u) => ({
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
      users: input.users,
    }, { createdBy: userId });

    return { batchId: batch.id, jobId: job.id, totalUsers: input.users.length };
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
