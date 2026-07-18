'use client';

import { Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, History, Rocket } from 'lucide-react';
import {
  DeploymentPageHeader,
  LazyTabPanel,
  PageSkeleton,
  TabbedWorkspaceShell,
  type WorkspaceTab,
} from '@/components/studio';
import { OrgToOrgDeployPanel } from './org-to-org-deploy-panel';

// History is code-split and only loaded once its tab is opened, so the main
// deployment flow ships less JavaScript and skips the history fetch/polling.
const OrgToOrgHistoryPanel = dynamic(
  () => import('./org-to-org-history-panel').then((m) => m.OrgToOrgHistoryPanel),
  { ssr: false, loading: () => <PageSkeleton /> },
);

type DataDeployView = 'new' | 'history';

const TABS: WorkspaceTab[] = [
  {
    id: 'new',
    label: 'New deployment',
    icon: Rocket,
    title: 'Deploy records between orgs',
    description:
      'Pick objects, filter records, compare against the target, then insert or upsert in dependency order — scratch orgs supported as source.',
  },
  {
    id: 'history',
    label: 'History',
    icon: History,
    title: 'Deployment history',
    description: 'Track, cancel, and roll back previous org-to-org data deployments.',
  },
];

function parseView(param: string | null): DataDeployView {
  return param === 'history' ? 'history' : 'new';
}

function OrgToOrgDeployWorkspaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get('view'));

  const setView = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'new') params.delete('view');
      else params.set('view', next);
      const qs = params.toString();
      router.replace(qs ? `/data-deploy?${qs}` : '/data-deploy', { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <TabbedWorkspaceShell
      header={
        <DeploymentPageHeader
          title="Data Deployment"
          subtitle="Compare source vs target records and move data between Salesforce orgs safely."
          icon={ArrowLeftRight}
          accentClass="to-indigo-500/10"
          showBreadcrumbs
        />
      }
      tabs={TABS}
      activeTab={view}
      onTabChange={setView}
    >
      <LazyTabPanel active={view === 'new'}>
        <OrgToOrgDeployPanel />
      </LazyTabPanel>
      <LazyTabPanel active={view === 'history'}>
        <OrgToOrgHistoryPanel />
      </LazyTabPanel>
    </TabbedWorkspaceShell>
  );
}

export function OrgToOrgDeployWorkspace() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgToOrgDeployWorkspaceInner />
    </Suspense>
  );
}
