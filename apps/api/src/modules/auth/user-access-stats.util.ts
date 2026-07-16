import type { UserAccessProfile } from '@sfcc/shared';

export interface UserAccessStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  /** Reserved for a future invite system; always 0 today. */
  pendingInvites: number;
  /** Users created in the last 7 days. */
  newThisWeek: number;
  /** Percentage change of new signups vs the previous 7-day window. */
  totalTrendPct: number | null;
}

type StatsInput = Pick<UserAccessProfile, 'role' | 'status'> & {
  createdAt?: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Derive User Access stat-card figures from an already-loaded user list. Kept
 * pure (no DB access) so the overview endpoint needs a single query and the
 * math stays unit-testable.
 */
export function computeUserAccessStats(
  users: StatsInput[],
  now: number = Date.now(),
): UserAccessStats {
  const weekAgo = now - WEEK_MS;
  const twoWeeksAgo = now - 2 * WEEK_MS;

  let active = 0;
  let inactive = 0;
  let admins = 0;
  let newThisWeek = 0;
  let prevWeek = 0;

  for (const user of users) {
    if (user.status === 'inactive') inactive += 1;
    else active += 1;
    if (user.role === 'admin') admins += 1;

    const created = user.createdAt ? Date.parse(user.createdAt) : NaN;
    if (Number.isFinite(created)) {
      if (created >= weekAgo) newThisWeek += 1;
      else if (created >= twoWeeksAgo) prevWeek += 1;
    }
  }

  const totalTrendPct =
    prevWeek > 0 ? Math.round(((newThisWeek - prevWeek) / prevWeek) * 100) : null;

  return {
    total: users.length,
    active,
    inactive,
    admins,
    pendingInvites: 0,
    newThisWeek,
    totalTrendPct,
  };
}
