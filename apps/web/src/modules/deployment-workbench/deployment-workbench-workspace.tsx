'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeftRight,
  Boxes,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  FlaskConical,
  GitCompare,
  History,
  Lock,
  Play,
  Plus,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Target,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  BusyRow,
  DeploymentPageHeader,
  GlassCard,
  InlineAlert,
  LoadingOverlay,
  PageSkeleton,
  StatusBadge,
  WizardSteps,
} from '@/components/studio';
import { GitMetadataSourceFields } from '@/modules/source-control/git-metadata-source-fields';
import { cn } from '@/utils/cn';
import type { DeploymentWorkbenchState } from './use-deployment-workbench';
import { useDeploymentWorkbench } from './use-deployment-workbench';
import { ComponentsComparisonWindow } from './components-comparison-window';
import type { DependencyGraph, WorkbenchStage } from './types';
import {
  componentCount,
  groupQualityResults,
  layoutDependencyGraph,
  readableStage,
  serverRunActions,
  stageRisk,
  staticAnalysisEngineOptions,
  supportsDestructiveAcknowledgement,
  supportsOptionalDependencies,
  TERMINAL_RUN_STATUSES,
  WORKBENCH_STEPS,
} from './workbench-utils';

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
        <TabButton
          id="workbench-tab-plan"
          controls="workbench-panel-plan"
          active={tab === 'plan'}
          onClick={() => setTab('plan')}
        >
          Plan &amp; execute
        </TabButton>
        <TabButton
          id="workbench-tab-history"
          controls="workbench-panel-history"
          active={tab === 'history'}
          onClick={() => setTab('history')}
        >
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

      <section
        id={`workbench-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`workbench-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'history'
          ? <HistoryView w={w} />
          : <PlanView w={w} onOpenHistory={() => setTab('history')} />}
      </section>
    </div>
  );
}

function TabButton({
  active,
  controls,
  children,
  id,
  onClick,
}: {
  active: boolean;
  controls: string;
  children: React.ReactNode;
  id: string;
  onClick: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    if (!tabs.length) return;
    event.preventDefault();
    const current = tabs.indexOf(event.currentTarget);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    tabs[next]?.click();
  };
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-controls={controls}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
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

function PlanView({
  w,
  onOpenHistory,
}: {
  w: DeploymentWorkbenchState;
  onOpenHistory: () => void;
}) {
  const sourceReady = Boolean(w.form.targetOrgId) && (
    w.form.sourceMode === 'org_compare'
      ? Boolean(w.form.sourceOrgId) && w.form.sourceOrgId !== w.form.targetOrgId
      : Boolean(w.scmSource)
  );
  const componentsReady = w.form.sourceMode === 'scm'
    || componentCount(w.form.components) + componentCount(w.form.destructiveSelections) > 0;

  // Each wizard step is its own page; a step is only reachable once the
  // steps before it are satisfied (Plan Review needs a preview, Execute a run).
  const stepEnabled = (index: number): boolean => {
    if (index <= 0) return true;
    if (index <= 3) return sourceReady && (index === 1 || componentsReady);
    if (index === 4) return Boolean(w.preview);
    return Boolean(w.runId);
  };

  const goToStep = (index: number) => {
    if (!stepEnabled(index)) return;
    w.setStep(index);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector<HTMLElement>('#workbench-main')?.focus();
    });
  };

  return (
    <div className="relative space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/30 p-3">
        <WizardSteps
          steps={[...WORKBENCH_STEPS]}
          current={w.step}
          className="min-w-[760px]"
          onStepSelect={goToStep}
          isStepEnabled={stepEnabled}
        />
      </div>
      <main id="workbench-main" tabIndex={-1} className="relative focus:outline-none">
        {w.step === 0 && <SourceStep w={w} />}
        {w.step === 1 && <ComponentsStep w={w} />}
        {w.step === 2 && <DependenciesStep w={w} />}
        {w.step === 3 && <QualityStep w={w} />}
        {w.step === 4 && <ReviewStep w={w} />}
        {w.step === 5 && <ExecuteStep w={w} onOpenHistory={onOpenHistory} />}
        {w.previewing && (
          <LoadingOverlay
            label="Building the deployment plan…"
            sublabel="Resolving the manifest, dependencies, and quality gates on the server. This can take a moment for large selections."
          />
        )}
        {w.creating && (
          <LoadingOverlay
            label="Creating the deployment run…"
            sublabel="Persisting the immutable plan and starting execution."
          />
        )}
      </main>
      {w.step < 5 && !(w.step === 0 && w.form.sourceMode === 'org_compare') && (
        <WizardFooter w={w} />
      )}
    </div>
  );
}

function SourceStep({ w }: { w: DeploymentWorkbenchState }) {
  const orgCompare = w.form.sourceMode === 'org_compare';
  const sameOrg = Boolean(
    orgCompare && w.form.sourceOrgId && w.form.sourceOrgId === w.form.targetOrgId,
  );
  const sourceReady = orgCompare
    ? Boolean(w.form.sourceOrgId && w.form.targetOrgId && w.form.sourceOrgId !== w.form.targetOrgId)
    : Boolean(w.scmSource && w.form.targetOrgId);

  const startCompare = () => {
    w.setStep(1);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector<HTMLElement>('#workbench-main')?.focus();
    });
  };

  const swapOrgs = () => {
    const nextSource = w.form.targetOrgId;
    const nextTarget = w.form.sourceOrgId;
    w.selectSource(nextSource);
    w.selectTarget(nextTarget);
  };

  return (
    <GlassCard
      title={orgCompare ? 'Compare orgs' : 'Source and target'}
      description={orgCompare
        ? 'Pick the org you are deploying from and the org you are deploying to, then run a full metadata comparison.'
        : 'Choose a connected source-control manifest and the org to deploy to.'}
    >
      <fieldset className="space-y-5">
        <legend className="sr-only">Deployment source type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <SourceChoice
            name="workbench-source-mode"
            value="org_compare"
            checked={w.form.sourceMode === 'org_compare'}
            title="Org to org"
            description="Compare connected orgs in the background."
            onChange={() => w.selectSourceMode('org_compare')}
          />
          <SourceChoice
            name="workbench-source-mode"
            value="scm"
            checked={w.form.sourceMode === 'scm'}
            title="Source control"
            description="Azure DevOps, GitHub, or Bitbucket repository manifest."
            onChange={() => w.selectSourceMode('scm')}
          />
        </div>

        {orgCompare ? (
          <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
            <OrgSelectCard
              tone="source"
              label="Source org"
              hint="Deploy from"
              icon={<Cloud className="size-4" />}
              selectId="workbench-source-org"
              value={w.form.sourceOrgId}
              org={w.orgs.find((org) => org.id === w.form.sourceOrgId)}
              orgs={w.orgs}
              disabledId={w.form.targetOrgId}
              placeholder="Select source org…"
              onChange={(value) => w.selectSource(value)}
            />
            <div className="flex items-center justify-center md:pt-9">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={swapOrgs}
                disabled={!w.form.sourceOrgId && !w.form.targetOrgId}
                aria-label="Swap source and target orgs"
                title="Swap source and target"
              >
                <ArrowLeftRight className="size-4" />
              </Button>
            </div>
            <OrgSelectCard
              tone="target"
              label="Target org"
              hint="Deploy to"
              icon={<Target className="size-4" />}
              selectId="workbench-target-org"
              value={w.form.targetOrgId}
              org={w.orgs.find((org) => org.id === w.form.targetOrgId)}
              orgs={w.orgs}
              disabledId={w.form.sourceOrgId}
              placeholder="Select target org…"
              onChange={(value) => w.selectTarget(value)}
            />
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

        {sameOrg && (
          <InlineAlert variant="warning">
            Source and target must be different orgs to compare metadata.
          </InlineAlert>
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

        {orgCompare && (
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitCompare className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {sourceReady
                ? 'Ready. Choose "Compare orgs" to load every metadata difference between the two orgs.'
                : 'Select a source and target org to enable the comparison.'}
            </p>
            <Button type="button" onClick={startCompare} disabled={!sourceReady}>
              <GitCompare className="mr-2 size-4" /> Compare orgs
            </Button>
          </div>
        )}
      </fieldset>
    </GlassCard>
  );
}

function OrgSelectCard({
  tone,
  label,
  hint,
  icon,
  selectId,
  value,
  org,
  orgs,
  disabledId,
  placeholder,
  onChange,
}: {
  tone: 'source' | 'target';
  label: string;
  hint: string;
  icon: React.ReactNode;
  selectId: string;
  value: string;
  org?: { id: string; alias: string; type?: string; username?: string | null };
  orgs: Array<{ id: string; alias: string; type?: string }>;
  disabledId: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const selected = Boolean(value);
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border p-4 transition-colors',
        selected
          ? tone === 'source'
            ? 'border-sky-500/40 bg-sky-500/5'
            : 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-border/60 bg-card/40',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-lg',
              tone === 'source' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300',
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{hint}</p>
            <p className="truncate text-sm font-semibold">{org?.alias ?? label}</p>
          </div>
        </div>
        {selected && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />}
      </div>
      <Select
        id={selectId}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {orgs.map((option) => (
          <option key={option.id} value={option.id} disabled={option.id === disabledId}>
            {option.alias}
          </option>
        ))}
      </Select>
      {org?.type && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/60 px-2 py-0.5 capitalize">{org.type}</span>
          {org.username && <span className="truncate">{org.username}</span>}
        </div>
      )}
    </div>
  );
}

function SourceChoice({
  checked,
  title,
  description,
  name,
  onChange,
  value,
}: {
  checked: boolean;
  title: string;
  description: string;
  name: string;
  onChange: () => void;
  value: string;
}) {
  return (
    <label
      className={cn(
        'relative cursor-pointer rounded-xl border p-4 text-left transition-colors focus-within:ring-2 focus-within:ring-ring',
        checked ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="absolute right-4 top-4"
      />
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </label>
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

  const sourceLabel = w.orgs.find((org) => org.id === w.form.sourceOrgId)?.alias ?? 'Source org';
  const targetLabel = w.orgs.find((org) => org.id === w.form.targetOrgId)?.alias ?? 'Target org';

  return (
    <GlassCard
      title="Compare & select components"
      description="Pick a metadata type to load its components from both orgs, review the source-vs-target diff, then select what to deploy."
    >
      <ComponentsComparisonWindow
        comparisonId={w.form.comparisonId}
        comparisonStatus={w.comparisonStatus}
        comparisonSummary={w.comparisonSummary}
        items={w.compareItems}
        selectedKeys={w.selectedKeys}
        comparing={w.comparing}
        selectedItem={w.selectedCompareItem}
        itemDiff={w.compareItemDiff}
        itemDiffLoading={w.compareItemDiffLoading}
        itemDiffError={w.compareItemDiffError}
        sourceLabel={sourceLabel}
        targetLabel={targetLabel}
        onRetryComparison={w.retryComparison}
        onToggleItem={w.toggleCompareItem}
        onSelectItems={w.selectCompareItems}
        onSelectItem={(item) => void w.loadCompareItemDiff(item)}
      />
      {componentCount(w.form.destructiveSelections) > 0 && !w.capabilities?.supports.destructiveChanges && (
        <InlineAlert variant="error" title="Destructive plan blocked">
          The server must advertise destructive changes.
        </InlineAlert>
      )}
    </GlassCard>
  );
}

function DependenciesStep({ w }: { w: DeploymentWorkbenchState }) {
  const dependencyStage = w.results?.stages.find((stage) => stage.key === 'dependencies');
  const artifacts = dependencyStage?.artifacts;
  const previewDependencies = w.preview?.dependencies;
  const graph = (artifacts?.graph ?? (
    previewDependencies
      ? { nodes: previewDependencies.nodes, edges: previewDependencies.edges }
      : undefined
  )) as DependencyGraph | undefined;
  const decisions = (artifacts?.decisions ?? previewDependencies?.reasons ?? []) as Array<{
    nodeId: string;
    decision: string;
    reason: string;
  }>;
  const missing = (artifacts?.missing ?? previewDependencies?.missing ?? []) as Array<{
    nodeId: string;
    requiredBy?: string[];
    explanation?: string;
  }>;
  const cycles = (artifacts?.cycles ?? previewDependencies?.cycles ?? []) as string[][];
  const batchCount = Number(previewDependencies?.batchEstimate?.batchCount ?? 0);
  const dependencyAvailable = Boolean(dependencyStage || previewDependencies);

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
              name="workbench-dependency-mode"
              value={value}
              checked={w.form.dependencyPolicy.mode === value}
              title={title}
              description={description}
              onChange={() => w.setForm((current) => ({
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
            {supportsOptionalDependencies(w.capabilities) && (
              <PolicyToggle
                id="include-optional"
                label="Include optional dependencies"
                checked={w.form.dependencyPolicy.includeOptional}
                onChange={(checked) => w.setForm((current) => ({
                  ...current,
                  dependencyPolicy: { ...current.dependencyPolicy, includeOptional: checked },
                }))}
              />
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Resolved dependency graph" description="Accessible list and table fallback for the execution graph.">
        {!dependencyAvailable ? (
          <InlineAlert variant="info">
            Preview the plan to resolve the selected manifest against a read-only source checkout.
          </InlineAlert>
        ) : (
          <>
            {dependencyStage?.error && <InlineAlert variant="error">{dependencyStage.error}</InlineAlert>}
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="Nodes" value={graph?.nodes.length ?? 0} />
              <Metric label="Edges" value={graph?.edges.length ?? 0} />
              <Metric label="Missing" value={missing.length} danger={missing.length > 0} />
              <Metric label="Cycles" value={cycles.length} danger={cycles.length > 0} />
              <Metric label="Estimated batches" value={batchCount} />
            </div>
            {graph?.nodes.length ? <DependencyGraphVisual graph={graph} /> : null}
            {graph?.nodes.length ? (
              <details className="mb-4 rounded-lg border border-border/60 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Accessible dependency graph fallback
                </summary>
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Dependency graph nodes</caption>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="p-2">Node</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Selection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graph.nodes.map((node) => (
                      <tr key={node.id} className="border-t border-border/40">
                        <td className="p-2">{node.id}</td>
                        <td className="p-2">{node.metadataType ?? '—'}</td>
                        <td className="p-2">{node.selected ? 'Selected' : 'Included'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h4 className="mt-3 text-sm font-medium">Directed references</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {graph.edges.map((edge, index) => (
                    <li key={`${edge.from}-${edge.to}-${index}`}>
                      {edge.from} → {edge.to}{edge.explanation ? `: ${edge.explanation}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
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
  const selectedTestCount = w.form.policy.tests.tests.length;

  return (
    <div className="space-y-4">
      {production && <ProductionLock />}
      <GlassCard
        title={<SectionTitle icon={ShieldCheck}>Quality gates</SectionTitle>}
        description="Server-enforced gates that must pass before the target org is mutated."
      >
        <div className="space-y-3">
          <PolicyToggle
            id="validation-required"
            label="Validation required"
            description="Runs a full check-only deploy against the target and blocks on any component failure."
            checked={w.form.policy.validation.required}
            disabled={production || w.form.strategy === 'validate_then_quick'}
            locked={production || w.form.strategy === 'validate_then_quick'}
            onChange={(checked) => w.setPolicy((policy) => ({ ...policy, validation: { required: checked } }))}
          />
          <PolicyToggle
            id="snapshot-required"
            label="Capture target snapshot"
            description="Retrieves the affected metadata from the target before deploying so the previous state is preserved."
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
            description="Fails the run if a restorable snapshot could not be captured. Requires the target snapshot gate."
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
            description="Pauses the run before deployment until the configured approvers sign off."
            checked={w.form.policy.approval.required}
            disabled={production}
            locked={production}
            onChange={(checked) => w.setPolicy((policy) => ({
              ...policy,
              approval: { ...policy.approval, required: checked },
            }))}
          />
          {w.form.policy.approval.required && (
            <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/10 p-3 md:grid-cols-2">
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

      <AutomaticStaticAnalysisCard w={w} />

      <GlassCard
        title={<SectionTitle icon={FlaskConical}>Apex tests and coverage</SectionTitle>}
        description="Test execution and the minimum org-wide coverage enforced during validation and deployment."
      >
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
            <legend className="flex items-center gap-2 text-sm font-medium">
              Apex test classes
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                selectedTestCount > 0
                  ? 'bg-primary/10 text-primary'
                  : 'bg-amber-500/10 text-amber-300',
              )}
              >
                {selectedTestCount} selected
              </span>
            </legend>
            <Input
              value={testSearch}
              onChange={(event) => setTestSearch(event.target.value)}
              placeholder="Filter Apex classes…"
              aria-label="Filter Apex test classes"
              className="my-2 max-w-md"
            />
            <div className="max-h-60 overflow-auto rounded-lg border border-border/60 p-2">
              {w.testClassesLoading ? (
                <BusyRow label="Loading Apex classes from the target org…" />
              ) : !filteredTests.length ? (
                <p className="p-3 text-sm text-muted-foreground">
                  {w.testClasses.length
                    ? 'No Apex classes match the filter.'
                    : 'No Apex classes were found in the target org.'}
                </p>
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

      <GlassCard
        title={<SectionTitle icon={Database}>Chained data deployment</SectionTitle>}
        description="Run a reviewed data configuration against the target after the metadata deployment succeeds."
      >
        <PolicyToggle
          id="chained-data"
          label="Enable chained data"
          description="Copies the configured object records from the source org once every metadata stage has passed."
          checked={w.form.chainedDataEnabled}
          onChange={(checked) => w.setForm((current) => ({ ...current, chainedDataEnabled: checked }))}
        />
        {w.form.chainedDataEnabled && (
          <div className="mt-4 space-y-3">
            <PolicyToggle
              id="chained-stop"
              label="Stop data chain on first error"
              description="Halts remaining data steps as soon as one object fails instead of continuing the chain."
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
                placeholder='[{"objectName":"Account","strategy":"upsert","matchField":"Name"}]'
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each entry needs an objectName plus an optional soql filter, strategy (insert or upsert), and matchField for upserts.
              </p>
            </Field>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function AutomaticStaticAnalysisCard({ w }: { w: DeploymentWorkbenchState }) {
  const requested = new Set(w.form.policy.staticAnalysis.engines);
  const engineOptions = staticAnalysisEngineOptions(w.capabilities)
    .filter((engine) => requested.size === 0 || requested.has(engine.id));
  const production = w.form.targetProfile === 'production';
  return (
    <GlassCard
      title={(
        <div className="flex items-center gap-2.5">
          <SectionTitle icon={ScanSearch}>Static code analysis</SectionTitle>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            Automatic
          </span>
        </div>
      )}
      description="Nothing to configure — a complete static code analysis runs in the background on every deployment."
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Every available analyzer is executed against the exact resolved source while the
          deployment runs; analyzers that are not installed on the server are skipped
          automatically. Findings appear in the results and in the audit trail.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {engineOptions.map((engine) => (
            <div
              key={engine.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5',
                engine.available ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/5',
              )}
            >
              <ScanSearch
                className={cn('mt-0.5 size-4 shrink-0', engine.available ? 'text-primary' : 'text-muted-foreground')}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-sm font-medium', !engine.available && 'text-muted-foreground')}>
                    {engine.label}
                  </span>
                  {engine.available ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                      Runs automatically
                    </span>
                  ) : (
                    <span className="rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Not installed — skipped
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {engine.description}
                </span>
                {!engine.available && engine.requires && (
                  <span className="mt-1.5 block text-xs text-amber-300/90">{engine.requires}</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <InlineAlert variant={production ? 'warning' : 'info'}>
          {production
            ? 'Production target: any error or critical finding blocks the deployment before the org is touched.'
            : 'Findings are reported without blocking this environment. Production targets block on error and critical findings.'}
        </InlineAlert>
      </div>
    </GlassCard>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold leading-none tracking-tight">{children}</span>
    </div>
  );
}

function ReviewStep({ w }: { w: DeploymentWorkbenchState }) {
  const stages = w.preview?.stages ?? [];
  const destructiveCount = Math.max(
    componentCount(w.form.destructiveSelections),
    w.destructiveReview?.componentCount ?? 0,
  );
  const dependencies = w.preview?.dependencies;
  const hashReviewSupported = supportsDestructiveAcknowledgement(w.capabilities)
    || Boolean(w.preview?.sourceResolution?.digest);
  const estimatedBatches = Number(dependencies?.batchEstimate.batchCount ?? 1);
  const resolvedComponents = Number(
    dependencies?.summary.resolved ?? componentCount(w.form.components),
  );
  return (
    <div className="space-y-4">
      <GlassCard title="Deployment plan" description="Review server-normalized stages, batches, risks, and immutable policy gates.">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Resolved components" value={resolvedComponents} />
          <Metric label="Destructive" value={destructiveCount} danger={destructiveCount > 0} />
          <Metric label="Estimated batches" value={estimatedBatches} />
          <Metric label="Stages" value={stages.length} />
        </div>
        {w.preview?.sourceResolution && (
          <>
            <InlineAlert variant="info" className="mb-4">
              Read-only {w.preview.sourceResolution.type === 'scm' ? 'SCM checkout' : 'source-org retrieve'} resolved{' '}
              {w.preview.sourceResolution.selectedComponents} selected component(s) from{' '}
              {w.preview.sourceResolution.manifest}.
            </InlineAlert>
            <dl className="mb-4 grid gap-3 rounded-lg border border-border/60 p-3 text-sm sm:grid-cols-2">
              <SummaryTerm
                label="Pinned commit SHA"
                value={w.preview.sourceResolution.commitSha ?? w.preview.sourceResolution.revision ?? 'Not supplied'}
              />
              <SummaryTerm
                label="Source digest"
                value={w.preview.sourceResolution.sourceDigest ?? w.preview.sourceResolution.digest ?? 'Not supplied'}
              />
            </dl>
          </>
        )}
        {dependencies?.blocking.map((reason) => (
          <InlineAlert key={reason} variant="error" title="Dependency blocker" className="mb-3">
            {reason}
          </InlineAlert>
        ))}
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
      {destructiveCount > 0 && (
        <GlassCard
          title="Destructive manifest acknowledgement"
          description="The acknowledgement is bound to the exact server-generated manifest hash."
        >
          {!hashReviewSupported ? (
            <InlineAlert variant="error" title="Destructive execution blocked">
              This backend does not advertise hash-bound destructive acknowledgement support.
            </InlineAlert>
          ) : w.destructiveReviewLoading ? (
            <BusyRow label="Loading the server-generated destructive manifest…" />
          ) : w.destructiveReview ? (
            <div className="space-y-3">
              {!w.runId && (
                <InlineAlert variant="warning" title="Execution will pause for destructive review">
                  The server generated this destructive manifest from your selection. After the
                  plan is created, target mutation stays blocked until this exact digest is
                  explicitly acknowledged.
                </InlineAlert>
              )}
              <dl><SummaryTerm label="Manifest SHA-256" value={w.destructiveReview.manifestHash} /></dl>
              <pre className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
                {w.destructiveReview.manifestXml}
              </pre>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={w.destructiveAcknowledgedHash === w.destructiveReview.manifestHash}
                  onChange={(event) => w.setDestructiveAcknowledgedHash(
                    event.target.checked ? w.destructiveReview!.manifestHash : null,
                  )}
                />
                <span>
                  I reviewed and explicitly acknowledge destructive manifest hash{' '}
                  <code>{w.destructiveReview.manifestHash}</code>.
                </span>
              </label>
            </div>
          ) : !w.runId ? (
            <InlineAlert variant="warning" title="Execution will pause for destructive review">
              Create the immutable plan to fetch its server-generated destructive manifest and
              SHA-256 digest. Target mutation remains blocked until that exact digest is explicitly
              acknowledged.
            </InlineAlert>
          ) : (
            <InlineAlert variant="error" title="Destructive execution blocked">
              The server did not return a manifest and hash for this exact plan.
            </InlineAlert>
          )}
        </GlassCard>
      )}
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

function ExecuteStep({
  w,
  onOpenHistory,
}: {
  w: DeploymentWorkbenchState;
  onOpenHistory: () => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [showReport, setShowReport] = useState(false);
  if (!w.runId || !w.status) {
    return (
      <GlassCard title="Execute deployment">
        <InlineAlert variant="info">Create a reviewed plan before execution.</InlineAlert>
      </GlassCard>
    );
  }
  const actions = serverRunActions(w.status);
  const terminal = TERMINAL_RUN_STATUSES.includes(w.status.status as never);
  const succeeded = w.status.status === 'passed';

  // Success shows ONLY the success screen; the full report is opt-in so the
  // page never stacks every planning section under the result again.
  if (terminal && succeeded && !showReport) {
    return (
      <div className="space-y-4">
        <SuccessPanel w={w} onOpenHistory={onOpenHistory} onShowReport={() => setShowReport(true)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {terminal && succeeded && (
        <SuccessPanel
          w={w}
          compact
          onOpenHistory={onOpenHistory}
          onShowReport={() => setShowReport(false)}
          reportOpen
        />
      )}
      {terminal && !succeeded && (
        <InlineAlert
          variant={w.status.status === 'failed' ? 'error' : 'warning'}
          title={w.status.status === 'failed' ? 'Deployment failed' : `Deployment ${w.status.status}`}
        >
          Review the stage outcomes and quality results below
          {actions.canRollback ? ', or roll the target back to its captured snapshot' : ''}.
        </InlineAlert>
      )}

      <RunProgressCard
        w={w}
        actions={actions}
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
      />

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

      {(w.destructiveReview || w.destructiveReviewLoading) && !terminal && (
        <GlassCard
          title="Destructive manifest review"
          description="Target mutation is blocked until this persisted plan digest is explicitly approved."
        >
          {w.destructiveReviewLoading || !w.destructiveReview ? (
            <BusyRow label="Loading the server-generated destructive manifest…" />
          ) : (
            <div className="space-y-3">
              <dl>
                <SummaryTerm label="Manifest SHA-256" value={w.destructiveReview.manifestHash} />
              </dl>
              <pre className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
                {w.destructiveReview.manifestXml}
              </pre>
              {w.status?.destructiveReviewed
              || w.destructiveSubmittedHash === w.destructiveReview.manifestHash ? (
                <InlineAlert variant="success">
                  This exact destructive manifest digest is acknowledged.
                </InlineAlert>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={w.destructiveAcknowledgedHash === w.destructiveReview.manifestHash}
                      onChange={(event) => w.setDestructiveAcknowledgedHash(
                        event.target.checked ? w.destructiveReview!.manifestHash : null,
                      )}
                    />
                    <span>
                      I reviewed every deletion and acknowledge digest{' '}
                      <code>{w.destructiveReview.manifestHash}</code>.
                    </span>
                  </label>
                  <Button
                    variant="destructive"
                    disabled={w.destructiveAcknowledgedHash !== w.destructiveReview.manifestHash}
                    loading={w.actionPending === 'destructive-review'}
                    onClick={() => void w.submitDestructiveReview()}
                  >
                    Confirm destructive review
                  </Button>
                </>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {(terminal || w.status.status === 'awaiting_approval') && <ResultDetails w={w} />}

      {terminal
        && w.form.sourceMode === 'org_compare'
        && w.form.comparisonId
        && (showReport || !succeeded) && (
        <GlassCard
          title="Deployed selection & source-versus-target XML"
          description="The comparison from this run stays available for inspection without starting a new one."
        >
          <ComponentsComparisonWindow
            comparisonId={w.form.comparisonId}
            comparisonStatus={w.comparisonStatus}
            comparisonSummary={w.comparisonSummary}
            items={w.compareItems}
            selectedKeys={w.selectedKeys}
            comparing={w.comparing}
            selectedItem={w.selectedCompareItem}
            itemDiff={w.compareItemDiff}
            itemDiffLoading={w.compareItemDiffLoading}
            itemDiffError={w.compareItemDiffError}
            sourceLabel={w.orgs.find((org) => org.id === w.form.sourceOrgId)?.alias ?? 'Source org'}
            targetLabel={w.orgs.find((org) => org.id === w.form.targetOrgId)?.alias ?? 'Target org'}
            onRetryComparison={w.retryComparison}
            onToggleItem={w.toggleCompareItem}
            onSelectItems={w.selectCompareItems}
            onSelectItem={(item) => void w.loadCompareItemDiff(item)}
          />
        </GlassCard>
      )}

      {actions.canRollback && (
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

/** Clean, single-purpose success screen shown when a run passes. */
function SuccessPanel({
  w,
  onOpenHistory,
  onShowReport,
  compact,
  reportOpen,
}: {
  w: DeploymentWorkbenchState;
  onOpenHistory: () => void;
  onShowReport: () => void;
  compact?: boolean;
  reportOpen?: boolean;
}) {
  const grouped = groupQualityResults(w.results, w.status);
  const targetAlias = w.orgs.find((org) => org.id === w.form.targetOrgId)?.alias
    ?? w.status?.results?.validation?.summary?.targetAlias
    ?? 'target org';
  const deployed = componentCount(w.form.components);
  const destructive = componentCount(w.form.destructiveSelections);
  const durationMs = w.status
    ? Math.max(0, new Date(w.status.updatedAt).getTime() - new Date(w.status.createdAt).getTime())
    : 0;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Deployment successful — full report below
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onShowReport}>
            {reportOpen ? 'Hide full report' : 'View full report'}
          </Button>
          <Button size="sm" onClick={() => w.resetPlan()}>
            <Plus className="mr-1.5 size-4" /> New deployment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <GlassCard className="border-emerald-500/40">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-9 text-emerald-400" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Deployment successful</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {deployed > 0 ? `${deployed} component${deployed === 1 ? '' : 's'} deployed` : 'Deployment completed'}
            {destructive > 0 ? ` · ${destructive} deleted` : ''} to <strong>{String(targetAlias)}</strong>
            {durationMs > 0 ? ` in ${formatDuration(durationMs)}` : ''}.
          </p>
        </div>
        <dl className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Components" value={deployed || '—'} />
          <Metric
            label="Apex coverage"
            value={grouped.coverage === null ? '—' : `${grouped.coverage}%`}
          />
          <Metric
            label="Static findings"
            value={grouped.staticIssues.length}
            danger={grouped.staticIssues.length > 0}
          />
          <Metric label="Run" value={w.runId ? w.runId.slice(0, 8) : '—'} />
        </dl>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button onClick={() => w.resetPlan()}>
            <Plus className="mr-2 size-4" /> Start new deployment
          </Button>
          <Button variant="outline" onClick={onShowReport}>
            <FileText className="mr-2 size-4" /> View full report
          </Button>
          <Button variant="ghost" onClick={onOpenHistory}>
            <History className="mr-2 size-4" /> Audit &amp; history
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

/** Live run card: stage loader banner + stage list + server-authorized actions. */
function RunProgressCard({
  w,
  actions,
  rejectReason,
  onRejectReasonChange,
}: {
  w: DeploymentWorkbenchState;
  actions: ReturnType<typeof serverRunActions>;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
}) {
  if (!w.runId || !w.status) return null;
  const terminal = TERMINAL_RUN_STATUSES.includes(w.status.status as never);
  const runningStage = w.stages.find((stage) => stage.status === 'running');
  const sourceIdentity = w.results?.artifacts?.source as Record<string, unknown> | undefined;
  const pinnedCommit = typeof sourceIdentity?.commitSha === 'string'
    ? sourceIdentity.commitSha
    : w.status.commitSha;
  const sourceDigest = typeof sourceIdentity?.digest === 'string'
    ? sourceIdentity.digest
    : w.status.sourceDigest;
  return (
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
      {!terminal && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Spinner size="md" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {runningStage
                ? `${readableStage(runningStage.key)} is running in the background…`
                : w.status.status === 'awaiting_approval'
                  ? 'Waiting for approval — nothing runs until the plan is approved.'
                  : 'Working… the next stage starts automatically.'}
            </p>
            <p className="text-xs text-muted-foreground">
              You can keep this page open; every stage updates live.
            </p>
          </div>
        </div>
      )}
      {(pinnedCommit || sourceDigest) && (
        <dl className="mb-4 grid gap-3 rounded-lg border border-border/60 p-3 text-sm sm:grid-cols-2">
          <SummaryTerm label="Pinned commit SHA" value={pinnedCommit ?? '—'} />
          <SummaryTerm label="Source digest" value={sourceDigest ?? '—'} />
        </dl>
      )}
      <div className="space-y-2">
        {w.stages.map((stage) => <StageRow key={stage.key} stage={stage} />)}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {actions.canCancel && (
          <Button
            variant="outline"
            loading={w.actionPending === 'cancel'}
            onClick={() => void w.runAction('cancel')}
          >
            <XCircle className="mr-2 size-4" /> Cancel
          </Button>
        )}
        {actions.canApprove && (
          <Button
            loading={w.actionPending === 'approve'}
            onClick={() => void w.runAction('approve')}
          >
            <ShieldCheck className="mr-2 size-4" /> Approve
          </Button>
        )}
        {actions.canResume && (
          <Button loading={w.actionPending === 'resume'} onClick={() => void w.runAction('resume')}>
            <Play className="mr-2 size-4" /> Resume intelligent batches
          </Button>
        )}
        {actions.canQuickDeploy && (
          <Button
            variant="outline"
            loading={w.actionPending === 'quick-deploy'}
            onClick={() => void w.runAction('quick-deploy')}
          >
            Quick deploy validated package
          </Button>
        )}
      </div>
      {actions.canReject && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-end">
          <Field label="Rejection reason" htmlFor="reject-reason" className="flex-1">
            <Input id="reject-reason" value={rejectReason} onChange={(event) => onRejectReasonChange(event.target.value)} />
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
  );
}

function StageRow({ stage }: { stage: WorkbenchStage }) {
  const icon = stage.status === 'passed'
    ? <CheckCircle2 className="size-4 text-emerald-400" />
    : stage.status === 'failed'
      ? <XCircle className="size-4 text-red-400" />
      : stage.status === 'running'
        ? <Spinner size="sm" label={`${readableStage(stage.key)} running`} />
        : <span className="size-2 rounded-full bg-muted-foreground" />;
  return (
    <details
      className={cn(
        'rounded-lg border px-3 py-2',
        stage.status === 'running' ? 'border-primary/40 bg-primary/5' : 'border-border/60',
      )}
      open={stage.status === 'failed'}
    >
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
  const grouped = groupQualityResults(w.results, w.status);
  return (
    <div className="space-y-4">
      <GlassCard title="Quality results">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Static issues" value={grouped.staticIssues.length} danger={grouped.staticIssues.length > 0} />
          <Metric
            label="Validation component failures"
            value={grouped.validationComponentFailures.length}
            danger={grouped.validationComponentFailures.length > 0}
          />
          <Metric
            label="Failed Apex tests"
            value={grouped.apexTestFailures.length}
            danger={grouped.apexTestFailures.length > 0}
          />
          <Metric label="Apex coverage" value={grouped.coverage === null ? '—' : `${grouped.coverage}%`} danger={grouped.coverage !== null && grouped.coverage < w.form.policy.tests.minimumCoverage} />
        </div>
      </GlassCard>
      {grouped.validationComponentFailures.length > 0 && (
        <GlassCard title="Validation component failures">
          <GenericTable rows={grouped.validationComponentFailures} />
        </GlassCard>
      )}
      {grouped.apexTestFailures.length > 0 && !w.results?.testResults.length && (
        <GlassCard title="Apex test failures from validation artifacts">
          <GenericTable rows={grouped.apexTestFailures} />
        </GlassCard>
      )}
      {grouped.staticIssues.length ? (
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
                {grouped.staticIssues.map((issue) => (
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
  const updateFilter = <K extends keyof typeof w.historyFilters>(
    key: K,
    value: (typeof w.historyFilters)[K],
  ) => w.setHistoryFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="relative space-y-4">
      {w.historyLoading && (
        <LoadingOverlay label="Loading deployment history…" />
      )}
      <GlassCard title="Deployment history" description="Authoritative quality runs, gates, validation, and stage outcomes.">
        <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Source" htmlFor="history-source">
            <Select
              id="history-source"
              value={w.historyFilters.source}
              onChange={(event) => updateFilter('source', event.target.value as typeof w.historyFilters.source)}
            >
              <option value="">All sources</option>
              <option value="org_compare">Org to org</option>
              <option value="scm">Source control</option>
            </Select>
          </Field>
          <Field label="Target" htmlFor="history-target">
            <Select
              id="history-target"
              value={w.historyFilters.target}
              onChange={(event) => updateFilter('target', event.target.value)}
            >
              <option value="">All targets</option>
              {w.orgs.map((org) => <option key={org.id} value={org.id}>{org.alias}</option>)}
            </Select>
          </Field>
          <Field label="Environment" htmlFor="history-environment">
            <Select
              id="history-environment"
              value={w.historyFilters.environment}
              onChange={(event) => updateFilter(
                'environment',
                event.target.value as typeof w.historyFilters.environment,
              )}
            >
              <option value="">All environments</option>
              <option value="scratch">Scratch</option>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="history-status">
            <Select
              id="history-status"
              value={w.historyFilters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {['planned', 'running', 'awaiting_approval', 'passed', 'failed', 'cancelled', 'rejected']
                .map((status) => <option key={status} value={status}>{readableStage(status)}</option>)}
            </Select>
          </Field>
          <Field label="From" htmlFor="history-from">
            <Input
              id="history-from"
              type="date"
              value={w.historyFilters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="history-to">
            <Input
              id="history-to"
              type="date"
              value={w.historyFilters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
            />
          </Field>
          <Field label="Owner ID (admin)" htmlFor="history-owner">
            <Input
              id="history-owner"
              value={w.historyFilters.owner}
              onChange={(event) => updateFilter('owner', event.target.value)}
              placeholder="Current owner by default"
            />
          </Field>
          <div className="flex items-end">
            <Button
              className="w-full"
              loading={w.historyLoading}
              onClick={() => void w.loadHistory({ ...w.historyFilters, page: 1 })}
            >
              Apply filters
            </Button>
          </div>
        </div>
        {!w.history.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No workbench deployments yet.</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="p-3">Deployment</th><th className="p-3">Source</th>
                  <th className="p-3">Target</th><th className="p-3">Gates</th>
                  <th className="p-3">Validation</th><th className="p-3">Duration</th>
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
                        onClick={() => void w.openHistoryRun(row.id)}
                      >
                        {row.name || row.id.slice(0, 8)}
                      </button>
                      <p className="text-xs text-muted-foreground">{row.owner.displayName ?? row.owner.id}</p>
                    </td>
                    <td className="p-3">{row.source.label}</td>
                    <td className="p-3">{row.target.alias ?? row.target.id}<br /><span className="text-xs text-muted-foreground">{row.environment}</span></td>
                    <td className="p-3"><StatusBadge status={row.gateOutcome} /></td>
                    <td className="p-3">
                      <StatusBadge status={row.validation.status} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.coverage == null ? 'Coverage —' : `${row.coverage.toFixed(1)}% coverage`}
                      </p>
                    </td>
                    <td className="p-3">{formatDuration(row.durationMs)}</td>
                    <td className="p-3"><StatusBadge status={row.status} /></td>
                    <td className="p-3">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {w.historyResponse.total} run(s) · page {w.historyResponse.page} of {Math.max(1, w.historyResponse.totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={w.historyLoading || w.historyResponse.page <= 1}
              onClick={() => void w.loadHistory({
                ...w.historyFilters,
                page: w.historyResponse.page - 1,
              })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={w.historyLoading || w.historyResponse.page >= w.historyResponse.totalPages}
              onClick={() => void w.loadHistory({
                ...w.historyFilters,
                page: w.historyResponse.page + 1,
              })}
            >
              Next
            </Button>
          </div>
        </div>
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
  const deployableCount = componentCount(w.form.components);
  const destructiveCount = Math.max(
    componentCount(w.form.destructiveSelections),
    w.destructiveReview?.componentCount ?? 0,
  );
  const destructivePreviewSupported = destructiveCount === 0
    || w.capabilities?.supports.destructiveChanges === true;
  const destructiveExecutionSupported = destructiveCount === 0
    || (
      w.capabilities?.supports.destructiveChanges === true
      && (
        supportsDestructiveAcknowledgement(w.capabilities)
        || Boolean(w.preview?.sourceResolution?.digest)
      )
      && (
        deployableCount > 0
        || w.capabilities?.supports.destructiveOnly === true
        || w.capabilities?.supports.destructiveChanges === true
      )
    );
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
    || (w.step === 3 && (w.validation.blockers.length > 0 || !destructivePreviewSupported));

  const focusStepTop = () => requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector<HTMLElement>('#workbench-main')?.focus();
  });
  const next = async () => {
    if (w.step === 3) {
      const previewed = await w.previewPlan();
      if (previewed) focusStepTop();
      return;
    }
    w.setStep(Math.min(4, w.step + 1));
    focusStepTop();
  };
  const back = () => {
    w.setStep(Math.max(0, w.step - 1));
    focusStepTop();
  };
  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <Button variant="outline" disabled={w.step === 0 || w.previewing || w.creating} onClick={back}>
        Back
      </Button>
      <div className="flex items-center gap-2">
        {w.step === 4 ? (
          <Button
            loading={w.creating}
            disabled={
              w.validation.blockers.length > 0
              || !w.preview?.executionAvailable
              || !destructiveExecutionSupported
              || w.destructiveReviewLoading
            }
            onClick={() => void w.createRun()}
          >
            <Play className="mr-2 size-4" /> {destructiveCount > 0
              ? 'Create plan for destructive review'
              : 'Create & execute plan'}
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
  description,
  checked,
  disabled,
  locked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (!description) {
    return (
      <div className="flex items-center gap-3">
        <Switch id={id} checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {label}{locked && <Lock className="size-3.5 text-amber-300" aria-label="Policy locked" />}
        </Label>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border p-3 transition-colors',
        checked ? 'border-primary/30 bg-primary/[0.04]' : 'border-border/60 bg-muted/5',
        disabled && 'opacity-70',
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {label}{locked && <Lock className="size-3.5 text-amber-300" aria-label="Policy locked" />}
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onChange={onChange} aria-label={label} className="mt-0.5" />
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

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  const seconds = Math.round(durationMs / 1_000);
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
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

function displayValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
