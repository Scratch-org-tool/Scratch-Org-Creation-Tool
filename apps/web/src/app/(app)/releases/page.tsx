import { Suspense } from 'react';
import { PageSkeleton } from '@/components/studio';
import { ReleasesWorkspace } from '@/modules/releases';

export default function ReleasesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="studio-sidebar" />}>
      <ReleasesWorkspace />
    </Suspense>
  );
}
