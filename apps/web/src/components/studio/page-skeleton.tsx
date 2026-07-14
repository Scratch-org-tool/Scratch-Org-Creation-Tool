import { Skeleton } from '@/components/ui/skeleton';

interface PageSkeletonProps {
  variant?: 'default' | 'studio-3col' | 'studio-2row' | 'studio-sidebar' | 'form' | 'hub';
}

export function PageSkeleton({ variant = 'default' }: PageSkeletonProps) {
  if (variant === 'studio-sidebar') {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <Skeleton className="h-[640px]" />
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-[calc(100vh-12rem)]" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'studio-2row') {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-96 max-w-full" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-[calc(100vh-12rem)]" />
          <Skeleton className="h-[calc(100vh-12rem)]" />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (variant === 'studio-3col') {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-96 max-w-full" />
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (variant === 'hub') {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
