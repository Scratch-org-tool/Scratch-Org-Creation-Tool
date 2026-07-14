'use client';

import { Settings2 } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';

interface CustomSettingsPageHeaderProps {
  sfdmuInstalled: boolean | null;
}

function SfdmuStatusChip({ installed }: { installed: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border',
        installed
          ? 'bg-green-500/10 text-green-400 border-green-500/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      )}
    >
      {installed ? 'SFDMU ready' : 'Plugin missing'}
    </span>
  );
}

export function CustomSettingsPageHeader({ sfdmuInstalled }: CustomSettingsPageHeaderProps) {
  return (
    <DeploymentPageHeader
      title="Custom Settings Load"
      subtitle="Run SFDMU to copy custom settings from a source org to a target org."
      icon={Settings2}
      accentClass="to-teal-500/10"
      showBreadcrumbs
      actions={
        sfdmuInstalled !== null ? (
          <SfdmuStatusChip installed={sfdmuInstalled} />
        ) : undefined
      }
    />
  );
}
