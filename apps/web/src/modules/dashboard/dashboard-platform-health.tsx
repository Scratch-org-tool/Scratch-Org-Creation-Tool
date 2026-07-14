'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Bot, Database, Server, Timer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDecoration, GlassCard, StatusBadge } from '@/components/studio';
import { cn } from '@/utils/cn';
import { LineChart, MiniBar } from './dashboard-charts';
import { formatDurationMs } from './dashboard-utils';
import type { DashboardHealth, DurationPoint } from './types';

interface DashboardPlatformHealthProps {
  health: DashboardHealth | null;
  durationSeries: DurationPoint[];
  loading?: boolean;
}

interface HealthStatusTileProps {
  icon: LucideIcon;
  label: string;
  accentColor: string;
  iconClass: string;
  children: ReactNode;
}

function HealthStatusTile({
  icon: Icon,
  label,
  accentColor,
  iconClass,
  children,
}: HealthStatusTileProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-lg border border-border/50 bg-card/40 p-3 min-h-[72px]',
        'overflow-hidden',
      )}
      style={{ boxShadow: `inset 0 1px 0 0 ${accentColor}18` }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)` }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
            'bg-secondary/40 border border-border/40',
          )}
          style={{ boxShadow: `0 0 10px ${accentColor}22` }}
        >
          <Icon className={cn('w-3.5 h-3.5', iconClass)} />
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function PlatformHealthSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-lg" />
        ))}
      </div>
      <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 pt-4 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-[110px] w-full rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardPlatformHealth({
  health,
  durationSeries,
  loading,
}: DashboardPlatformHealthProps) {
  const chartData = durationSeries.map((p) => ({
    label: p.date.slice(5),
    value: p.avgMs,
  }));

  const aiProvider = health?.aiProvider ?? '—';

  if (loading) {
    return (
      <GlassCard title="Platform Health" description="System metrics and job duration trend" className="h-full">
        <PlatformHealthSkeleton />
      </GlassCard>
    );
  }

  return (
    <GlassCard
      title="Platform Health"
      description="System metrics and job duration trend"
      className="h-full"
    >
      <CardDecoration />

      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthStatusTile
            icon={Timer}
            label="Avg Job Duration"
            accentColor="#a78bfa"
            iconClass="text-purple-400"
          >
            <p className="text-sm font-semibold tabular-nums">
              {formatDurationMs(health?.avgJobDurationMs ?? 0)}
            </p>
          </HealthStatusTile>

          <HealthStatusTile
            icon={Server}
            label="API Status"
            accentColor="#4ade80"
            iconClass="text-green-400"
          >
            <StatusBadge
              status={health?.apiOnline ? 'completed' : 'failed'}
              label={health?.apiOnline ? 'Online' : 'Offline'}
            />
          </HealthStatusTile>

          <HealthStatusTile
            icon={Database}
            label="Queue Engine"
            accentColor="#22d3ee"
            iconClass="text-cyan-400"
          >
            <StatusBadge
              status={health?.redisConnected ? 'connected' : 'cancelled'}
              label={health?.redisConnected ? 'Connected' : 'Not configured'}
            />
          </HealthStatusTile>

          <HealthStatusTile
            icon={Bot}
            label="AI Provider"
            accentColor="#60a5fa"
            iconClass="text-blue-400"
          >
            <p className="text-sm font-semibold truncate" title={aiProvider}>
              {aiProvider}
            </p>
          </HealthStatusTile>
        </div>

        <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <MiniBar label="Success rate" value={health?.successRate ?? 0} color="#22c55e" />
          <MiniBar label="Failure rate" value={health?.failureRate ?? 0} color="#ef4444" />
          <MiniBar
            label="Active orgs"
            value={health?.activeOrgs ?? 0}
            max={Math.max(health?.activeOrgs ?? 1, 10)}
            color="#06b6d4"
            showPercent={false}
          />
          <MiniBar
            label="Queue depth"
            value={health?.queueDepth ?? 0}
            max={Math.max(health?.queueDepth ?? 1, 10)}
            color="#a78bfa"
            showPercent={false}
          />
        </div>

        <div className="border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground mb-2">Avg duration (daily)</p>
          <div className="min-h-[110px]">
            <LineChart data={chartData} height={110} stroke="#a78bfa" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
