'use client';

import { Database } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';

export function DataCenterPageHeader() {
  return (
    <DeploymentPageHeader
      title="Data Operations"
      subtitle="CONA seed, Account Partner mapping, replication, and query templates — all in one workspace."
      icon={Database}
      accentClass="to-green-500/10"
      showBreadcrumbs
    />
  );
}
