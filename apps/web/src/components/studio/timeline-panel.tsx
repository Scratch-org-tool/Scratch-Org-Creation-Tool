import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from './glass-card';

export interface TimelineStep {
  label: string;
  description?: string;
  icon: LucideIcon;
  iconClass?: string;
}

interface TimelinePanelProps {
  title?: string;
  steps: TimelineStep[];
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

export function TimelinePanel({
  title = 'What happens next',
  steps,
  className,
  orientation = 'vertical',
}: TimelinePanelProps) {
  if (orientation === 'horizontal') {
    return (
      <GlassCard title={title} className={className}>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <li key={step.label} className="flex gap-3 min-w-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  step.iconClass ?? 'bg-primary/10 text-primary',
                )}
              >
                <step.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{step.label}</p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{step.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </GlassCard>
    );
  }

  return (
    <GlassCard title={title} className={className}>
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  step.iconClass ?? 'bg-primary/10 text-primary',
                )}
              >
                <step.icon className="w-4 h-4" />
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 min-h-[1rem] bg-border/80 my-1" />
              )}
            </div>
            <div className="pb-1 min-w-0">
              <p className="text-sm font-medium">{step.label}</p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </GlassCard>
  );
}
