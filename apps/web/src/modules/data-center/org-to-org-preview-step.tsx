'use client';

import type { OrgToOrgObjectDeployConfig, OrgToOrgObjectInfo } from './types';

interface OrgToOrgPreviewStepProps {
  checkedObjects: OrgToOrgObjectInfo[];
  objectConfigs: Map<string, OrgToOrgObjectDeployConfig>;
  selectedRecordIds: Map<string, Set<string>>;
  onToggleRecord: (objectName: string, recordId: string) => void;
  onToggleAll: (objectName: string, recordIds: string[]) => void;
}

export function OrgToOrgPreviewStep({
  checkedObjects,
  objectConfigs,
  selectedRecordIds,
  onToggleRecord,
  onToggleAll,
}: OrgToOrgPreviewStepProps) {
  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
      <p className="text-sm text-muted-foreground">
        Review matching records per object. Check rows to deploy only specific records, or leave
        unchecked to deploy all records matching the filter.
      </p>
      {checkedObjects.map((obj) => {
        const config = objectConfigs.get(obj.apiName);
        const records = (config?.previewRecords ?? []) as Array<Record<string, unknown>>;
        const columns = config?.displayFields ?? ['Id', 'Name'];
        const selected = selectedRecordIds.get(obj.apiName) ?? new Set();
        const pageIds = records.map((r) => String(r.Id ?? '')).filter(Boolean);
        const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
        const someSelected = pageIds.some((id) => selected.has(id));

        return (
          <div key={obj.apiName} className="rounded-lg border border-border/60 overflow-hidden min-w-0">
            <div className="px-4 py-2 bg-secondary/30 border-b border-border/60 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{obj.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{obj.apiName}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {config?.matchCount ?? 0} match · {selected.size} selected
              </span>
            </div>
            <div className="min-w-0 overflow-x-auto overflow-y-auto max-h-64">
              {records.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">No records match the current filter.</p>
              ) : (
                <table className="text-xs w-max min-w-full">
                  <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
                    <tr>
                      <th className="w-10 px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => onToggleAll(obj.apiName, pageIds)}
                          aria-label="Select all"
                        />
                      </th>
                      {columns.map((col) => (
                        <th key={col} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => {
                      const id = String(row.Id ?? '');
                      return (
                        <tr key={id || JSON.stringify(row)} className="border-t border-border/30">
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              disabled={!id}
                              onChange={() => onToggleRecord(obj.apiName, id)}
                            />
                          </td>
                          {columns.map((col) => (
                            <td key={col} className="px-2 py-1 whitespace-nowrap max-w-[180px] truncate">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
