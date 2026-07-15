'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DeploymentPageHeader,
  GlassCard,
  InlineAlert,
  PageSkeleton,
  StatusBadge,
  WizardSteps,
} from '@/components/studio';
import { GitMetadataSourceFields } from '@/modules/source-control/git-metadata-source-fields';
import { cn } from '@/utils/cn';
import type { DeploymentWorkbenchState } from './use-deployment-workbench';
import { useDeploymentWorkbench } from './use-deployment-workbench';
import type { CompareItem, DependencyGraph, WorkbenchStage } from './types';
import {
  componentCount,
  layoutDependencyGraph,
  readableStage,
  runCanResume,
  stageRisk,
  WORKBENCH_STEPS,
} from './workbench-utils';

const DIFF_STYLES: Record<CompareItem['diffType'], string> = {
  new: 'text-emerald-300 bg-emerald-500/10',
  changed: 'text-amber-300 bg-amber-500/10',
  deleted: 'text-red-300 bg-red-500/10',
  same: 'text-muted-foreground bg-muted/30',
  unknown: 'text-muted-foreground bg-muted/30',
};

export function DeploymentWorkbenchWorkspace({
  sourceMode,
}: {
  sourceMode?: 'org_compare' | 'scm';
} = {}) {
  const w = useDeploymentWorkbench(sourceMode);
  const [tab, setTab] = useState<'plan' | 'history'>('plan');

  if (w.loading) {
    return <div className="p-4 md:p-6"><PageSkeleton variant="studio-2row" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Deployment Workbench"
        subtitle="Plan, govern, execute, and audit Salesforce metadata deployments"
        icon={Boxes}
        accentClass="to-cyan-500/10"
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Deployment workbench views">
        <TabButton active={tab === 'plan'} onClick={() => setTab('plan')}>Plan & execute</TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          Audit & history
        </TabButton>
      </div>

      {w.error && (
        <InlineAlert variant="error" title="Blocked" onDismiss={() => w.setError(null)}>
          {w.error}
        </InlineAlert>
      )}
      {w.notice && (
        <InlineAlert variant="success" onDismiss={() => w.setNotice(null)}>
          {w.notice}
        </InlineAlert>
      )}

      {tab === 'history' ? <HistoryView w={w} /> : <PlanView w={w} />}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-primary font-medium'
          : 'border-border/60 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function PlanView({ w }: { w: DeploymentWorkbenchState }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/30 p-3">
        <WizardSteps steps={[...WORKBENCH_STEPS]} current={w.step} className="min-w-[760px]" />
      </div>
      <main id="workbench-main" tabIndex={-1} className="focus:outline-none">
        {w.step === 0 && <SourceStep w={w} />}
        {w.step === 1 && <ComponentsStep w={w} />}
        {w.step === 2 && <DependenciesStep w={w} />}
        {w.step === 3 && <QualityStep w={w} />}
        {w.step === 4 && <ReviewStep w={w} />}
        {w.step === 5 && <ExecuteStep w={w} />}
      </main>
      {w.step < 5 && <WizardFooter w={w} />}
    </div>
  );
}

function SourceStep({ w }: { w: DeploymentWorkbenchState }) {
  const sourceReady = w.form.sourceMode === 'scm'
    ? Boolean(w.scmSource)
    : Boolean(w.form.sourceOrgId && w.form.targetOrgId && w.form.sourceOrgId !== w.form.targetOrgId);
  return (
    <GlassCard
      title="Source and target"
      description="Choose an org comparison or a connected source-control manifest."
    >
      <fieldset className="space-y-5">
        <legend className="sr-only">Deployment source type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <SourceChoice
            checked={w.form.sourceMode === 'org_compare'}
            title="Org to org"
            description="Compare connected orgs in the background."
            onClick={() => w.setForm((current) => ({ ...current, sourceMode: 'org_compare' }))}
          />
          <SourceChoice
            checked={w.form.sourceMode === 'scm'}
            title="Source control"
            description="Azure DevOps, GitHub, or Bitbucket repository manifest."
            onClick={() => w.setForm((current) => ({ ...current, sourceMode: 'scm' }))}
          />
        </div>

        {w.form.sourceMode === 'org_compare' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Source org" htmlFor="workbench-source-org">
              <Select
                id="workbench-source-org"
                value={w.form.sourceOrgId}
                onChange={(event) => w.setForm((current) => ({
                  ...current,
                  sourceOrgId: event.target.value,
                  comparisonId: undefined,
                }))}
              >
                <option value="">Select source org…</option>
                {w.orgs.map((org) => (
                  <option key={org.id} value={org.id} disabled={org.id === w.form.targetOrgId}>
                    {org.alias}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Target org" htmlFor="workbench-target-org">
              <Select id="workbench-target-org" value={w.form.targetOrgId} onChange={(event) => w.selectTarget(event.target.value)}>
                <option value="">Select target org…</option>
                {w.orgs.map((org) => (
                  <option key={org.id} value={org.id} disabled={org.id === w.form.sourceOrgId}>
                    {org.alias}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <>
            <GitMetadataSourceFields source={w.scm} />
            <Field label="Target org" htmlFor="workbench-target-org" className="max-w-md">
              <Select id="workbench-target-org" value={w.form.targetOrgId} onChange={(event) => w.selectTarget(event.target.value)}>
                <option value="">Select target org…</option>
                {w.orgs.map((org) => <option key={org.id} value={org.id}>{org.alias}</option>)}
              </Select>
            </Field>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Environment profile" htmlFor="workbench-environment">
            <Select
              id="workbench-environment"
              value={w.form.targetProfile}
              onChange={(event) => w.selectProfile(event.target.value as typeof w.form.targetProfile)}
            >
              {(w.capabilities?.environments ?? ['scratch', 'sandbox', 'production']).map((environment) => (
                <option key={environment} value={environment}>{environment}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Must match the connected target org; the server verifies this value.
            </p>
          </Field>
          <Field label="Deployment strategy" htmlFor="workbench-strategy">
            <Select
              id="workbench-strategy"
              value={w.form.strategy}
              onChange={(event) => w.setForm((current) => ({
                ...current,
                strategy: event.target.value as typeof current.strategy,
                policy: event.target.value === 'validate_then_quick'
                  ? { ...current.policy, validation: { required: true } }
                  : current.policy,
              }))}
            >
              <option value="direct">Direct</option>
              <option value="intelligent">Intelligent batches</option>
              <option value="validate_then_quick">Validate, then quick deploy</option>
            </Select>
          </Field>
        </div>

        {w.form.targetProfile === 'production' && <ProductionLock />}
        {!sourceReady && (
          <p className="text-sm text-muted-foreground">
            Complete the source and target fields to continue.
          </p>
        )}
      </fieldset>
    </GlassCard>
  );
}

function SourceChoice({
  checked,
  title,
  description,
  onClick,
}: {
  checked: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

function ComponentsStep({ w }: { w: DeploymentWorkbenchState }) {
  if (w.form.sourceMode === 'scm') {
    return (
      <GlassCard title="Manifest components" description="The selected branch manifest is resolved by the workbench source stage.">
        <dl className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm sm:grid-cols-3">
          <SummaryTerm label="Repository" value={w.scmSource?.type === 'scm' ? w.scmSource.repo : '—'} />
          <SummaryTerm label="Branch" value={w.scmSource?.type === 'scm' ? w.scmSource.branch : '—'} />
          <SummaryTerm label="Manifest" value={w.scmSource?.type === 'scm' ? w.scmSource.manifestPath ?? 'Default' : '—'} />
        </dl>
        <InlineAlert variant="info" className="mt-4">
          Components, wildcard expansion, and destructive manifests are resolved from this immutable repository revision during execution.
        </InlineAlert>
      </GlassCard>
    );
  }

  const grouped = ['changed', 'new', 'deleted'] as const;
  return (
    <GlassCard
      title="Component comparison"
      description="Select changed and new metadata to deploy. Deleted metadata is isolated for destructive review."
      headerAction={(
        <Button onClick={() => void w.startComparison()} loading={w.comparing} disabled={!w.form.sourceOrgId || !w.form.targetOrgId}>
          <RefreshCw className="mr-2 size-4" />
          {w.form.comparisonId ? 'Compare again' : 'Run comparison'}
        </Button>
      )}
    >
      <div aria-live="polite" className="mb-4 text-sm text-muted-foreground">
        Comparison status: <StatusBadge status={w.comparisonStatus} />
        {w.comparisonSummary && ` · ${w.comparisonSummary.total} components inspected`}
      </div>
      {w.comparisonStatus === 'running' && (
        <InlineAlert variant="info" className="mb-4">
          The comparison is running in the background. Results update automatically.
        </InlineAlert>
      )}
      {grouped.map((diffType) => {
        const items = w.compareItems.filter((item) => item.diffType === diffType);
        if (!items.length) return null;
        return (
          <section key={diffType} className="mb-5" aria-labelledby={`components-${diffType}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 id={`components-${diffType}`} className="text-sm font-semibold capitalize">
                {diffType === 'deleted' ? 'Destructive changes' : `${diffType} components`} ({items.length})
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => w.selectDiffType(diffType, true)}>Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => w.selectDiffType(diffType, false)}>Clear</Button>
              </div>
            </div>
            {diffType === 'deleted' && (
              <InlineAlert variant="warning" className="mb-2">
                Selected deletions are sent as a separate destructive manifest.
              </InlineAlert>
            )}
            <div className="max-h-72 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="w-12 p-2"><span className="sr-only">Select</span></th>
                    <th className="p-2">Component</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const key = `${item.metadataType}::${item.fullName}`;
                    return (
                      <tr key={key} className="border-b border-border/40 last:border-0">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={w.selectedKeys.has(key)}
                            onChange={() => w.toggleCompareItem(item)}
                            aria-label={`Select ${item.metadataType} ${item.fullName}`}
                          />
                        </td>
                        <td className="p-2 font-medium">{item.fullName}</td>
                        <td className="p-2 text-muted-foreground">{item.metadataType}</td>
                        <td className="p-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs capitalize', DIFF_STYLES[item.diffType])}>
                            {item.diffType}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {!w.compareItems.length && w.comparisonStatus !== 'running' && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Run the background comparison to resolve changed, new, and deleted metadata.
        </div>
      )}
    </GlassCard>
  );
}

function DependenciesStep({ w }: { w: DeploymentWorkbenchState }) {
  const dependencyStage = w.results?.stages.find((stage) => stage.key === 'dependencies');
  const artifacts = dependencyStage?.artifacts;
  const graph = artifacts?.graph as DependencyGraph | undefined;
  const decisions = (artifacts?.decisions ?? []) as Array<{
    nodeId: string;
    decision: string;
    reason: string;
  }>;
  const missing = (artifacts?.missing ?? []) as Array<{
    nodeId: string;
    requiredBy?: string[];
    explanation?: string;
  }>;
  const cycles = (artifacts?.cycles ?? []) as string[][];

  return (
    <div className="space-y-4">
      <GlassCard title="Dependency decisions" description="Choose how transitive metadata references are included.">
        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="sr-only">Dependency inclusion mode</legend>
          {[
            ['selected_only', 'Selected only', 'Deploy only explicit selections.'],
            ['include_required', 'Include required', 'Add required transitive dependencies.'],
            ['include_all', 'Include all', 'Include every component discovered in the source.'],
          ].map(([value, title, description]) => (
            <SourceChoice
              key={value}
              checked={w.form.dependencyPolicy.mode === value}
              title={title}
              description={description}
              onClick={() => w.setForm((current) => ({
                ...current,
                dependencyPolicy: {
                  ...current.dependencyPolicy,
                  mode: value as typeof current.dependencyPolicy.mode,
                },
              }))}
            />
          ))}
        </fieldset>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Maximum dependency depth" htmlFor="dependency-depth">
            <Input
              id="dependency-depth"
              type="number"
              min={0}
              max={25}
              value={w.form.dependencyPolicy.maxDepth}
              onChange={(event) => w.setForm((current) => ({
                ...current,
                dependencyPolicy: {
                  ...current.dependencyPolicy,
                  maxDepth: Math.max(0, Math.min(25, Number(event.target.value))),
                },
              }))}
            />
          </Field>
          <div className="space-y-3">
            <PolicyToggle
              id="fail-missing"
              label="Block on missing required dependencies"
              checked={w.form.dependencyPolicy.failOnMissing}
              onChange={(checked) => w.setForm((current) => ({
                ...current,
                dependencyPolicy: { ...current.dependencyPolicy, failOnMissing: checked },
              }))}
            />
            <PolicyToggle
              id="allow-cycles"
              label="Allow dependency cycles"
              checked={w.form.dependencyPolicy.allowCycles}
              onChange={(checked) => w.setForm((current) => ({
                ...current,
                dependencyPolicy: { ...current.dependencyPolicy, allowCycles: checked },
              }))}
            />
            <PolicyToggle
              id="include-optional"
              label="Include optional dependencies"
              checked={w.form.dependencyPolicy.includeOptional}
              onChange={(checked) => w.setForm((current) => ({
                ...current,
                dependencyPolicy: { ...current.dependencyPolicy, includeOptional: checked },
              }))}
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Resolved dependency graph" description="Accessible list and table fallback for the execution graph.">
        {!dependencyStage ? (
          <InlineAlert variant="info">
            The server resolves references against the checked-out source. Graph nodes, missing references, cycles, and inclusion reasons appear here after the dependency stage starts.
          </InlineAlert>
        ) : (
          <>
            {dependencyStage.error && <InlineAlert variant="error">{dependencyStage.error}</InlineAlert>}
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Nodes" value={graph?.nodes.length ?? 0} />
              <Metric label="Edges" value={graph?.edges.length ?? 0} />
              <Metric label="Missing" value={missing.length} danger={missing.length > 0} />
              <Metric label="Cycles" value={cycles.length} danger={cycles.length > 0} />
            </div>
            {graph?.nodes.length ? <DependencyGraphVisual graph={graph} /> : null}
            <div className="max-h-80 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="p-2">Node</th>
                    <th className="p-2">Decision</th>
                    <th className="p-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((decision) => (
                    <tr key={decision.nodeId} className="border-b border-border/40">
                      <td className="p-2 font-medium">{decision.nodeId}</td>
                      <td className="p-2"><StatusBadge status={decision.decision} /></td>
                      <td className="p-2 text-muted-foreground">{decision.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missing.map((item) => (
              <InlineAlert key={item.nodeId} variant="error" className="mt-2">
                <strong>{item.nodeId}</strong>: {item.explanation}
                {item.requiredBy?.length ? ` Required by ${item.requiredBy.join(', ')}.` : ''}
              </InlineAlert>
            ))}
            {cycles.map((cycle, index) => (
              <InlineAlert key={`${cycle.join('-')}-${index}`} variant="warning" className="mt-2">
                Cycle: {cycle.join(' → ')}
              </InlineAlert>
            ))}
          </>
        )}
      </GlassCard>
    </div>
  );
}

function QualityStep({ w }: { w: DeploymentWorkbenchState }) {
  const production = w.form.targetProfile === 'production';
  const [testSearch, setTestSearch] = useState('');
  const filteredTests = w.testClasses.filter((item) =>
    item.name.toLowerCase().includes(testSearch.toLowerCase()));
  const staticPolicy = w.form.policy.staticAnalysis;

  return (
    <div className="space-y-4">
      {production && <ProductionLock />}
      <GlassCard title="Quality gates" description="These gates are evaluated by the server before target mutation.">
        <div className="space-y-4">
          <PolicyToggle
            id="validation-required"
            label="Validation required"
            checked={w.form.policy.validation.required}
            disabled={production || w.form.strategy === 'validate_then_quick'}
            locked={production || w.form.strategy === 'validate_then_quick'}
            onChange={(checked) => w.setPolicy((policy) => ({ ...policy, validation: { required: checked } }))}
          />
          <PolicyToggle
            id="snapshot-required"
            label="Capture target snapshot"
            checked={w.form.policy.snapshot.required}
            onChange={(checked) => w.setPolicy((policy) => ({
              ...policy,
              snapshot: {
                required: checked,
                rollbackRequired: checked ? policy.snapshot.rollbackRequired : false,
              },
            }))}
          />
          <PolicyToggle
            id="rollback-required"
            label="Require rollback readiness"
            checked={w.form.policy.snapshot.rollbackRequired}
            disabled={!w.form.policy.snapshot.required}
            onChange={(checked) => w.setPolicy((policy) => ({
              ...policy,
              snapshot: { ...policy.snapshot, rollbackRequired: checked },
            }))}
          />
          <PolicyToggle
            id="approval-required"
            label="Approval required"
            checked={w.form.policy.approval.required}
            disabled={production}
            locked={production}
            onChange={(checked) => w.setPolicy((policy) => ({
              ...policy,
              approval: { ...policy.approval, required: checked },
            }))}
          />
          {w.form.policy.approval.required && (
            <div className="grid gap-4 pl-11 md:grid-cols-2">
              <Field label="Approver policy" htmlFor="approver-type">
                <Select
                  id="approver-type"
                  value={w.form.policy.approval.approverType}
                  onChange={(event) => w.setPolicy((policy) => ({
                    ...policy,
                    approval: {
                      ...policy.approval,
                      approverType: event.target.value as typeof policy.approval.approverType,
                    },
                  }))}
                >
                  <option value="owner">Plan owner or admin</option>
                  <option value="admin">Administrator</option>
                  <option value="distinct_user">Distinct user</option>
                </Select>
              </Field>
              <Field label="Minimum approvals" htmlFor="minimum-approvals">
                <Input
                  id="minimum-approvals"
                  type="number"
                  min={1}
                  max={10}
                  value={w.form.policy.approval.minimumApprovals}
                  onChange={(event) => w.setPolicy((policy) => ({
                    ...policy,
                    approval: {
                      ...policy.approval,
                      minimumApprovals: Math.max(1, Math.min(10, Number(event.target.value))),
                    },
                  }))}
                />
              </Field>
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard title="Static analysis" description="Select engines and blocking thresholds.">
        <PolicyToggle
          id="static-enabled"
          label="Run static analysis"
          checked={staticPolicy.enabled}
          onChange={(checked) => w.setPolicy((policy) => ({
            ...policy,
            staticAnalysis: {
              ...policy.staticAnalysis,
              enabled: checked,
              engines: checked && !policy.staticAnalysis.engines.length
                ? [w.capabilities?.staticAnalysisEngines[0] ?? 'code-analyzer']
                : policy.staticAnalysis.engines,
            },
          }))}
        />
        {staticPolicy.enabled && (
          <div className="mt-4 space-y-4 pl-0 md:pl-11">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Engines</legend>
              <div className="flex flex-wrap gap-3">
                {(w.capabilities?.staticAnalysisEngines ?? []).map((engine) => {
                  const available = (w.capabilities as (typeof w.capabilities & {
                    staticAnalysisAvailability?: Record<string, boolean>;
                  }))?.staticAnalysisAvailability?.[engine] !== false;
                  return (
                    <label key={engine} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={staticPolicy.engines.includes(engine)}
                        disabled={!available}
                        onChange={(event) => w.setPolicy((policy) => ({
                          ...policy,
                          staticAnalysis: {
                            ...policy.staticAnalysis,
                            engines: event.target.checked
                              ? [...policy.staticAnalysis.engines, engine]
                              : policy.staticAnalysis.engines.filter((item) => item !== engine),
                          },
                        }))}
                      />
                      {engine}{!available && ' (unavailable)'}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Severity threshold" htmlFor="severity-threshold">
                <Select
                  id="severity-threshold"
                  value={staticPolicy.severityThreshold}
                  onChange={(event) => w.setPolicy((policy) => ({
                    ...policy,
                    staticAnalysis: {
                      ...policy.staticAnalysis,
                      severityThreshold: event.target.value as typeof policy.staticAnalysis.severityThreshold,
                    },
                  }))}
                >
                  {['info', 'warning', 'error', 'critical'].map((severity) => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Blocking mode" htmlFor="static-block-mode">
                <Select
                  id="static-block-mode"
                  value={staticPolicy.blockMode}
                  onChange={(event) => w.setPolicy((policy) => ({
                    ...policy,
                    staticAnalysis: {
                      ...policy.staticAnalysis,
                      blockMode: event.target.value as typeof policy.staticAnalysis.blockMode,
                    },
                  }))}
                >
                  <option value="threshold">Configured maximums</option>
                  <option value="any">Any issue at threshold</option>
                  <option value="never">Report only</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['info', 'warning', 'error', 'critical'] as const).map((severity) => (
                <Field key={severity} label={`Max ${severity}`} htmlFor={`max-${severity}`}>
                  <Input
                    id={`max-${severity}`}
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={staticPolicy.maxCounts[severity] ?? ''}
                    onChange={(event) => w.setPolicy((policy) => ({
                      ...policy,
                      staticAnalysis: {
                        ...policy.staticAnalysis,
                        maxCounts: {
                          ...policy.staticAnalysis.maxCounts,
                          [severity]: event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
                        },
                      },
                    }))}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Apex tests and coverage">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Test level" htmlFor="test-level">
            <Select
              id="test-level"
              value={w.form.policy.tests.level}
              onChange={(event) => w.setPolicy((policy) => ({
                ...policy,
                tests: {
                  ...policy.tests,
                  level: event.target.value as typeof policy.tests.level,
                  tests: event.target.value === 'RunSpecifiedTests' ? policy.tests.tests : [],
                },
              }))}
            >
              {(w.capabilities?.testLevels ?? []).map((level) => (
                <option key={level} value={level} disabled={production && level === 'NoTestRun'}>
                  {readableStage(level)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum coverage (%)" htmlFor="minimum-coverage">
            <Input
              id="minimum-coverage"
              type="number"
              min={production ? 75 : 0}
              max={100}
              value={w.form.policy.tests.minimumCoverage}
              onChange={(event) => w.setPolicy((policy) => ({
                ...policy,
                tests: {
                  ...policy.tests,
                  minimumCoverage: Math.max(production ? 75 : 0, Math.min(100, Number(event.target.value))),
                },
              }))}
            />
            {production && <p className="mt-1 flex items-center gap-1 text-xs text-amber-300"><Lock className="size-3" /> Minimum 75%</p>}
          </Field>
        </div>
        {w.form.policy.tests.level === 'RunSpecifiedTests' && (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Apex test classes</legend>
            <Input
              value={testSearch}
              onChange={(event) => setTestSearch(event.target.value)}
              placeholder="Filter Apex classes…"
              aria-label="Filter Apex test classes"
              className="my-2 max-w-md"
            />
            <div className="max-h-60 overflow-auto rounded-lg border border-border/60 p-2">
              {w.testClassesLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Loading classes from target org…</p>
              ) : filteredTests.map((testClass) => (
                <label key={testClass.name} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={w.form.policy.tests.tests.includes(testClass.name)}
                    onChange={(event) => w.setPolicy((policy) => ({
                      ...policy,
                      tests: {
                        ...policy.tests,
                        tests: event.target.checked
                          ? [...policy.tests.tests, testClass.name]
                          : policy.tests.tests.filter((name) => name !== testClass.name),
                      },
                    }))}
                  />
                  <span>{testClass.name}</span>
                  {testClass.likelyTest && <span className="text-xs text-emerald-300">likely test</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </GlassCard>

      <GlassCard title="Chained data deployment" description="Run a reviewed data configuration after metadata succeeds.">
        <PolicyToggle
          id="chained-data"
          label="Enable chained data"
          checked={w.form.chainedDataEnabled}
          onChange={(checked) => w.setForm((current) => ({ ...current, chainedDataEnabled: checked }))}
        />
        {w.form.chainedDataEnabled && (
          <div className="mt-4 space-y-3 pl-0 md:pl-11">
            <PolicyToggle
              id="chained-stop"
              label="Stop data chain on first error"
              checked={w.form.chainedDataStopOnError}
              onChange={(checked) => w.setForm((current) => ({ ...current, chainedDataStopOnError: checked }))}
            />
            <Field label="Data deployment configuration (JSON array)" htmlFor="chained-config">
              <Textarea
                id="chained-config"
                rows={7}
                value={w.form.chainedDataJson}
                onChange={(event) => w.setForm((current) => ({ ...current, chainedDataJson: event.target.value }))}
                className="font-mono text-xs"
              />
            </Field>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function ReviewStep({ w }: { w: DeploymentWorkbenchState }) {
  const stages = w.preview?.stages ?? [];
  const destructiveCount = componentCount(w.form.destructiveSelections);
  const estimatedBatches = w.form.strategy === 'intelligent'
    ? Math.max(1, w.form.components.length)
    : 1;
  return (
    <div className="space-y-4">
      <GlassCard title="Deployment plan" description="Review server-normalized stages, batches, risks, and immutable policy gates.">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Components" value={componentCount(w.form.components)} />
          <Metric label="Destructive" value={destructiveCount} danger={destructiveCount > 0} />
          <Metric label="Estimated batches" value={estimatedBatches} />
          <Metric label="Stages" value={stages.length} />
        </div>
        <div className="overflow-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="p-3">Order</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Required</th>
                <th className="p-3">Risk</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.key} className="border-b border-border/40 last:border-0">
                  <td className="p-3">{stage.ordinal + 1}</td>
                  <td className="p-3 font-medium">{readableStage(stage.key)}</td>
                  <td className="p-3">{stage.required ? 'Yes' : 'No'}</td>
                  <td className="p-3"><RiskBadge risk={stageRisk(stage)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
      <GlassCard title="Plan identity">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Deployment name" htmlFor="deployment-name">
            <Input
              id="deployment-name"
              maxLength={120}
              value={w.form.name}
              onChange={(event) => w.setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Optional audit label"
            />
          </Field>
          <Field label="Notes" htmlFor="deployment-notes">
            <Textarea
              id="deployment-notes"
              maxLength={2000}
              value={w.form.description}
              onChange={(event) => w.setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Change ticket, scope, and rationale"
            />
          </Field>
        </div>
      </GlassCard>
      {w.validation.warnings.map((warning) => (
        <InlineAlert key={warning} variant="warning">{warning}</InlineAlert>
      ))}
      {w.validation.blockers.map((blocker) => (
        <InlineAlert key={blocker} variant="error" title="Plan blocker">{blocker}</InlineAlert>
      ))}
      {w.form.targetProfile === 'production' && <ProductionLock />}
    </div>
  );
}

function ExecuteStep({ w }: { w: DeploymentWorkbenchState }) {
  const [rejectReason, setRejectReason] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  if (!w.runId || !w.status) {
    return (
      <GlassCard title="Execute deployment">
        <InlineAlert variant="info">Create a reviewed plan before execution.</InlineAlert>
      </GlassCard>
    );
  }
  const active = ['planned', 'approved', 'running', 'awaiting_approval'].includes(w.status.status);
  const quickAvailable = Boolean(w.status.validationId);
  const rollbackReady = w.stages.some((stage) => stage.key === 'rollback_ready' && stage.status === 'passed');
  return (
    <div className="space-y-4">
      <GlassCard
        title={(
          <div className="flex flex-wrap items-center gap-2">
            <span>Run {w.runId.slice(0, 8)}</span>
            <StatusBadge status={w.status.status} />
          </div>
        )}
        description="Stage updates use the live event stream with authenticated polling fallback."
        headerAction={(
          <span className={cn('flex items-center gap-1 text-xs', w.sseConnected ? 'text-emerald-300' : 'text-amber-300')}>
            <span className={cn('size-2 rounded-full', w.sseConnected ? 'bg-emerald-400' : 'bg-amber-400')} />
            {w.sseConnected ? 'Live' : 'Polling'}
          </span>
        )}
      >
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          Deployment status {w.status.status}. Current stage {w.status.currentStage ?? 'none'}.
        </div>
        <div className="space-y-2">
          {w.stages.map((stage) => <StageRow key={stage.key} stage={stage} />)}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {active && (
            <Button
              variant="outline"
              loading={w.actionPending === 'cancel'}
              onClick={() => void w.runAction('cancel')}
            >
              <XCircle className="mr-2 size-4" /> Cancel
            </Button>
          )}
          {w.status.status === 'awaiting_approval' && (
            <Button
              loading={w.actionPending === 'approve'}
              onClick={() => void w.runAction('approve')}
            >
              <ShieldCheck className="mr-2 size-4" /> Approve
            </Button>
          )}
          {runCanResume(w.status.status, w.progress ?? undefined) && (
            <Button loading={w.actionPending === 'resume'} onClick={() => void w.runAction('resume')}>
              <Play className="mr-2 size-4" /> Resume intelligent batches
            </Button>
          )}
          {quickAvailable && w.status.status !== 'passed' && (
            <Button
              variant="outline"
              loading={w.actionPending === 'quick-deploy'}
              onClick={() => void w.runAction('quick-deploy')}
            >
              Quick deploy validated package
            </Button>
          )}
        </div>
        {w.status.status === 'awaiting_approval' && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-end">
            <Field label="Rejection reason" htmlFor="reject-reason" className="flex-1">
              <Input id="reject-reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            </Field>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              loading={w.actionPending === 'reject'}
              onClick={() => void w.runAction('reject', { reason: rejectReason })}
            >
              Reject plan
            </Button>
          </div>
        )}
      </GlassCard>

      {w.progress?.totalBatches ? (
        <GlassCard title="Intelligent batches">
          <p className="mb-3 text-sm text-muted-foreground">
            {w.progress.completedBatches} of {w.progress.totalBatches} batches complete
          </p>
          <div className="space-y-2">
            {w.progress.batches.map((batch) => (
              <div key={batch.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                <span>Batch {batch.batchNumber}{batch.componentCount ? ` · ${batch.componentCount} components` : ''}</span>
                <StatusBadge status={batch.status} />
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      <ResultDetails w={w} />
      <DependenciesStep w={w} />

      {rollbackReady && (
        <GlassCard title="Rollback" description="Restores captured existing metadata. Net-new metadata is not deleted automatically.">
          <InlineAlert variant="warning" className="mb-3">
            Review net-new cleanup separately; rollback cannot recreate or safely infer destructive cleanup.
          </InlineAlert>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Rollback reason" htmlFor="rollback-reason" className="flex-1">
              <Input id="rollback-reason" value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} />
            </Field>
            <Button
              variant="destructive"
              disabled={!rollbackReason.trim()}
              loading={w.actionPending === 'rollback'}
              onClick={() => void w.runAction('rollback', { reason: rollbackReason })}
            >
              <RotateCcw className="mr-2 size-4" /> Roll back
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function StageRow({ stage }: { stage: WorkbenchStage }) {
  const icon = stage.status === 'passed'
    ? <CheckCircle2 className="size-4 text-emerald-400" />
    : stage.status === 'failed'
      ? <XCircle className="size-4 text-red-400" />
      : <span className={cn('size-2 rounded-full', stage.status === 'running' ? 'animate-pulse bg-primary' : 'bg-muted-foreground')} />;
  return (
    <details className="rounded-lg border border-border/60 px-3 py-2" open={stage.status === 'failed'}>
      <summary className="flex cursor-pointer list-none items-center gap-3">
        {icon}
        <span className="flex-1 text-sm font-medium">{readableStage(stage.key)}</span>
        <StatusBadge status={stage.status} />
      </summary>
      {(stage.error || stage.summary) && (
        <div className="mt-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
          {stage.error && <p className="text-red-300">{stage.error}</p>}
          {stage.summary && <pre className="mt-1 overflow-auto whitespace-pre-wrap">{JSON.stringify(stage.summary, null, 2)}</pre>}
        </div>
      )}
    </details>
  );
}

function ResultDetails({ w }: { w: DeploymentWorkbenchState }) {
  const validationStage = w.results?.stages.find((stage) => stage.key === 'validation');
  const raw = validationStage?.artifacts?.raw as Record<string, unknown> | undefined;
  const resultRoot = (raw?.result ?? raw) as Record<string, unknown> | undefined;
  const details = resultRoot?.details as Record<string, unknown> | undefined;
  const componentFailures = arrayValue(details?.componentFailures);
  const coverage = numberValue(validationStage?.summary?.coverage);
  return (
    <div className="space-y-4">
      <GlassCard title="Quality results">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Static issues" value={w.results?.issues.length ?? 0} danger={Boolean(w.results?.issues.length)} />
          <Metric
            label="Failed Apex tests"
            value={w.results?.testResults.filter((test) => test.status === 'failed').length ?? 0}
            danger={Boolean(w.results?.testResults.some((test) => test.status === 'failed'))}
          />
          <Metric label="Apex coverage" value={coverage === null ? '—' : `${coverage}%`} danger={coverage !== null && coverage < w.form.policy.tests.minimumCoverage} />
        </div>
      </GlassCard>
      {componentFailures.length > 0 && (
        <GlassCard title="Validation component failures">
          <GenericTable rows={componentFailures} />
        </GlassCard>
      )}
      {w.results?.issues.length ? (
        <GlassCard title="Static analysis issues">
          <div className="max-h-96 overflow-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="p-2">Severity</th><th className="p-2">Engine / rule</th>
                  <th className="p-2">Component</th><th className="p-2">Issue</th><th className="p-2">Location</th>
                </tr>
              </thead>
              <tbody>
                {w.results.issues.map((issue) => (
                  <tr key={issue.id} className="border-b border-border/40">
                    <td className="p-2"><StatusBadge status={issue.severity} /></td>
                    <td className="p-2">{issue.engine} · {issue.ruleId}</td>
                    <td className="p-2">{issue.component ?? '—'}</td>
                    <td className="p-2">{issue.message}</td>
                    <td className="p-2">{issue.file ?? '—'}{issue.line ? `:${issue.line}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}
      {w.results?.testResults.length ? (
        <GlassCard title="Apex tests">
          <div className="max-h-96 overflow-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="p-2">Class</th><th className="p-2">Method</th>
                  <th className="p-2">Status</th><th className="p-2">Duration</th><th className="p-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {w.results.testResults.map((test) => (
                  <tr key={test.id} className="border-b border-border/40">
                    <td className="p-2">{test.className}</td><td className="p-2">{test.methodName}</td>
                    <td className="p-2"><StatusBadge status={test.status} /></td>
                    <td className="p-2">{test.durationMs == null ? '—' : `${test.durationMs} ms`}</td>
                    <td className="p-2 text-red-300">{test.message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}

function HistoryView({ w }: { w: DeploymentWorkbenchState }) {
  return (
    <div className="space-y-4">
      <GlassCard title="Deployment history" description="Compatibility deployment records linked to workbench audit runs.">
        {!w.history.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No workbench deployments yet.</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="p-3">Deployment</th><th className="p-3">Source</th>
                  <th className="p-3">Target</th><th className="p-3">Strategy</th>
                  <th className="p-3">Status</th><th className="p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {w.history.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="p-3">
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => row.metadata?.workbenchRunId && void w.openHistoryRun(row.metadata.workbenchRunId)}
                      >
                        {row.metadata?.name || row.metadata?.workbenchRunId?.slice(0, 8)}
                      </button>
                    </td>
                    <td className="p-3">{row.repo}@{row.branch}</td>
                    <td className="p-3">{row.targetOrg?.alias ?? '—'}</td>
                    <td className="p-3">{row.metadata?.workbenchStrategy ?? row.strategy}</td>
                    <td className="p-3"><StatusBadge status={row.status} /></td>
                    <td className="p-3">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
      {w.results?.audits.length ? (
        <GlassCard title="Authoritative audit trail">
          <ol className="space-y-2">
            {w.results.audits.map((audit) => (
              <li key={audit.id} className="rounded-lg border border-border/60 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{readableStage(audit.action)}</span>
                  <time className="text-xs text-muted-foreground">{new Date(audit.createdAt).toLocaleString()}</time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Actor {audit.actorId}</p>
                {audit.details && <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(audit.details, null, 2)}</pre>}
              </li>
            ))}
          </ol>
        </GlassCard>
      ) : null}
    </div>
  );
}

function WizardFooter({ w }: { w: DeploymentWorkbenchState }) {
  const sourceBlocked = !w.form.targetOrgId || (
    w.form.sourceMode === 'org_compare'
      ? !w.form.sourceOrgId || w.form.sourceOrgId === w.form.targetOrgId
      : !w.scmSource
  );
  const componentBlocked = w.form.sourceMode === 'org_compare'
    && componentCount(w.form.components) + componentCount(w.form.destructiveSelections) === 0;
  const nextBlocked =
    (w.step === 0 && sourceBlocked)
    || (w.step === 1 && componentBlocked)
    || (w.step === 3 && w.validation.blockers.length > 0);

  const next = async () => {
    if (w.step === 3) {
      await w.previewPlan();
      return;
    }
    w.setStep(Math.min(4, w.step + 1));
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#workbench-main')?.focus());
  };
  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <Button variant="outline" disabled={w.step === 0} onClick={() => w.setStep(Math.max(0, w.step - 1))}>
        Back
      </Button>
      <div className="flex items-center gap-2">
        {w.step === 4 ? (
          <Button
            loading={w.creating}
            disabled={w.validation.blockers.length > 0 || !w.preview?.executionAvailable}
            onClick={() => void w.createRun()}
          >
            <Play className="mr-2 size-4" /> Create & execute plan
          </Button>
        ) : (
          <Button loading={w.previewing} disabled={nextBlocked} onClick={() => void next()}>
            {w.step === 3 ? 'Preview plan' : `Next: ${WORKBENCH_STEPS[w.step + 1]}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function PolicyToggle({
  id,
  label,
  checked,
  disabled,
  locked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}{locked && <Lock className="size-3.5 text-amber-300" aria-label="Policy locked" />}
      </Label>
    </div>
  );
}

function ProductionLock() {
  return (
    <InlineAlert variant="warning" title="Production policy locked">
      <span className="inline-flex items-center gap-1">
        <Lock className="size-3.5" />
        Validation, Apex tests, minimum 75% coverage, and approval are enforced by the server and cannot be bypassed here.
      </span>
    </InlineAlert>
  );
}

function Metric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold', danger && 'text-red-300')}>{value}</p>
    </div>
  );
}

function SummaryTerm({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium">{value}</dd></div>;
}

function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-xs capitalize',
      risk === 'high' ? 'bg-red-500/10 text-red-300' : risk === 'medium' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300',
    )}>
      {risk}
    </span>
  );
}

function GenericTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = useMemo(() => [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 8), [rows]);
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            {columns.map((column) => <th key={column} className="p-2">{readableStage(column)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/40">
              {columns.map((column) => <td key={column} className="max-w-sm p-2">{displayValue(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DependencyGraphVisual({ graph }: { graph: DependencyGraph }) {
  const layout = useMemo(() => layoutDependencyGraph(graph), [graph]);
  return (
    <figure className="mb-4 overflow-auto rounded-lg border border-border/60 bg-background/40 p-2">
      <svg
        role="img"
        aria-labelledby="dependency-graph-title dependency-graph-description"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="min-h-48 min-w-[560px] w-full"
      >
        <title id="dependency-graph-title">Resolved metadata dependency graph</title>
        <desc id="dependency-graph-description">
          Directed references between selected and included metadata. The following table contains the same decisions and reasons.
        </desc>
        <defs>
          <marker id="dependency-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {layout.edges.map((edge, index) => (
          <line
            key={`${edge.from}-${edge.to}-${index}`}
            x1={edge.fromPosition.x}
            y1={edge.fromPosition.y}
            x2={edge.toPosition.x}
            y2={edge.toPosition.y}
            className="stroke-muted-foreground/60"
            markerEnd="url(#dependency-arrow)"
          />
        ))}
        {layout.nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x - 65} ${node.y - 18})`}>
            <rect
              width="130"
              height="36"
              rx="8"
              className={node.selected ? 'fill-primary/20 stroke-primary' : 'fill-card stroke-border'}
            />
            <text x="65" y="22" textAnchor="middle" className="fill-foreground text-[10px]">
              {node.id.length > 20 ? `${node.id.slice(0, 18)}…` : node.id}
            </text>
          </g>
        ))}
      </svg>
      {layout.truncated && (
        <figcaption className="px-2 pb-1 text-xs text-muted-foreground">
          Visual graph limited to 24 nodes. The complete decision list remains in the table.
        </figcaption>
      )}
    </figure>
  );
}

function arrayValue(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  return [];
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function displayValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
