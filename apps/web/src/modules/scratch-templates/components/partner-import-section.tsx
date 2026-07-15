'use client';

import { useState } from 'react';
import { Label, Select } from '@/components/ui/input';
import type { BottlerSalesOfficeConfig, ScratchPipelineTemplateConfig } from '@sfcc/shared';
import { api } from '@/services/api';
import { FileDropzone } from './file-dropzone';

type PartnerImport = NonNullable<ScratchPipelineTemplateConfig['partnerImport']>;

interface PartnerImportSectionProps {
  value: PartnerImport;
  onChange: (value: PartnerImport) => void;
  excelFile: File | null;
  onExcelFileChange: (file: File | null) => void;
  storedFileName?: string;
}

export function PartnerImportSection({
  value,
  onChange,
  excelFile,
  onExcelFileChange,
  storedFileName,
}: PartnerImportSectionProps) {
  const [configError, setConfigError] = useState<string | null>(null);

  const handleSalesOfficeJson = async (file: File | null) => {
    setConfigError(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validated = await api<{ normalized: BottlerSalesOfficeConfig }>(
        '/environment/scratch-templates/validate-bottler-config',
        { method: 'POST', body: JSON.stringify(parsed) },
      );
      onChange({
        ...value,
        salesOfficeConfig: validated.normalized,
        perOffice: validated.normalized.perOfficePartnerLimit,
        bottler: validated.normalized.bottler,
      });
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Invalid sales office JSON');
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Enable partner import in pipeline
      </label>

      {value.enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="partner-import-mode">Mode</Label>
              <Select
                id="partner-import-mode"
                value={value.mode}
                onChange={(e) =>
                  onChange({ ...value, mode: e.target.value as PartnerImport['mode'] })
                }
              >
                <option value="org_to_org_matched">Org to org (matched, 20/office)</option>
                <option value="excel">Excel upload (legacy)</option>
                <option value="org_to_org">Org to org bulk (legacy)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="partner-import-bottler">Bottler</Label>
              <Select
                id="partner-import-bottler"
                value={value.bottler}
                onChange={(e) =>
                  onChange({ ...value, bottler: e.target.value as PartnerImport['bottler'] })
                }
              >
                <option value="5000">5000</option>
                <option value="4900">4900</option>
                <option value="4600">4600</option>
                <option value="all">All</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="partner-import-office-limit">Per office limit</Label>
              <input
                id="partner-import-office-limit"
                type="number"
                min={1}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={value.perOffice}
                onChange={(e) => onChange({ ...value, perOffice: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={value.matchOrgDistribution}
                  onChange={(e) => onChange({ ...value, matchOrgDistribution: e.target.checked })}
                />
                Match org distribution
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Sales office JSON (bottler-wise)</p>
            <p className="text-xs text-muted-foreground">
              Offices, roles, and per-office partner limit used for matched import and account seeding.
            </p>
            {value.salesOfficeConfig && (
              <p className="text-xs text-muted-foreground">
                Loaded: {value.salesOfficeConfig.offices.length} offices, bottler{' '}
                {value.salesOfficeConfig.bottler}
              </p>
            )}
            <FileDropzone
              accept=".json,application/json"
              label="Drop bottler sales office JSON"
              hint="bottler, offices[], roles[], perOfficePartnerLimit"
              file={null}
              onFileChange={(f) => void handleSalesOfficeJson(f)}
            />
            {configError && <p className="text-xs text-destructive">{configError}</p>}
          </div>

          {value.mode === 'excel' && (
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Partner Excel file</p>
              {storedFileName && !excelFile && (
                <p className="text-xs text-muted-foreground">Saved file: {storedFileName}</p>
              )}
              <FileDropzone
                accept=".xlsx,.xls"
                label="Drop partner Excel workbook"
                hint=".xlsx or .xls — stored with template for pipeline runs"
                file={excelFile}
                onFileChange={onExcelFileChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
