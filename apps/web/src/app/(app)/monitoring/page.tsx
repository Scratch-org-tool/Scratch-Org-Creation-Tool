import { Suspense } from 'react';
import { MonitoringWorkspace } from '@/modules/monitoring';
import { Skeleton } from '@/components/ui/skeleton';

function MonitoringLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<MonitoringLoading />}>
      <MonitoringWorkspace />
    </Suspense>
  );
}
