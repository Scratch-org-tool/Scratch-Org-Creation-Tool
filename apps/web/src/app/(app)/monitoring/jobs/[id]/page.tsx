import { Suspense } from 'react';
import { JobDetailWorkspace } from '@/modules/monitoring/job-detail-workspace';
import { Skeleton } from '@/components/ui/skeleton';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 space-y-5">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      }
    >
      <JobDetailWorkspace jobId={id} />
    </Suspense>
  );
}
