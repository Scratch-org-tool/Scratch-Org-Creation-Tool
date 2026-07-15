'use client';

import { SCRATCH_ORG_SKIPPABLE_STEPS, type ScratchPipelineTemplateConfig } from '@sfcc/shared';
import { Bug, CloudUpload, KeyRound, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/studio/form-section';
import { GitMetadataSourceFields } from '@/modules/source-control/git-metadata-source-fields';
import type { GitMetadataSourceHook } from '@/modules/source-control/use-git-metadata-source';
import { cn } from '@/utils/cn';
import type { ScratchOrgFormState } from '@/components/scratch-org/types';

interface ScratchOrgFormProps {
  form: ScratchOrgFormState;
  setForm: (f: ScratchOrgFormState) => void;
  devHubs: { alias: string }[];
  sourceOrgs: { id: string; alias: string }[];
  templates: Array<{ id: string; name: string; isSystem: boolean }>;
  templateMeta?: { name: string; config: ScratchPipelineTemplateConfig } | null;
  metadataSource: GitMetadataSourceHook;
  installPackage: boolean;
  setInstallPackage: (v: boolean) => void;
  isRunning: boolean;
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
  templates,
  templateMeta,
  metadataSource,
  installPackage,
  setInstallPackage,
  isRunning,
}: ScratchOrgFormProps) {
  const usingTemplate = Boolean(form.templateId && templateMeta);

  return (
    <div className="space-y-6">
      <FormSection title="Pipeline template" description="Use a saved template or manage templates in the sidebar.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field className="sm:col-span-2">
            <Label htmlFor="scratch-org-pipeline-template">Scratch pipeline template</Label>
            <Select
              id="scratch-org-pipeline-template"
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
              disabled={isRunning}
            >
              <option value="">Manual configuration (form below)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.isSystem ? ' (system)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          {usingTemplate && (
            <Field className="sm:col-span-2">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
                <p className="font-medium">From template: {templateMeta!.name}</p>
                <p className="text-xs text-muted-foreground">
                  Scratch defaults, permissions, custom settings, data seed, and users come from this template.
                  Set alias, Dev Hub, and metadata source below for this run.
                </p>
              </div>
            </Field>
          )}
          <Field>
            <Label htmlFor="scratch-org-data-org">Data Deployment Org</Label>
            <Select
              id="scratch-org-data-org"
              value={form.dataDeploymentOrgId || form.sourceOrgId}
              onChange={(e) => setForm({
                ...form,
                sourceOrgId: e.target.value,
                dataDeploymentOrgId: e.target.value,
              })}
              disabled={isRunning}
            >
              <option value="">Use template default</option>
              {sourceOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Runtime override for queries, data seed, and partner joins.</p>
          </Field>
          <Field>
            <Label htmlFor="scratch-org-settings-org">Custom Settings Org (optional override)</Label>
            <Select
              id="scratch-org-settings-org"
              value={form.customSettingsOrgId}
              onChange={(e) => setForm({ ...form, customSettingsOrgId: e.target.value })}
              disabled={isRunning}
            >
              <option value="">Use template default</option>
              {sourceOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Only used for the SFDMU custom-settings export.</p>
          </Field>
          {usingTemplate && (templateMeta?.config.userProvisioning?.teams?.length ?? 0) > 0 && (
            <Field className="sm:col-span-2">
              <Label htmlFor="scratch-org-runtime-email-pool">Replacement team email pool (optional)</Label>
              <Textarea
                id="scratch-org-runtime-email-pool"
                value={form.runtimeEmailPool}
                onChange={(event) => setForm({ ...form, runtimeEmailPool: event.target.value })}
                placeholder="person1@example.com&#10;person2@example.com"
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Replaces the template pool for this run. Allocation remains deterministic shuffled round-robin.
              </p>
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection title="Salesforce" description="Scratch org identity and lifetime.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <Label htmlFor="scratch-org-dev-hub">Dev Hub Org</Label>
            <Select
              id="scratch-org-dev-hub"
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
            <Label htmlFor="scratch-org-alias">Scratch Org Alias</Label>
            <Input
              id="scratch-org-alias"
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="Sprint40DevScratch"
              disabled={isRunning}
            />
          </Field>
          {!usingTemplate && (
            <>
              <Field>
                <Label htmlFor="scratch-org-duration">Duration (days)</Label>
                <Input
                  id="scratch-org-duration"
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground mt-1">Min 1 day, max 30 days</p>
              </Field>
              <Field>
                <Label htmlFor="scratch-org-definition">Scratch Org Template</Label>
                <Input
                  id="scratch-org-definition"
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value })}
                  disabled={isRunning}
                />
              </Field>
            </>
          )}
          {usingTemplate && (
            <Field>
              <Label htmlFor="scratch-org-duration">Duration (days)</Label>
              <Input id="scratch-org-duration" type="number" value={form.duration} disabled className="opacity-70" />
              <p className="text-xs text-muted-foreground mt-1">From template</p>
            </Field>
          )}
          <Field className="sm:col-span-2">
            <Label htmlFor="scratch-org-description">Description</Label>
            <Textarea
              id="scratch-org-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 255) })}
              className="min-h-[72px] resize-none"
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{form.description.length} / 255</p>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Metadata Source" description="Connected Git provider and repository used for metadata deployment.">
        <GitMetadataSourceFields source={metadataSource} disabled={isRunning} />
      </FormSection>

      <FormSection title="Pipeline Options">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!usingTemplate && (
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
          <PipelineOptionCard
            label="Generate Password"
            description="Auto-generated on create"
            checked
            disabled
            icon={KeyRound}
            iconClass="bg-orange-500/10 text-orange-400"
          />
        </div>
      </FormSection>
    </div>
  );
}
