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

export function DefectsCommandCentreWorkspace() {
  const w = useDefectsWorkspace();
  const showSkeleton = w.loading && !w.overview && !w.needsProjectSelection;
  const notConnected = w.projectsMeta && !w.projectsMeta.connected;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DefectsPageHeader w={w} />

      {w.error && <InlineAlert variant="error">{w.error}</InlineAlert>}

      {w.needsProjectSelection && (
        <InlineAlert variant="warning" title="Select an Azure project">
          <p className="mb-0">
            Your organization has multiple Azure DevOps projects. Choose a project from the header
            dropdown to load defects and user stories for that board.
          </p>
        </InlineAlert>
      )}

      {notConnected && (
        <InlineAlert variant="warning" title="Azure DevOps not connected">
          <p className="mb-3">
            Link Azure DevOps with Work Items scopes to see your assigned defects and user stories.
          </p>
          <Button size="sm" asChild>
            <Link href="/environment-center?tab=azure">Go to Azure Integrations</Link>
          </Button>
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
            search={w.search}
            selectedId={w.selectedId}
            assigneeEmail={w.overview?.assigneeEmail ?? null}
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
