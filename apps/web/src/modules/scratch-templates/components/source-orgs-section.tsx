'use client';

import { Label, Select } from '@/components/ui/input';

interface Org {
  id: string;
  alias: string;
}

interface SourceOrgsSectionProps {
  orgs: Org[];
  dataDeploymentOrgId?: string;
  customSettingsOrgId?: string;
  onChange: (patch: { dataDeploymentOrgId?: string; customSettingsOrgId?: string }) => void;
}

export function SourceOrgsSection({
  orgs,
  dataDeploymentOrgId,
  customSettingsOrgId,
  onChange,
}: SourceOrgsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose which authorized orgs supply data for deployment and custom settings. Data seed and
        partner import use the data deployment org; SFDMU custom settings use the custom settings org.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div>
          <Label>Data deployment org</Label>
          <Select
            value={dataDeploymentOrgId ?? ''}
            onChange={(e) => onChange({ dataDeploymentOrgId: e.target.value || undefined })}
          >
            <option value="">Select org…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.alias}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Custom settings load org</Label>
          <Select
            value={customSettingsOrgId ?? ''}
            onChange={(e) => onChange({ customSettingsOrgId: e.target.value || undefined })}
          >
            <option value="">Select org…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.alias}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
