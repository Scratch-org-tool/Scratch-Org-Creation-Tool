'use client';

import { Users } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';

export function ProvisioningPageHeader() {
  return (
    <DeploymentPageHeader
      title="User Provisioning"
      subtitle="CONA onboarding users from org picklists, or generic CSV bulk import."
      icon={Users}
      accentClass="to-indigo-500/10"
      showBreadcrumbs
    />
  );
}
