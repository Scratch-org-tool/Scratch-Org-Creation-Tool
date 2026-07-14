'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  CheckCircle,
  Clock,
  Cloud,
  Rocket,
  XCircle,
} from 'lucide-react';
import { Sparkline, ProgressRing } from './dashboard-charts';
import { KpiCard } from '@/components/studio';
import type { DashboardData } from './types';

interface DashboardStatCardsProps {
  data: DashboardData | null;
  loading?: boolean;
}

export function DashboardStatCards({ data, loading }: DashboardStatCardsProps) {
  const total = data?.jobStats.total ?? 0;
  const sparkData = data?.sparklines.map((p) => p.count) ?? [];

  const ringCards = [
    {
      label: 'Running',
      value: data?.jobStats.running ?? 0,
      trend: data?.trends.running,
      icon: Clock,
      iconClass: 'text-yellow-400',
      accentColor: '#facc15',
      ringColor: '#facc15',
    },
    {
      label: 'Completed',
      value: data?.jobStats.completed ?? 0,
      trend: data?.trends.completed,
      icon: CheckCircle,
      iconClass: 'text-green-400',
      accentColor: '#4ade80',
      ringColor: '#4ade80',
    },
    {
      label: 'Failed',
      value: data?.jobStats.failed ?? 0,
      trend: data?.trends.failed,
      icon: XCircle,
      iconClass: 'text-red-400',
      accentColor: '#f87171',
      ringColor: '#f87171',
    },
  ];

  const simpleCards = [
    {
      label: 'Orgs',
      value: data?.orgCount ?? 0,
      trend: null as number | null,
      icon: Cloud,
      iconClass: 'text-cyan-400',
      accentColor: '#22d3ee',
    },
    {
      label: 'Deployments',
      value: data?.deploymentCount ?? 0,
      trend: data?.trends.deployments ?? null,
      icon: Rocket,
      iconClass: 'text-purple-400',
      accentColor: '#a78bfa',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        label="Total Jobs"
        value={total}
        icon={Activity}
        iconClass="text-blue-400"
        accentColor="#60a5fa"
        trend={data?.trends.totalJobs}
        footer={
          sparkData.length > 0 ? (
            <Sparkline data={sparkData} color="#60a5fa" height={32} />
          ) : (
            <div className="h-8 rounded bg-secondary/30" />
          )
        }
      />

      {ringCards.map((c) => (
        <KpiCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          iconClass={c.iconClass}
          accentColor={c.accentColor}
          trend={c.trend}
          footer={
            <div className="flex justify-end -mt-1">
              <ProgressRing value={c.value} max={total || 1} size={44} color={c.ringColor} />
            </div>
          }
        />
      ))}

      {simpleCards.map((c) => (
        <KpiCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          iconClass={c.iconClass}
          accentColor={c.accentColor}
          trend={c.trend ?? 'hidden'}
        />
      ))}
    </div>
  );
}
