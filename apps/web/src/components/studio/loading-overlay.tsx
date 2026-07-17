'use client';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/utils/cn';

interface LoadingOverlayProps {
  /** Main action description, e.g. "Building deployment plan…". */
  label: string;
  /** Secondary line under the label. */
  sublabel?: string;
  className?: string;
}

/**
 * Full-panel busy overlay. Place inside a `relative` container: it dims the
 * content underneath and centers a spinner + description so the user always
 * sees that background work is in progress.
 */
export function LoadingOverlay({ label, sublabel, className }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl',
        'bg-background/70 backdrop-blur-[2px]',
        className,
      )}
    >
      <Spinner size="lg" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sublabel && <p className="max-w-md text-center text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

interface BusyRowProps {
  label: string;
  className?: string;
}

/** Inline spinner + text for in-card loading states (replaces text-only "Loading…"). */
export function BusyRow({ label, className }: BusyRowProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2 p-3 text-sm text-muted-foreground', className)}
    >
      <Spinner size="sm" />
      {label}
    </p>
  );
}
