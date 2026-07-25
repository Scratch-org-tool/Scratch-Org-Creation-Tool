'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileJson, ListChecks, ScrollText } from 'lucide-react';
import { InlineAlert } from '@/components/studio';
import { Skeleton } from '@/components/ui/skeleton';
import { JobDetailLogs } from './job-detail-logs';
import { JobDetailReportButton } from './job-detail-report';
import { JobDetailStopButton } from './job-detail-stop-button';
import { JobDetailSummary } from './job-detail-summary';
import { useJobDetail } from './use-job-detail';
import { formatDuration } from './format-utils';
import { cn } from '@/utils/cn';

type DetailTab = 'summary' | 'logs' | 'details';

const TABS: Array<{ id: DetailTab; label: string; icon: typeof ListChecks }> = [
  { id: 'summary', label: 'Summary', icon: ListChecks },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'details', label: 'Details', icon: FileJson },
];

export function JobDetailWorkspace({ jobId }: { jobId: string }) {
  const { detail, loading, error, canStop, stopping, stop } = useJobDetail(jobId);
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Link href="/monitoring" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Monitoring
        </Link>
        <InlineAlert variant="error">{error ?? 'Job not found'}</InlineAlert>
      </div>
    );
  }

  const { job, deployment, audits, automationRun, siblingJobs } = detail;

  return (
    <div id="job-detail-report" className="p-4 md:p-6 space-y-5 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href="/monitoring" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Monitoring
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canStop && (
            <JobDetailStopButton
              compact
              stopping={stopping}
              onStop={stop}
            />
          )}
          <JobDetailReportButton />
        </div>
      </div>

      <JobDetailSummary detail={detail} canStop={canStop} stopping={stopping} onStop={stop} />

      <div className="flex flex-wrap gap-2 no-print">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              activeTab === tab.id
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/25',
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'logs' ? ` (${job.logCount})` : ''}
          </button>
        ))}
      </div>

      {(activeTab === 'summary' || activeTab === 'logs') && (
        <div className={cn('space-y-4', activeTab !== 'summary' && 'hidden print:block')}>
          <div className="rounded-xl border border-border/60 bg-card/60 p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Job name</p>
              <p className="font-medium">{job.alias ?? job.type.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Queue</p>
              <p className="font-medium capitalize">{job.queue.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current step</p>
              <p className="font-medium">{job.currentStep}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Triggered by</p>
              <p className="font-medium">{automationRun?.createdBy ?? job.createdBy}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Started at</p>
              <p className="font-medium">{job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed at</p>
              <p className="font-medium">{job.finishedAt ? new Date(job.finishedAt).toLocaleString() : '—'}</p>
            </div>
            {deployment && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Repository</p>
                  <p className="font-medium">{deployment.repo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Branch</p>
                  <p className="font-medium">{deployment.branch}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Strategy</p>
                  <p className="font-medium capitalize">{deployment.strategy}</p>
                </div>
              </>
            )}
          </div>

          {siblingJobs.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <h2 className="text-sm font-semibold mb-3">Pipeline steps</h2>
              <div className="space-y-2">
                {siblingJobs.map((step) => (
                  <div key={step.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <span>{step.alias ?? step.type.replace(/_/g, ' ')}</span>
                    <span className="capitalize text-muted-foreground">{step.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audits.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <h2 className="text-sm font-semibold mb-3">Deployment audit</h2>
              <div className="space-y-2 text-sm">
                {audits.map((audit) => (
                  <div key={audit.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <span className="capitalize">{audit.action.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground">{audit.status}</span>
                    <span className="text-muted-foreground">
                      {audit.componentCount ?? 0} components
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(audit.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'logs' || activeTab === 'summary') && (
        <div className={cn(activeTab !== 'logs' && 'hidden print:block')}>
          <JobDetailLogs
            logs={job.logs}
            logsTruncated={job.logsTruncated}
            logCount={job.logCount}
            live={job.status === 'running' || job.status === 'queued' || job.status === 'pending'}
          />
        </div>
      )}

      {activeTab === 'details' && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-5">
          <h2 className="text-sm font-semibold mb-3">Raw payload</h2>
          <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs font-mono text-green-200">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
          {job.durationMs != null && (
            <p className="text-xs text-muted-foreground mt-3">
              Duration: {formatDuration(job.durationMs)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
