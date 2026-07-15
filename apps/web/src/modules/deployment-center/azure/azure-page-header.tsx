'use client';

import Link from 'next/link';
import { Link2, Rocket } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';
import type { ScmProvider } from '@sfcc/shared';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';

interface AzurePageHeaderProps {
  connected: boolean;
  provider?: ScmProvider | '';
}

export function GitMetadataPageHeader({ connected, provider }: AzurePageHeaderProps) {
  return (
    <DeploymentPageHeader
      title="Git Metadata Deploy"
      subtitle="Deploy a manifest from any connected source-control provider to Salesforce"
      icon={Rocket}
      accentClass="to-blue-500/10"
      showBreadcrumbs
      actions={
        connected ? (
          <div className="text-sm rounded-lg border border-border/60 bg-card/40 px-3 py-2">
            <span className="text-muted-foreground">Source: </span>
            <span className="font-medium">{provider ? SCM_PROVIDER_LABELS[provider] : 'Connected provider'}</span>
          </div>
        ) : (
          <Link
            href="/environment-center?tab=source-control"
            className="text-sm text-primary inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 hover:bg-primary/15 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect source control
          </Link>
        )
      }
    />
  );
}
