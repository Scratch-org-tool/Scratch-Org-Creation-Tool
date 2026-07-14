'use client';

import { useRouter } from 'next/navigation';
import {
  Cloud,
  Database,
  ExternalLink,
  Eye,
  Rocket,
  Settings,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { GlassCard, StatusBadge } from '@/components/studio';
import {
  IntegrationsDataTable,
  IntegrationsTableHead,
  IntegrationsTd,
  IntegrationsTh,
} from '@/modules/environment-center/integrations/integrations-data-table';
import { getJobWorkspaceHref } from '@/lib/job-workspace-links';
import { cn } from '@/utils/cn';
import { formatDuration } from './format-utils';
import type { JobStatusFilter, MonitoringJobRow } from './types';
import type { LucideIcon } from 'lucide-react';

interface MonitoringJobsTableProps {
  jobs: MonitoringJobRow[];
  allJobsCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusFilter: JobStatusFilter;
  selectedJobId: string | null;
  selectedJob: MonitoringJobRow | null;
  onStatusFilterChange: (f: JobStatusFilter) => void;
  onPageChange: (p: number) => void;
  onSelectJob: (id: string | null) => void;
}

function jobIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes('scratch') || t.includes('org')) return Cloud;
  if (t.includes('deploy') || t.includes('metadata') || t.includes('azure') || t.includes('jenkins')) {
    return Rocket;
  }
  if (t.includes('data') || t.includes('sfdmu') || t.includes('replic')) return Database;
  if (t.includes('provision') || t.includes('user')) return Users;
  if (t.includes('setup')) return Settings;
  return Rocket;
}

export function MonitoringJobsTable({
  jobs,
  allJobsCount,
  page,
  pageSize,
  totalPages,
  statusFilter,
  selectedJobId,
  selectedJob,
  onStatusFilterChange,
  onPageChange,
  onSelectJob,
}: MonitoringJobsTableProps) {
  const router = useRouter();
  const start = allJobsCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, allJobsCount);
  const selectedWorkspaceHref = selectedJob ? getJobWorkspaceHref(selectedJob) : null;

  const handleRowClick = (job: MonitoringJobRow) => {
    const href = getJobWorkspaceHref(job);
    if (href) {
      router.push(href);
      return;
    }
    onSelectJob(job.id === selectedJobId ? null : job.id);
  };

  return (
    <GlassCard
      title="Recent Jobs"
      description="Live queue activity and job status"
      headerAction={
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as JobStatusFilter)}
          className="h-8 text-xs w-[130px]"
        >
          <option value="all">All status</option>
          <option value="completed">Success</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </Select>
      }
    >
      <IntegrationsDataTable maxHeight="max-h-[420px]">
        <IntegrationsTableHead>
          <IntegrationsTh>Job name</IntegrationsTh>
          <IntegrationsTh>Type</IntegrationsTh>
          <IntegrationsTh>Status</IntegrationsTh>
          <IntegrationsTh>Duration</IntegrationsTh>
          <IntegrationsTh className="hidden md:table-cell">Completed at</IntegrationsTh>
          <IntegrationsTh className="hidden lg:table-cell">Triggered by</IntegrationsTh>
          <IntegrationsTh className="w-8"><span className="sr-only">Selected</span></IntegrationsTh>
        </IntegrationsTableHead>
        <tbody>
          {jobs.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                No jobs match this filter.
              </td>
            </tr>
          )}
          {jobs.map((job) => {
            const Icon = jobIcon(job.type);
            const selected = job.id === selectedJobId;
            const workspaceHref = getJobWorkspaceHref(job);
            return (
              <tr
                key={job.id}
                onClick={() => handleRowClick(job)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(job);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  'border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer',
                  selected && !workspaceHref && 'border-l-2 border-l-primary bg-primary/5',
                )}
              >
                <IntegrationsTd>
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{job.displayName}</span>
                  </div>
                </IntegrationsTd>
                <IntegrationsTd className="text-muted-foreground capitalize">
                  {job.type.replace(/_/g, ' ')}
                </IntegrationsTd>
                <IntegrationsTd>
                  <StatusBadge status={job.status} />
                </IntegrationsTd>
                <IntegrationsTd className="tabular-nums text-muted-foreground">
                  {formatDuration(job.durationMs)}
                </IntegrationsTd>
                <IntegrationsTd className="hidden md:table-cell text-muted-foreground text-xs">
                  {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
                </IntegrationsTd>
                <IntegrationsTd className="hidden lg:table-cell text-muted-foreground text-xs truncate max-w-[140px]">
                  {job.triggeredBy}
                </IntegrationsTd>
                <IntegrationsTd className="w-8 text-right">
                  {workspaceHref ? (
                    <ExternalLink className="w-3.5 h-3.5 text-primary inline-block" aria-hidden />
                  ) : (
                    selected && (
                      <Eye className="w-3.5 h-3.5 text-primary inline-block" aria-hidden />
                    )
                  )}
                </IntegrationsTd>
              </tr>
            );
          })}
        </tbody>
      </IntegrationsDataTable>

      {selectedJob && !selectedWorkspaceHref && (
        <div className="mt-4 rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Selected job</p>
              <p className="font-medium truncate">{selectedJob.displayName}</p>
            </div>
            <StatusBadge status={selectedJob.status} />
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd className="capitalize">{selectedJob.type.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Queue</dt>
              <dd className="capitalize">{selectedJob.queue.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Duration</dt>
              <dd className="tabular-nums">{formatDuration(selectedJob.durationMs)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Started at</dt>
              <dd className="text-xs">
                {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Triggered by</dt>
              <dd className="text-xs truncate">{selectedJob.triggeredBy}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-2 border-t border-border/60 text-xs text-muted-foreground">
        <span>
          Showing {start} to {end} of {allJobsCount} jobs
        </span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
