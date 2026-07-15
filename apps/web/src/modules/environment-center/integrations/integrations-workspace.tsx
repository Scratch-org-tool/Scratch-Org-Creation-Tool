'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { RefreshCw, Rocket, Cloud, GitBranch, BriefcaseBusiness, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ConfirmBanner,
  InlineAlert,
  PageSkeleton,
  StatCard,
  StatCardGrid,
} from '@/components/studio';
import { Skeleton } from '@/components/ui/skeleton';
import { activateTabFromKey } from '@/components/ui/tab-keyboard';
import { cn } from '@/utils/cn';
import { IntegrationsPageHeader } from './integrations-page-header';
import { SalesforceIntegrationPanel } from './salesforce-integration-panel';
import {
  SourceControlIntegrationPanel,
  WorkManagementIntegrationPanel,
} from './provider-integrations-panel';
import { ScratchOrgCredentialsDrawer } from './scratch-org-credentials-drawer';
import { useIntegrationsWorkspace } from './use-integrations-workspace';
import { useProviderIntegrations } from './use-provider-integrations';

function TabButton({
  active,
  onClick,
  children,
  badge,
  id,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
  id: string;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={activateTabFromKey}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/25',
      )}
    >
      {children}
      {badge}
    </button>
  );
}

function IntegrationsWorkspaceInner() {
  const w = useIntegrationsWorkspace();
  const providerState = useProviderIntegrations();
  const showDataSkeleton = w.initialLoading;

  const copyAll = () => {
    if (!w.credentials) return;
    const lines = [
      `Alias: ${w.credentials.alias}`,
      `Username: ${w.credentials.username}`,
      w.credentials.password ? `Password: ${w.credentials.password}` : 'Password: (not available)',
      `Org Id: ${w.credentials.orgId ?? ''}`,
      `Instance URL: ${w.credentials.instanceUrl ?? ''}`,
      `Login URL: ${w.credentials.loginUrl ?? ''}`,
      `Expires: ${w.credentials.expirationDate ? new Date(w.credentials.expirationDate).toLocaleString() : ''}`,
      `Dev Hub: ${w.credentials.devHubAlias ?? ''}`,
    ];
    void w.copyText('all', lines.join('\n'));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <IntegrationsPageHeader
        actions={
          <>
            <Button variant="outline" onClick={() => void w.refreshAll({ manual: true })} loading={w.refreshing}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Link
              href="/environment-center/create-scratch-org"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm font-medium"
            >
              <Rocket className="w-4 h-4" />
              Create Scratch Org
            </Link>
          </>
        }
      />

      <StatCardGrid cols={4}>
        {showDataSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Connected Orgs" value={w.orgs.length} icon={Cloud} iconClass="text-cyan-400" />
            <StatCard label="Dev Hubs" value={w.devHubCount} icon={Star} iconClass="text-amber-400" />
            <StatCard label="Scratch Orgs" value={w.scratchOrgs.length} icon={Rocket} iconClass="text-violet-400" />
            <StatCard
              label="Source Control"
              value="3 providers"
              icon={GitBranch}
              iconClass="text-blue-400"
            />
          </>
        )}
      </StatCardGrid>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Environment Center">
        <TabButton
          id="environment-tab-salesforce"
          controls="environment-panel-salesforce"
          active={w.activeTab === 'salesforce'}
          onClick={() => w.setTab('salesforce')}
          badge={
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/80">
              {w.orgs.length + w.scratchOrgs.length}
            </span>
          }
        >
          Salesforce
        </TabButton>
        <TabButton
          id="environment-tab-source-control"
          controls="environment-panel-source-control"
          active={w.activeTab === 'source-control'}
          onClick={() => w.setTab('source-control')}
        >
          <GitBranch className="w-3.5 h-3.5" />
          Source Control
        </TabButton>
        <TabButton
          id="environment-tab-work-management"
          controls="environment-panel-work-management"
          active={w.activeTab === 'work-management'}
          onClick={() => w.setTab('work-management')}
        >
          <BriefcaseBusiness className="w-3.5 h-3.5" />
          Work Management
        </TabButton>
      </div>

      {w.error && (
        <InlineAlert variant="error" onDismiss={() => w.setError(null)}>
          {w.error}
        </InlineAlert>
      )}

      {w.pendingDisconnect && (
        <ConfirmBanner
          title={`Disconnect "${w.pendingDisconnect}"?`}
          message="This removes the org from this app and logs out local Salesforce CLI auth."
          confirmLabel="Disconnect"
          loading={w.disconnectingAlias === w.pendingDisconnect}
          onConfirm={() => void w.disconnectOrg(w.pendingDisconnect!)}
          onCancel={() => w.setPendingDisconnect(null)}
        />
      )}

      {w.pendingScratchDelete && (
        <ConfirmBanner
          title={`Delete "${w.pendingScratchDelete}"?`}
          message="This permanently deletes the scratch org in Salesforce and removes it from this app."
          confirmLabel="Delete"
          variant="error"
          loading={w.deletingScratchAlias === w.pendingScratchDelete}
          onConfirm={() => void w.deleteScratchOrg(w.pendingScratchDelete!)}
          onCancel={() => w.setPendingScratchDelete(null)}
        />
      )}

      <div
        role="tabpanel"
        id={`environment-panel-${w.activeTab}`}
        aria-labelledby={`environment-tab-${w.activeTab}`}
        tabIndex={0}
      >
        {showDataSkeleton ? (
          <Skeleton className="h-[480px] w-full rounded-xl" />
        ) : w.activeTab === 'salesforce' ? (
          <SalesforceIntegrationPanel w={w} />
        ) : w.activeTab === 'source-control' ? (
          <SourceControlIntegrationPanel initialProvider={w.sourceProvider} state={providerState} />
        ) : (
          <WorkManagementIntegrationPanel state={providerState} />
        )}
      </div>

      <ScratchOrgCredentialsDrawer
        alias={w.credentialsAlias}
        credentials={w.credentials}
        loading={w.loadingCreds}
        regenerating={w.regenerating}
        copiedField={w.copiedField}
        onClose={w.closeCredentials}
        onCopy={(field, text) => void w.copyText(field, text)}
        onRegenerate={() => void w.regeneratePassword()}
        onCopyAll={copyAll}
      />
    </div>
  );
}

export function IntegrationsWorkspace() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <IntegrationsWorkspaceInner />
    </Suspense>
  );
}
