'use client';

import { useState } from 'react';
import { Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/studio';
import { cn } from '@/utils/cn';

interface JobDetailStopButtonProps {
  label?: string;
  compact?: boolean;
  stopping: boolean;
  onStop: () => Promise<void>;
  className?: string;
}

export function JobDetailStopButton({
  label = 'Stop job',
  compact = false,
  stopping,
  onStop,
  className,
}: JobDetailStopButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await onStop();
      setConfirmOpen(false);
    } catch {
      // Parent surfaces API errors; keep dialog open for retry.
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={compact ? 'sm' : 'default'}
        className={cn('gap-2 no-print', className)}
        loading={stopping}
        onClick={() => setConfirmOpen(true)}
      >
        <Square className={cn('fill-current', compact ? 'h-3 w-3' : 'h-4 w-4')} />
        {label}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Stop this job?"
        message="The running process will be cancelled. Steps already completed will not be rolled back."
        confirmLabel="Stop job"
        cancelLabel="Keep running"
        loading={stopping}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
