'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface HubActionItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconBg?: string;
  badge?: string;
  locked?: boolean;
  lockTooltip?: string;
}

interface HubActionCardProps {
  action: HubActionItem;
}

export function HubActionCard({ action }: HubActionCardProps) {
  const locked = action.locked ?? false;
  const lockTooltip = action.lockTooltip ?? 'Coming soon';

  const className = cn(
    'group relative flex flex-col h-auto p-4 rounded-xl border border-border/60 bg-card/40 transition-all duration-300',
    locked
      ? 'opacity-60 cursor-not-allowed relative'
      : 'hover:border-primary/30 hover:bg-card/70 hover:shadow-lg hover:shadow-primary/5',
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            action.iconBg ?? 'bg-primary/10 text-primary',
            locked && 'opacity-70',
          )}
        >
          <action.icon className="w-5 h-5" />
        </div>
        {locked ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground border border-border/60">
            <Lock className="w-3 h-3" />
            Locked
          </span>
        ) : (
          action.badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {action.badge}
            </span>
          )
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-semibold text-foreground transition-colors',
            !locked && 'group-hover:text-primary',
          )}
        >
          {action.label}
        </p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{action.description}</p>
      </div>
      <div
        className={cn(
          'flex items-center gap-1 mt-3 text-xs text-muted-foreground',
          !locked && 'group-hover:text-primary transition-colors',
        )}
      >
        {locked ? (
          <span>{lockTooltip}</span>
        ) : (
          <>
            <span>Open</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </div>
    </>
  );

  if (locked) {
    return (
      <div className={cn(className, 'group')} title={lockTooltip} aria-disabled="true">
        <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] whitespace-nowrap rounded-md border border-border/60 bg-popover px-2.5 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
          {lockTooltip}
        </span>
        {content}
      </div>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {content}
    </Link>
  );
}
