'use client';

import { Rocket } from 'lucide-react';
import { Breadcrumbs } from '@/components/studio/breadcrumbs';
import { WizardSteps } from '@/components/studio/wizard-steps';
import { cn } from '@/utils/cn';

const DESKTOP_STEPS = ['Configure', 'Review', 'Create'];

interface ScratchOrgPageHeaderProps {
  desktopStep?: number;
}

export function ScratchOrgPageHeader({ desktopStep = 0 }: ScratchOrgPageHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60',
        'bg-gradient-to-r from-card via-card/95 to-primary/10',
      )}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none hidden sm:block">
        <Rocket className="w-28 h-28 text-primary rotate-12" />
      </div>
      <div className="relative p-5 md:p-6 space-y-4">
        <Breadcrumbs className="mb-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Scratch Org</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Spin up a new Salesforce scratch org and configure pipeline settings.
          </p>
        </div>
        <WizardSteps
          steps={DESKTOP_STEPS}
          current={desktopStep}
          connected={false}
          className="max-w-md"
        />
      </div>
    </div>
  );
}

export { DESKTOP_STEPS };
