'use client';

import { motion } from 'framer-motion';
import { ChevronRight, Crosshair, FileText, Rocket, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard, InlineAlert, PageSkeleton } from '@/components/studio';
import { cn } from '@/utils/cn';
import { ScratchOrgPageHeader } from './scratch-org-page-header';
import { ConnectedOrgsPanel } from './connected-orgs-panel';
import { QuickActionsPanel } from './quick-actions-panel';
import { ScratchOrgForm } from './scratch-org-form';
import { ScratchOrgReview } from './scratch-org-review';
import { JobProgressPanel } from './job-progress-panel';
import { PostDeployPanel } from './post-deploy-panel';
import { useScratchOrgWorkspace } from './use-scratch-org-workspace';
import { WizardStepIndicator } from '@/components/scratch-org/wizard-step-indicator';
import { ExecutionLogConsole } from '@/components/scratch-org/execution-log-console';
import { ScratchOrgSuccessBanner } from '@/components/scratch-org/scratch-org-success';
import { StatusBadge } from '@/components/studio/status-badge';

function JobProgressCard({
  w,
  className,
  fillHeight = false,
  logHeightRem = 13,
}: {
  w: ReturnType<typeof useScratchOrgWorkspace>;
  className?: string;
  fillHeight?: boolean;
  logHeightRem?: number;
}) {
  return (
    <GlassCard
      title={
        <span className="inline-flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-primary" />
          Job Progress & Logs
        </span>
      }
      className={cn('flex flex-col min-h-0 shrink-0', className)}
      contentClassName="flex flex-col min-h-0 p-4"
    >
      <JobPanelContent w={w} fillHeight={fillHeight} logHeightRem={logHeightRem} />
    </GlassCard>
  );
}

function ConfigCard({
  w,
  desktopOnNext,
  desktopCanNext,
}: {
  w: ReturnType<typeof useScratchOrgWorkspace>;
  desktopOnNext: () => void;
  desktopCanNext: boolean;
}) {
  const pipelineSummary = w.desktopStep === 2 && !!w.automationRunId;

  return (
    <GlassCard
      className={cn(pipelineSummary && 'shrink-0')}
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Scratch Org Configuration
        </span>
      }
      headerAction={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => void w.loadDefaults()}
          disabled={!!w.isRunning}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Form
        </Button>
      }
    >
      {w.desktopStep === 0 && (
        <ScratchOrgForm
          form={w.form}
          setForm={w.setForm}
          devHubs={w.devHubs}
          sourceOrgs={w.sourceOrgs}
          templates={w.templates}
          templateMeta={w.templateMeta}
          metadataSource={w.metadataSource}
          installPackage={w.installPackage}
          setInstallPackage={w.setInstallPackage}
          isRunning={!!w.isRunning}
        />
      )}
      {w.desktopStep === 1 && (
        <ScratchOrgReview
          form={w.form}
          installPackage={w.installPackage}
          sourceControlConnected={w.metadataSource.connected}
          templateMeta={w.templateMeta}
          dataOrgAlias={w.sourceOrgs.find((o) => o.id === (
            w.templatePreview?.config.dataDeploymentOrgId
            ?? w.templatePreview?.config.sourceOrgId
            ?? (w.form.dataDeploymentOrgId || w.form.sourceOrgId)
          ))?.alias}
          settingsOrgAlias={w.sourceOrgs.find((o) => o.id === (
            w.templatePreview?.config.customSettingsOrgId
            ?? (w.form.customSettingsOrgId || undefined)
          ))?.alias}
          templatePreview={w.templatePreview}
        />
      )}
      {pipelineSummary && (
        <div className="flex flex-wrap items-center gap-3 py-1 text-sm">
          <p className="text-muted-foreground">
            Pipeline for <span className="font-medium text-foreground">{w.form.alias || 'scratch org'}</span>
          </p>
          {w.run?.status && <StatusBadge status={w.run.status} />}
          <p className="text-xs text-muted-foreground font-mono">
            RUN-{w.automationRunId!.slice(0, 8).toUpperCase()}
          </p>
        </div>
      )}
      {!w.isRunning && w.desktopStep < 2 && (
        <div className="flex gap-2 pt-6 mt-6 border-t border-border">
          <Button variant="outline" onClick={w.resetForm}>
            Reset
          </Button>
          {w.desktopStep > 0 && (
            <Button variant="outline" onClick={() => w.setDesktopStep((w.desktopStep - 1) as 0 | 1)}>
              Back
            </Button>
          )}
          <Button
            className="flex-1 gap-2 ml-auto"
            onClick={desktopOnNext}
            loading={w.submitting}
            disabled={!desktopCanNext}
          >
            {w.desktopStep === 1 ? (
              <>
                <Rocket className="w-4 h-4" />
                Create Scratch Org
              </>
            ) : (
              <>
                Next: Review Configuration
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}

function JobPanelContent({
  w,
  fillHeight,
  compact,
  logHeightRem,
  onViewFullLogs,
}: {
  w: ReturnType<typeof useScratchOrgWorkspace>;
  fillHeight?: boolean;
  compact?: boolean;
  logHeightRem?: number;
  onViewFullLogs?: () => void;
}) {
  return (
    <JobProgressPanel
      automationRunId={w.automationRunId}
      run={w.run}
      logs={w.logs}
      onClearLogs={() => w.setLogs([])}
      logsExpanded={w.logsExpanded}
      onToggleLogsExpand={() => w.setLogsExpanded((v) => !v)}
      isRunning={!!w.isRunning}
      isPaused={!!w.isPaused}
      isCancelled={!!w.isCancelled}
      canResume={!!w.canResume}
      stopping={w.stopping}
      resuming={w.resuming}
      onCancel={() => void w.cancelRun()}
      onResume={() => void w.resumeRun()}
      onReset={w.resetForm}
      credentials={w.credentials}
      onViewDetails={() => w.router.push('/environment-center?tab=salesforce#scratch-orgs')}
      getState={w.getState}
      activeSubtext={w.activeSubtext}
      elapsedMs={w.elapsedMs}
      progressPercent={w.progressPercent}
      streamState={w.streamState}
      restoredBanner={w.restoredBanner}
      fillHeight={fillHeight}
      compact={compact}
      logHeightRem={logHeightRem}
      onViewFullLogs={onViewFullLogs}
      wizardPreviewStep={w.desktopStep}
      postDeploySlot={
        <PostDeployPanel
          run={w.run}
          automationRunId={w.automationRunId}
          sourceOrgId={w.form.dataDeploymentOrgId || w.form.sourceOrgId || undefined}
          onRefresh={() => w.automationRunId && void w.refreshRun(w.automationRunId)}
        />
      }
    />
  );
}

export function CreateScratchOrgWorkspace() {
  const w = useScratchOrgWorkspace();
  const showDataSkeleton = w.initialLoading;

  const desktopOnNext = () => {
    if (w.desktopStep === 0) w.setDesktopStep(1);
    else if (w.desktopStep === 1) void w.launchPipeline();
  };

  const desktopCanNext =
    w.desktopStep === 0
      ? !!w.form.alias && !!w.form.devHubAlias
      : w.desktopStep === 1
        ? w.canLaunch
        : false;

  const pipelineActive = !!(
    w.automationRunId ||
    w.isRunning ||
    w.isPaused ||
    w.desktopStep === 2
  );

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-0 scrollbar-thin">
      <ScratchOrgPageHeader desktopStep={w.desktopStep} />

      {w.launchError && (
        <InlineAlert variant="error" onDismiss={() => w.setLaunchError(null)}>
          {w.launchError}
        </InlineAlert>
      )}

      {showDataSkeleton ? (
        <PageSkeleton variant="studio-sidebar" />
      ) : (
        <>
      {/* Mobile */}
      <div className="lg:hidden space-y-4">
        {w.mobileView === 'wizard' && (
          <>
            <WizardStepIndicator current={w.wizardStep} />
            <GlassCard title={w.wizardStep === 0 ? 'Scratch Org Details' : 'Review'}>
              {w.wizardStep === 0 ? (
                <ScratchOrgForm
                  form={w.form}
                  setForm={w.setForm}
                  devHubs={w.devHubs}
                  sourceOrgs={w.sourceOrgs}
                  templates={w.templates}
                  templateMeta={w.templateMeta}
                  metadataSource={w.metadataSource}
                  installPackage={w.installPackage}
                  setInstallPackage={w.setInstallPackage}
                  isRunning={!!w.isRunning}
                />
              ) : (
                <ScratchOrgReview
                  form={w.form}
                  installPackage={w.installPackage}
                  sourceControlConnected={w.metadataSource.connected}
                  templateMeta={w.templateMeta}
                  dataOrgAlias={w.sourceOrgs.find((o) => o.id === (
                    w.templatePreview?.config.dataDeploymentOrgId
                    ?? w.templatePreview?.config.sourceOrgId
                    ?? (w.form.dataDeploymentOrgId || w.form.sourceOrgId)
                  ))?.alias}
                  settingsOrgAlias={w.sourceOrgs.find((o) => o.id === (
                    w.templatePreview?.config.customSettingsOrgId
                    ?? (w.form.customSettingsOrgId || undefined)
                  ))?.alias}
                  templatePreview={w.templatePreview}
                />
              )}
              <div className="flex gap-2 mt-6">
                {w.wizardStep === 1 && (
                  <Button variant="outline" className="flex-1" onClick={() => w.setWizardStep(0)}>
                    Back
                  </Button>
                )}
                {w.wizardStep === 0 ? (
                  <Button
                    className="flex-1"
                    disabled={!w.form.alias || !w.form.devHubAlias}
                    onClick={() => w.setWizardStep(1)}
                  >
                    Next: Review
                  </Button>
                ) : (
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => void w.launchPipeline()}
                    loading={w.submitting}
                    disabled={!w.canLaunch}
                  >
                    <Rocket className="w-4 h-4" />
                    Create Scratch Org
                  </Button>
                )}
              </div>
            </GlassCard>
          </>
        )}
        {w.mobileView === 'progress' && (
          <GlassCard title="Job Progress & Logs">
            <JobPanelContent w={w} fillHeight onViewFullLogs={() => w.setMobileView('logs')} />
          </GlassCard>
        )}
        {w.mobileView === 'logs' && (
          <GlassCard
            title="Execution Logs"
            headerAction={
              <Button variant="ghost" size="sm" onClick={() => w.setMobileView('progress')}>
                Back
              </Button>
            }
          >
            <ExecutionLogConsole logs={w.logs} onClear={() => w.setLogs([])} expanded />
          </GlassCard>
        )}
        {w.mobileView === 'success' && w.credentials && (
          <GlassCard>
            <ScratchOrgSuccessBanner
              variant="full"
              alias={w.credentials.alias}
              username={w.credentials.username}
              password={w.credentials.password ?? undefined}
              instanceUrl={w.credentials.instanceUrl ?? undefined}
              expirationDate={w.credentials.expirationDate ?? undefined}
              onViewDetails={() => w.router.push('/environment-center?tab=salesforce#scratch-orgs')}
            />
            <Button
              className="w-full mt-4"
              onClick={() => w.router.push('/environment-center?tab=salesforce#scratch-orgs')}
            >
              Back to Scratch Orgs
            </Button>
          </GlassCard>
        )}
      </div>

      {/* Desktop */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden lg:block space-y-4"
      >
        {pipelineActive ? (
          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
            <div className="flex flex-col gap-4 min-w-0">
              <ConfigCard w={w} desktopOnNext={desktopOnNext} desktopCanNext={desktopCanNext} />
              <JobProgressCard w={w} logHeightRem={13} />
            </div>
            <aside className="sticky top-6 self-start flex flex-col gap-4 min-w-0">
              <ConnectedOrgsPanel
                variant="sidebar"
                orgs={w.orgs}
                selectedAlias={w.form.devHubAlias}
                onSelect={w.selectDevHub}
                azureStatus={w.azureStatus}
              />
              <QuickActionsPanel className="shrink-0" />
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <ConfigCard w={w} desktopOnNext={desktopOnNext} desktopCanNext={desktopCanNext} />
            <aside className="sticky top-6 self-start flex flex-col gap-4 min-w-0 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-y-contain pb-24 scrollbar-thin">
              <ConnectedOrgsPanel
                variant="sidebar"
                orgs={w.orgs}
                selectedAlias={w.form.devHubAlias}
                onSelect={w.selectDevHub}
                azureStatus={w.azureStatus}
              />
              <GlassCard
                title={
                  <span className="inline-flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-primary" />
                    Job Progress & Logs
                  </span>
                }
                contentClassName="p-4"
              >
                <JobPanelContent w={w} />
              </GlassCard>
              <QuickActionsPanel className="shrink-0" />
            </aside>
          </div>
        )}
      </motion.div>
        </>
      )}
    </div>
  );
}
