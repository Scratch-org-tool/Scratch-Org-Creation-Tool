'use client';

import Link from 'next/link';
import { Ban, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { GlassCard, StatusBadge } from '@/components/studio';
import { CardDecoration } from '@/components/studio';
import { deploymentLabel, relativeTime } from './dashboard-utils';
import type { RecentDeployment } from './types';

interface DashboardRecentDeploymentsProps {
  deployments: RecentDeployment[];
  loading?: boolean;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === 'cancelled') return <Ban className="w-4 h-4 text-muted-foreground shrink-0" />;
  if (status === 'running' || status === 'pending' || status === 'queued')
    return <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
  return <Loader2 className="w-4 h-4 text-muted-foreground shrink-0" />;
}

export function DashboardRecentDeployments({ deployments, loading }: DashboardRecentDeploymentsProps) {
  return (
    <GlassCard
      title="Recent Deployments"
      description="Latest metadata deployments"
      className="h-full"
    >
      {!loading && deployments.length > 0 && <CardDecoration />}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : deployments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No deployments yet. Start one from the Deployment Center.
        </p>
      ) : (
        <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
          {deployments.map((d) => {
            const href = d.jobId
              ? `/deployment-center/git?deployment=${d.id}`
              : '/deployment-center/git';
            return (
              <Link
                key={d.id}
                href={href}
                className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0"
              >
                <StatusIcon status={d.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deploymentLabel(d)}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(d.createdAt)}</p>
                </div>
                <StatusBadge status={d.status} />
              </Link>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
