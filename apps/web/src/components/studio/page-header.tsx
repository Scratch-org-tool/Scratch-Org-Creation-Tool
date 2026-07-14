'use client';

import { cn } from '@/utils/cn';
import { Breadcrumbs } from './breadcrumbs';
import type { BreadcrumbItem } from '@/lib/nav-breadcrumbs';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: React.ReactNode;
  className?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBreadcrumbs?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
  breadcrumbs,
  showBreadcrumbs = true,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
