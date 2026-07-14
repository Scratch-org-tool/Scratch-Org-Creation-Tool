'use client';

import { CheckCircle2, Circle, Loader2, SkipForward, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { PIPELINE_STEPS_UI, type PipelineStepLabel, type StepState } from './types';

interface JobStepperProps {
  orientation?: 'horizontal' | 'vertical';
  getState: (label: PipelineStepLabel) => StepState;
  activeSubtext?: string;
  compact?: boolean;
}

function StepIcon({ state, compact }: { state: StepState; compact?: boolean }) {
  const size = compact ? 'w-3 h-3' : 'w-4 h-4';
  if (state === 'done') return <CheckCircle2 className={cn(size, 'text-green-500 shrink-0')} />;
  if (state === 'failed') return <XCircle className={cn(size, 'text-red-500 shrink-0')} />;
  if (state === 'active') return <Loader2 className={cn(size, 'text-primary animate-spin shrink-0')} />;
  if (state === 'skipped') return <SkipForward className={cn(size, 'text-muted-foreground shrink-0')} />;
  return <Circle className={cn(size, 'text-muted-foreground/50 shrink-0')} />;
}

export function JobStepper({ orientation = 'horizontal', getState, activeSubtext, compact }: JobStepperProps) {
  const vertical = orientation === 'vertical';

  if (vertical) {
    return (
      <ol className={cn('relative', compact ? 'space-y-0 max-h-24 overflow-y-auto scrollbar-thin pr-1' : 'space-y-0')}>
        {PIPELINE_STEPS_UI.map((label, i) => {
          const state = getState(label);
          const isLast = i === PIPELINE_STEPS_UI.length - 1;
          const isActive = state === 'active';
          const isDone = state === 'done' || state === 'skipped';
          if (compact && !isActive && !isDone && state !== 'failed') return null;

          return (
            <li key={label} className={cn('flex gap-2', compact ? 'pb-1.5' : 'pb-4 last:pb-0')}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'rounded-full border flex items-center justify-center shrink-0',
                    compact ? 'w-5 h-5' : 'w-8 h-8',
                    state === 'active' && 'border-primary bg-primary/10',
                    state === 'done' && 'border-green-500/40 bg-green-500/10',
                    state === 'failed' && 'border-red-500/40 bg-red-500/10',
                    state === 'pending' && 'border-border bg-card/40',
                  )}
                >
                  <StepIcon state={state} compact={compact} />
                </div>
                {!isLast && !compact && <div className="w-px flex-1 min-h-[1rem] bg-border/80 my-1" />}
              </div>
              <div className={cn('min-w-0 flex-1', compact ? 'pt-0' : 'pt-1')}>
                <span
                  className={cn(
                    compact ? 'text-[11px] leading-tight' : 'text-sm font-medium',
                    state === 'pending' && 'text-muted-foreground',
                    state === 'failed' && 'text-red-400',
                    state === 'active' && 'font-medium text-foreground',
                  )}
                >
                  {label}
                </span>
                {state === 'active' && activeSubtext && (
                  <p className={cn('text-muted-foreground mt-0.5', compact ? 'text-[10px] leading-snug' : 'text-xs')}>
                    {activeSubtext}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PIPELINE_STEPS_UI.map((label) => {
        const state = getState(label);
        return (
          <div
            key={label}
            className={cn(
              'flex items-center gap-1.5 text-xs rounded-md border border-border/60 bg-card/40 px-2 py-1.5',
              state === 'active' && 'border-primary/40 bg-primary/5',
              state === 'failed' && 'border-red-500/40 bg-red-500/5',
            )}
          >
            <StepIcon state={state} />
            <span
              className={cn(
                state === 'pending' && 'text-muted-foreground',
                state === 'failed' && 'text-red-400',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
