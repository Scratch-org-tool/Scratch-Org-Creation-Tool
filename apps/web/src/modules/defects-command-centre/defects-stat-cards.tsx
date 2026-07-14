'use client';

import { AlertCircle, CheckCircle, Loader2, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard, StatCardGrid } from '@/components/studio';
import type { DefectsOverview } from './types';

interface DefectsStatCardsProps {
  data: DefectsOverview | null;
  loading?: boolean;
}

export function DefectsStatCards({ data, loading }: DefectsStatCardsProps) {
  if (loading) {
    return (
      <StatCardGrid cols={4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </StatCardGrid>
    );
  }

  const cards = [
    {
      label: 'Open',
      value: data?.open ?? 0,
      icon: AlertCircle,
      iconClass: 'text-amber-400',
      accentColor: '#fbbf24',
    },
    {
      label: 'In Progress',
      value: data?.inProgress ?? 0,
      icon: Loader2,
      iconClass: 'text-blue-400',
      accentColor: '#60a5fa',
    },
    {
      label: 'Resolved',
      value: data?.resolved ?? 0,
      icon: CheckCircle,
      iconClass: 'text-green-400',
      accentColor: '#4ade80',
    },
    {
      label: 'Critical',
      value: data?.critical ?? 0,
      icon: Zap,
      iconClass: 'text-red-400',
      accentColor: '#f87171',
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
          trendLabel={`${data?.total ?? 0} total items`}
        />
      ))}
    </StatCardGrid>
  );
}
