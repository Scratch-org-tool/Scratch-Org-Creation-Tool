'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { DataSeedQuerySet } from '@sfcc/shared';
import { validateDataSeedQuerySet } from '@sfcc/shared';
import type { AccountSeedRow } from '../types';
import { FileDropzone } from './file-dropzone';

type Dataset = 'OnboardingConfig' | 'Products' | 'VisitPlans' | 'Accounts';
type DataSeedMode = 'automatic' | 'query_json' | 'hybrid' | 'query_section';

const DATASETS: Dataset[] = ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'];

const DEFAULT_ROW: AccountSeedRow = {
  accountGroup: 'Z001',
  bottler: '5000',
  distributionChannel: 'Z1',
  limit: 500,
};

function isZfsv5000Blocked(row: AccountSeedRow) {
  return row.accountGroup === 'ZFSV' && row.bottler === '5000';
}

interface DataSeedSectionProps {
  mode: DataSeedMode;
  datasets: Dataset[];
  accountRows: AccountSeedRow[];
  querySet?: DataSeedQuerySet;
  queryJsonFile: File | null;
  onModeChange: (mode: DataSeedMode) => void;
  onDatasetsChange: (datasets: Dataset[]) => void;
  onAccountRowsChange: (rows: AccountSeedRow[]) => void;
  onQuerySetChange: (querySet: DataSeedQuerySet | undefined) => void;
  onQueryJsonFileChange: (file: File | null) => void;
}

export function DataSeedSection({
  mode,
  datasets,
  accountRows,
  querySet,
  queryJsonFile,
  onModeChange,
  onDatasetsChange,
  onAccountRowsChange,
  onQuerySetChange,
  onQueryJsonFileChange,
}: DataSeedSectionProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  const toggleDataset = (d: Dataset) => {
    onDatasetsChange(
      datasets.includes(d) ? datasets.filter((x) => x !== d) : [...datasets, d],
    );
  };

  const updateRow = (i: number, patch: Partial<AccountSeedRow>) => {
    onAccountRowsChange(accountRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const handleQueryFile = async (file: File | null) => {
    onQueryJsonFileChange(file);
    setJsonError(null);
    if (!file) {
      onQuerySetChange(undefined);
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = validateDataSeedQuerySet(parsed);
      if (!result.valid) {
        throw new Error('Invalid query JSON structure');
      }
      onQuerySetChange(result.normalized);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid query JSON');
      onQuerySetChange(undefined);
    }
  };

  const showAutomatic = mode === 'automatic' || mode === 'hybrid';
  const showQueryJson = mode === 'query_json' || mode === 'hybrid';

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <Label htmlFor="data-seed-mode">Seed mode</Label>
        <Select id="data-seed-mode" value={mode} onChange={(e) => onModeChange(e.target.value as DataSeedMode)}>
          <option value="hybrid">Hybrid (automatic + query JSON)</option>
          <option value="automatic">Automatic CONA datasets only</option>
          <option value="query_json">Query JSON only</option>
          <option value="query_section">V2 named query section (configured next)</option>
        </Select>
        {mode === 'query_section' && (
          <p className="text-xs text-muted-foreground mt-1">
            Continue to Query section to edit ordered SOQL, dependencies, and Account Partner joins.
          </p>
        )}
      </div>

      {showQueryJson && (
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Data seed query JSON</p>
          <p className="text-xs text-muted-foreground">
            Upload queries for related objects and account rules with per-office limits.
          </p>
          {querySet && !queryJsonFile && (
            <p className="text-xs text-muted-foreground">
              Saved: {querySet.queries.length} queries
              {querySet.accountRules?.length ? `, ${querySet.accountRules.length} account rules` : ''}
            </p>
          )}
          <FileDropzone
            accept=".json,application/json"
            label="Drop data seed query JSON"
            hint="Includes queries[] and optional accountRules[] for per-office account limits"
            file={queryJsonFile}
            onFileChange={(f) => void handleQueryFile(f)}
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        </div>
      )}

      {showAutomatic && (
        <>
          <div>
            <p className="mb-2 block text-sm font-medium leading-none">CONA datasets to seed</p>
            <div className="flex flex-wrap gap-3">
              {DATASETS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={datasets.includes(d)}
                    onChange={() => toggleDataset(d)}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium leading-none">Account limits</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAccountRowsChange([...accountRows, { ...DEFAULT_ROW }])}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add row
              </Button>
            </div>
            <div className="space-y-2">
              {accountRows.map((row, i) => (
                <div
                  key={`row-${i}`}
                  className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <Label htmlFor={`template-seed-${i}-group`} className="text-xs">Group</Label>
                    <Select
                      id={`template-seed-${i}-group`}
                      value={row.accountGroup}
                      onChange={(e) =>
                        updateRow(i, { accountGroup: e.target.value as AccountSeedRow['accountGroup'] })
                      }
                    >
                      <option value="Z001">Z001</option>
                      <option value="ZFSV">ZFSV</option>
                      <option value="Z003">Z003</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`template-seed-${i}-bottler`} className="text-xs">Bottler</Label>
                    <Select
                      id={`template-seed-${i}-bottler`}
                      value={row.bottler}
                      onChange={(e) => updateRow(i, { bottler: e.target.value as AccountSeedRow['bottler'] })}
                    >
                      <option value="5000">5000</option>
                      <option value="4900">4900</option>
                      <option value="4600">4600</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`template-seed-${i}-channel`} className="text-xs">Channel</Label>
                    <Select
                      id={`template-seed-${i}-channel`}
                      value={row.distributionChannel}
                      onChange={(e) =>
                        updateRow(i, {
                          distributionChannel: e.target.value as AccountSeedRow['distributionChannel'],
                        })
                      }
                    >
                      <option value="Z1">Z1</option>
                      <option value="Z3">Z3</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`template-seed-${i}-limit`} className="text-xs">Limit</Label>
                    <Input
                      id={`template-seed-${i}-limit`}
                      type="number"
                      min={1}
                      value={row.limit}
                      onChange={(e) => updateRow(i, { limit: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {accountRows.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onAccountRowsChange(accountRows.filter((_, idx) => idx !== i))}
                        aria-label={`Remove account limit row ${i + 1}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {isZfsv5000Blocked(row) && (
                    <p className="col-span-full text-xs text-destructive">
                      ZFSV is not available for bottler 5000
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
