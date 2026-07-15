'use client';

import Link from 'next/link';
import { Cloud } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from '@/components/studio/glass-card';
import { OrgStatusCard } from '@/components/scratch-org/org-status-card';
import type { ConnectedOrgRow } from '@/components/scratch-org/types';
import type { AzureStatus } from './types';

interface ConnectedOrgsPanelProps {
  orgs: ConnectedOrgRow[];
  selectedAlias?: string;
  onSelect: (alias: string) => void;
  azureStatus: AzureStatus;
  variant?: 'card' | 'compact' | 'sidebar';
  className?: string;
}

export function ConnectedOrgsPanel({
  orgs,
  selectedAlias,
  onSelect,
  azureStatus,
  variant = 'card',
  className,
}: ConnectedOrgsPanelProps) {
  const orgList = (
    <>
      {orgs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No Salesforce orgs connected.{' '}
          <Link href="/environment-center?tab=salesforce" className="text-primary hover:underline">
            Connect →
          </Link>
        </p>
      ) : (
        <div className={cn('space-y-2', variant === 'compact' && 'max-h-[168px] overflow-y-auto')}>
          {orgs.map((o) => (
            <OrgStatusCard
              key={o.alias}
              org={o}
              selected={o.alias === selectedAlias}
              onClick={() => onSelect(o.alias)}
            />
          ))}
        </div>
      )}
    </>
  );

  if (variant === 'sidebar') {
    return (
      <GlassCard
        className={className}
        contentClassName="space-y-2"
        headerAction={
          <Link
            href="/environment-center"
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            View All →
          </Link>
        }
        title={
          <span className="inline-flex items-center gap-2">
            <Cloud className="w-4 h-4 text-sky-400" />
            Connected Orgs
          </span>
        }
      >
        {orgList}
        {orgs.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/60">
            <Link href="/environment-center?tab=salesforce" className="text-primary hover:underline">
              + Connect org
            </Link>
          </p>
        )}
        {!azureStatus.connected && (
          <p className="text-xs text-muted-foreground">
            <Link href="/environment-center?tab=source-control" className="text-primary hover:underline">
              + Connect source control
            </Link>
          </p>
        )}
      </GlassCard>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border/80 bg-card/50 p-3 space-y-2.5 w-full',
          className,
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Connected Orgs
        </p>
        {orgList}
      </div>
    );
  }

  return (
    <GlassCard title="Connected Orgs" contentClassName="space-y-2" className={className}>
      {orgList}
    </GlassCard>
  );
}
