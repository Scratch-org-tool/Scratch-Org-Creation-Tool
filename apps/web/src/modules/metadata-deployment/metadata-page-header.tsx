'use client';

import { GitCompare } from 'lucide-react';
import { Breadcrumbs } from '@/components/studio/breadcrumbs';
import { WizardSteps } from '@/components/studio/wizard-steps';
import { cn } from '@/utils/cn';
import type { ComparePhase } from './types';

export const METADATA_WIZARD_STEPS = ['Compare', 'Analyze', 'Summary', 'Deploy'];

export function phaseToWizardStep(phase: ComparePhase): number {
  switch (phase) {
    case 'setup':
    case 'compare':
      return 0;
    case 'analysis':
      return 1;
    case 'summary':
      return 2;
    case 'deploying':
    case 'success':
      return 3;
    default:
      return 0;
  }
}

export function MetadataPageHeader({ phase }: { phase: ComparePhase }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60',
        'bg-gradient-to-r from-card via-card/95 to-violet-500/10',
      )}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none hidden sm:block text-primary">
        <GitCompare className="w-28 h-28 -rotate-12" />
      </div>
      <div className="relative p-5 md:p-6 space-y-4">
        <Breadcrumbs className="mb-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metadata Deployment</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Compare metadata between orgs, review XML changes, and deploy selected items to your target org.
          </p>
        </div>
        <WizardSteps
          steps={METADATA_WIZARD_STEPS}
          current={phaseToWizardStep(phase)}
          connected
          className="max-w-xl"
        />
      </div>
    </div>
  );
}
