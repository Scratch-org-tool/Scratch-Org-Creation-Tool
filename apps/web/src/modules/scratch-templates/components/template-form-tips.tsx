'use client';

import { GlassCard, TipsCard } from '@/components/studio';
import { TEMPLATE_STEP_DESCRIPTIONS } from '../template-form-page-header';

const STEP_TIPS: Record<number, string[]> = {
  0: [
    'Use a clear name your team will recognize in the scratch org wizard.',
    'The description appears on the template list and helps others pick the right preset.',
  ],
  1: [
    'Alias and Dev Hub are chosen when launching a scratch org — not stored on the template.',
    'Manifest path pre-fills Azure deploy; repo and branch are selected per run.',
  ],
  2: [
    'Data deployment org is used for CONA data seed and partner matching.',
    'Custom settings org is used only for SFDMU custom settings export.',
  ],
  3: [
    'Bundled mode uses the built-in CONA SFDMU export.',
    'Custom mode lets you paste or edit export JSON validated by the API.',
  ],
  4: [
    'Permission sets are applied after the scratch org is created.',
    'Org config flags control queue IDs, domain fields, and request ID prefix.',
  ],
  5: [
    'Upload query JSON for per-office account rules and related object queries.',
    'Hybrid mode runs automatic datasets plus query JSON.',
  ],
  6: [
    'Upload bottler sales-office JSON for 20 partners per office matching.',
    'User templates define role, modules, and locations; slots set name and email.',
  ],
  7: [
    'Use Edit on any section to jump back and adjust settings.',
    'Saving creates a private template visible only to your workspace.',
  ],
};

interface TemplateFormTipsProps {
  step: number;
}

export function TemplateFormTips({ step }: TemplateFormTipsProps) {
  const tips = STEP_TIPS[step] ?? [];

  return (
    <div className="space-y-4">
      <GlassCard title="Current step" className="text-sm">
        <p className="text-muted-foreground leading-relaxed">{TEMPLATE_STEP_DESCRIPTIONS[step]}</p>
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
