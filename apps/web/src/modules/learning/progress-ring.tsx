'use client';

import { cn } from '@/utils/cn';

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  accent?: string;
  className?: string;
  label?: string;
}

/** SVG circular progress indicator with a centered percentage. */
export function ProgressRing({
  percent,
  size = 72,
  strokeWidth = 6,
  accent = '#38bdf8',
  className,
  label,
}: ProgressRingProps) {
  const bounded = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - bounded / 100);

  return (
    <div
      className={cn('relative inline-flex items-center justify-center shrink-0', className)}
      role="img"
      aria-label={label ?? `${bounded}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-secondary/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span
        className="absolute font-semibold tabular-nums"
        style={{ fontSize: Math.max(11, size * 0.22) }}
      >
        {bounded}%
      </span>
    </div>
  );
}
