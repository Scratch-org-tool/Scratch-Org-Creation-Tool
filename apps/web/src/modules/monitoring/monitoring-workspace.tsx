'use client';

import { InlineAlert } from '@/components/studio';
import { Skeleton } from '@/components/ui/skeleton';
import { MonitoringJobsTable } from './monitoring-jobs-table';
import { MonitoringPageHeader } from './monitoring-page-header';
import { MonitoringStatCards } from './monitoring-stat-cards';
import { useMonitoringWorkspace } from './use-monitoring-workspace';

export function MonitoringWorkspace() {
  const {
    days,
    setDays,
    overview,
    loading,
    refreshing,
    error,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    pageSize,
    totalPages,
    filteredJobs,
    paginatedJobs,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    refresh,
  } = useMonitoringWorkspace();

  const showDataSkeleton = loading && !overview;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <MonitoringPageHeader
        days={days}
        onDaysChange={setDays}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      <MonitoringStatCards data={overview} days={days} loading={showDataSkeleton} />

      {showDataSkeleton ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      ) : (
        <MonitoringJobsTable
          jobs={paginatedJobs}
          allJobsCount={filteredJobs.length}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          statusFilter={statusFilter}
          selectedJob={selectedJob}
          selectedJobId={selectedJobId}
          onStatusFilterChange={setStatusFilter}
          onPageChange={setPage}
          onSelectJob={setSelectedJobId}
        />
      )}
    </div>
  );
}
