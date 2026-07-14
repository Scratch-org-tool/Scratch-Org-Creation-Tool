'use client';

import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';

interface OrgConfigSectionProps {
  value: NonNullable<ScratchPipelineTemplateConfig['orgConfig']>;
  onChange: (value: NonNullable<ScratchPipelineTemplateConfig['orgConfig']>) => void;
}

const TOGGLES = [
  { key: 'upsertQueueIds' as const, label: 'Upsert queue IDs', desc: 'OnboardingConfig__c queue ID fields' },
  { key: 'upsertDomainFields' as const, label: 'Upsert domain URLs', desc: 'Domain and callback URL fields' },
  { key: 'upsertRequestId' as const, label: 'Upsert request ID prefix', desc: 'Request ID prefix on config' },
];

export function OrgConfigSection({ value, onChange }: OrgConfigSectionProps) {
  return (
    <div className="space-y-3">
      {TOGGLES.map((t) => (
        <label key={t.key} className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={value[t.key]}
            onChange={(e) => onChange({ ...value, [t.key]: e.target.checked })}
          />
          <div>
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
