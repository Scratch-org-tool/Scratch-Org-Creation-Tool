'use client';

import { Suspense, useMemo } from 'react';
import { DatabaseZap, FileSpreadsheet, Settings, Users } from 'lucide-react';
import { PageSkeleton, TabbedWorkspaceShell, type WorkspaceTab } from '@/components/studio';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule } from '@/lib/auth-utils';
import { OrgSetupPageHeader } from './org-setup-page-header';
import { BaselineSetupPanel } from './baseline-setup-panel';
import { LoadOrgConfigPanel } from './load-org-config-panel';
import { UsersCsvPanel } from './users-csv-panel';
import { useOrgSetupWorkspace } from './use-org-setup-workspace';
import { ConaUserProvisioningForm } from '@/modules/provisioning/cona-user-provisioning-form';
import type { OrgSetupTab } from './types';

const ALL_TABS: (WorkspaceTab & { module: 'org-setup' | 'provisioning' })[] = [
  {
    id: 'baseline',
    label: 'Baseline setup',
    icon: Settings,
    module: 'org-setup',
    title: 'Baseline setup',
    description: 'Permission sets and theme for the target org.',
  },
  {
    id: 'load-config',
    label: 'Org config',
    icon: DatabaseZap,
    module: 'org-setup',
    title: 'Org config',
    description: 'Upsert OnboardingConfig__c queue IDs, domain URLs, and request ID prefix.',
  },
  {
    id: 'users-cona',
    label: 'CONA users',
    icon: Users,
    module: 'provisioning',
    title: 'CONA onboarding users',
    description: 'Discover picklists and provision users with roles and modules.',
  },
  {
    id: 'users-csv',
    label: 'CSV bulk',
    icon: FileSpreadsheet,
    module: 'provisioning',
    title: 'CSV bulk upload',
    description: 'Import users from a CSV file with profiles and permission sets.',
  },
];

function OrgSetupWorkspaceInner() {
  const w = useOrgSetupWorkspace();
  const { profile } = useAuth();

  const tabs = useMemo(
    () =>
      ALL_TABS.filter((t) =>
        t.module === 'org-setup'
          ? canAccessModule(profile, 'org-setup')
          : canAccessModule(profile, 'provisioning'),
      ),
    [profile],
  );

  const activeTab = tabs.some((t) => t.id === w.activeTab)
    ? w.activeTab
    : (tabs[0]?.id as OrgSetupTab | undefined) ?? 'baseline';

  return (
    <TabbedWorkspaceShell
      header={<OrgSetupPageHeader />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => w.setTab(id as OrgSetupTab)}
    >
      <div hidden={activeTab !== 'baseline'}>
        <BaselineSetupPanel w={w} />
      </div>
      <div hidden={activeTab !== 'load-config'}>
        <LoadOrgConfigPanel w={w} />
      </div>
      <div hidden={activeTab !== 'users-cona'}>
        <ConaUserProvisioningForm embedded />
      </div>
      <div hidden={activeTab !== 'users-csv'}>
        <UsersCsvPanel w={w} />
      </div>
    </TabbedWorkspaceShell>
  );
}

export function OrgSetupWorkspace() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgSetupWorkspaceInner />
    </Suspense>
  );
}
