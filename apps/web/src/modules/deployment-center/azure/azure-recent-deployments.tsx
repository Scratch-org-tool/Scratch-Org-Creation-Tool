'use client';

import { useState } from 'react';
import { Ban, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { CardDecoration, GlassCard, StatusBadge } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { DeploymentRow, HistoryFilter } from './types';
import { ACTIVE_STATUSES } from './types';
import { deploymentDuration, matchesHistoryFilter, relativeTime } from './log-utils';
import { providerFromDeployment, SCM_PROVIDER_SHORT_LABELS } from '@/modules/source-control/provider-config';

interface AzureRecentDeploymentsProps {
  history: DeploymentRow[];
  activeDeploymentId: string | null;
  selectingDeploymentId?: string | null;
  onSelect: (row: DeploymentRow) => void;
}

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'success', label: 'Success' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function statusAccentBorder(status: string): string {
  if (status === 'completed') return 'border-l-green-500';
  if (status === 'failed') return 'border-l-red-500';
  if (status === 'cancelled') return 'border-l-muted-foreground';
  if (ACTIVE_STATUSES.includes(status)) return 'border-l-blue-500';
  return 'border-l-amber-500';
}

function statusAccentColor(status: string): string {
  if (status === 'completed') return '#4ade80';
  if (status === 'failed') return '#f87171';
  if (status === 'cancelled') return '#94a3b8';
  if (ACTIVE_STATUSES.includes(status)) return '#60a5fa';
  return '#facc15';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === 'cancelled') return <Ban className="w-4 h-4 text-muted-foreground" />;
  if (ACTIVE_STATUSES.includes(status)) return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
  return <Loader2 className="w-4 h-4 text-muted-foreground" />;
}

export function AzureRecentDeployments({
  history,
  activeDeploymentId,
  selectingDeploymentId,
  onSelect,
}: AzureRecentDeploymentsProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const filtered = history.filter((d) => matchesHistoryFilter(d.status, filter)).slice(0, 12);

  return (
    <div id="recent-deployments">
    <GlassCard
      title="Recent Deployments"
      description="Latest metadata deployments"
      headerAction={
        <div className="flex flex-wrap gap-1">
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
      }
    >
      {filtered.length > 0 && <CardDecoration />}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No deployments match this filter</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {filtered.map((d) => {
            const isOrgToOrg = d.metadata?.deployMode === 'org_to_org' || d.repo === 'org-to-org';
            const alias = d.targetOrg?.alias ?? 'org';
            const sourceAlias = d.sourceOrg?.alias;
            const title = isOrgToOrg && sourceAlias
              ? `${sourceAlias} → ${alias}`
              : `Deploy to ${alias}`;
            const provider = providerFromDeployment(d);
            const subtitle = isOrgToOrg
              ? 'Org-to-org metadata'
              : `${provider ? `${SCM_PROVIDER_SHORT_LABELS[provider]} · ` : ''}${d.branch}`;
            const dur = deploymentDuration(d);
            const isSelecting = selectingDeploymentId === d.id;
            const accent = statusAccentColor(d.status);
            const selected = activeDeploymentId === d.id;

            return (
              <button
                key={d.id}
                type="button"
                disabled={isSelecting}
                onClick={() => onSelect(d)}
                className={cn(
                  'shrink-0 w-[220px] text-left rounded-lg border border-border/60 bg-card/60 p-3',
                  'border-l-4 hover:border-primary/40 transition-colors disabled:opacity-70',
                  statusAccentBorder(d.status),
                  selected && 'ring-1 ring-primary/40 border-primary/30 bg-primary/5',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary/40 border border-border/40"
                    style={{ boxShadow: `0 0 10px ${accent}22` }}
                  >
                    {isSelecting ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <StatusIcon status={d.status} />
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-sm font-medium truncate">{title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
                {d.metadata?.error && (
                  <p className="text-[11px] text-destructive truncate mt-1" title={d.metadata.error}>
                    {provider ? SCM_PROVIDER_SHORT_LABELS[provider] : 'Provider'}: {d.metadata.error}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
                  <span>{relativeTime(d.createdAt)}</span>
                  {dur && <span>{dur}</span>}
                </div>
                <span className="text-xs text-primary mt-2 inline-block">
                  {isSelecting ? 'Loading logs…' : 'View Logs →'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </GlassCard>
    </div>
  );
}
