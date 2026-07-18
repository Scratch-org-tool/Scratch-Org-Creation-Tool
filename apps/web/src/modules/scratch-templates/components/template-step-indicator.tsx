'use client';

import { cn } from '@/utils/cn';
import { CheckCircle2 } from 'lucide-react';
import type { TemplateWizardStep } from '../types';

/** Compact horizontal stepper for mobile / tablet. */
export function TemplateStepIndicator({
  steps,
  current,
}: {
  steps: readonly TemplateWizardStep[];
  current: number;
}) {
  return (
    <div
      className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1 scrollbar-thin lg:hidden"
      aria-label="Template wizard progress"
    >
      {steps.map(({ id, label }, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={id}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
              active && 'border-primary/40 bg-primary/10 text-primary',
              done && !active && 'border-green-500/30 bg-green-500/5 text-green-400',
              !done && !active && 'border-border/60 bg-card/40 text-muted-foreground',
            )}
          >
            {done ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/80 text-[10px] font-semibold">
                {i + 1}
              </span>
            )}
            <span className="whitespace-nowrap">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
