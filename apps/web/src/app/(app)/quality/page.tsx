import { Suspense } from 'react';
import { QualityWorkspace } from '@/modules/quality';

export default function QualityPage() {
  return (
    <Suspense fallback={null}>
      <QualityWorkspace />
    </Suspense>
  );
}
