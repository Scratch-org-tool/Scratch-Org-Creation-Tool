'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from './glass-card';

export interface QuickActionItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  border?: string;
  iconBg?: string;
}

interface QuickActionGridProps {
  title?: string;
  description?: string;
  actions: QuickActionItem[];
  columns?: 1 | 2;
}

export function QuickActionGrid({
  title = 'Quick Actions',
  description = 'Common workflows',
  actions,
  columns = 2,
}: QuickActionGridProps) {
  return (
    <GlassCard title={title} description={description}>
      <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              'flex gap-3 p-3 rounded-lg border border-border/80 border-l-4',
              'hover:bg-secondary/40 transition-colors',
              a.border ?? 'border-l-primary',
            )}
          >
            <div
              className={cn(
                'w-9 h-9 rounded-md flex items-center justify-center shrink-0',
                a.iconBg ?? 'bg-primary/10 text-primary',
              )}
            >
              <a.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </GlassCard>
  );
}
