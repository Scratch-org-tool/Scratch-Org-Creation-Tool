'use client';

import { Users } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';

export function OrgSetupPageHeader() {
  return (
    <DeploymentPageHeader
      title="Org & Users"
      subtitle="Baseline org setup, org config, and user provisioning in one workspace."
      icon={Users}
      accentClass="to-amber-500/10"
      showBreadcrumbs
    />
  );
}
