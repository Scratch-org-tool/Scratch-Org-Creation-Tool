'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert } from '@/components/studio';
import { Link2, Rocket } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AzureDeployForm, AzureRepo, AzureStatus, Org, TestLevel } from './types';
import { TEST_LEVEL_OPTIONS } from './types';

export const DEPLOY_CARD_HEIGHT = 'calc(100vh - 14rem)';

export const DEPLOY_CARD_CLASS = cn(
  'flex flex-col h-[var(--deploy-card-height)] max-h-[var(--deploy-card-height)] overflow-hidden',
);

interface AzureDeploymentFormProps {
  form: AzureDeployForm;
  setForm: (fn: (f: AzureDeployForm) => AzureDeployForm) => void;
  orgs: Org[];
  repos: AzureRepo[];
  branches: string[];
  azureStatus: AzureStatus;
  targetOrgAlias: string;
  isRunning: boolean;
  canDeploy: boolean;
  deploying: boolean;
  onRepoChange: (repo: string) => void;
  onDeploy: () => void;
  className?: string;
}

function Field({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('min-w-0', className)}>{children}</div>;
}

export function AzureDeploymentForm({
  form,
  setForm,
  orgs,
  repos,
  branches,
  azureStatus,
  targetOrgAlias,
  isRunning,
  canDeploy,
  deploying,
  onRepoChange,
  onDeploy,
  className,
}: AzureDeploymentFormProps) {
  return (
    <GlassCard
      title="Deployment Configuration"
      className={cn(DEPLOY_CARD_CLASS, className)}
      contentClassName="flex flex-col flex-1 min-h-0 overflow-hidden gap-4"
      style={{ '--deploy-card-height': DEPLOY_CARD_HEIGHT } as React.CSSProperties}
    >
      {!azureStatus.connected && (
        <InlineAlert variant="warning" title="Azure DevOps is not connected" className="shrink-0">
          <Link
            href="/environment-center?tab=azure"
            className="text-primary inline-flex items-center gap-1 mt-1 hover:underline text-xs"
          >
            <Link2 className="w-3 h-3" />
            Connect Azure DevOps
          </Link>
        </InlineAlert>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-5">
        <FormSection title="Target & repository">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="azure-deploy-target-org">Target Org</Label>
              <Select
                id="azure-deploy-target-org"
                value={form.targetOrgId}
                onChange={(e) => setForm((f) => ({ ...f, targetOrgId: e.target.value }))}
                disabled={isRunning}
              >
                <option value="">Select org...</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.alias}
                  </option>
                ))}
              </Select>
              {form.targetOrgId && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Connected
                </span>
              )}
            </Field>

            <Field>
              <Label htmlFor="azure-deploy-repository">Repository</Label>
              <Select
                id="azure-deploy-repository"
                value={form.repo}
                onChange={(e) => onRepoChange(e.target.value)}
                disabled={isRunning || !azureStatus.connected}
              >
                <option value="">Select...</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.project ? `${r.name} (${r.project})` : r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Branch & manifest">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="azure-deploy-branch">Branch</Label>
              <Select
                id="azure-deploy-branch"
                value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                disabled={isRunning}
              >
                <option value="">Select...</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label htmlFor="azure-deploy-manifest">Manifest</Label>
              <Input
                id="azure-deploy-manifest"
                value={form.manifestPath}
                onChange={(e) => setForm((f) => ({ ...f, manifestPath: e.target.value }))}
                placeholder="CoreFlex Onboarding/manifest/package.xml"
                disabled={isRunning}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Test level">
          <Field className="max-w-xs">
            <Label htmlFor="azure-deploy-test-level">Test Level</Label>
            <Select
              id="azure-deploy-test-level"
              value={form.testLevel}
              onChange={(e) => setForm((f) => ({ ...f, testLevel: e.target.value as TestLevel }))}
              disabled={isRunning}
            >
              {TEST_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </FormSection>
      </div>

      <div className="mt-auto space-y-4 shrink-0 pt-2 border-t border-border/60">
        {form.repo && form.branch && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
            <p className="font-medium text-sm mb-2">Deployment Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p>
                <span className="text-muted-foreground">Target:</span> {targetOrgAlias || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Branch:</span> {form.branch}
              </p>
              <p>
                <span className="text-muted-foreground">Repository:</span> {form.repo}
              </p>
              <p>
                <span className="text-muted-foreground">Test Level:</span> {form.testLevel}
              </p>
              <p className="sm:col-span-2 truncate">
                <span className="text-muted-foreground">Manifest:</span> {form.manifestPath}
              </p>
            </div>
          </div>
        )}

        <Button onClick={onDeploy} loading={deploying} disabled={!canDeploy} className="w-full gap-2">
          <Rocket className="w-4 h-4" />
          Deploy Now
        </Button>
      </div>
    </GlassCard>
  );
}
