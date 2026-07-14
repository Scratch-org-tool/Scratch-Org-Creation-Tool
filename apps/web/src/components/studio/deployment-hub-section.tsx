'use client';

import { cn } from '@/utils/cn';
import { GlassCard } from './glass-card';
import { HubActionCard, type HubActionItem } from './hub-action-card';

interface DeploymentHubSectionProps {
  title: string;
  description: string;
  actions: HubActionItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}

export function DeploymentHubSection({
  title,
  description,
  actions,
  columns = 2,
  className,
}: DeploymentHubSectionProps) {
  const colClass =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : columns === 1
        ? 'grid-cols-1'
        : 'grid-cols-1 sm:grid-cols-2';

  return (
    <GlassCard title={title} description={description} className={className}>
      <div className={cn('grid gap-4 items-start', colClass)}>
        {actions.map((action) => (
          <HubActionCard key={action.href} action={action} />
        ))}
      </div>
    </GlassCard>
  );
}
