'use client';

import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { TemplateWizardStep } from '../types';

interface TemplateStepSidebarProps {
  steps: readonly TemplateWizardStep[];
  current: number;
  onStepClick: (step: number) => void;
}

export function TemplateStepSidebar({ steps, current, onStepClick }: TemplateStepSidebarProps) {
  return (
    <nav aria-label="Template wizard steps" className="space-y-1">
      {steps.map(({ id, label }, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= current;

        return (
          <button
            key={id}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onStepClick(i)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
              active && 'bg-primary/10 text-primary border border-primary/25',
              done && !active && 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              !done && !active && 'text-muted-foreground/50 cursor-not-allowed',
              reachable && !active && 'hover:bg-secondary/40',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-primary bg-primary text-primary-foreground',
                active && !done && 'border-primary text-primary bg-primary/10',
                !active && !done && 'border-border bg-card/40',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('font-medium truncate', active && 'text-foreground')}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
