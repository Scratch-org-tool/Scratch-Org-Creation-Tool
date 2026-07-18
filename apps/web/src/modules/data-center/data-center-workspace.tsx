'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { FileCode, FileSpreadsheet, RefreshCw, Sprout, UsersRound } from 'lucide-react';
import {
  LazyTabPanel,
  PageSkeleton,
  TabbedWorkspaceShell,
  type WorkspaceTab,
} from '@/components/studio';
import { DataCenterPageHeader } from './data-center-page-header';
import { ConaSeedDeploymentForm } from './cona-seed-deployment-form';
import { useDataCenterWorkspace } from './use-data-center-workspace';
import type { DataCenterTab } from './types';

// Non-default tabs are code-split and mounted on first visit only. Mounting
// all panels eagerly made every visit pay for every panel's JavaScript,
// effects, and org fetches.
const BulkDataUpdatePanel = dynamic(
  () => import('./bulk-data-update-panel').then((m) => m.BulkDataUpdatePanel),
  { ssr: false, loading: () => <PageSkeleton /> },
);
const AccountPartnersPanel = dynamic(
  () => import('./account-partners-panel').then((m) => m.AccountPartnersPanel),
  { ssr: false, loading: () => <PageSkeleton /> },
);
const ReplicationPanel = dynamic(
  () => import('./replication-panel').then((m) => m.ReplicationPanel),
  { ssr: false, loading: () => <PageSkeleton /> },
);
const QueryTemplatesPanel = dynamic(
  () => import('./query-templates-panel').then((m) => m.QueryTemplatesPanel),
  { ssr: false, loading: () => <PageSkeleton /> },
);

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
    id: 'bulk-update',
    label: 'Bulk Data Updating',
    icon: FileSpreadsheet,
    title: 'Bulk Data Updating',
    description:
      'Match spreadsheet rows to existing org records and update only reviewed field differences.',
  },
  {
    id: 'account-partners',
    label: 'Account Partners',
    icon: UsersRound,
    title: 'Account Partner Migration',
    description:
      'Map source Account Partner query results to existing target Accounts and Employee Masters.',
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
      <LazyTabPanel active={w.activeTab === 'cona'}>
        <ConaSeedDeploymentForm embedded />
      </LazyTabPanel>
      <LazyTabPanel active={w.activeTab === 'bulk-update'}>
        <BulkDataUpdatePanel />
      </LazyTabPanel>
      <LazyTabPanel active={w.activeTab === 'account-partners'}>
        <AccountPartnersPanel />
      </LazyTabPanel>
      <LazyTabPanel active={w.activeTab === 'replication'}>
        <ReplicationPanel />
      </LazyTabPanel>
      <LazyTabPanel active={w.activeTab === 'templates'}>
        <QueryTemplatesPanel />
      </LazyTabPanel>
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
