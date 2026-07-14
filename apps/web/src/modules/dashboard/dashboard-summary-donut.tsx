'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard } from '@/components/studio';
import { DonutChart } from './dashboard-charts';
import type { StatusDistribution } from './types';

interface DashboardSummaryDonutProps {
  distribution: StatusDistribution | null;
  loading?: boolean;
}

const SEGMENT_META = [
  { key: 'completed' as const, label: 'Completed', color: '#4ade80' },
  { key: 'failed' as const, label: 'Failed', color: '#f87171' },
  { key: 'running' as const, label: 'Running', color: '#60a5fa' },
  { key: 'cancelled' as const, label: 'Cancelled', color: '#94a3b8' },
];

export function DashboardSummaryDonut({ distribution, loading }: DashboardSummaryDonutProps) {
  const segments = SEGMENT_META.map((m) => ({
    label: m.label,
    value: distribution?.[m.key] ?? 0,
    color: m.color,
  }));

  if (loading) {
    return (
      <GlassCard
        title="Deployment Summary"
        description="Job status distribution for selected period"
        className="h-full"
      >
        <div className="flex items-center justify-center min-h-[200px]">
          <Skeleton className="w-28 h-28 rounded-full" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      title="Deployment Summary"
      description="Job status distribution for selected period"
      className="h-full"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <DonutChart segments={segments} size={140} />
        <ul className="space-y-2.5 text-sm flex-1 w-full">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}66` }}
                />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  );
}
