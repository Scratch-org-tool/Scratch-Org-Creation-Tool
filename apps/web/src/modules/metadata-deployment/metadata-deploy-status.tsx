'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { MetadataCompareHook } from './use-metadata-compare';

export function MetadataDeployStatus({ w }: { w: MetadataCompareHook }) {
  const [showLogs, setShowLogs] = useState(false);
  const visible = w.phase === 'deploying' || w.isRunning || (w.jobStatus && w.phase === 'success');

  if (!visible) return null;

  const isSuccess = w.jobStatus === 'completed';
  const isFailed = w.jobStatus === 'failed' || w.jobStatus === 'cancelled';
  const isRunning = w.isRunning || w.phase === 'deploying';

  const duration =
    w.deployStartedAt && w.jobStatus && ['completed', 'failed', 'cancelled'].includes(w.jobStatus)
      ? Math.round((Date.now() - w.deployStartedAt) / 1000)
      : null;

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 flex flex-col gap-2',
        isSuccess && 'border-emerald-500/30 bg-emerald-500/5',
        isFailed && 'border-destructive/30 bg-destructive/5',
        isRunning && 'border-primary/30 bg-primary/5',
        !isSuccess && !isFailed && !isRunning && 'border-border/60 bg-card/40',
      )}
    >
      <div className="flex items-center gap-3">
        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
        {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
        {isFailed && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {isRunning && 'Deploying metadata…'}
            {isSuccess && 'Deployment completed'}
            {isFailed && 'Deployment failed'}
            {!isRunning && !isSuccess && !isFailed && 'Processing deployment'}
          </p>
          {w.currentStep && isRunning && (
            <p className="text-xs text-muted-foreground truncate">{w.currentStep}</p>
          )}
          {duration !== null && !isRunning && (
            <p className="text-xs text-muted-foreground">Duration: {duration}s</p>
          )}
          {w.error && isFailed && (
            <p className="text-xs text-destructive mt-0.5">{w.error}</p>
          )}
        </div>
        {w.logs.length > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
            onClick={() => setShowLogs((v) => !v)}
          >
            {showLogs ? 'Hide logs' : 'View logs'}
          </button>
        )}
      </div>
      {showLogs && w.logs.length > 0 && (
        <pre className="text-[10px] font-mono bg-background/60 rounded border border-border/60 p-2 max-h-32 overflow-auto">
          {w.logs.slice(-8).join('\n')}
        </pre>
      )}
    </div>
  );
}
