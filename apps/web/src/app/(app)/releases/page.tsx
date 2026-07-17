import { Suspense } from 'react';
import { ReleasesWorkspace } from '@/modules/releases';

export default function ReleasesPage() {
  return (
    <Suspense fallback={null}>
      <ReleasesWorkspace />
    </Suspense>
  );
}
