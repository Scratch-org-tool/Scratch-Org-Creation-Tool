'use client';

import type { LucideIcon } from 'lucide-react';
import { Breadcrumbs } from './breadcrumbs';
import { cn } from '@/utils/cn';

interface DeploymentPageHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accentClass?: string;
  showBreadcrumbs?: boolean;
  actions?: React.ReactNode;
  /** Stack actions below title when there are many controls (e.g. defects filters). */
  actionsLayout?: 'inline' | 'stacked';
}

export function DeploymentPageHeader({
  title,
  subtitle,
  icon: Icon,
  accentClass = 'to-violet-500/10',
  showBreadcrumbs = false,
  actions,
  actionsLayout = 'inline',
}: DeploymentPageHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60',
        'bg-gradient-to-r from-card via-card/95',
        accentClass,
      )}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none hidden sm:block text-primary">
        <Icon className="w-28 h-28 -rotate-12" />
      </div>
      <div className="relative p-5 md:p-6">
        {showBreadcrumbs && <Breadcrumbs className="mb-2" />}
        {actionsLayout === 'stacked' ? (
          <div className="flex flex-col gap-4">
            <div className="min-w-0 pr-20 sm:pr-28">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-3xl">{subtitle}</p>
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 pr-20 sm:pr-28">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{subtitle}</p>
            </div>
            {actions && (
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 w-full sm:w-auto">
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
