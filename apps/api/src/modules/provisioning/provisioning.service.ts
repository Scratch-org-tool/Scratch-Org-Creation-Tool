import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { QUEUE_NAMES, userProvisionSchema, conaUserProvisionSchema } from '@sfcc/shared';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { assertOrgOwned, userOwnedWhere } from '../../common/user-tenancy.util';

@Injectable()
export class ProvisioningService {
  constructor(private readonly orchestrator: OrchestratorService) {}

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
