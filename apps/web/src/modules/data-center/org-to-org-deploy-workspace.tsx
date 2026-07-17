'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, History, Rocket } from 'lucide-react';
import {
  DeploymentPageHeader,
  PageSkeleton,
  TabbedWorkspaceShell,
  type WorkspaceTab,
} from '@/components/studio';
import { OrgToOrgDeployPanel } from './org-to-org-deploy-panel';
import { OrgToOrgHistoryPanel } from './org-to-org-history-panel';

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
      <div hidden={view !== 'new'}>
        <OrgToOrgDeployPanel />
      </div>
      <div hidden={view !== 'history'}>
        <OrgToOrgHistoryPanel />
      </div>
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
