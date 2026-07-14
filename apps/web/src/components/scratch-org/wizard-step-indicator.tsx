 'use client';

import { cn } from '@/utils/cn';
import { CheckCircle2 } from 'lucide-react';

const STEPS = ['Details', 'Review'] as const;

export function WizardStepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className={cn('w-8 h-px', done ? 'bg-primary' : 'bg-border')} />}
            <div
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full',
                active && 'bg-primary/15 text-primary',
                done && !active && 'text-green-400',
                !done && !active && 'text-muted-foreground',
              )}
            >
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
