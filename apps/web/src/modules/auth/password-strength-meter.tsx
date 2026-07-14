'use client';

import { Check, Circle } from 'lucide-react';
import { scorePassword } from '@sfcc/shared';
import { cn } from '@/utils/cn';

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

const BAR_COLORS: Record<number, string> = {
  1: 'bg-destructive',
  2: 'bg-amber-500',
  3: 'bg-primary',
  4: 'bg-emerald-500',
};

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const strength = scorePassword(password);

  return (
    <div className={cn('space-y-2', className)} aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Password strength:{' '}
          <span className="font-medium text-foreground">{strength.label}</span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={strength.percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            BAR_COLORS[strength.score] ?? 'bg-muted-foreground',
          )}
          style={{ width: `${strength.percent}%` }}
        />
      </div>

      <ul className="space-y-1">
        {strength.checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              'flex items-center gap-1.5 text-xs',
              check.met ? 'text-foreground/80' : 'text-muted-foreground',
            )}
          >
            {check.met ? (
              <Check className="size-3 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <Circle className="size-3 shrink-0 opacity-50" aria-hidden />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
