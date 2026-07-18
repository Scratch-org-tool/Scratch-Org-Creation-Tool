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
  showCustomSettings?: boolean;
  onChange: (patch: { dataDeploymentOrgId?: string; customSettingsOrgId?: string }) => void;
}

export function SourceOrgsSection({
  orgs,
  dataDeploymentOrgId,
  customSettingsOrgId,
  showCustomSettings = true,
  onChange,
}: SourceOrgsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optionally store an authorized source-org default, or leave it empty to select at launch.
        Data queries and partners use the data deployment org
        {showCustomSettings ? '; SFDMU custom settings use the custom settings org.' : '.'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div>
          <Label htmlFor="template-data-deployment-org">Data deployment org</Label>
          <Select
            id="template-data-deployment-org"
            value={dataDeploymentOrgId ?? ''}
            onChange={(e) => onChange({ dataDeploymentOrgId: e.target.value || undefined })}
          >
            <option value="">Select at launch</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.alias}
              </option>
            ))}
          </Select>
        </div>
        {showCustomSettings && (
          <div>
            <Label htmlFor="template-custom-settings-org">Custom settings load org</Label>
            <Select
              id="template-custom-settings-org"
              value={customSettingsOrgId ?? ''}
              onChange={(e) => onChange({ customSettingsOrgId: e.target.value || undefined })}
            >
              <option value="">Select at launch</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.alias}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
