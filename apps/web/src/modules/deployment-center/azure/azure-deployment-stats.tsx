'use client';

import { Activity, CheckCircle, Clock, Play, XCircle } from 'lucide-react';
import { KpiCard } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { DeploymentRow } from './types';
import { ACTIVE_STATUSES } from './types';
import { formatDuration, isToday } from './log-utils';

interface AzureDeploymentStatsProps {
  history: DeploymentRow[];
  activeOrgAlias?: string;
}

export function AzureDeploymentStats({ history, activeOrgAlias }: AzureDeploymentStatsProps) {
  const today = history.filter((d) => isToday(d.createdAt));
  const successfulToday = today.filter((d) => d.status === 'completed').length;
  const failedToday = today.filter((d) => d.status === 'failed').length;
  const active = history.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const durations = history
    .map((d) => {
      const s = d.job?.startedAt ?? d.job?.createdAt;
      const f = d.job?.finishedAt;
      if (!s || !f) return null;
      return new Date(f).getTime() - new Date(s).getTime();
    })
    .filter((v): v is number => v != null && v > 0);
  const avgMs =
    durations.length >= 2
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

  const cards = [
    {
      label: 'Deployments Today',
      value: String(today.length),
      trendLabel: today.length ? `${today.length} run${today.length === 1 ? '' : 's'} today` : 'No runs yet',
      icon: Activity,
      iconClass: 'text-blue-400',
      accentColor: '#60a5fa',
    },
    {
      label: 'Successful',
      value: String(successfulToday),
      trendLabel: today.length ? `${Math.round((successfulToday / today.length) * 100) || 0}% today` : '—',
      icon: CheckCircle,
      iconClass: 'text-green-400',
      accentColor: '#4ade80',
    },
    {
      label: 'Failed',
      value: String(failedToday),
      trendLabel: failedToday ? 'Review logs below' : 'None today',
      icon: XCircle,
      iconClass: 'text-red-400',
      accentColor: '#f87171',
    },
    {
      label: 'Avg Duration',
      value: avgMs ? formatDuration(avgMs) : '—',
      trendLabel: durations.length >= 2 ? `from ${durations.length} jobs` : 'Need more data',
      icon: Clock,
      iconClass: 'text-purple-400',
      accentColor: '#a78bfa',
    },
    {
      label: 'Active Deployment',
      value: active.length ? String(active.length) : '0',
      trendLabel: active.length
        ? activeOrgAlias
          ? `Deploying to ${activeOrgAlias}`
          : 'In progress'
        : 'None running',
      icon: Play,
      iconClass: cn('text-cyan-400', active.length > 0 && 'animate-pulse'),
      accentColor: '#22d3ee',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((c) => (
        <KpiCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          iconClass={c.iconClass}
          accentColor={c.accentColor}
          trend="hidden"
          trendLabel={c.trendLabel}
        />
      ))}
    </div>
  );
}
