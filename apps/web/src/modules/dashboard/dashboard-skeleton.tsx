'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardDays } from './types';

interface DashboardSkeletonProps {
  days: DashboardDays;
  onDaysChange: (days: DashboardDays) => void;
}

export function DashboardSkeleton({ days: _days, onDaysChange: _onDaysChange }: DashboardSkeletonProps) {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <Skeleton className="h-[120px] w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-[360px] rounded-lg" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-[240px] rounded-lg" />
        <Skeleton className="h-[240px] rounded-lg" />
      </div>
    </div>
  );
}
