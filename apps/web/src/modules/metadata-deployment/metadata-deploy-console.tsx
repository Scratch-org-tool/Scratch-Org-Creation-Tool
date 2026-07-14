'use client';

import { useMemo, useRef, useEffect, useState, memo } from 'react';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/studio';
import { cn } from '@/utils/cn';
import { classifyLogs } from '@/modules/deployment-center/azure/log-utils';
import { METADATA_LOG_TAIL, TERMINAL_STATUSES } from './types';

type LogTab = 'all' | 'info' | 'success' | 'warning' | 'error';

interface MetadataDeployConsoleProps {
  jobStatus: string | null;
  currentStep: string | null;
  logs: string[];
  logStreams: string[];
  loadingLogs?: boolean;
  logsTruncated?: boolean;
  logCount?: number | null;
  error?: string | null;
  className?: string;
  onClose?: () => void;
}

const LogLines = memo(function LogLines({ entries }: { entries: ReturnType<typeof classifyLogs> }) {
  return (
    <>
      {entries.map((entry, i) => (
        <div
          key={`${i}-${entry.line.slice(0, 24)}`}
          className={cn(
            entry.level === 'success' && 'text-green-400',
            entry.level === 'error' && 'text-red-400',
            entry.level === 'warning' && 'text-amber-400',
          )}
        >
          {entry.line}
        </div>
      ))}
    </>
  );
});

export function MetadataDeployConsole({
  jobStatus,
  currentStep,
  logs,
  logStreams,
  loadingLogs,
  logsTruncated,
  logCount,
  error,
  className,
  onClose,
}: MetadataDeployConsoleProps) {
  const [tab, setTab] = useState<LogTab>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const classified = useMemo(() => classifyLogs(logs, logStreams), [logs, logStreams]);
  const filtered = tab === 'all' ? classified : classified.filter((e) => e.level === tab);
  const isRunning = Boolean(jobStatus && !TERMINAL_STATUSES.includes(jobStatus));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <GlassCard
      title="Deployment logs"
      description={
        isRunning
          ? 'Live output from the metadata deploy job'
          : 'Output from the selected deployment'
      }
      className={className}
      headerAction={
        onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close deployment logs"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(['all', 'info', 'success', 'warning', 'error'] as const).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setTab(level)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors capitalize',
              tab === level
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {level}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {loadingLogs && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading logs…</span>
            </>
          )}
          {!loadingLogs && logCount != null && <span>{logCount} line(s)</span>}
          {logsTruncated && <span>Showing last {METADATA_LOG_TAIL}</span>}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {currentStep && isRunning && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>{currentStep}</span>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-background/60 font-mono text-[11px] leading-relaxed max-h-[360px] overflow-auto p-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm font-sans">
            {loadingLogs ? 'Loading deployment logs…' : 'No logs for this deployment yet.'}
          </p>
        ) : (
          <LogLines entries={filtered} />
        )}
        <div ref={bottomRef} />
      </div>

      {jobStatus && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {jobStatus === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          {jobStatus === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          <span className="capitalize">{jobStatus.replace('_', ' ')}</span>
        </div>
      )}
    </GlassCard>
  );
}
