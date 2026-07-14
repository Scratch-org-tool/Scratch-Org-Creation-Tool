'use client';

import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';

type PipelineSteps = NonNullable<ScratchPipelineTemplateConfig['pipelineSteps']>;

interface PipelineStepsSectionProps {
  value: PipelineSteps;
  onChange: (value: PipelineSteps) => void;
}

const STEPS = [
  {
    key: 'autoRunDataSeed' as const,
    label: 'Auto-run data seed',
    desc: 'After custom settings, seed CONA datasets and account limits',
  },
  {
    key: 'autoRunPartners' as const,
    label: 'Auto-run partner import',
    desc: 'Import account partners from Excel or source org',
  },
  {
    key: 'autoRunUsers' as const,
    label: 'Auto-run user provisioning',
    desc: 'Create configured users with roles and modules',
  },
];

export function PipelineStepsSection({ value, onChange }: PipelineStepsSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose which post-deploy steps run automatically after custom settings load.
      </p>
      {STEPS.map((s) => (
        <label key={s.key} className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={value[s.key]}
            onChange={(e) => onChange({ ...value, [s.key]: e.target.checked })}
          />
          <div>
            <p className="text-sm font-medium">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
