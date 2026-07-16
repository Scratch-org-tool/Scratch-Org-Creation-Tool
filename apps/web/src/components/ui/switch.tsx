'use client';

import { cn } from '@/utils/cn';

type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

const SIZES: Record<SwitchSize, { track: string; knob: string; on: string }> = {
  sm: { track: 'h-4 w-7', knob: 'size-3', on: 'translate-x-3' },
  md: { track: 'h-5 w-9', knob: 'size-4', on: 'translate-x-4' },
  lg: { track: 'h-7 w-12', knob: 'size-6', on: 'translate-x-5' },
};

export function Switch({
  checked,
  onChange,
  disabled,
  size = 'md',
  id,
  className,
  'aria-label': ariaLabel,
}: SwitchProps) {
  const dims = SIZES[size];
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border-2 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        dims.track,
        checked
          ? 'border-transparent bg-primary'
          : 'border-border bg-muted hover:border-primary/50',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-md ring-0 transition-transform',
          dims.knob,
          checked ? dims.on : 'translate-x-0',
        )}
      />
    </button>
  );
}
