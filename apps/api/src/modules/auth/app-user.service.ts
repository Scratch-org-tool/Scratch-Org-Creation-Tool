import { prisma } from '@sfcc/db';
import {
  toAppUserId,
  toFirebaseUid,
  type AppModule,
  type UserAccessProfile,
  type UserAccessStatus,
  type UserRole,
} from '@sfcc/shared';

function toProfile(user: {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  grantedModules: string[];
  grantedLearningPaths?: string[];
  grantedLearningFeatures?: string[];
  status: string;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): UserAccessProfile & { createdAt: string; updatedAt: string } {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    grantedModules: user.grantedModules as AppModule[],
    grantedLearningPaths: user.grantedLearningPaths ?? [],
    grantedLearningFeatures: user.grantedLearningFeatures ?? [],
    status: (user.status === 'inactive' ? 'inactive' : 'active') as UserAccessStatus,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getAppUser(userId: string) {
  const user = await prisma.appUser.findUnique({ where: { id: userId } });
  return user ? toProfile(user) : null;
}

/** Resolve Deployment Tool profile by Firebase Auth UID (prefixed or legacy). */
export async function getAppUserByFirebaseUid(firebaseUid: string) {
  const prefixedId = toAppUserId(firebaseUid);
  const prefixed = await getAppUser(prefixedId);
  if (prefixed) return prefixed;
  const rawUid = toFirebaseUid(firebaseUid);
  if (rawUid !== prefixedId) {
    return getAppUser(rawUid);
  }
  return null;
}

export async function listAppUsers(_dptOnly = false) {
  const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(toProfile);
}

export async function upsertAppUser(profile: {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  grantedModules?: AppModule[];
}) {
  const user = await prisma.appUser.upsert({
    where: { id: profile.id },
    create: {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      role: profile.role,
      grantedModules: profile.grantedModules ?? [],
    },
    update: {
      email: profile.email,
      displayName: profile.displayName,
    },
  });
  return toProfile(user);
}

export async function createAppUser(profile: {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  grantedModules?: AppModule[];
}) {
  return upsertAppUser(profile);
}

export async function touchLastActive(userId: string) {
  const user = await prisma.appUser.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
  return toProfile(user);
}

export async function updateAppUser(
  userId: string,
  updates: {
    grantedModules?: AppModule[];
    grantedLearningPaths?: string[];
    grantedLearningFeatures?: string[];
    role?: UserRole;
    displayName?: string;
    status?: UserAccessStatus;
  },
) {
  const user = await prisma.appUser.update({
    where: { id: userId },
    data: {
      grantedModules: updates.grantedModules,
      grantedLearningPaths: updates.grantedLearningPaths,
      grantedLearningFeatures: updates.grantedLearningFeatures,
      role: updates.role,
      displayName: updates.displayName,
      status: updates.status,
    },
  });
  return toProfile(user);
}

/** Efficient count of active administrators, for last-admin protection. */
export async function countActiveAdminUsers(): Promise<number> {
  return prisma.appUser.count({
    where: { role: 'admin', status: { not: 'inactive' } },
  });
}
