'use client';

import { PageSkeleton } from '@/components/studio';

/** In-layout route loading — keeps sidebar visible (no full-screen flash). */
export function ContentRouteLoading() {
  return <PageSkeleton variant="default" />;
}
