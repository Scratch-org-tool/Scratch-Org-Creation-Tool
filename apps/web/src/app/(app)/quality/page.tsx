import { Suspense } from 'react';
import { PageSkeleton } from '@/components/studio';
import { QualityWorkspace } from '@/modules/quality';

export default function QualityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QualityWorkspace />
    </Suspense>
  );
}
