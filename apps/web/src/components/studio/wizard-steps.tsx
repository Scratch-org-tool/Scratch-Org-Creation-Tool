'use client';

import { cn } from '@/utils/cn';
import { Check } from 'lucide-react';

interface WizardStepsProps {
  steps: string[];
  current: number;
  className?: string;
  /** When false, step circles are shown without connecting lines. */
  connected?: boolean;
  /**
   * When provided, steps render as buttons and clicking a reachable step
   * navigates to it (each step behaves like its own page).
   */
  onStepSelect?: (index: number) => void;
  /** Whether a step can be navigated to (defaults to every step). */
  isStepEnabled?: (index: number) => boolean;
}

export function WizardSteps({
  steps,
  current,
  className,
  connected = true,
  onStepSelect,
  isStepEnabled,
}: WizardStepsProps) {
  return (
    <div
      className={cn(connected ? 'flex items-center gap-2' : 'flex items-center gap-4', className)}
      {...(onStepSelect ? { role: 'tablist', 'aria-label': 'Wizard steps' } : {})}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const enabled = !isStepEnabled || isStepEnabled(i);
        const clickable = Boolean(onStepSelect) && enabled && !active;
        const content = (
          <>
            <span
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors',
                done && 'bg-primary border-primary text-primary-foreground',
                active && !done && 'border-primary text-primary bg-primary/10',
                !active && !done && 'border-border text-muted-foreground bg-card/40',
              )}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'text-xs font-medium truncate',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <div key={label} className={cn('flex items-center gap-2', connected && 'flex-1 min-w-0')}>
            {connected && i > 0 && (
              <div
                className={cn('h-px flex-1 min-w-[12px]', done ? 'bg-primary' : 'bg-border')}
              />
            )}
            {onStepSelect ? (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? 'step' : undefined}
                disabled={!enabled}
                onClick={() => {
                  if (clickable) onStepSelect(i);
                }}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 rounded-lg px-1.5 py-1 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  clickable && 'cursor-pointer hover:bg-primary/10',
                  !enabled && 'cursor-not-allowed opacity-50',
                )}
                title={enabled ? label : 'Complete the previous steps first'}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">{content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
