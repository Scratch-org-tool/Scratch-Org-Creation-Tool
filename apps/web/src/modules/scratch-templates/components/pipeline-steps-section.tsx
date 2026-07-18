'use client';

import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';

type PipelineSteps = NonNullable<ScratchPipelineTemplateConfig['pipelineSteps']>;

interface PipelineStepsSectionProps {
  value: PipelineSteps;
  onChange: (value: PipelineSteps) => void;
  availability?: Partial<Record<keyof PipelineSteps, boolean>>;
  visibleSteps?: readonly (keyof PipelineSteps)[];
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

export function PipelineStepsSection({
  value,
  onChange,
  availability = {},
  visibleSteps,
}: PipelineStepsSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose which post-deploy steps run automatically after custom settings load.
      </p>
      {STEPS.filter((step) => !visibleSteps || visibleSteps.includes(step.key)).map((s) => {
        const available = availability[s.key] !== false;
        return (
          <label
            key={s.key}
            className={[
              'flex items-start gap-3 rounded-lg border border-border/60 p-3',
              available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
            ].join(' ')}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={available && value[s.key]}
              disabled={!available}
              onChange={(e) => onChange({ ...value, [s.key]: e.target.checked })}
            />
            <div>
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">
                {s.desc}{available ? '' : ' — configure this stage first'}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
