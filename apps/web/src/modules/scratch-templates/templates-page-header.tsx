'use client';

import { FileStack } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';

interface TemplatesPageHeaderProps {
  actions?: React.ReactNode;
}

export function TemplatesPageHeader({ actions }: TemplatesPageHeaderProps) {
  return (
    <DeploymentPageHeader
      title="Templates"
      subtitle="Private pipeline presets: scratch org, Azure deploy, custom settings JSON, data seed, users."
      icon={FileStack}
      accentClass="to-violet-500/10"
      showBreadcrumbs
      actions={actions}
    />
  );
}
