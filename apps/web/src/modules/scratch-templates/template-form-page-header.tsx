'use client';

import { FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/studio/breadcrumbs';
import { cn } from '@/utils/cn';
import {
  SYSTEM_SCRATCH_TEMPLATE_KEYS,
  type SystemScratchTemplateKey,
} from '@sfcc/shared';
import type { TemplateStepId, TemplateWizardStep } from './types';

export const TEMPLATE_STEP_DESCRIPTIONS: Record<TemplateStepId, string> = {
  general: 'Name and describe this pipeline preset.',
  scratch: 'Scratch org definition, duration, and provider-neutral Git defaults.',
  'source-orgs': 'Data deployment org and custom settings load org.',
  'custom-settings': 'Bundled or custom SFDMU export for custom settings.',
  permissions: 'Permission sets and org configuration flags.',
  'data-seed': 'Seed mode, query JSON, datasets, and account limits.',
  'query-section': 'Named, dependency-ordered SOQL queries and Account Partner join plan.',
  'partners-users': 'Partner import, generated users, role mappings, and automation toggles.',
  review: 'Review all settings before saving.',
};

const SYSTEM_TEMPLATE_STEP_DESCRIPTIONS: Partial<
  Record<SystemScratchTemplateKey, Partial<Record<TemplateStepId, string>>>
> = {
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT]: {
    scratch: 'Scratch org definition, duration, package, and Azure DevOps source defaults.',
    permissions: 'Permission sets applied after source deployment.',
  },
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.DATA_DEPLOYMENT_QUERIES]: {
    'source-orgs': 'Choose the source org for query-driven data deployment.',
    'data-seed': 'Configure the data deployment mode and query inputs.',
    'query-section': 'Edit the ordered Account, Product, and Visit Plan queries.',
  },
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.CONFIG_SEED_ACCOUNT_PARTNERS]: {
    'source-orgs': 'Choose source orgs for configuration seed and custom settings.',
    permissions: 'Configure queue IDs, domain fields, and request ID updates.',
    'data-seed': 'Configure the onboarding configuration seed.',
    'partners-users': 'Configure Account Partner mapping and automatic execution.',
  },
};

export function getTemplateStepDescription(stepId: TemplateStepId, systemKey?: string | null) {
  const scoped = systemKey
    ? SYSTEM_TEMPLATE_STEP_DESCRIPTIONS[systemKey as SystemScratchTemplateKey]?.[stepId]
    : undefined;
  return scoped ?? TEMPLATE_STEP_DESCRIPTIONS[stepId];
}

interface TemplateFormPageHeaderProps {
  mode: 'new' | 'edit';
  isSystem?: boolean;
  systemKey?: string | null;
  activeStep: TemplateWizardStep;
  stepNumber: number;
  totalSteps: number;
  onCancel: () => void;
}

export function TemplateFormPageHeader({
  mode,
  isSystem = false,
  systemKey,
  activeStep,
  stepNumber,
  totalSteps,
  onCancel,
}: TemplateFormPageHeaderProps) {
  const title = mode === 'new'
    ? 'New template'
    : isSystem
      ? 'Edit default template'
      : 'Edit template';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60',
        'bg-gradient-to-r from-card via-card/95 to-violet-500/10',
      )}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none hidden sm:block">
        <FileStack className="w-28 h-28 text-violet-400 -rotate-12" />
      </div>
      <div className="relative p-5 md:p-6">
        <Breadcrumbs
          className="mb-2"
          items={[
            { href: '/environment-center', label: 'Environment' },
            { href: '/scratch-templates', label: 'Templates' },
            { href: '/scratch-templates', label: title },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-primary/80">
              Step {stepNumber} of {totalSteps} · {activeStep.label}
            </p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">
              {title}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              {getTemplateStepDescription(activeStep.id, systemKey)}
            </p>
          </div>
          <Button variant="outline" onClick={onCancel} className="shrink-0">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
