'use client';

import { GlassCard, TipsCard } from '@/components/studio';
import { SYSTEM_SCRATCH_TEMPLATE_KEYS } from '@sfcc/shared';
import { getTemplateStepDescription } from '../template-form-page-header';
import type { TemplateStepId, TemplateWizardStep } from '../types';

const STEP_TIPS: Record<TemplateStepId, string[]> = {
  general: [
    'Use a clear name your team will recognize in the scratch org wizard.',
    'The description appears on the template list and helps others pick the right preset.',
  ],
  scratch: [
    'Alias and Dev Hub are chosen when launching a scratch org — not stored on the template.',
    'Manifest path pre-fills Azure deploy; repo and branch are selected per run.',
  ],
  'source-orgs': [
    'Data deployment org is used for CONA data seed and partner matching.',
    'Custom settings org is used only for SFDMU custom settings export.',
  ],
  'custom-settings': [
    'Bundled mode uses the built-in CONA SFDMU export.',
    'Custom mode lets you paste or edit export JSON validated by the API.',
  ],
  permissions: [
    'Permission sets are applied after the scratch org is created.',
    'Org config flags control queue IDs, domain fields, and request ID prefix.',
  ],
  'data-seed': [
    'Upload query JSON for per-office account rules and related object queries.',
    'Hybrid mode runs automatic datasets plus query JSON.',
  ],
  'query-section': [
    'Dependencies prevent an unsafe reorder and determine execution order within each stage.',
    'Validate against the selected data org before saving the query section.',
  ],
  'partners-users': [
    'Team email pools use deterministic shuffled round-robin allocation.',
    'Email and Salesforce Username are intentionally shown as separate values.',
  ],
  review: [
    'Use Edit on any section to jump back and adjust settings.',
    'Saving creates a private template visible only to your workspace.',
  ],
};

interface TemplateFormTipsProps {
  step: TemplateWizardStep;
  systemKey?: string | null;
}

export function TemplateFormTips({ step, systemKey }: TemplateFormTipsProps) {
  let tips = STEP_TIPS[step.id] ?? [];
  if (
    systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT
    && step.id === 'permissions'
  ) {
    tips = ['Permission sets are applied after source metadata is deployed.'];
  }
  if (
    systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.CONFIG_SEED_ACCOUNT_PARTNERS
    && step.id === 'data-seed'
  ) {
    tips = [
      'Keep OnboardingConfig selected for this seed preset.',
      'The data source org can be selected now or when the template is launched.',
    ];
  }
  if (
    systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.CONFIG_SEED_ACCOUNT_PARTNERS
    && step.id === 'partners-users'
  ) {
    tips = [
      'Account Partner mapping uses the configured bottler and sales offices.',
      'Automation runs configuration seed before Account Partner mapping.',
    ];
  }

  return (
    <div className="space-y-4">
      <GlassCard title="Current step" className="text-sm">
        <p className="text-muted-foreground leading-relaxed">
          {getTemplateStepDescription(step.id, systemKey)}
        </p>
      </GlassCard>
      <TipsCard title="Tips">
        <ul className="list-disc pl-4 space-y-2">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </TipsCard>
    </div>
  );
}
