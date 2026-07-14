'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
} as const;

interface SpinnerProps {
  size?: keyof typeof sizeClasses;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-primary', sizeClasses[size], className)}
      aria-hidden={!label}
      aria-label={label}
    />
  );
}
