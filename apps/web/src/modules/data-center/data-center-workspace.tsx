'use client';

import { Suspense } from 'react';
import { Database, FileCode, RefreshCw, Sprout } from 'lucide-react';
import { PageSkeleton, TabbedWorkspaceShell, type WorkspaceTab } from '@/components/studio';
import { DataCenterPageHeader } from './data-center-page-header';
import { ConaSeedDeploymentForm } from './cona-seed-deployment-form';
import { GenericDeployPanel } from './generic-deploy-panel';
import { ReplicationPanel } from './replication-panel';
import { QueryTemplatesPanel } from './query-templates-panel';
import { useDataCenterWorkspace } from './use-data-center-workspace';
import type { DataCenterTab } from './types';

const TABS: WorkspaceTab[] = [
  {
    id: 'cona',
    label: 'CONA seed',
    icon: Sprout,
    title: 'CONA Data Seed',
    description:
      'Validate, export, and import onboarding config, products, visit plans, and account slices using dynamic SOQL.',
  },
  {
    id: 'deploy',
    label: 'Generic deploy',
    icon: Database,
    title: 'Generic SOQL deploy',
    description: 'Bulk export/import records between orgs with optional SOQL.',
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
      <div hidden={w.activeTab !== 'deploy'}>
        <GenericDeployPanel />
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
