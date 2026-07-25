'use client';

import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { StatusBadge } from '@/components/studio';
import { formatDuration } from './format-utils';
import { JobDetailStopButton } from './job-detail-stop-button';
import type { JobDetailResponse } from './types';

function statusHeadline(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'Job completed successfully!';
  if (normalized === 'failed') return 'Job failed';
  if (normalized === 'cancelled') return 'Job cancelled';
  if (normalized === 'running' || normalized === 'queued' || normalized === 'pending') {
    return 'Job in progress';
  }
  return 'Job report';
}

function CounterCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Cloud;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-center">
      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function payloadString(payload: unknown, key: string): string {
  if (typeof payload !== 'object' || !payload || !(key in payload)) return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export function JobDetailSummary({
  detail,
  canStop = false,
  stopping = false,
  onStop,
}: {
  detail: JobDetailResponse;
  canStop?: boolean;
  stopping?: boolean;
  onStop?: () => Promise<void>;
}) {
  const { job, deployment, summary } = detail;
  const completedAt = job.finishedAt ?? job.startedAt ?? job.createdAt;
  const sourceLabel =
    deployment?.sourceOrgAlias ||
    deployment?.repo ||
    payloadString(job.payload, 'sourceOrgAlias') ||
    'Source';
  const targetLabel =
    deployment?.targetOrgAlias ||
    payloadString(job.payload, 'targetOrgAlias') ||
    'Target';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card/70 p-6 md:p-8 text-center">
        <div className="flex justify-center mb-4">
          {job.status === 'completed' ? (
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          ) : job.status === 'failed' ? (
            <XCircle className="h-14 w-14 text-red-500" />
          ) : (
            <RefreshCw className="h-14 w-14 text-blue-400 animate-spin" />
          )}
        </div>
        <h1 className="text-2xl font-semibold">{statusHeadline(job.status)}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {new Date(completedAt).toLocaleString()}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
          <StatusBadge status={job.status} />
          <span className="text-muted-foreground capitalize">{job.type.replace(/_/g, ' ')}</span>
          {job.durationMs != null && (
            <span className="text-muted-foreground">Duration: {formatDuration(job.durationMs)}</span>
          )}
        </div>

        {canStop && onStop && (
          <div className="mt-5 flex justify-center no-print">
            <JobDetailStopButton stopping={stopping} onStop={onStop} />
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center max-w-3xl mx-auto text-left">
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Source</p>
            <p className="font-medium">{sourceLabel}</p>
            {deployment?.repo && (
              <p className="text-xs text-muted-foreground mt-1">{deployment.repo}</p>
            )}
          </div>
          <ArrowRight className="mx-auto h-5 w-5 text-muted-foreground hidden md:block" />
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Target</p>
            <p className="font-medium">{targetLabel}</p>
            {deployment?.branch && (
              <p className="text-xs text-muted-foreground mt-1">{deployment.branch}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <CounterCard label="Deployed" value={summary.deployedComponents} icon={Cloud} tone="bg-blue-500/15 text-blue-400" />
        <CounterCard label="Changed" value={summary.changedComponents} icon={RefreshCw} tone="bg-amber-500/15 text-amber-400" />
        <CounterCard label="New" value={summary.newComponents} icon={PlusCircle} tone="bg-emerald-500/15 text-emerald-400" />
        <CounterCard label="Deleted" value={summary.deletedComponents} icon={MinusCircle} tone="bg-red-500/15 text-red-400" />
        <CounterCard label="Steps done" value={summary.completedSteps} icon={CheckCircle2} tone="bg-purple-500/15 text-purple-400" />
      </div>

      {job.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-medium mb-1">Failure details</p>
          <pre className="whitespace-pre-wrap font-mono text-xs">{job.error}</pre>
        </div>
      )}
    </div>
  );
}
