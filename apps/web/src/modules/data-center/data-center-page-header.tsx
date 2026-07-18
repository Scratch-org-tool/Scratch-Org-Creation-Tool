'use client';

import { Database } from 'lucide-react';
import { DeploymentPageHeader } from '@/components/studio';

export function DataCenterPageHeader() {
  return (
    <DeploymentPageHeader
      title="Data Operations"
      subtitle="Spreadsheet updates, CONA seed, Account Partner mapping, replication, and query templates."
      icon={Database}
      accentClass="to-green-500/10"
      showBreadcrumbs
    />
  );
}
