import { describe, expect, it } from 'vitest';
import { computeUserAccessStats } from './user-access-stats.util';

const NOW = Date.parse('2026-07-16T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('computeUserAccessStats', () => {
  it('counts totals, status, admins, and recent signups from one list', () => {
    const stats = computeUserAccessStats(
      [
        { role: 'admin', status: 'active', createdAt: daysAgo(1) },
        { role: 'user', status: 'active', createdAt: daysAgo(3) },
        { role: 'user', status: 'inactive', createdAt: daysAgo(10) },
      ],
      NOW,
    );

    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.inactive).toBe(1);
    expect(stats.admins).toBe(1);
    expect(stats.newThisWeek).toBe(2);
    expect(stats.pendingInvites).toBe(0);
  });

  it('treats missing status as active', () => {
    const stats = computeUserAccessStats([{ role: 'user', status: undefined }], NOW);
    expect(stats.active).toBe(1);
    expect(stats.inactive).toBe(0);
  });

  it('derives the week-over-week trend from signups', () => {
    const stats = computeUserAccessStats(
      [
        { role: 'user', status: 'active', createdAt: daysAgo(1) },
        { role: 'user', status: 'active', createdAt: daysAgo(2) },
        { role: 'user', status: 'active', createdAt: daysAgo(10) },
      ],
      NOW,
    );
    // 2 this week vs 1 the prior week => +100%
    expect(stats.newThisWeek).toBe(2);
    expect(stats.totalTrendPct).toBe(100);
  });

  it('returns a null trend when there is no prior-week baseline', () => {
    const stats = computeUserAccessStats(
      [{ role: 'user', status: 'active', createdAt: daysAgo(1) }],
      NOW,
    );
    expect(stats.totalTrendPct).toBeNull();
  });
});
