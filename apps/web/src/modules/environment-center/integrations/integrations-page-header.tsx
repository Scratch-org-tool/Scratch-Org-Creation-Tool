'use client';

import { Link2 } from 'lucide-react';
import { Breadcrumbs } from '@/components/studio/breadcrumbs';
import { cn } from '@/utils/cn';

interface IntegrationsPageHeaderProps {
  actions?: React.ReactNode;
}

export function IntegrationsPageHeader({ actions }: IntegrationsPageHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60',
        'bg-gradient-to-r from-card via-card/95 to-cyan-500/10',
      )}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none hidden sm:block">
        <Link2 className="w-28 h-28 text-cyan-400 -rotate-12" />
      </div>
      <div className="relative p-5 md:p-6">
        <Breadcrumbs className="mb-2" />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Manage Salesforce orgs, scratch orgs, and Azure DevOps connections.
            </p>
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
