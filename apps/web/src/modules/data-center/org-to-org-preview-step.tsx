'use client';

import { memo, useMemo, useState } from 'react';
import { extractRecordId } from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { BusyRow } from '@/components/studio';
import type { OrgToOrgObjectDeployConfig, OrgToOrgObjectInfo } from './types';

interface OrgToOrgPreviewStepProps {
  checkedObjects: OrgToOrgObjectInfo[];
  objectConfigs: Map<string, OrgToOrgObjectDeployConfig>;
  selectedRecordIds: Map<string, Set<string>>;
  /** True while record previews for the review step are still being fetched. */
  loading?: boolean;
  onToggleRecord: (objectName: string, recordId: string) => void;
  onToggleAll: (objectName: string, recordIds: string[]) => void;
  onClearSelection: (objectName: string) => void;
}

/** Rows rendered before the user asks for more — keeps huge previews responsive. */
const INITIAL_VISIBLE_ROWS = 200;
const VISIBLE_ROWS_INCREMENT = 500;

const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

const RecordRow = memo(function RecordRow({
  objectName,
  id,
  row,
  columns,
  checked,
  onToggleRecord,
}: {
  objectName: string;
  id: string;
  row: Record<string, unknown>;
  columns: string[];
  checked: boolean;
  onToggleRecord: (objectName: string, recordId: string) => void;
}) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-2 py-1">
        <input
          type="checkbox"
          checked={checked}
          disabled={!id}
          onChange={() => onToggleRecord(objectName, id)}
          aria-label={id ? `Select record ${id}` : 'Record has no Id and cannot be selected'}
        />
      </td>
      {columns.map((col) => (
        <td key={col} className="px-2 py-1 whitespace-nowrap max-w-[180px] truncate">
          {String(row[col] ?? '')}
        </td>
      ))}
    </tr>
  );
});

const ObjectPreviewTable = memo(function ObjectPreviewTable({
  objectName,
  label,
  config,
  selected,
  loading,
  onToggleRecord,
  onToggleAll,
  onClearSelection,
}: {
  objectName: string;
  label: string;
  config: OrgToOrgObjectDeployConfig | undefined;
  selected: ReadonlySet<string>;
  loading?: boolean;
  onToggleRecord: (objectName: string, recordId: string) => void;
  onToggleAll: (objectName: string, recordIds: string[]) => void;
  onClearSelection: (objectName: string) => void;
}) {
  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS);

  const records = useMemo(
    () => (config?.previewRecords ?? []) as Array<Record<string, unknown>>,
    [config?.previewRecords],
  );
  const columns = config?.displayFields ?? ['Id', 'Name'];
  const matchCount = config?.matchCount ?? 0;

  const rows = useMemo(
    () => records.map((row) => ({ row, id: extractRecordId(row) })),
    [records],
  );
  const pageIds = useMemo(
    () => rows.map((entry) => entry.id).filter(Boolean),
    [rows],
  );
  const unselectableCount = rows.length - pageIds.length;

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = pageIds.some((id) => selected.has(id));
  const visible = rows.slice(0, visibleRows);
  const hiddenCount = rows.length - visible.length;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden min-w-0">
      <div className="px-4 py-2 bg-secondary/30 border-b border-border/60 flex flex-wrap justify-between items-center gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground font-mono">{objectName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {matchCount.toLocaleString()} match · {selected.size.toLocaleString()} selected
          </span>
          {selected.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => onClearSelection(objectName)}
            >
              Clear selection
            </Button>
          )}
        </div>
      </div>
      {records.length > 0 && records.length < matchCount && (
        <p className="px-4 py-1.5 text-xs text-muted-foreground border-b border-border/40 bg-secondary/10">
          Showing the first {records.length.toLocaleString()} of {matchCount.toLocaleString()}{' '}
          matching records. Selecting all checks only the loaded records — leave every row
          unchecked to deploy all matches.
        </p>
      )}
      {unselectableCount > 0 && (
        <p className="px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400 border-b border-border/40 bg-amber-500/5">
          {unselectableCount.toLocaleString()} row(s) did not return an Id and cannot be selected
          individually.
        </p>
      )}
      <div className="min-w-0 overflow-x-auto overflow-y-auto max-h-64">
        {records.length === 0 ? (
          loading ? (
            <BusyRow label="Loading matching records…" className="text-xs" />
          ) : (
            <p className="p-4 text-xs text-muted-foreground">No records match the current filter.</p>
          )
        ) : (
          <table className="text-xs w-max min-w-full">
            <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
              <tr>
                <th className="w-10 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={pageIds.length === 0}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => onToggleAll(objectName, pageIds)}
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
              {visible.map((entry, index) => (
                <RecordRow
                  key={entry.id || `row-${index}`}
                  objectName={objectName}
                  id={entry.id}
                  row={entry.row}
                  columns={columns}
                  checked={Boolean(entry.id) && selected.has(entry.id)}
                  onToggleRecord={onToggleRecord}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      {hiddenCount > 0 && (
        <div className="px-4 py-2 border-t border-border/40 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {hiddenCount.toLocaleString()} more row(s) loaded but not rendered.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setVisibleRows((count) => count + VISIBLE_ROWS_INCREMENT)}
          >
            Show more rows
          </Button>
        </div>
      )}
    </div>
  );
});

export function OrgToOrgPreviewStep({
  checkedObjects,
  objectConfigs,
  selectedRecordIds,
  loading,
  onToggleRecord,
  onToggleAll,
  onClearSelection,
}: OrgToOrgPreviewStepProps) {
  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
      <p className="text-sm text-muted-foreground">
        Review matching records per object. Check rows to deploy only specific records, or leave
        unchecked to deploy all records matching the filter.
      </p>
      {checkedObjects.map((obj) => (
        <ObjectPreviewTable
          key={obj.apiName}
          objectName={obj.apiName}
          label={obj.label}
          config={objectConfigs.get(obj.apiName)}
          selected={selectedRecordIds.get(obj.apiName) ?? EMPTY_SELECTION}
          loading={loading}
          onToggleRecord={onToggleRecord}
          onToggleAll={onToggleAll}
          onClearSelection={onClearSelection}
        />
      ))}
    </div>
  );
}
