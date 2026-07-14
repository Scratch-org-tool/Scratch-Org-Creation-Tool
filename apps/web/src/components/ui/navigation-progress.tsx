'use client';

import { useNavigation } from '@/contexts/navigation-context';

/** Thin top bar — instant feedback while a route chunk loads. */
export function NavigationProgress() {
  const { pendingHref } = useNavigation();
  if (!pendingHref) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-primary/15"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="nav-progress-bar h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
