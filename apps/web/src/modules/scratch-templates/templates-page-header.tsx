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
      subtitle="Configure three progressive scratch-org presets, then create private templates for team-specific pipelines."
      icon={FileStack}
      accentClass="to-violet-500/10"
      showBreadcrumbs
      actions={actions}
    />
  );
}
