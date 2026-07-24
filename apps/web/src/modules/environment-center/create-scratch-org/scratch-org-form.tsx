'use client';

import { useId } from 'react';
import { SCRATCH_ORG_SKIPPABLE_STEPS, type ScratchPipelineTemplateConfig } from '@sfcc/shared';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  CloudUpload,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/studio/form-section';
import { GitMetadataSourceFields } from '@/modules/source-control/git-metadata-source-fields';
import type { GitMetadataSourceHook } from '@/modules/source-control/use-git-metadata-source';
import { cn } from '@/utils/cn';
import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import type {
  ExistingOrgEligibility,
  ExistingScratchOrgCandidate,
} from './types';
import { Button } from '@/components/ui/button';
import {
  isActiveRecentRun,
  isCandidateSelectable,
} from './existing-scratch-org-utils';

interface ScratchOrgFormProps {
  form: ScratchOrgFormState;
  setForm: (f: ScratchOrgFormState) => void;
  devHubs: { alias: string }[];
  sourceOrgs: { id: string; alias: string }[];
  templateMeta?: { name: string; config: ScratchPipelineTemplateConfig } | null;
  metadataSource: GitMetadataSourceHook;
  installPackage: boolean;
  setInstallPackage: (v: boolean) => void;
  isRunning: boolean;
  mode: 'create_new' | 'configure_existing';
  onModeChange: (mode: 'create_new' | 'configure_existing') => void;
  existingCandidates: ExistingScratchOrgCandidate[];
  existingOrgConnectionId: string;
  onExistingOrgChange: (id: string) => void;
  existingOrgOptions: {
    verifyAuthentication: boolean;
    ensureRequiredPackage: boolean;
  };
  onExistingOrgOptionsChange: (options: {
    verifyAuthentication: boolean;
    ensureRequiredPackage: boolean;
  }) => void;
  eligibility: ExistingOrgEligibility | null;
  eligibilityLoading: boolean;
  eligibilityError: string | null;
  onOpenRun: (runId: string) => void;
  /** Run id currently being opened/restored, if any. */
  openingRunId?: string | null;
  onCancelConflict: (runId: string) => void;
  stoppingConflict: boolean;
}

function Field({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('min-w-0', className)}>{children}</div>;
}

function PipelineOptionCard({
  label,
  description,
  checked,
  onChange,
  disabled,
  icon: Icon,
  iconClass,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors h-full',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/30',
        disabled && 'opacity-60 cursor-not-allowed',
        !disabled && 'hover:border-primary/25',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 rounded border-border shrink-0"
      />
      <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconClass)}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
    </label>
  );
}

export function ScratchOrgForm({
  form,
  setForm,
  devHubs,
  sourceOrgs,
  templateMeta,
  metadataSource,
  installPackage,
  setInstallPackage,
  isRunning,
  mode,
  onModeChange,
  existingCandidates,
  existingOrgConnectionId,
  onExistingOrgChange,
  existingOrgOptions,
  onExistingOrgOptionsChange,
  eligibility,
  eligibilityLoading,
  eligibilityError,
  onOpenRun,
  openingRunId,
  onCancelConflict,
  stoppingConflict,
}: ScratchOrgFormProps) {
  const generatedId = useId().replace(/:/g, '');
  const fieldId = (name: string) => `scratch-org-${generatedId}-${name}`;
  const usingTemplate = Boolean(form.foundationTemplateId && templateMeta);
  const showDataOrgFields = mode === 'create_new'
    ? form.pipelineScope.dataDeployment
    : form.pipelineScope.dataDeployment;
  const showMetadataSource = mode === 'create_new' || form.pipelineScope.sourceDeployment;
  const selectedExisting = existingCandidates.find(
    (candidate) => candidate.orgConnectionId === existingOrgConnectionId,
  );

  return (
    <div className="space-y-6">
      <FormSection
        title="Workspace mode"
        description="Create a scratch org or deploy configuration to one you already own."
      >
        <fieldset disabled={isRunning}>
          <legend className="sr-only">Scratch org workspace mode</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['create_new', 'Create new', 'Create a new org before deployment'],
              ['configure_existing', 'Configure existing', 'Reuse an active owned scratch org'],
            ] as const).map(([value, label, description]) => (
              <label
                key={value}
                className={cn(
                  'rounded-lg border p-3 cursor-pointer transition-colors',
                  mode === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-primary/30',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={fieldId('mode')}
                    value={value}
                    checked={mode === value}
                    onChange={() => onModeChange(value)}
                  />
                  <span className="font-medium text-sm">{label}</span>
                </span>
                <span className="block ml-6 mt-1 text-xs text-muted-foreground">
                  {description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      {mode === 'configure_existing' && (
        <FormSection
          title="Existing scratch org"
          description="Only active scratch orgs owned by your account can be configured."
        >
          <div className="space-y-4">
            <Field>
              <Label htmlFor={fieldId('existing-target')}>Target scratch org</Label>
              <Select
                id={fieldId('existing-target')}
                value={existingOrgConnectionId}
                onChange={(event) => onExistingOrgChange(event.target.value)}
                disabled={isRunning}
              >
                <option value="">Select an existing scratch org</option>
                {existingCandidates.map((candidate) => (
                  <option
                    key={candidate.orgConnectionId}
                    value={candidate.orgConnectionId}
                    disabled={!isCandidateSelectable(candidate)}
                  >
                    {candidate.alias} · {candidate.status}
                  </option>
                ))}
              </Select>
              {existingCandidates.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No caller-owned scratch org connections are available.
                </p>
              )}
            </Field>

            {selectedExisting && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border/60 bg-card/30 p-3 text-xs">
                <div><dt className="text-muted-foreground">Alias</dt><dd className="font-medium">{selectedExisting.alias}</dd></div>
                <div><dt className="text-muted-foreground">Connection ID</dt><dd className="font-mono break-all">{selectedExisting.orgConnectionId}</dd></div>
                <div><dt className="text-muted-foreground">Status / authentication</dt><dd>{selectedExisting.status} · {selectedExisting.authenticated ? 'Authenticated' : 'Unavailable'}</dd></div>
                <div><dt className="text-muted-foreground">Expires</dt><dd>{selectedExisting.expirationDate ? new Date(selectedExisting.expirationDate).toLocaleString() : 'Unknown'}</dd></div>
                <div><dt className="text-muted-foreground">Dev Hub</dt><dd>{selectedExisting.devHubAlias ?? 'Unknown'}</dd></div>
                <div><dt className="text-muted-foreground">Latest run</dt><dd>{selectedExisting.latestRun ? `${selectedExisting.latestRun.status} · RUN-${selectedExisting.latestRun.id.slice(0, 8).toUpperCase()}` : 'None'}</dd></div>
              </dl>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PipelineOptionCard
                label="Verify authentication"
                description="Check Salesforce CLI auth before deployment"
                checked={existingOrgOptions.verifyAuthentication}
                onChange={(verifyAuthentication) => onExistingOrgOptionsChange({
                  ...existingOrgOptions,
                  verifyAuthentication,
                })}
                disabled={isRunning}
                icon={ShieldCheck}
                iconClass="bg-emerald-500/10 text-emerald-400"
              />
              <PipelineOptionCard
                label="Ensure required package"
                description="Verify and install the package only when missing"
                checked={existingOrgOptions.ensureRequiredPackage}
                onChange={(ensureRequiredPackage) => onExistingOrgOptionsChange({
                  ...existingOrgOptions,
                  ensureRequiredPackage,
                })}
                disabled={isRunning}
                icon={Bug}
                iconClass="bg-blue-500/10 text-blue-400"
              />
            </div>

            <div aria-live="polite" className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {eligibilityLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : eligibility?.eligible ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                Eligibility
              </div>
              {eligibilityError && <p className="mt-2 text-xs text-destructive">{eligibilityError}</p>}
              {!eligibilityLoading && !eligibility && !eligibilityError && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Select a target and complete source settings to run checks.
                </p>
              )}
              {eligibility && (
                <ul className="mt-2 space-y-2">
                  {eligibility.steps.map((step) => (
                    <li key={step.step} className="flex items-start gap-2 text-xs">
                      {step.status === 'error'
                        ? <XCircle className="w-3.5 h-3.5 mt-0.5 text-destructive shrink-0" />
                        : step.status === 'warning' || step.warnings.length > 0
                          ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
                          : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 shrink-0" />}
                      <span><strong className="capitalize">{step.step.replace(/_/g, ' ')}:</strong> {step.messages.join(' ')}</span>
                    </li>
                  ))}
                </ul>
              )}
              {eligibility?.conflictRunId && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onOpenRun(eligibility.conflictRunId!)}
                    loading={openingRunId === eligibility.conflictRunId}
                    disabled={Boolean(openingRunId)}
                  >
                    {openingRunId !== eligibility.conflictRunId && (
                      <ExternalLink className="w-3 h-3 mr-1" />
                    )}
                    Open active run
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    loading={stoppingConflict}
                    onClick={() => onCancelConflict(eligibility.conflictRunId!)}
                  >
                    Cancel active run
                  </Button>
                </div>
              )}
              {selectedExisting?.latestRun && isActiveRecentRun(selectedExisting.latestRun) && !eligibility?.conflictRunId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs mt-3"
                  onClick={() => onOpenRun(selectedExisting.latestRun!.id)}
                  loading={openingRunId === selectedExisting.latestRun.id}
                  disabled={Boolean(openingRunId)}
                >
                  {openingRunId !== selectedExisting.latestRun.id && (
                    <ExternalLink className="w-3 h-3 mr-1" />
                  )}
                  Open latest active run
                </Button>
              )}
            </div>
          </div>
        </FormSection>
      )}

      <FormSection
        title="Deployment scope"
        description="Choose which pipeline stages to run for this scratch org."
      >
        <div className="space-y-4">
          {mode === 'create_new' ? (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Scratch Org &amp; Source Deployment</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Always creates the scratch org and deploys metadata from your selected repository.
                </p>
              </div>
              <PipelineOptionCard
                label="Run Master data deployment"
                description="Load config, partners, accounts, products, and visit plans in one SFDMU run"
                checked={form.pipelineScope.dataDeployment}
                onChange={(dataDeployment) => setForm({
                  ...form,
                  pipelineScope: { sourceDeployment: true, dataDeployment },
                })}
                disabled={isRunning}
                icon={Database}
                iconClass="bg-indigo-500/10 text-indigo-400"
              />
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PipelineOptionCard
                label="Source deployment"
                description="Deploy metadata from the connected Git repository"
                checked={form.pipelineScope.sourceDeployment}
                onChange={(sourceDeployment) => {
                  if (!sourceDeployment && !form.pipelineScope.dataDeployment) return;
                  setForm({
                    ...form,
                    pipelineScope: {
                      ...form.pipelineScope,
                      sourceDeployment,
                    },
                  });
                }}
                disabled={isRunning}
                icon={CloudUpload}
                iconClass="bg-violet-500/10 text-violet-400"
              />
              <PipelineOptionCard
                label="Data deployment"
                description="Run the Master Template SFDMU data load"
                checked={form.pipelineScope.dataDeployment}
                onChange={(dataDeployment) => {
                  if (!dataDeployment && !form.pipelineScope.sourceDeployment) return;
                  setForm({
                    ...form,
                    pipelineScope: {
                      ...form.pipelineScope,
                      dataDeployment,
                    },
                  });
                }}
                disabled={isRunning}
                icon={Database}
                iconClass="bg-indigo-500/10 text-indigo-400"
              />
            </div>
          )}
          {usingTemplate && (
            <div className="rounded-lg border border-border/60 bg-card/30 p-3 text-sm space-y-1">
              <p className="font-medium">{templateMeta!.name}</p>
              <p className="text-xs text-muted-foreground">
                {mode === 'create_new'
                  ? 'Set alias, Dev Hub, and metadata source below for this run.'
                  : 'Select the existing target and configure deployment scope for this run.'}
              </p>
            </div>
          )}
          {showDataOrgFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <Label htmlFor={fieldId('data-org')}>Data Deployment Org</Label>
                <Select
                  id={fieldId('data-org')}
                  value={form.dataDeploymentOrgId || form.sourceOrgId}
                  onChange={(e) => setForm({
                    ...form,
                    sourceOrgId: e.target.value,
                    dataDeploymentOrgId: e.target.value,
                  })}
                  disabled={isRunning}
                >
                  <option value="">Select a source org</option>
                  {sourceOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.alias}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Source org for the Master SFDMU export.
                </p>
              </Field>
              <Field>
                <Label htmlFor={fieldId('settings-org')}>Custom Settings Org (optional override)</Label>
                <Select
                  id={fieldId('settings-org')}
                  value={form.customSettingsOrgId}
                  onChange={(e) => setForm({ ...form, customSettingsOrgId: e.target.value })}
                  disabled={isRunning}
                >
                  <option value="">Use data deployment org</option>
                  {sourceOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.alias}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {usingTemplate && (templateMeta?.config.userProvisioning?.teams?.length ?? 0) > 0 && (
            <Field>
              <Label htmlFor={fieldId('runtime-email-pool')}>Replacement team email pool (optional)</Label>
              <Textarea
                id={fieldId('runtime-email-pool')}
                value={form.runtimeEmailPool}
                onChange={(event) => setForm({ ...form, runtimeEmailPool: event.target.value })}
                placeholder="person1@example.com&#10;person2@example.com"
                disabled={isRunning}
              />
            </Field>
          )}
        </div>
      </FormSection>

      {mode === 'create_new' && <FormSection title="Salesforce" description="Scratch org identity and lifetime.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <Label htmlFor={fieldId('dev-hub')}>Dev Hub Org</Label>
            <Select
              id={fieldId('dev-hub')}
              value={form.devHubAlias}
              onChange={(e) => setForm({ ...form, devHubAlias: e.target.value })}
              disabled={isRunning}
            >
              {devHubs.map((h) => (
                <option key={h.alias} value={h.alias}>
                  {h.alias}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor={fieldId('alias')}>Scratch Org Alias</Label>
            <Input
              id={fieldId('alias')}
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="Sprint40DevScratch"
              disabled={isRunning}
            />
          </Field>
          {!usingTemplate && mode === 'create_new' && (
            <>
              <Field>
                <Label htmlFor={fieldId('duration')}>Duration (days)</Label>
                <Input
                  id={fieldId('duration')}
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground mt-1">Min 1 day, max 30 days</p>
              </Field>
              <Field>
                <Label htmlFor={fieldId('definition')}>Scratch Org Template</Label>
                <Input
                  id={fieldId('definition')}
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value })}
                  disabled={isRunning}
                />
              </Field>
            </>
          )}
          {usingTemplate && (
            <Field>
              <Label htmlFor={fieldId('duration')}>Duration (days)</Label>
              <Input id={fieldId('duration')} type="number" value={form.duration} disabled className="opacity-70" />
              <p className="text-xs text-muted-foreground mt-1">From template</p>
            </Field>
          )}
          <Field className="sm:col-span-2">
            <Label htmlFor={fieldId('description')}>Description</Label>
            <Textarea
              id={fieldId('description')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 255) })}
              className="min-h-[72px] resize-none"
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{form.description.length} / 255</p>
          </Field>
        </div>
      </FormSection>}

      {showMetadataSource && (
        <FormSection title="Metadata Source" description="Connected Git provider and repository used for metadata deployment.">
          <GitMetadataSourceFields source={metadataSource} disabled={isRunning} />
        </FormSection>
      )}

      <FormSection title="Pipeline Options">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!usingTemplate && mode === 'create_new' && (
            <PipelineOptionCard
              label="Install Error Logger Package"
              description="Pre-install logging package on scratch org"
              checked={installPackage}
              onChange={setInstallPackage}
              disabled={isRunning}
              icon={Bug}
              iconClass="bg-blue-500/10 text-blue-400"
            />
          )}
          {SCRATCH_ORG_SKIPPABLE_STEPS.filter((s) => s.key !== 'installPackages').map((s) => (
            <PipelineOptionCard
              key={s.key}
              label={s.label}
              description="Included in the metadata pipeline"
              checked
              disabled
              icon={s.key === 'deployMetadata' ? CloudUpload : ShieldCheck}
              iconClass={
                s.key === 'deployMetadata'
                  ? 'bg-violet-500/10 text-violet-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }
            />
          ))}
          {mode === 'create_new' && <PipelineOptionCard
            label="Generate Password"
            description="Auto-generated on create"
            checked
            disabled
            icon={KeyRound}
            iconClass="bg-orange-500/10 text-orange-400"
          />}
        </div>
      </FormSection>
    </div>
  );
}
