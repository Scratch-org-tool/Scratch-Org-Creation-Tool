'use client';

import { useState } from 'react';

/**
 * Defer a workspace tab's subtree until its first activation, then keep it
 * mounted (hidden) so tab state survives switching.
 *
 * Rendering every tab up front made pages with several heavy panels fetch and
 * poll for all of them on load; this keeps the initial render down to the
 * visible tab only.
 */
export function LazyTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [hasActivated, setHasActivated] = useState(active);
  // Render-phase state update (supported by React for the same component):
  // flips exactly once, the first time the tab becomes active.
  if (active && !hasActivated) setHasActivated(true);
  if (!hasActivated && !active) return null;
  return <div hidden={!active}>{children}</div>;
}
