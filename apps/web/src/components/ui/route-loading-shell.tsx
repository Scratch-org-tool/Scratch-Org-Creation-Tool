'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';

interface RouteLoadingShellProps {
  titleWidth?: string;
  subtitleWidth?: string;
  showTabs?: boolean;
  tabCount?: number;
  bodyClassName?: string;
  children?: React.ReactNode;
}

/** Instant route feedback — header shell while page chunk loads (sidebar stays visible). */
export function RouteLoadingShell({
  titleWidth = 'w-48',
  subtitleWidth = 'w-72',
  showTabs = false,
  tabCount = 3,
  bodyClassName,
  children,
}: RouteLoadingShellProps) {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-150">
      <div className="space-y-2">
        <Skeleton className={cn('h-8 max-w-full', titleWidth)} />
        <Skeleton className={cn('h-4 max-w-full', subtitleWidth)} />
      </div>
      {showTabs && (
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: tabCount }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
      )}
      <div className={cn('space-y-4', bodyClassName)}>
        {children ?? (
          <>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        )}
      </div>
    </div>
  );
}
