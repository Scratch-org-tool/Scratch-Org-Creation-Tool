'use client';

import { Button } from '@/components/ui/button';
import { InlineAlert } from './inline-alert';

interface ConfirmBannerProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'warning' | 'error';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmBanner({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  loading,
  onConfirm,
  onCancel,
}: ConfirmBannerProps) {
  return (
    <InlineAlert variant={variant} title={title}>
      <p className="mb-3">{message}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      </div>
    </InlineAlert>
  );
}
