'use client';

import type { LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/utils/cn';
import { GlassCard } from './glass-card';

export interface MasterToggleCardProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  disabled?: boolean;
  statusLabel?: string;
  ariaLabel?: string;
}

export function MasterToggleCard({
  enabled,
  onChange,
  icon: Icon,
  title,
  description,
  hint,
  disabled,
  statusLabel,
  ariaLabel,
}: MasterToggleCardProps) {
  return (
    <GlassCard
      className={cn(
        'border-2 transition-colors',
        enabled
          ? 'border-emerald-500/35 bg-emerald-500/[0.04]'
          : 'border-amber-500/45 bg-amber-500/[0.04]',
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground/70">{description}</p>
            {hint ? <p className="mt-2 text-sm font-medium text-amber-300/90">{hint}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
          {statusLabel ? (
            <span
              className={cn(
                'min-w-8 text-right text-xs font-semibold uppercase tracking-wide',
                enabled ? 'text-emerald-400' : 'text-amber-300',
              )}
            >
              {statusLabel}
            </span>
          ) : null}
          <Switch
            size="lg"
            checked={enabled}
            disabled={disabled}
            onChange={onChange}
            aria-label={ariaLabel ?? title}
          />
        </div>
      </div>
    </GlassCard>
  );
}
