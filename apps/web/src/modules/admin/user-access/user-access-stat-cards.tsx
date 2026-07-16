'use client';

import { Shield, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { StatCard, StatCardGrid } from '@/components/studio';
import type { UserAccessStats } from './types';

interface UserAccessStatCardsProps {
  stats: UserAccessStats | null;
}

export function UserAccessStatCards({ stats }: UserAccessStatCardsProps) {
  const total = stats?.total ?? 0;
  const active = stats?.active ?? 0;
  const admins = stats?.admins ?? 0;
  const inactive = stats?.inactive ?? 0;

  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
  const adminPct = total > 0 ? Math.round((admins / total) * 100) : 0;
  const inactivePct = total > 0 ? Math.round((inactive / total) * 100) : 0;

  const trend =
    stats?.totalTrendPct != null
      ? `${stats.totalTrendPct >= 0 ? '▲' : '▼'} ${Math.abs(stats.totalTrendPct)}% vs last 7 days`
      : undefined;

  return (
    <StatCardGrid cols={5}>
      <StatCard label="Total Users" value={total} icon={Users} iconClass="text-blue-400" trend={trend} />
      <StatCard
        label="Active Users"
        value={active}
        icon={UserCheck}
        iconClass="text-green-400"
        trend={`${activePct}% of total users`}
      />
      <StatCard
        label="Admins"
        value={admins}
        icon={Shield}
        iconClass="text-purple-400"
        trend={`${adminPct}% of total users`}
      />
      <StatCard
        label="New This Week"
        value={stats?.newThisWeek ?? 0}
        icon={UserPlus}
        iconClass="text-amber-400"
        trend="Joined in the last 7 days"
      />
      <StatCard
        label="Inactive Users"
        value={inactive}
        icon={UserMinus}
        iconClass="text-red-400"
        trend={`${inactivePct}% of total users`}
      />
    </StatCardGrid>
  );
}
