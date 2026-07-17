'use client';

import { Suspense } from 'react';
import { FileCode, RefreshCw, Sprout } from 'lucide-react';
import { PageSkeleton, TabbedWorkspaceShell, type WorkspaceTab } from '@/components/studio';
import { DataCenterPageHeader } from './data-center-page-header';
import { ConaSeedDeploymentForm } from './cona-seed-deployment-form';
import { ReplicationPanel } from './replication-panel';
import { QueryTemplatesPanel } from './query-templates-panel';
import { useDataCenterWorkspace } from './use-data-center-workspace';
import type { DataCenterTab } from './types';

// Org-to-org record deployment (the old "Generic deploy" tab) lives in the
// Deployment Workbench data flow now — Data Operations keeps only the jobs
// that are NOT plain org-to-org record moves.
const TABS: WorkspaceTab[] = [
  {
    id: 'cona',
    label: 'CONA seed',
    icon: Sprout,
    title: 'CONA Data Seed',
    description:
      'Validate, export, and import onboarding data with guided Account filters or manual SOQL.',
  },
  {
    id: 'replication',
    label: 'Replication',
    icon: RefreshCw,
    title: 'Data replication',
    description: 'Replicate onboarding configurations between orgs.',
  },
  {
    id: 'templates',
    label: 'Query templates',
    icon: FileCode,
    title: 'Query templates',
    description: 'Reusable SOQL query templates for data jobs.',
  },
];

function DataCenterWorkspaceInner() {
  const w = useDataCenterWorkspace();

  return (
    <TabbedWorkspaceShell
      header={<DataCenterPageHeader />}
      tabs={TABS}
      activeTab={w.activeTab}
      onTabChange={(id) => w.setTab(id as DataCenterTab)}
    >
      <div hidden={w.activeTab !== 'cona'}>
        <ConaSeedDeploymentForm embedded />
      </div>
      <div hidden={w.activeTab !== 'replication'}>
        <ReplicationPanel />
      </div>
      <div hidden={w.activeTab !== 'templates'}>
        <QueryTemplatesPanel />
      </div>
    </TabbedWorkspaceShell>
  );
}

export function DataCenterWorkspace() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DataCenterWorkspaceInner />
    </Suspense>
  );
}
