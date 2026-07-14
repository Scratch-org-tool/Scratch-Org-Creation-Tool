'use client';

import { CheckCircle, Layers, Loader2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardGrid } from '@/components/studio';
import { Sparkline } from '@/modules/dashboard/dashboard-charts';
import { KpiCard } from '@/components/studio';
import { cn } from '@/utils/cn';
import { trendLabel } from './format-utils';
import type { MonitoringOverview } from './types';

interface MonitoringStatCardsProps {
  data: MonitoringOverview | null;
  days: number;
  loading?: boolean;
}

export function MonitoringStatCards({ data, days, loading }: MonitoringStatCardsProps) {
  if (loading) {
    return (
      <StatCardGrid cols={4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </StatCardGrid>
    );
  }

  const totalSpark = data?.sparklines.map((p) => p.count) ?? [];
  const completedSpark = data?.sparklinesCompleted.map((p) => p.count) ?? [];
  const failedSpark = data?.sparklinesFailed.map((p) => p.count) ?? [];

  const inProgress =
    (data?.jobStats.running ?? 0) +
    (data?.jobStats.pending ?? 0) +
    (data?.jobStats.queued ?? 0);

  const cards = [
    {
      label: 'Completed',
      value: data?.jobStats.completed ?? 0,
      trend: trendLabel(data?.trends.completed, days, '—'),
      icon: CheckCircle,
      iconClass: 'text-green-400',
      accentColor: '#4ade80',
      spark: completedSpark,
      sparkColor: '#4ade80',
    },
    {
      label: 'Failed',
      value: data?.jobStats.failed ?? 0,
      trend: trendLabel(data?.trends.failed, days, '—'),
      icon: XCircle,
      iconClass: 'text-red-400',
      accentColor: '#f87171',
      spark: failedSpark,
      sparkColor: '#f87171',
    },
    {
      label: 'In Progress',
      value: inProgress,
      trend: 'Currently running',
      icon: Loader2,
      iconClass: cn('text-blue-400', inProgress > 0 && 'animate-spin'),
      accentColor: '#60a5fa',
      spark: [] as number[],
      sparkColor: '#60a5fa',
    },
    {
      label: 'Total Jobs',
      value: data?.jobStats.total ?? 0,
      trend: trendLabel(data?.trends.totalJobs, days, '—'),
      icon: Layers,
      iconClass: 'text-purple-400',
      accentColor: '#a78bfa',
      spark: totalSpark,
      sparkColor: '#a78bfa',
    },
  ];

  return (
    <StatCardGrid cols={4}>
      {cards.map((c) => (
        <KpiCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          iconClass={c.iconClass}
          accentColor={c.accentColor}
          trend="hidden"
          trendLabel={c.trend}
          footer={
            c.spark.length > 0 ? (
              <Sparkline data={c.spark} color={c.sparkColor} height={28} />
            ) : undefined
          }
        />
      ))}
    </StatCardGrid>
  );
}
