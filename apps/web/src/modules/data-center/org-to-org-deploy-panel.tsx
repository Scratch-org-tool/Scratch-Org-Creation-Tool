'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeftRight, ArrowRight, LoaderCircle, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { ConfirmDialog, InlineAlert, StatusBadge, WizardSteps } from '@/components/studio';
import { OrgToOrgObjectSettings } from './org-to-org-object-settings';
import { OrgToOrgObjectSidebar } from './org-to-org-object-sidebar';
import { OrgToOrgPreviewStep } from './org-to-org-preview-step';
import { OrgToOrgTargetCompare } from './org-to-org-target-compare';
import { useOrgToOrgDeploy } from './use-org-to-org-deploy';
import { DataDeployBatchProgress } from './data-deploy-batch-progress';
import { OrgToOrgDependencyEditor } from './org-to-org-dependency-editor';
import { DataPreflightReportView } from './data-preflight-report';

const WIZARD_LABELS = ['Select & configure', 'Review & compare', 'Deploy'];

function wizardIndex(step: 'configure' | 'preview' | 'deploy'): number {
  if (step === 'configure') return 0;
  if (step === 'preview') return 1;
  return 2;
}

export function OrgToOrgDeployPanel() {
  const w = useOrgToOrgDeploy();
  const logBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [w.logs]);

  const sourceLabel = w.sourceOrg?.alias ?? 'Source';
  const targetLabel = w.targetOrg?.alias ?? 'Target';
  const sameOrg =
    Boolean(w.form.sourceOrgId) && w.form.sourceOrgId === w.form.targetOrgId;

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-hidden">
      {w.error && (
        <InlineAlert variant="error" onDismiss={() => w.setError(null)}>
          {w.error}
        </InlineAlert>
      )}

      {w.scratchWarning && (
        <InlineAlert variant="warning">
          Source scratch org expires soon — deploy data before the org expires.
        </InlineAlert>
      )}

      {/* Connection bar: source → target + strategy */}
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-end">
          <div className="min-w-0">
            <Label htmlFor="org-to-org-source-org">Source org</Label>
            <Select
              id="org-to-org-source-org"
              value={w.form.sourceOrgId}
              onChange={(e) => w.setForm({ ...w.form, sourceOrgId: e.target.value })}
            >
              <option value="">Select source…</option>
              {w.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                  {o.type === 'scratch' ? ' (scratch)' : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="hidden lg:flex items-center justify-center pb-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={w.swapOrgs}
              disabled={!w.form.sourceOrgId && !w.form.targetOrgId}
              aria-label="Swap source and target orgs"
              title="Swap source and target"
            >
              <ArrowLeftRight />
            </Button>
          </div>
          <div className="min-w-0">
            <Label htmlFor="org-to-org-target-org">Target org</Label>
            <Select
              id="org-to-org-target-org"
              value={w.form.targetOrgId}
              onChange={(e) => w.setForm({ ...w.form, targetOrgId: e.target.value })}
            >
              <option value="">Select target…</option>
              {w.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                  {o.type === 'scratch' ? ' (scratch)' : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <Label htmlFor="org-to-org-deploy-strategy">Deploy strategy</Label>
            <Select
              id="org-to-org-deploy-strategy"
              value={w.form.strategy}
              onChange={(e) =>
                w.setForm({ ...w.form, strategy: e.target.value as 'insert' | 'upsert' })
              }
            >
              <option value="upsert">Upsert — update matches, create the rest</option>
              <option value="insert">Insert — always create new records</option>
            </Select>
          </div>
        </div>

        {sameOrg && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Source and target must be different orgs.
          </p>
        )}

        {w.orgsReady && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium text-foreground">{sourceLabel}</span>
              <MoveRight className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">{targetLabel}</span>
            </span>
            <span aria-hidden>·</span>
            <a
              href={`/metadata-deployment?sourceOrgId=${encodeURIComponent(w.form.sourceOrgId)}&targetOrgId=${encodeURIComponent(w.form.targetOrgId)}`}
              className="text-primary hover:underline"
            >
              Deploy metadata between these orgs instead
            </a>
          </div>
        )}
      </div>

      {!w.orgsReady && !sameOrg && (
        <div className="rounded-lg border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          Choose a source and a target org to browse deployable objects.
        </div>
      )}

      {w.orgsReady && (
        <>
          <WizardSteps steps={WIZARD_LABELS} current={wizardIndex(w.wizardStep)} />

          {w.wizardStep === 'configure' && (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] border border-border/60 rounded-lg min-h-[24rem] overflow-hidden min-w-0">
              <OrgToOrgObjectSidebar
                objects={w.objects}
                checkedObjects={w.checkedObjects}
                activeObject={w.activeObject}
                onToggle={w.toggleObjectChecked}
                onFocus={w.focusObject}
                loading={w.loadingObjects}
              />
              <div className="min-h-[24rem] min-w-0 overflow-hidden">
                {w.activeObject && w.activeMeta && w.activeConfig ? (
                  <OrgToOrgObjectSettings
                    meta={w.activeMeta}
                    config={w.activeConfig}
                    loadingPreview={w.loadingPreview}
                    onConfigChange={(patch) => w.updateObjectConfig(w.activeObject!, patch)}
                    onReferenceToggle={(field, selected) =>
                      w.toggleReferenceField(w.activeObject!, field, selected)
                    }
                    onQueryModeChange={(mode) => w.setQueryMode(w.activeObject!, mode)}
                    onApplySoql={(soql) => w.applyCustomSoql(w.activeObject!, soql)}
                    onClearSoql={() => w.clearCustomSoql(w.activeObject!)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full p-8 text-sm text-muted-foreground">
                    {w.loadingObjects
                      ? 'Loading objects…'
                      : 'Select an object from the list to configure deployment settings.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {w.wizardStep === 'preview' && (
            <div className="space-y-4">
              <OrgToOrgTargetCompare
                objects={w.checkedObjectList}
                compare={w.targetCompare}
                loading={w.loadingCompare}
                strategy={w.form.strategy}
                targetLabel={targetLabel}
              />
              <OrgToOrgDependencyEditor
                objects={w.checkedObjectList}
                configs={w.objectConfigs}
                error={w.dependencyError}
                onMove={w.moveObject}
                onToggleDependency={w.toggleObjectDependency}
              />
              <OrgToOrgPreviewStep
                checkedObjects={w.checkedObjectList}
                objectConfigs={w.objectConfigs}
                selectedRecordIds={w.selectedRecordIds}
                onToggleRecord={w.toggleRecord}
                onToggleAll={w.toggleAllRecordsForObject}
              />
              {w.preflightResult?.quotaSummary && (
                <InlineAlert variant={w.preflightResult.quotaSummary.sufficient ? 'info' : 'error'}>
                  All-object plan: {w.preflightResult.quotaSummary.estimatedBulkBatches} estimated Bulk
                  batch(es), {w.preflightResult.quotaSummary.remaining ?? 'unknown'} remaining.
                </InlineAlert>
              )}
              {w.preflightResult?.preflight?.map((item, index) => (
                <DataPreflightReportView
                  key={item.id}
                  report={item.report}
                  title={`${index + 1}. ${item.objectName} preflight`}
                />
              ))}
            </div>
          )}

          {w.wizardStep === 'deploy' && w.batchResult && (
            <div className="space-y-3">
              <p className="text-sm">
                Batch <span className="font-mono text-xs">{w.batchResult.batchId}</span> queued with{' '}
                {w.batchResult.deployments.length} object plan(s).
              </p>
              <ul className="text-xs space-y-1">
                {w.batchResult.deployments.map((d) => (
                  <li key={d.movementId}>
                    {d.objectName}: {d.jobId ? `planner job ${d.jobId}` : 'preparing planner'}
                    {d.totalChunks ? ` (${d.totalChunks} chunks)` : ''}
                  </li>
                ))}
              </ul>
              {w.batchResult.deployments
                .filter((d) => d.batchId)
                .map((d) => (
                  <DataDeployBatchProgress
                    key={d.batchId}
                    batchId={d.batchId!}
                    onJobIdsChange={w.trackJobIds}
                  />
                ))}
              <div className="studio-console rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-border/60 text-xs text-muted-foreground">
                  Job output
                </div>
                <div className="h-48 overflow-y-auto p-3 space-y-0.5 text-xs">
                  {w.logs.length === 0 && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      {!['completed', 'partial', 'failed', 'cancelled'].includes(w.deployStatus ?? '')
                        && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                      {['completed', 'partial', 'failed', 'cancelled'].includes(w.deployStatus ?? '')
                        ? 'No CLI output was captured. Review the chunk result above.'
                        : 'Preparing planner and chunk output…'}
                    </p>
                  )}
                  {w.logs.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  <div ref={logBottomRef} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={w.deployStatus ?? 'queued'} />
                {w.deployStatus === 'completed' && (
                  <p className="text-sm text-muted-foreground">
                    Every planned chunk completed without reported row failures.
                  </p>
                )}
                {w.deployStatus === 'partial' && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Deployment completed with failed chunks or row errors.
                  </p>
                )}
              </div>
              {w.deployJobError && (
                <InlineAlert variant="error">
                  {w.deployJobError}
                </InlineAlert>
              )}
              <div className="pt-2 border-t border-border/60">
                <Button variant="outline" onClick={w.startNewDeployment}>
                  Start another deployment
                </Button>
              </div>
            </div>
          )}

          {w.wizardStep !== 'deploy' && (
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-border/60">
              <div className="text-xs text-muted-foreground">
                {w.checkedObjects.size} object(s) selected
                {w.wizardStep === 'preview' && ` · ${w.totalSelectedCount} record(s) selected`}
              </div>
              <div className="flex gap-2">
                {w.wizardStep === 'preview' && (
                  <Button variant="outline" onClick={() => w.setWizardStep('configure')}>
                    Back
                  </Button>
                )}
                {w.wizardStep === 'configure' && (
                  <Button onClick={() => void w.goToPreview()} disabled={!w.canGoNext}>
                    Review &amp; compare
                    <ArrowRight />
                  </Button>
                )}
                {w.wizardStep === 'preview' && (
                  <Button
                    onClick={() => void w.prepareDeploy()}
                    loading={w.loadingDeploy}
                    disabled={!w.canDeploy}
                  >
                    Preflight &amp; deploy
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={w.confirmingDeploy}
        title="Deploy this object dependency plan?"
        message={`Deploy ${w.preflightResult?.preflight?.length ?? w.checkedObjects.size} object(s) from ${sourceLabel} to ${targetLabel} in dependency order using ${w.preflightResult?.quotaSummary?.estimatedBulkBatches ?? 'an unknown number of'} estimated Bulk batch(es). ${w.form.strategy === 'upsert' ? 'Each displayed external ID makes retries idempotent.' : 'Insert is non-idempotent and failed chunks cannot be retried safely.'}`}
        confirmLabel="Start deployment"
        loading={w.loadingDeploy}
        onOpenChange={w.setConfirmingDeploy}
        onConfirm={() => void w.deploy()}
      />
    </div>
  );
}
