'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { cn } from '@/utils/cn';

/** Salesforce-style puff cloud (viewBox 0 0 240 130) */
const CLOUD_PATH =
  'M 62 88 C 42 88 32 72 38 56 C 28 42 44 30 60 36 C 66 20 88 18 100 32 '
  + 'C 118 20 148 26 154 46 C 178 42 198 60 192 76 C 208 82 202 98 186 100 '
  + 'C 192 112 174 118 156 112 C 144 124 118 128 100 118 C 82 128 58 124 52 108 '
  + 'C 36 108 30 98 36 88 Z';

const FILL_TOP = 22;
const FILL_BOTTOM = 128;
const FILL_HEIGHT = FILL_BOTTOM - FILL_TOP;

const sizeMap = {
  md: 'w-[120px] h-[78px]',
  lg: 'w-[160px] h-[104px]',
} as const;

interface DevopsCloudLoaderProps {
  size?: keyof typeof sizeMap;
  progress?: number;
  className?: string;
  label?: string;
}

export function DevopsCloudLoader({
  size = 'lg',
  progress,
  className,
  label = 'Loading',
}: DevopsCloudLoaderProps) {
  const reduceMotion = useReducedMotion();

  const fillHeight = useMemo(() => {
    if (progress !== undefined) {
      return (Math.min(100, Math.max(0, progress)) / 100) * FILL_HEIGHT;
    }
    return undefined;
  }, [progress]);

  const fillY = fillHeight !== undefined ? FILL_BOTTOM - fillHeight : undefined;

  return (
    <div
      className={cn('relative flex flex-col items-center gap-3', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <svg
        viewBox="0 0 240 130"
        className={cn('overflow-visible', sizeMap[size])}
        aria-hidden
      >
        <defs>
          <clipPath id="devops-cloud-clip">
            <path d={CLOUD_PATH} />
          </clipPath>
          <linearGradient id="devops-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#fb7185" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="devops-wave-gradient-2" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#f472b6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.7" />
          </linearGradient>
          <filter id="devops-wave-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wave ribbons behind the cloud */}
        <g filter="url(#devops-wave-glow)" opacity={0.9}>
          {reduceMotion ? (
            <>
              <path
                d="M -20 92 Q 40 78 100 92 T 220 88 T 280 92"
                fill="none"
                stroke="url(#devops-wave-gradient)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M -30 102 Q 50 112 120 98 T 260 104"
                fill="none"
                stroke="url(#devops-wave-gradient-2)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity={0.75}
              />
            </>
          ) : (
            <>
              <motion.g
                animate={{ x: [-28, 28, -28] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <path
                  d="M -20 92 Q 40 78 100 92 T 220 88 T 280 92"
                  fill="none"
                  stroke="url(#devops-wave-gradient)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </motion.g>
              <motion.g
                animate={{ x: [24, -24, 24] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <path
                  d="M -30 102 Q 50 112 120 98 T 260 104"
                  fill="none"
                  stroke="url(#devops-wave-gradient-2)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity={0.75}
                />
              </motion.g>
              <motion.g
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <path
                  d="M 0 86 Q 80 74 160 86 T 300 84"
                  fill="none"
                  stroke="url(#devops-wave-gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity={0.5}
                />
              </motion.g>
            </>
          )}
        </g>

        {/* Empty cloud shell */}
        <path
          d={CLOUD_PATH}
          fill="hsl(222 47% 12%)"
          stroke="hsl(199 89% 48% / 0.35)"
          strokeWidth="1.5"
        />

        {/* Rising blue fill clipped to cloud */}
        <g clipPath="url(#devops-cloud-clip)">
          {reduceMotion ? (
            <rect
              x="0"
              y={FILL_TOP + FILL_HEIGHT * 0.3}
              width="240"
              height={FILL_HEIGHT * 0.7}
              fill="hsl(199 89% 48%)"
            />
          ) : progress !== undefined && fillY !== undefined && fillHeight !== undefined ? (
            <rect
              x="0"
              y={fillY}
              width="240"
              height={fillHeight}
              fill="hsl(199 89% 48%)"
            />
          ) : (
            <motion.rect
              x="0"
              width="240"
              fill="hsl(199 89% 48%)"
              initial={{ y: FILL_BOTTOM, height: 0 }}
              animate={{
                y: [FILL_BOTTOM, FILL_TOP, FILL_BOTTOM],
                height: [0, FILL_HEIGHT, 0],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </g>

        {/* Cloud outline on top for crisp edge */}
        <path
          d={CLOUD_PATH}
          fill="none"
          stroke="hsl(199 89% 55% / 0.25)"
          strokeWidth="1"
        />

        {/* Devops label */}
        <text
          x="120"
          y="78"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="22"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ letterSpacing: '-0.02em' }}
        >
          Devops
        </text>
      </svg>
    </div>
  );
}
