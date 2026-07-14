import { Suspense } from 'react';
import { PageSkeleton } from '@/components/studio';
import { CreateScratchOrgWorkspace } from '@/components/scratch-org/create-scratch-org-workspace';

export default function CreateScratchOrgPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CreateScratchOrgWorkspace />
    </Suspense>
  );
}
