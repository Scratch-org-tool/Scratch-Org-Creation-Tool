'use client';

import Link from 'next/link';
import { InlineAlert } from '@/components/studio';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DefectDetailPanel } from './defect-detail-panel';
import { DefectsPageHeader } from './defects-page-header';
import { DefectsStatCards } from './defects-stat-cards';
import { DefectsWorkItemsTable } from './defects-work-items-table';
import { useDefectsWorkspace } from './use-defects-workspace';
import { providerLabel, providerSetupHref } from './work-item-contracts';

export function DefectsCommandCentreWorkspace() {
  const w = useDefectsWorkspace();
  const showSkeleton = w.loading && !w.overview && !w.needsProjectSelection;
  const notConnected = !w.contextsLoading && !w.connected && !w.setupError;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <p className="sr-only" role="status" aria-live="polite">{w.optimisticAnnouncement}</p>
      <DefectsPageHeader w={w} />

      {w.error && <InlineAlert variant="error">{w.error}</InlineAlert>}

      {w.needsProjectSelection && (
        <InlineAlert variant="warning" title={`Select a ${providerLabel(w.provider)} project`}>
          <p className="mb-0">
            Choose a project from the header to load its supported work items.
          </p>
        </InlineAlert>
      )}

      {w.setupError && (
        <InlineAlert
          variant="warning"
          title={
            w.setupError.code === 'EXTERNAL_IDENTITY_NOT_BOUND'
              ? 'Provider identity setup required'
              : `${providerLabel(w.provider)} setup required`
          }
        >
          <p className="mb-3">{w.setupError.message}</p>
          <p className="mb-3 text-sm">
            {w.setupError.code === 'EXTERNAL_IDENTITY_NOT_BOUND' && !w.contexts?.isAdmin
              ? 'Ask an administrator to bind your app account to your provider identity for this connection.'
              : 'Configure a connected work-item connection and ProjectBinding.'}
          </p>
          {w.contexts?.isAdmin && (
            <Button size="sm" asChild>
              <Link href={providerSetupHref(w.provider)}>Open integration setup</Link>
            </Button>
          )}
        </InlineAlert>
      )}

      {notConnected && (
        <InlineAlert variant="warning" title={`${providerLabel(w.provider)} not connected`}>
          <p className="mb-3">
            Connect this provider with work-item scopes to load projects and issues.
          </p>
          {w.contexts?.isAdmin && (
            <Button size="sm" asChild>
              <Link href={providerSetupHref(w.provider)}>Open integration setup</Link>
            </Button>
          )}
        </InlineAlert>
      )}

      <DefectsStatCards data={w.overview} loading={showSkeleton} />

      {showSkeleton ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-[560px] w-full rounded-xl" />
          <Skeleton className="h-[560px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <DefectsWorkItemsTable
            items={w.items}
            total={w.total}
            page={w.page}
            pageSize={w.pageSize}
            totalPages={w.totalPages}
            statusFilter={w.statusFilter}
            typeFilter={w.typeFilter}
            issueTypes={w.issueTypes}
            search={w.search}
            selectedId={w.selectedId}
            assigneeId={w.overview?.assigneeExternalId ?? null}
            projectName={w.selectedProject || w.overview?.project || null}
            isAdminView={w.overview?.isAdminView ?? false}
            onStatusFilterChange={w.setStatusFilter}
            onTypeFilterChange={w.setTypeFilter}
            onSearchChange={w.setSearch}
            onPageChange={w.setPage}
            onSelect={w.selectWorkItem}
          />
          <DefectDetailPanel w={w} />
        </div>
      )}
    </div>
  );
}
