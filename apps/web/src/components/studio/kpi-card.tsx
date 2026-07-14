'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatTrend, trendClass } from '@/lib/ui-utils';
import { cn } from '@/utils/cn';

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClass?: string;
  accentColor?: string;
  trend?: number | null | 'hidden';
  trendLabel?: string;
  footer?: ReactNode;
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconClass = 'text-primary',
  accentColor = '#60a5fa',
  trend,
  trendLabel,
  footer,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border/60 bg-card/60 p-4',
        'hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300',
        'flex flex-col min-h-[118px]',
        className,
      )}
      style={{
        boxShadow: `inset 0 1px 0 0 ${accentColor}18`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}88, transparent)` }}
      />
      <div className="flex items-start justify-between gap-2 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
          {trendLabel ? (
            <p className="text-xs text-muted-foreground mt-1">{trendLabel}</p>
          ) : (
            trend !== undefined &&
            trend !== 'hidden' && (
              <p className={cn('text-xs mt-1', trendClass(trend))}>
                {formatTrend(trend)} vs prior period
              </p>
            )
          )}
        </div>
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            'bg-secondary/40 border border-border/40',
          )}
          style={{ boxShadow: `0 0 12px ${accentColor}22` }}
        >
          <Icon className={cn('w-4 h-4', iconClass)} />
        </div>
      </div>
      {footer && <div className="mt-2 pt-1 overflow-hidden">{footer}</div>}
    </div>
  );
}

export function CardDecoration() {
  return (
    <div className="flex items-center gap-2 mb-3" aria-hidden>
      <svg viewBox="0 0 80 20" className="h-4 w-16 text-muted-foreground/40" fill="none">
        <path
          d="M0 12 Q10 4 20 12 T40 12 T60 8 T80 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M0 16 Q12 10 24 16 T48 14 T72 10"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="w-2 h-2 rounded-full bg-red-400/80 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
        <span className="w-2 h-2 rounded-full bg-green-400/80 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
      </div>
    </div>
  );
}
