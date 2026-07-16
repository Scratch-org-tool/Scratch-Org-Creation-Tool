'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { ConfirmDialog, FormSection, InlineAlert, StatusBadge } from '@/components/studio';
import { OrgToOrgObjectSettings } from './org-to-org-object-settings';
import { OrgToOrgObjectSidebar } from './org-to-org-object-sidebar';
import { OrgToOrgPreviewStep } from './org-to-org-preview-step';
import { useOrgToOrgDeploy } from './use-org-to-org-deploy';
import { DataDeployBatchProgress } from './data-deploy-batch-progress';
import { OrgToOrgDependencyEditor } from './org-to-org-dependency-editor';
import { DataPreflightReportView } from './data-preflight-report';

export function OrgToOrgDeployPanel() {
  const w = useOrgToOrgDeploy();
  const logBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [w.logs]);

  const sourceLabel = w.sourceOrg?.alias ?? 'Source';
  const targetLabel = w.targetOrg?.alias ?? 'Target';

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

      <FormSection title="Data deployments">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-[280px]">
            <div>
              <Label htmlFor="org-to-org-source-org">Source org</Label>
              <Select
                id="org-to-org-source-org"
                value={w.form.sourceOrgId}
                onChange={(e) => w.setForm({ ...w.form, sourceOrgId: e.target.value })}
              >
                <option value="">Select…</option>
                {w.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                    {o.type === 'scratch' ? ' (scratch)' : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="org-to-org-target-org">Target org</Label>
              <Select
                id="org-to-org-target-org"
                value={w.form.targetOrgId}
                onChange={(e) => w.setForm({ ...w.form, targetOrgId: e.target.value })}
              >
                <option value="">Select…</option>
                {w.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                    {o.type === 'scratch' ? ' (scratch)' : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="org-to-org-deploy-strategy">Deploy strategy</Label>
              <Select
                id="org-to-org-deploy-strategy"
                value={w.form.strategy}
                onChange={(e) =>
                  w.setForm({ ...w.form, strategy: e.target.value as 'insert' | 'upsert' })
                }
              >
                <option value="upsert">Upsert (SFDMU)</option>
                <option value="insert">Insert (bulk)</option>
              </Select>
            </div>
          </div>
        </div>

        {w.orgsReady && (
          <p className="text-sm text-muted-foreground mb-4">
            <span className="font-medium text-foreground">{sourceLabel}</span>
            {' → '}
            <span className="font-medium text-foreground">{targetLabel}</span>
            {' · '}
            <a
              href={`/metadata-deployment?sourceOrgId=${encodeURIComponent(w.form.sourceOrgId)}&targetOrgId=${encodeURIComponent(w.form.targetOrgId)}`}
              className="text-primary hover:underline"
            >
              Deploy metadata between these orgs
            </a>
          </p>
        )}

        {w.wizardStep === 'configure' && w.orgsReady && (
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
              {w.batchResult.deployments.length} object job(s).
            </p>
            <ul className="text-xs space-y-1">
              {w.batchResult.deployments.map((d) => (
                <li key={d.movementId}>
                  {d.objectName}: job {d.jobId}
                  {d.totalChunks ? ` (${d.totalChunks} chunks)` : ''}
                </li>
              ))}
            </ul>
            {w.batchResult.deployments
              .filter((d) => d.batchId)
              .map((d) => (
                <DataDeployBatchProgress key={d.batchId} batchId={d.batchId!} />
              ))}
            <div className="studio-console rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border/60 text-xs text-muted-foreground">
                Job output
              </div>
              <div className="h-48 overflow-y-auto p-3 space-y-0.5 text-xs">
                {w.logs.length === 0 && (
                  <p className="text-muted-foreground">Waiting for job output…</p>
                )}
                {w.logs.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                <div ref={logBottomRef} />
              </div>
            </div>
            <StatusBadge status={w.deployStatus ?? 'queued'} />
            {w.deployJobError && (
              <InlineAlert variant="error">
                {w.deployJobError}
              </InlineAlert>
            )}
            {w.deployStatus === 'completed' && (
              <p className="text-sm text-muted-foreground mt-2">Deployment completed successfully.</p>
            )}
          </div>
        )}

        {w.orgsReady && w.wizardStep !== 'deploy' && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border/60">
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
                  Next →
                </Button>
              )}
              {w.wizardStep === 'preview' && (
                <Button
                  onClick={() => void w.prepareDeploy()}
                  loading={w.loadingDeploy}
                  disabled={!w.canDeploy}
                >
                  Preflight &amp; review
                </Button>
              )}
            </div>
          </div>
        )}
      </FormSection>
      <ConfirmDialog
        open={w.confirmingDeploy}
        title="Deploy this object dependency plan?"
        message={`Deploy ${w.preflightResult?.preflight?.length ?? w.checkedObjects.size} object(s) in dependency order using ${w.preflightResult?.quotaSummary?.estimatedBulkBatches ?? 'an unknown number of'} estimated Bulk batch(es). ${w.form.strategy === 'upsert' ? 'Each displayed external ID makes retries idempotent.' : 'Insert is non-idempotent and failed chunks cannot be retried safely.'}`}
        confirmLabel="Start deployment"
        loading={w.loadingDeploy}
        onOpenChange={w.setConfirmingDeploy}
        onConfirm={() => void w.deploy()}
      />
    </div>
  );
}
