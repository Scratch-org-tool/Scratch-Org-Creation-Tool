'use client';

import { cn } from '@/utils/cn';
import type { ConnectedOrgRow } from './types';

const statusClass = (status?: string) => {
  const s = (status ?? '').toLowerCase();
  if (s.includes('connect') || s === 'active') return 'bg-green-500/10 text-green-400';
  if (s.includes('fail') || s.includes('revok')) return 'bg-red-500/10 text-red-400';
  return 'bg-amber-500/10 text-amber-400';
};

interface OrgStatusCardProps {
  org: ConnectedOrgRow;
  selected?: boolean;
  onClick?: () => void;
}

export function OrgStatusCard({ org, selected, onClick }: OrgStatusCardProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-3 space-y-1.5 transition-all duration-200',
        selected
          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
          : 'border-border/60 bg-card/50 hover:border-primary/25 hover:bg-card/80',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{org.alias}</span>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
          {org.isDevHub ? 'Dev Hub' : org.orgType ?? 'Org'}
        </span>
      </div>
      {org.username && <p className="text-xs text-muted-foreground truncate">{org.username}</p>}
      <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full', statusClass(org.status))}>
        {org.status ?? 'Unknown'}
      </span>
    </Wrapper>
  );
}
