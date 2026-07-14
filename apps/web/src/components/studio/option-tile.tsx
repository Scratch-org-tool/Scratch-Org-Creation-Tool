'use client';

import { cn } from '@/utils/cn';

interface OptionTileProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function OptionTile({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: OptionTileProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/30',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:border-primary/25',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 rounded border-border"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </label>
  );
}
