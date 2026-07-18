'use client';

import Link from 'next/link';
import { RotateCcw, Rocket, Square, ClipboardList, Eye, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/studio/status-badge';
import { InlineAlert } from '@/components/studio/inline-alert';
import { JobStepper } from '@/components/scratch-org/job-stepper';
import { ExecutionLogConsole } from '@/components/scratch-org/execution-log-console';
import { ScratchOrgSuccessBanner } from '@/components/scratch-org/scratch-org-success';
import { formatPipelineStepId } from '@/components/scratch-org/types';
import type { AutomationRunView, PipelineStepLabel, StepState } from '@/components/scratch-org/types';
import type { ScratchOrgLaunchMode } from '@/components/scratch-org/types';
import type { ScratchCredentials } from './types';
import type { StreamConnectionState } from '@/hooks/use-job-event-stream';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { TemplateV2Progress } from './template-v2-progress';
import { resolvePreparationProgress } from './existing-scratch-org-utils';

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

function StreamBadge({ state }: { state: StreamConnectionState }) {
  if (state === 'idle') return null;
  const config =
    state === 'connected'
      ? { dot: 'bg-green-400', label: 'Live', pulse: false }
      : state === 'reconnecting'
        ? { dot: 'bg-amber-400', label: 'Reconnecting…', pulse: true }
        : { dot: 'bg-red-400', label: 'Disconnected', pulse: false };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn('w-1.5 h-1.5 rounded-full', config.dot, config.pulse && 'animate-pulse')}
      />
      {config.label}
    </span>
  );
}

interface JobProgressPanelProps {
  automationRunId: string | null;
  run: AutomationRunView | null;
  logs: string[];
  onClearLogs: () => void;
  logsExpanded: boolean;
  onToggleLogsExpand: () => void;
  isRunning: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  canResume: boolean;
  stopping: boolean;
  resuming: boolean;
  onCancel: () => void;
  onResume: () => void;
  onReset: () => void;
  credentials: ScratchCredentials | null;
  onViewDetails: () => void;
  getState: (label: PipelineStepLabel) => StepState;
  activeSubtext?: string;
  elapsedMs?: number | null;
  progressPercent?: number;
  streamState?: StreamConnectionState;
  restoredBanner?: string | null;
  postDeploySlot?: ReactNode;
  fillHeight?: boolean;
  onViewFullLogs?: () => void;
  wizardPreviewStep?: number;
  compact?: boolean;
  logHeightRem?: number;
  launchMode?: ScratchOrgLaunchMode;
  onGeneratePassword?: () => void;
  generatingPassword?: boolean;
}

export function JobProgressPanel({
  automationRunId,
  run,
  logs,
  onClearLogs,
  logsExpanded,
  onToggleLogsExpand,
  isRunning,
  isPaused,
  isCancelled,
  canResume,
  stopping,
  resuming,
  onCancel,
  onResume,
  onReset,
  credentials,
  onViewDetails,
  getState,
  activeSubtext,
  elapsedMs,
  progressPercent = 0,
  streamState = 'idle',
  restoredBanner,
  postDeploySlot,
  fillHeight,
  onViewFullLogs,
  wizardPreviewStep = 0,
  compact,
  logHeightRem,
  launchMode = 'create_new',
  onGeneratePassword,
  generatingPassword,
}: JobProgressPanelProps) {
  const preparationJob = run?.jobs?.findLast((job) => job.type === 'prepare_existing_org');
  const preparationProgress = resolvePreparationProgress(run);
  if (!automationRunId) {
    const previewSteps = [
      { label: 'Configure', icon: ClipboardList, active: wizardPreviewStep === 0 },
      { label: 'Review', icon: Eye, active: wizardPreviewStep === 1 },
      {
        label: launchMode === 'configure_existing' ? 'Deploy' : 'Create',
        icon: Rocket,
        active: wizardPreviewStep === 2,
      },
    ];
    return (
      <div className="flex flex-col min-h-0">
        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground shrink-0">
          <Rocket className="w-9 h-9 mb-3 opacity-30" />
          <p className="text-sm font-medium text-foreground">
            {launchMode === 'configure_existing' ? 'Ready to configure' : 'Ready to create'}
          </p>
          <p className="text-xs mt-1">
            Configure your scratch org pipeline and start deployment.
          </p>
        </div>
        <ul className="space-y-2 shrink-0 border-t border-border/60 pt-4">
          {previewSteps.map((step) => (
            <li key={step.label} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border',
                  step.active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground bg-card/40',
                )}
              >
                <step.icon className="w-3.5 h-3.5" />
              </span>
              <span className={step.active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {step.label}
              </span>
              {!step.active && <Circle className="w-1.5 h-1.5 fill-muted-foreground/40 text-transparent ml-auto" />}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const terminalAnnouncement =
    run?.status === 'completed'
      ? 'Pipeline completed successfully.'
      : run?.status === 'partial'
        ? 'Pipeline completed with partial post-deploy results.'
      : run?.status === 'awaiting_input'
        ? 'Automatic pipeline steps completed. Manual post-deploy actions are ready.'
      : run?.status === 'failed'
        ? `Pipeline failed${run.failedStep ? ` at ${formatPipelineStepId(run.failedStep)}` : ''}.`
        : run?.status === 'cancelled'
          ? 'Pipeline stopped.'
          : '';

  return (
    <div className={cn('flex flex-col min-h-0', fillHeight && 'h-full overflow-hidden')}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {terminalAnnouncement}
      </div>
      <div
        className={cn(
          'shrink-0 overflow-y-auto scrollbar-thin',
          compact ? 'space-y-2 max-h-[38%]' : 'space-y-4',
        )}
      >
        {restoredBanner && (
          <InlineAlert variant="info" title="Pipeline restored" className={compact ? 'px-3 py-2 text-xs' : undefined}>
            {restoredBanner}
          </InlineAlert>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {!compact && <p className="text-sm font-medium">Job Progress</p>}
            <p className={cn('text-muted-foreground font-mono truncate', compact ? 'text-[10px]' : 'text-xs')}>
              RUN-{automationRunId.slice(0, 8).toUpperCase()}
              {isRunning && elapsedMs != null && elapsedMs > 0 && (
                <span className="text-muted-foreground/80"> · {formatElapsed(elapsedMs)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {run?.status && (
              <StatusBadge
                status={run.status}
                className={compact ? 'text-[10px] px-1.5 py-0' : undefined}
              />
            )}
            <StreamBadge state={streamState} />
            {isRunning && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                loading={stopping}
                className={cn(
                  'text-destructive hover:text-destructive hover:bg-destructive/10',
                  compact ? 'h-6 px-2 text-[10px]' : 'h-7',
                )}
                title="Stop pipeline"
              >
                <Square className={cn('fill-current', compact ? 'w-2.5 h-2.5' : 'w-3 h-3', !compact && 'mr-1')} />
                {!compact && 'Stop'}
              </Button>
            )}
          </div>
        </div>

        {isRunning && (
          <div className="space-y-0.5">
            <div
              className="h-1 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-label="Pipeline completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, progressPercent)}
              aria-valuetext={`${Math.min(100, progressPercent)}% complete`}
            >
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
              {progressPercent}% complete
            </p>
          </div>
        )}

        {isPaused && run && (
          <InlineAlert
            variant="error"
            title={`Failed at ${formatPipelineStepId(run.failedStep)}`}
            className={compact ? 'px-3 py-2 text-xs' : undefined}
          >
            {run.lastError && (
              <p className="font-mono text-[10px] whitespace-pre-wrap break-words mt-1 max-h-20 overflow-y-auto scrollbar-thin">
                {run.lastError}
              </p>
            )}
            {canResume && (
              <Button
                size="sm"
                onClick={onResume}
                loading={resuming}
                className={cn('gap-1 mt-2', compact ? 'h-7 text-xs' : 'mt-3')}
              >
                <RotateCcw className="w-3 h-3" />
                {launchMode === 'configure_existing' ? 'Retry configuration' : 'Retry'}
              </Button>
            )}
          </InlineAlert>
        )}

        {isCancelled && (
          <InlineAlert variant="info" className={compact ? 'px-3 py-2 text-xs' : undefined}>
            Pipeline stopped.
          </InlineAlert>
        )}

        {run?.status === 'awaiting_input' && (
          <InlineAlert
            variant="info"
            title="Automatic steps completed"
            className={compact ? 'px-3 py-2 text-xs' : undefined}
          >
            Complete the configured post-deploy actions below to finish this scratch org.
          </InlineAlert>
        )}

        {(run?.status === 'partial' || Boolean(run?.checkpoint?.partialUserActions?.length)) && (
          <InlineAlert
            variant="warning"
            title="Scratch org created with partial results"
            className={compact ? 'px-3 py-2 text-xs' : undefined}
          >
            One or more post-deploy actions completed only partially. Review the logs before using the org.
          </InlineAlert>
        )}

        <JobStepper
          orientation={compact ? 'vertical' : 'horizontal'}
          getState={getState}
          activeSubtext={activeSubtext}
          compact={compact}
          launchMode={launchMode}
        />

        {launchMode === 'configure_existing' && preparationJob && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" aria-label="Existing org preparation status">
            <div className="rounded-md border border-border/60 p-2">
              <span className="text-muted-foreground">Authentication</span>
              <strong className="block mt-0.5">
                {preparationProgress?.authentication}
              </strong>
            </div>
            <div className="rounded-md border border-border/60 p-2">
              <span className="text-muted-foreground">Required package</span>
              <strong className="block mt-0.5">
                {preparationProgress?.requiredPackage}
              </strong>
            </div>
            {preparationProgress?.error && (
              <p className="sm:col-span-2 font-mono text-[10px] text-destructive whitespace-pre-wrap break-words">
                {preparationProgress.error}
              </p>
            )}
          </div>
        )}

        {run && <TemplateV2Progress run={run} />}

        {postDeploySlot}

        {(isPaused || isCancelled) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className={cn('gap-1.5', compact ? 'h-7 text-xs w-full' : undefined)}
          >
            <Rocket className="w-3 h-3" />
            New run
          </Button>
        )}
      </div>

      <div
        className={cn(
          'flex flex-col overflow-hidden',
          compact ? 'mt-2 flex-1 min-h-0' : 'mt-4',
          fillHeight && 'flex-1 min-h-0',
          !fillHeight && !logHeightRem && 'min-h-0',
        )}
      >
        <ExecutionLogConsole
          logs={logs}
          onClear={onClearLogs}
          expanded={logsExpanded}
          fillHeight={fillHeight && !logHeightRem}
          compact={compact}
          logHeightRem={logHeightRem}
          onToggleExpand={onToggleLogsExpand}
          className={cn(fillHeight && !logHeightRem && 'flex-1 min-h-0 h-full')}
        />
      </div>

      {onViewFullLogs && (
        <button type="button" className="text-xs text-primary lg:hidden mt-2" onClick={onViewFullLogs}>
          View full logs
        </button>
      )}

      {(run?.status === 'completed' || run?.status === 'partial') && credentials && (
        <div className={cn('shrink-0 space-y-2', compact ? 'mt-2' : 'mt-4')}>
          <ScratchOrgSuccessBanner
            alias={credentials.alias}
            username={credentials.username}
            password={credentials.password ?? undefined}
            instanceUrl={credentials.instanceUrl ?? undefined}
            expirationDate={credentials.expirationDate}
            onViewDetails={onViewDetails}
            compact={compact}
            mode={launchMode}
            onGeneratePassword={onGeneratePassword}
            generatingPassword={generatingPassword}
          />
          {!compact && (
            <Link href="/data-center?tab=cona" className="text-sm text-primary hover:underline block">
              Next: deploy data in Data Center →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
