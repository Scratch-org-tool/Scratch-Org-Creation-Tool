import { cn } from '@/utils/cn';
import { statusBadgeClass, statusLabel } from '@/lib/ui-utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex text-xs px-2 py-0.5 rounded-full capitalize shrink-0',
        className ?? statusBadgeClass(status),
      )}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}
