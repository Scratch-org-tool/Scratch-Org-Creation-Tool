'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDecoration, GlassCard, ListRow, ListRowGroup, StatusBadge } from '@/components/studio';
import { formatDurationMs, relativeTime } from '@/lib/ui-utils';
import { cn } from '@/utils/cn';
import type { DeploymentRow, HistoryFilter } from './types';
import { ACTIVE_STATUSES } from './types';
import type { MetadataCompareHook } from './use-metadata-compare';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'success', label: 'Success' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function matchesHistoryFilter(status: string, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'running') return ACTIVE_STATUSES.includes(status);
  if (filter === 'success') return status === 'completed';
  if (filter === 'failed') return status === 'failed';
  if (filter === 'cancelled') return status === 'cancelled';
  return true;
}

function deploymentDuration(row: DeploymentRow): string | null {
  const started = row.job?.startedAt ?? row.job?.createdAt;
  const finished = row.job?.finishedAt;
  if (!started || !finished) return null;
  return formatDurationMs(new Date(finished).getTime() - new Date(started).getTime());
}

function deploymentTitle(row: DeploymentRow): string {
  const source = row.sourceOrg?.alias ?? 'source';
  const target = row.targetOrg?.alias ?? 'target';
  if (row.metadata?.deploymentName) {
    return `${row.metadata.deploymentName} (${source} → ${target})`;
  }
  return `${source} → ${target}`;
}

function deploymentSubtitle(row: DeploymentRow): string {
  const count = row.metadata?.selections?.length;
  const parts = ['Org-to-org metadata'];
  if (count != null && count > 0) parts.push(`${count} component${count === 1 ? '' : 's'}`);
  const duration = deploymentDuration(row);
  if (duration) parts.push(duration);
  return parts.join(' · ');
}

interface MetadataDeploymentHistoryProps {
  w: MetadataCompareHook;
}

export function MetadataDeploymentHistory({ w }: MetadataDeploymentHistoryProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(
    () => w.history.filter((d) => matchesHistoryFilter(d.job?.status ?? d.status, filter)),
    [w.history, filter],
  );

  const stats = useMemo(() => ({
    total: w.history.length,
    success: w.history.filter((d) => (d.job?.status ?? d.status) === 'completed').length,
    failed: w.history.filter((d) => (d.job?.status ?? d.status) === 'failed').length,
  }), [w.history]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await w.loadHistory(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Total deployments" value={stats.total} />
        <StatPill label="Successful" value={stats.success} tone="success" />
        <StatPill label="Failed" value={stats.failed} tone="danger" />
      </div>

      <GlassCard
        title="Deployment history"
        description="Past org-to-org metadata deployments. Select a row to view logs and status details."
        headerAction={
          <Button variant="outline" size="sm" onClick={() => void refresh()} loading={refreshing}>
            {!refreshing && <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Refresh
          </Button>
        }
      >
        <div className="flex flex-wrap gap-1 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filter === f.id
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length > 0 && <CardDecoration />}

        <ListRowGroup emptyMessage="No deployments match this filter." maxHeight="420px">
          {filtered.map((row) => {
            const status = row.job?.status ?? row.status;
            const selected = w.activeDeploymentId === row.id;
            const loading = w.selectingDeploymentId === row.id;
            const hasJob = Boolean(row.jobId ?? row.job?.id);

            return (
              <ListRow
                key={row.id}
                title={deploymentTitle(row)}
                subtitle={deploymentSubtitle(row)}
                status={status}
                onClick={hasJob ? () => void w.selectHistory(row) : undefined}
                className={cn(
                  selected && 'bg-primary/5 ring-1 ring-primary/20',
                  !hasJob && 'opacity-60 cursor-not-allowed',
                )}
                icon={
                  <div className="w-8 h-8 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-center shrink-0">
                    {loading ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4 text-primary/80" />
                    )}
                  </div>
                }
                trailing={
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-[11px] text-muted-foreground">{relativeTime(row.createdAt)}</p>
                      <p className="text-[10px] text-muted-foreground/80">
                        {new Date(row.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                    {hasJob && (
                      <span className="text-xs text-primary whitespace-nowrap">
                        {loading ? 'Loading…' : selected ? 'Close logs' : 'View logs →'}
                      </span>
                    )}
                  </div>
                }
              />
            );
          })}
        </ListRowGroup>
      </GlassCard>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-2xl font-semibold mt-1',
          tone === 'success' && 'text-green-400',
          tone === 'danger' && 'text-red-400',
        )}
      >
        {value}
      </p>
    </div>
  );
}
