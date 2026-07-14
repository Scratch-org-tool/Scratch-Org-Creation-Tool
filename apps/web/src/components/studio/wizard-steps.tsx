'use client';

import { cn } from '@/utils/cn';
import { Check } from 'lucide-react';

interface WizardStepsProps {
  steps: string[];
  current: number;
  className?: string;
  /** When false, step circles are shown without connecting lines. */
  connected?: boolean;
}

export function WizardSteps({ steps, current, className, connected = true }: WizardStepsProps) {
  return (
    <div className={cn(connected ? 'flex items-center gap-2' : 'flex items-center gap-4', className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className={cn('flex items-center gap-2', connected && 'flex-1 min-w-0')}>
            {connected && i > 0 && (
              <div
                className={cn('h-px flex-1 min-w-[12px]', done ? 'bg-primary' : 'bg-border')}
              />
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border',
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
