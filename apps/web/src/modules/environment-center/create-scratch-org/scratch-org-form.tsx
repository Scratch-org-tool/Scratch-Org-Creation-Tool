'use client';

import Link from 'next/link';
import { SCRATCH_ORG_SKIPPABLE_STEPS } from '@sfcc/shared';
import { Bug, CloudUpload, KeyRound, Link2, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/studio/form-section';
import { InlineAlert } from '@/components/studio/inline-alert';
import { cn } from '@/utils/cn';
import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import type { AzureRepo, AzureStatus } from './types';

interface ScratchOrgFormProps {
  form: ScratchOrgFormState;
  setForm: (f: ScratchOrgFormState) => void;
  devHubs: { alias: string }[];
  sourceOrgs: { id: string; alias: string }[];
  templates: Array<{ id: string; name: string; isSystem: boolean }>;
  templateMeta?: { name: string; config: Record<string, unknown> } | null;
  repos: AzureRepo[];
  branches: string[];
  azureStatus: AzureStatus;
  installPackage: boolean;
  setInstallPackage: (v: boolean) => void;
  isRunning: boolean;
  onRepoChange: (repo: string) => void;
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
  repos,
  branches,
  azureStatus,
  installPackage,
  setInstallPackage,
  isRunning,
  onRepoChange,
}: ScratchOrgFormProps) {
  const usingTemplate = Boolean(form.templateId && templateMeta);

  return (
    <div className="space-y-6">
      <FormSection title="Pipeline template" description="Use a saved template or manage templates in the sidebar.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field className="sm:col-span-2">
            <Label>Scratch pipeline template</Label>
            <Select
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
                  Set alias, Dev Hub, and Azure repo/branch below for this run.
                </p>
              </div>
            </Field>
          )}
          <Field>
            <Label>Source org (data + custom settings)</Label>
            <Select
              value={form.sourceOrgId}
              onChange={(e) => setForm({ ...form, sourceOrgId: e.target.value })}
              disabled={isRunning}
            >
              <option value="">Select source org…</option>
              {sourceOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Salesforce" description="Scratch org identity and lifetime.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <Label>Dev Hub Org</Label>
            <Select
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
            <Label>Scratch Org Alias</Label>
            <Input
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="Sprint40DevScratch"
              disabled={isRunning}
            />
          </Field>
          {!usingTemplate && (
            <>
              <Field>
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground mt-1">Min 1 day, max 30 days</p>
              </Field>
              <Field>
                <Label>Scratch Org Template</Label>
                <Input
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value })}
                  disabled={isRunning}
                />
              </Field>
            </>
          )}
          {usingTemplate && (
            <Field>
              <Label>Duration (days)</Label>
              <Input type="number" value={form.duration} disabled className="opacity-70" />
              <p className="text-xs text-muted-foreground mt-1">From template</p>
            </Field>
          )}
          <Field className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 255) })}
              className="min-h-[72px] resize-none"
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{form.description.length} / 255</p>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Azure DevOps" description="Source repository for metadata deployment.">
        {azureStatus.connected ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label>Azure Repository</Label>
              <Select
                value={form.azureRepo}
                onChange={(e) => onRepoChange(e.target.value)}
                disabled={isRunning}
              >
                {repos.length === 0 ? (
                  <option value="">No repositories found</option>
                ) : (
                  repos.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.project ? `${r.name} (${r.project})` : r.name}
                    </option>
                  ))
                )}
              </Select>
            </Field>
            <Field>
              <Label>Branch</Label>
              <Select
                value={form.azureBranch}
                onChange={(e) => setForm({ ...form, azureBranch: e.target.value })}
                disabled={isRunning}
              >
                {branches.length === 0 ? (
                  <option value="">No branches found</option>
                ) : (
                  branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))
                )}
              </Select>
            </Field>
            <Field className="sm:col-span-2">
              <Label>Manifest Path</Label>
              <Input
                value={form.azureManifestPath}
                onChange={(e) => setForm({ ...form, azureManifestPath: e.target.value })}
                placeholder="CoreFlex Onboarding/manifest/package.xml"
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Path to package.xml inside the selected branch
              </p>
            </Field>
          </div>
        ) : (
          <InlineAlert variant="warning" title="Azure DevOps not connected">
            <Link
              href="/environment-center?tab=azure"
              className="text-primary inline-flex items-center gap-1 mt-1 hover:underline"
            >
              <Link2 className="w-3 h-3" />
              Connect Azure DevOps
            </Link>
          </InlineAlert>
        )}
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
              description="Included in Azure pipeline"
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
