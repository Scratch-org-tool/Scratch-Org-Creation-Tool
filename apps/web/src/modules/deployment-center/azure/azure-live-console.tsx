'use client';

import { useMemo, useRef, useEffect, useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/studio';
import {
  CheckCircle2,
  Cloud,
  CloudUpload,
  FolderGit2,
  Loader2,
  Pin,
  PinOff,
  Square,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DEPLOY_PHASES, AZURE_LOG_TAIL } from './types';
import type { DeployPhase } from './types';
import { classifyLogs, formatElapsed, phaseState, resolveDeployPhase } from './log-utils';
import { DEPLOY_CARD_CLASS, DEPLOY_CARD_HEIGHT } from './azure-deployment-form';
import type { LogLevel } from './types';

type LogTab = 'all' | LogLevel;

const PHASE_ICONS: Record<DeployPhase, LucideIcon> = {
  connecting: Cloud,
  fetching: FolderGit2,
  deploying: CloudUpload,
  completed: CheckCircle2,
  failed: XCircle,
};

interface AzureLiveConsoleProps {
  jobStatus: string | null;
  currentStep: string | null;
  logs: string[];
  logStreams: string[];
  sseConnected: boolean;
  hasActiveJob: boolean;
  logsTruncated?: boolean;
  logCount?: number | null;
  loadingLogs?: boolean;
  deployStartedAt?: number | null;
  stopping?: boolean;
  onCancel?: () => void;
  className?: string;
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

export function AzureLiveConsole({
  jobStatus,
  currentStep,
  logs,
  logStreams,
  sseConnected,
  hasActiveJob,
  logsTruncated,
  logCount,
  loadingLogs,
  deployStartedAt,
  stopping,
  onCancel,
  className,
}: AzureLiveConsoleProps) {
  const [tab, setTab] = useState<LogTab>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);
  const [, tick] = useState(0);

  const phase = resolveDeployPhase({ jobStatus, currentStep, logs });
  const tailLogs = useMemo(
    () => (logs.length > AZURE_LOG_TAIL ? logs.slice(-AZURE_LOG_TAIL) : logs),
    [logs],
  );
  const tailStreams = useMemo(
    () => (logStreams.length > AZURE_LOG_TAIL ? logStreams.slice(-AZURE_LOG_TAIL) : logStreams),
    [logStreams],
  );
  const classified = useMemo(() => classifyLogs(tailLogs, tailStreams), [tailLogs, tailStreams]);
  const isRunning = jobStatus === 'running' || jobStatus === 'queued' || jobStatus === 'pending';

  useEffect(() => {
    if (!isRunning || !deployStartedAt) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, deployStartedAt]);

  useEffect(() => {
    if (!autoScroll || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, tab, autoScroll]);

  const counts = useMemo(
    () => ({
      all: classified.length,
      info: classified.filter((l) => l.level === 'info').length,
      success: classified.filter((l) => l.level === 'success').length,
      warning: classified.filter((l) => l.level === 'warning').length,
      error: classified.filter((l) => l.level === 'error').length,
    }),
    [classified],
  );

  const filtered = tab === 'all' ? classified : classified.filter((l) => l.level === tab);

  const tabs: { id: LogTab; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'info', label: `Info (${counts.info})` },
    { id: 'success', label: `OK (${counts.success})` },
    { id: 'warning', label: `Warn (${counts.warning})` },
    { id: 'error', label: `Err (${counts.error})` },
  ];

  const displayPhases = DEPLOY_PHASES.map((p) => p.id);
  const activePhase = phase === 'failed' ? 'deploying' : phase;

  const liveStatus =
    hasActiveJob && (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[10px]',
          sseConnected ? 'text-green-400' : 'text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            sseConnected ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground',
          )}
        />
        {sseConnected ? 'Live' : 'Reconnecting…'}
        {deployStartedAt && isRunning && (
          <span className="text-muted-foreground font-mono">· {formatElapsed(deployStartedAt)}</span>
        )}
      </span>
    );

  return (
    <GlassCard
      title="Live Deployment Console"
      description={liveStatus ? undefined : 'Real-time deployment output'}
      headerAction={
        <div className="flex flex-col items-end gap-1 shrink-0">
          {liveStatus}
          {isRunning && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              loading={stopping}
              className="h-7 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Cancel deployment"
            >
              <Square className="w-3 h-3 fill-current mr-1" />
              Stop
            </Button>
          )}
        </div>
      }
      className={cn(DEPLOY_CARD_CLASS, className)}
      contentClassName="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden pt-0"
      style={{ '--deploy-card-height': DEPLOY_CARD_HEIGHT } as React.CSSProperties}
    >
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {displayPhases.map((phaseId) => {
          const meta = DEPLOY_PHASES.find((p) => p.id === phaseId)!;
          const Icon = PHASE_ICONS[phaseId];
          const state =
            jobStatus === 'failed' && phaseId === 'deploying'
              ? 'failed'
              : phaseState(phaseId, activePhase, jobStatus);

          return (
            <div
              key={phaseId}
              title={meta.label}
              aria-label={meta.label}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors',
                state === 'active' && 'border-primary/50 bg-primary/5',
                state === 'done' && 'border-green-500/30 bg-green-500/5',
                state === 'failed' && 'border-red-500/40 bg-red-500/5',
                state === 'pending' && 'border-border/60 bg-card/30',
              )}
            >
              <span
                className={cn(
                  'w-7 h-7 rounded-full border flex items-center justify-center',
                  state === 'active' && 'border-primary bg-primary/10 text-primary',
                  state === 'done' && 'border-green-500/40 bg-green-500/10 text-green-500',
                  state === 'failed' && 'border-red-500/40 bg-red-500/10 text-red-500',
                  state === 'pending' && 'border-border bg-card/40 text-muted-foreground',
                )}
              >
                {state === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : state === 'active' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : state === 'failed' ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium leading-tight line-clamp-2',
                  state === 'pending' && 'text-muted-foreground',
                  state === 'active' && 'text-primary',
                  state === 'done' && 'text-green-400',
                  state === 'failed' && 'text-red-400',
                )}
              >
                {meta.shortName}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between gap-1 p-1.5 border-b border-border bg-card/80 shrink-0">
          <div className="flex flex-wrap gap-0.5 min-w-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded transition-colors',
                  tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => setAutoScroll((v) => !v)}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            aria-label={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScroll ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {logsTruncated && (
            <p className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border/60 bg-muted/20 shrink-0">
              Showing last {tailLogs.length}
              {logCount != null ? ` of ${logCount}` : ''} log lines
            </p>
          )}
          <pre
            ref={logRef}
            className="studio-console h-full overflow-y-auto overflow-x-hidden scrollbar-thin p-2 text-[10px] leading-relaxed font-mono border-0 rounded-none"
          >
            {loadingLogs ? (
              <span className="text-muted-foreground">Loading logs…</span>
            ) : !hasActiveJob && !logs.length ? (
              <span className="text-muted-foreground">Start a deployment to see live logs…</span>
            ) : filtered.length ? (
              <LogLines entries={filtered} />
            ) : (
              <span className="text-muted-foreground">No logs in this category</span>
            )}
          </pre>
        </div>
      </div>
    </GlassCard>
  );
}
