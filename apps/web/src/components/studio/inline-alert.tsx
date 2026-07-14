import { cn } from '@/utils/cn';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const VARIANTS: Record<AlertVariant, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-blue-500/30 bg-blue-500/5 text-blue-200', Icon: Info },
  success: { className: 'border-green-500/30 bg-green-500/5 text-green-200', Icon: CheckCircle2 },
  warning: { className: 'border-amber-500/30 bg-amber-500/5 text-amber-200', Icon: AlertCircle },
  error: { className: 'border-red-500/30 bg-red-500/5 text-red-300', Icon: XCircle },
};

interface InlineAlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export function InlineAlert({
  variant = 'info',
  title,
  children,
  className,
  onDismiss,
}: InlineAlertProps) {
  const { className: variantClass, Icon } = VARIANTS[variant];
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', variantClass, className)} role="alert">
      <div className="flex gap-2">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-xs opacity-60 hover:opacity-100">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
