'use client';

import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { FormSection, GlassCard } from '@/components/studio';
import { GitMetadataSourceFields } from '@/modules/source-control/git-metadata-source-fields';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import { cn } from '@/utils/cn';
import type { AzureDeployForm, Org, TestLevel } from './azure/types';
import { TEST_LEVEL_OPTIONS } from './azure/types';
import type { GitMetadataSourceHook } from '@/modules/source-control/use-git-metadata-source';

export const DEPLOY_CARD_HEIGHT = 'calc(100vh - 14rem)';

export function GitMetadataDeploymentForm({
  form,
  setForm,
  orgs,
  metadataSource,
  targetOrgAlias,
  isRunning,
  canDeploy,
  deploying,
  onDeploy,
}: {
  form: AzureDeployForm;
  setForm: (fn: (form: AzureDeployForm) => AzureDeployForm) => void;
  orgs: Org[];
  metadataSource: GitMetadataSourceHook;
  targetOrgAlias: string;
  isRunning: boolean;
  canDeploy: boolean;
  deploying: boolean;
  onDeploy: () => void;
}) {
  const gitSource = metadataSource.gitSource;
  return (
    <GlassCard
      title="Deployment configuration"
      className={cn('flex flex-col h-[var(--deploy-card-height)] max-h-[var(--deploy-card-height)] overflow-hidden')}
      contentClassName="flex flex-col flex-1 min-h-0 overflow-hidden gap-4"
      style={{ '--deploy-card-height': DEPLOY_CARD_HEIGHT } as React.CSSProperties}
    >
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-5 pr-1">
        <FormSection title="Target Salesforce org">
          <div className="max-w-sm">
            <Label htmlFor="git-deploy-target-org">Target org</Label>
            <Select
              id="git-deploy-target-org"
              value={form.targetOrgId}
              onChange={(event) => setForm((current) => ({ ...current, targetOrgId: event.target.value }))}
              disabled={isRunning}
            >
              <option value="">Select org…</option>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.alias}</option>)}
            </Select>
          </div>
        </FormSection>
        <FormSection
          title="Git metadata source"
          description="Only connected providers are available. Repository identifiers remain provider-specific."
        >
          <GitMetadataSourceFields source={metadataSource} disabled={isRunning} compact />
        </FormSection>
        <FormSection title="Test level">
          <div className="max-w-sm">
            <Label htmlFor="git-deploy-test-level">Test level</Label>
            <Select
              id="git-deploy-test-level"
              value={form.testLevel}
              onChange={(event) => setForm((current) => ({ ...current, testLevel: event.target.value as TestLevel }))}
              disabled={isRunning}
            >
              {TEST_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
        </FormSection>
      </div>
      <div className="mt-auto space-y-4 shrink-0 pt-3 border-t border-border/60">
        {gitSource && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            <div><dt className="text-muted-foreground">Provider</dt><dd>{SCM_PROVIDER_LABELS[gitSource.provider]}</dd></div>
            <div><dt className="text-muted-foreground">Target</dt><dd>{targetOrgAlias || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Repository</dt><dd className="break-all">{gitSource.repo}</dd></div>
            <div><dt className="text-muted-foreground">Branch</dt><dd>{gitSource.branch}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Manifest</dt><dd className="break-all">{gitSource.manifestPath || 'Default manifest'}</dd></div>
          </dl>
        )}
        <Button onClick={onDeploy} loading={deploying} disabled={!canDeploy} className="w-full gap-2">
          <Rocket className="w-4 h-4" />
          Deploy metadata
        </Button>
      </div>
    </GlassCard>
  );
}
