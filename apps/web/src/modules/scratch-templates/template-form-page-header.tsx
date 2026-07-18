'use client';

import { FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/studio/breadcrumbs';
import { cn } from '@/utils/cn';
import { TEMPLATE_WIZARD_STEPS } from './types';

export const TEMPLATE_STEP_DESCRIPTIONS: Record<number, string> = {
  0: 'Name and describe this pipeline preset.',
  1: 'Scratch org definition, duration, and provider-neutral Git defaults.',
  2: 'Data deployment org and custom settings load org.',
  3: 'Bundled or custom SFDMU export for custom settings.',
  4: 'Permission sets and org configuration flags.',
  5: 'Seed mode, query JSON, datasets, and account limits.',
  6: 'Named, dependency-ordered SOQL queries and Account Partner join plan.',
  7: 'Partner import, generated users, role mappings, and automation toggles.',
  8: 'Review all settings before saving.',
};

interface TemplateFormPageHeaderProps {
  mode: 'new' | 'edit';
  isSystem?: boolean;
  step: number;
  onCancel: () => void;
}

export function TemplateFormPageHeader({
  mode,
  isSystem = false,
  step,
  onCancel,
}: TemplateFormPageHeaderProps) {
  const stepLabel = TEMPLATE_WIZARD_STEPS[step] ?? 'General';
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
              Step {step + 1} of {TEMPLATE_WIZARD_STEPS.length} · {stepLabel}
            </p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">
              {title}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              {TEMPLATE_STEP_DESCRIPTIONS[step]}
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
