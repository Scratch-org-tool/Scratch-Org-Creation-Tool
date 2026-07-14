'use client';

import Link from 'next/link';
import { Link2, Rocket } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';
import type { AzureStatus } from './types';

interface AzurePageHeaderProps {
  azureStatus: AzureStatus;
  project?: string;
}

export function AzurePageHeader({ azureStatus, project }: AzurePageHeaderProps) {
  return (
    <DeploymentPageHeader
      title="Azure DevOps Deployment Center"
      subtitle="Deploy metadata from your Azure repo directly to Salesforce orgs"
      icon={Rocket}
      accentClass="to-blue-500/10"
      showBreadcrumbs
      actions={
        azureStatus.connected ? (
          <div className="text-sm rounded-lg border border-border/60 bg-card/40 px-3 py-2">
            <span className="text-muted-foreground">Project: </span>
            <span className="font-medium">{project || azureStatus.project || '—'}</span>
          </div>
        ) : (
          <Link
            href="/environment-center?tab=azure"
            className="text-sm text-primary inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 hover:bg-primary/15 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect Azure DevOps
          </Link>
        )
      }
    />
  );
}
