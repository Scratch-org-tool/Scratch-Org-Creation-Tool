'use client';

import { Settings2 } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/utils/cn';

interface CustomSettingsPageHeaderProps {
  sfdmuInstalled: boolean | null;
  sfdmuVersion?: string;
}

function SfdmuStatusChip({
  installed,
  version,
}: {
  installed: boolean | null;
  version?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border',
        installed === true
          ? 'bg-green-500/10 text-green-400 border-green-500/20'
          : installed === false
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-secondary/50 text-muted-foreground border-border/60',
      )}
    >
      {installed === null && <Spinner size="sm" />}
      {installed === true
        ? `SFDMU${version ? ` ${version}` : ''} ready`
        : installed === false
          ? 'Plugin setup failed'
          : 'Checking SFDMU…'}
    </span>
  );
}

export function CustomSettingsPageHeader({
  sfdmuInstalled,
  sfdmuVersion,
}: CustomSettingsPageHeaderProps) {
  return (
    <DeploymentPageHeader
      title="Custom Settings Load"
      subtitle="Run SFDMU to copy custom settings from a source org to a target org."
      icon={Settings2}
      accentClass="to-teal-500/10"
      showBreadcrumbs
      actions={<SfdmuStatusChip installed={sfdmuInstalled} version={sfdmuVersion} />}
    />
  );
}
