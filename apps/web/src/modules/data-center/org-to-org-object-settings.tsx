'use client';

import { Input, Label } from '@/components/ui/input';
import { ORG_TO_ORG_RECORD_LIMIT_MAX, DATA_DEPLOY_CHUNK_SIZE, shouldChunkDeploy, chunkCountForLimit } from '@sfcc/shared';
import { OrgToOrgDeployFieldsPicker } from './org-to-org-deploy-fields-picker';
import { OrgToOrgFilterBuilder } from './org-to-org-filter-builder';
import { OrgToOrgSoqlEditor } from './org-to-org-soql-editor';
import type { OrgToOrgObjectDeployConfig, OrgToOrgObjectMeta, OrgToOrgQueryMode } from './types';

interface OrgToOrgObjectSettingsProps {
  meta: OrgToOrgObjectMeta;
  config: OrgToOrgObjectDeployConfig;
  loadingPreview?: boolean;
  onConfigChange: (patch: Partial<OrgToOrgObjectDeployConfig>) => void;
  onReferenceToggle: (fieldName: string, selected: boolean) => void;
  onQueryModeChange: (mode: OrgToOrgQueryMode) => void;
  onApplySoql: (soql: string) => void;
  onClearSoql: () => void;
}

export function OrgToOrgObjectSettings({
  meta,
  config,
  loadingPreview,
  onConfigChange,
  onReferenceToggle,
  onQueryModeChange,
  onApplySoql,
  onClearSoql,
}: OrgToOrgObjectSettingsProps) {
  const previewRecords = (config.previewRecords ?? []) as Array<Record<string, unknown>>;
  const previewColumns = config.displayFields ?? meta.displayFields;
  const isSoqlMode = config.queryMode === 'soql' && Boolean(config.customSoql?.trim());
  const willChunk = shouldChunkDeploy(config.recordLimit);
  const chunkCount = chunkCountForLimit(config.recordLimit);

  return (
    <div className="space-y-6 p-4 min-w-0 max-w-full overflow-y-auto overflow-x-hidden max-h-[40rem]">
      <div>
        <h3 className="text-sm font-semibold">{meta.label} object settings</h3>
        <p className="text-xs text-muted-foreground font-mono">{meta.objectName}</p>
      </div>

      <OrgToOrgSoqlEditor
        objectName={meta.objectName}
        config={config}
        onApply={onApplySoql}
        onModeChange={onQueryModeChange}
        onClear={onClearSoql}
      />

      <div>
        <Label htmlFor="org-object-record-limit">Maximum number of records to deploy</Label>
        <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
          <span className="text-sm text-muted-foreground">Deploy up to</span>
          <Input
            id="org-object-record-limit"
            type="number"
            min={1}
            max={ORG_TO_ORG_RECORD_LIMIT_MAX}
            value={config.recordLimit}
            onChange={(e) =>
              onConfigChange({
                recordLimit: Math.min(
                  ORG_TO_ORG_RECORD_LIMIT_MAX,
                  Math.max(1, Number(e.target.value) || 200),
                ),
              })
            }
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">
            records ({ORG_TO_ORG_RECORD_LIMIT_MAX.toLocaleString()} maximum)
          </span>
        </div>
        {willChunk && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Will run as {chunkCount} load-balanced chunks of up to{' '}
            {DATA_DEPLOY_CHUNK_SIZE.toLocaleString()} records each.
          </p>
        )}
        {config.recordLimit > 10_000 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            For large datasets, upsert (SFDMU) is recommended over bulk insert.
          </p>
        )}
      </div>

      {isSoqlMode && (
        <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          Driven by custom SOQL — editing filters or deploy fields below switches back to visual mode.
        </p>
      )}

      <OrgToOrgFilterBuilder
        meta={meta}
        filters={config.filters}
        matchCount={config.matchCount}
        loading={loadingPreview}
        onChange={(filters) => onConfigChange({ filters })}
      />

      <OrgToOrgDeployFieldsPicker
        deployableFields={meta.deployableFields ?? []}
        selectedFields={config.selectedDeployFields}
        matchField={meta.matchField}
        onChange={(selectedDeployFields) => onConfigChange({ selectedDeployFields })}
      />

      <div>
        <p className="text-sm font-medium leading-none">Reference relationships (optional)</p>
        <p className="text-xs text-muted-foreground mb-2">
          Lookup fields included when the referenced object is part of this deployment.
        </p>
        <div className="min-w-0 overflow-x-auto overflow-y-auto border border-border/60 rounded-lg max-h-40">
          <table className="text-xs w-max min-w-full">
            <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
              <tr>
                <th className="w-10 px-2 py-1.5" />
                <th className="text-left px-2 py-1.5">Field</th>
                <th className="text-left px-2 py-1.5">Referenced object</th>
                <th className="text-left px-2 py-1.5">Notes</th>
              </tr>
            </thead>
            <tbody>
              {meta.referenceFields.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-muted-foreground">
                    No reference fields on this object.
                  </td>
                </tr>
              ) : (
                meta.referenceFields.map((ref) => {
                  const selected = config.selectedReferenceFields.includes(ref.name);
                  return (
                    <tr key={ref.name} className="border-t border-border/30">
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!ref.deployable}
                          onChange={(e) => onReferenceToggle(ref.name, e.target.checked)}
                          aria-label={`Include relationship ${ref.label}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">{ref.label}</td>
                      <td className="px-2 py-1.5 font-mono">{ref.referencedTo.join(', ')}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {!ref.deployable ? 'Cannot be deployed to the target' : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border/60 p-3">
        <p className="text-xs font-medium text-muted-foreground">Filter using parent object</p>
        <p className="text-xs text-muted-foreground mt-1">
          Parent-object filters will be available in a future release.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium leading-none">Matching records (sample)</p>
          <span className="text-xs text-muted-foreground">
            {loadingPreview
              ? 'Loading…'
              : `${config.matchCount?.toLocaleString() ?? '—'} match deploy limit (${config.recordLimit.toLocaleString()})`}
          </span>
        </div>
        {config.recordLimit > 2_000 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            Preview table shows up to 2,000 sample rows — deploy still uses your{' '}
            {config.recordLimit.toLocaleString()} record limit.
          </p>
        )}
        <div className="min-w-0 overflow-x-auto overflow-y-auto border border-border/60 rounded-lg max-h-48">
          {loadingPreview ? (
            <p className="p-4 text-xs text-muted-foreground">Loading records…</p>
          ) : previewRecords.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              No records match — adjust filters, fields, limit, or SOQL query.
            </p>
          ) : (
            <table className="text-xs w-max min-w-full">
              <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
                <tr>
                  {previewColumns.map((col) => (
                    <th key={col} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRecords.map((row, i) => (
                  <tr key={String(row.Id ?? i)} className="border-t border-border/30">
                    {previewColumns.map((col) => (
                      <td
                        key={col}
                        className="px-2 py-1 whitespace-nowrap max-w-[160px] truncate"
                      >
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
