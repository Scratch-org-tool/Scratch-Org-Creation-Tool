'use client';

import { Button } from '@/components/ui/button';
import { GlassCard, InlineAlert, PageSkeleton } from '@/components/studio';
import { cn } from '@/utils/cn';
import { MetadataCompareSetup } from './metadata-compare-setup';
import { MetadataCompareSidebar } from './metadata-compare-sidebar';
import { MetadataDiffFilters } from './metadata-diff-filters';
import { MetadataCompareTable } from './metadata-compare-table';
import { MetadataItemDiffPanel } from './metadata-item-diff-panel';
import { MetadataProblemAnalysis } from './metadata-problem-analysis';
import { MetadataDeploySummary } from './metadata-deploy-summary';
import { MetadataDeploySuccess } from './metadata-deploy-success';
import { MetadataPageHeader } from './metadata-page-header';
import { MetadataCompareKpis } from './metadata-compare-kpis';
import { MetadataDeployStatus } from './metadata-deploy-status';
import { MetadataDeploymentHistory } from './metadata-deployment-history';
import { MetadataDeployConsole } from './metadata-deploy-console';
import { useMetadataDeployment } from './use-metadata-deployment';

export function MetadataDeploymentWorkspace() {
  const w = useMetadataDeployment();
  const showDataSkeleton = w.loading;

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-0 flex flex-col">
      <MetadataPageHeader phase={w.phase} />

      <div className="flex flex-wrap gap-2">
        <TabButton active={w.tab === 'compare'} onClick={() => w.setTab('compare')}>
          Compare and deploy
        </TabButton>
        <TabButton active={w.tab === 'history'} onClick={() => w.setTab('history')}>
          Deployment history
        </TabButton>
        <TabButton active={false} disabled>
          Saved pairs (soon)
        </TabButton>
      </div>

      {showDataSkeleton ? (
        <PageSkeleton variant="studio-2row" />
      ) : (
        <>
      {w.error && (
        <InlineAlert variant="error" onDismiss={() => w.setError(null)}>
          {w.error}
        </InlineAlert>
      )}

      {w.fieldWarning && (
        <InlineAlert variant="warning" onDismiss={() => w.setFieldWarning(null)}>
          {w.fieldWarning}
        </InlineAlert>
      )}

      {w.tab !== 'history' && <MetadataDeployStatus w={w} />}

      {w.tab === 'history' ? (
        <div className="space-y-5">
          <MetadataDeploymentHistory w={w} />
          {w.activeDeploymentId && (
            <MetadataDeployConsole
              jobStatus={w.jobStatus}
              currentStep={w.currentStep}
              logs={w.logs}
              logStreams={w.logStreams}
              loadingLogs={!!w.selectingDeploymentId}
              logsTruncated={w.logsTruncated}
              logCount={w.logCount}
              error={w.error}
              onClose={w.closeHistoryLogs}
            />
          )}
        </div>
      ) : (
        <>
          {(w.phase === 'compare' || w.summary) && w.phase !== 'setup' && (
            <MetadataCompareKpis w={w} />
          )}

          {w.phase === 'setup' && <MetadataCompareSetup w={w} />}

          {w.phase === 'compare' && (
            <GlassCard title="Comparison results" description="Filter by type and difference, select items to deploy.">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <MetadataDiffFilters w={w} />
                  <input
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs w-full sm:w-48"
                    placeholder="Search items…"
                    value={w.search}
                    onChange={(e) => { w.setSearch(e.target.value); w.setPage(1); }}
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-3 min-h-0">
                  <MetadataCompareSidebar w={w} />
                  <div className="flex-1 min-w-0 space-y-3">
                    <MetadataCompareTable w={w} />
                    <MetadataItemDiffPanel w={w} />
                  </div>
                </div>
              </div>
              <StickyFooter w={w} />
            </GlassCard>
          )}

          {w.phase === 'analysis' && (
            <GlassCard title="Problem analysis">
              <MetadataProblemAnalysis w={w} />
              <StickyFooter w={w} showBackToCompare />
            </GlassCard>
          )}

          {(w.phase === 'summary' || w.phase === 'deploying') && (
            <GlassCard title="Pre-deployment summary">
              <MetadataDeploySummary w={w} />
              {w.phase === 'summary' && <StickyFooter w={w} showBackToAnalysis />}
            </GlassCard>
          )}

          {w.phase === 'success' && (
            <GlassCard>
              <MetadataDeploySuccess w={w} />
            </GlassCard>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-xs px-3 py-1.5 rounded-full border transition-colors',
        disabled && 'text-muted-foreground/50 cursor-not-allowed border-transparent',
        !disabled && active && 'border-primary/50 bg-primary/10 text-primary font-medium',
        !disabled && !active && 'border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/25',
      )}
    >
      {children}
    </button>
  );
}

function StickyFooter({
  w,
  showBackToCompare,
  showBackToAnalysis,
}: {
  w: ReturnType<typeof useMetadataDeployment>;
  showBackToCompare?: boolean;
  showBackToAnalysis?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-50 bg-background/95 backdrop-blur border-t border-border py-3 px-3 sm:px-4 mt-4 flex flex-wrap items-center gap-3 justify-between">
      <div className="flex flex-wrap gap-2">
        {showBackToAnalysis ? (
          <Button variant="outline" onClick={() => w.setPhase('analysis')}>Back</Button>
        ) : showBackToCompare ? (
          <Button variant="outline" onClick={() => w.setPhase('compare')}>Back</Button>
        ) : (
          <Button variant="outline" onClick={() => w.setPhase('setup')}>Back</Button>
        )}
        <Button variant="outline" onClick={w.saveDraft}>Save draft</Button>
      </div>
      <div className="flex gap-2">
        {w.phase === 'compare' && (
          <Button
            disabled={w.selectionCount === 0}
            onClick={() => void w.runAnalysis()}
            loading={w.analysisLoading}
          >
            Next: Analysis ({w.selectionCount})
          </Button>
        )}
        {w.phase === 'analysis' && (
          <Button onClick={() => w.setPhase('summary')}>
            Next: Summary
          </Button>
        )}
      </div>
    </div>
  );
}
