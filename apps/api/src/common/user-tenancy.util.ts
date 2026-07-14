import { NotFoundException } from '@nestjs/common';

export function userOwnedWhere(userId: string) {
  return { createdBy: userId };
}

/** Authenticated production/sandbox/dev-hub connections (excludes scratch org aliases). */
export function connectedOrgWhere(userId: string) {
  return { type: { not: 'scratch' as const }, ...userOwnedWhere(userId) };
}

export function activeConnectedOrgWhere(userId: string) {
  return { ...connectedOrgWhere(userId), status: 'active' as const };
}

export function assertResourceOwner(
  resource: { createdBy?: string | null } | null | undefined,
  userId: string,
  label = 'Resource',
): asserts resource is { createdBy?: string | null } {
  if (!resource || resource.createdBy !== userId) {
    throw new NotFoundException(`${label} not found`);
  }
}

export async function assertOrgOwned<T extends { createdBy?: string | null }>(
  orgId: string,
  userId: string,
  prisma: {
    orgConnection: {
      findUnique: (args: { where: { id: string } }) => Promise<T | null>;
    };
  },
): Promise<T> {
  const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
  assertResourceOwner(org, userId, 'Org');
  return org!;
}
