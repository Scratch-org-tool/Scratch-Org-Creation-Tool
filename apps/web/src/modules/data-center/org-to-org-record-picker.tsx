'use client';

import { Input, Label } from '@/components/ui/input';
import { ORG_TO_ORG_RECORD_LIMIT_MAX } from '@sfcc/shared';
import { cn } from '@/utils/cn';
import type { OrgToOrgRecordPage } from './types';

interface OrgToOrgRecordPickerProps {
  recordsData: OrgToOrgRecordPage | null;
  selectedRecordIds: Set<string>;
  recordLimit: number;
  currentPage: number;
  totalPages: number;
  onToggleRecord: (id: string) => void;
  onToggleAllOnPage: () => void;
  onRecordLimitChange: (limit: number) => void;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function OrgToOrgRecordPicker({
  recordsData,
  selectedRecordIds,
  recordLimit,
  currentPage: page,
  totalPages,
  onToggleRecord,
  onToggleAllOnPage,
  onRecordLimitChange,
  onPageChange,
  loading,
}: OrgToOrgRecordPickerProps) {
  const records = (recordsData?.records ?? []) as Array<Record<string, unknown>>;
  const columns = recordsData?.displayFields ?? ['Id', 'Name'];

  const pageIds = records
    .map((r) => String(r.Id ?? ''))
    .filter((id) => id.length > 0);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedRecordIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedRecordIds.has(id));

  return (
    <div className={cn('space-y-3', loading && 'opacity-60 pointer-events-none')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {recordsData?.objectName ?? 'Records'}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedRecordIds.size} selected
            {recordsData ? ` · ${recordsData.totalSize} total in source` : ''}
          </p>
        </div>
        <div className="w-36">
          <Label>Load limit</Label>
          <Input
            type="number"
            min={1}
            max={ORG_TO_ORG_RECORD_LIMIT_MAX}
            value={recordLimit}
            onChange={(e) =>
              onRecordLimitChange(
                Math.min(ORG_TO_ORG_RECORD_LIMIT_MAX, Math.max(1, Number(e.target.value) || 200)),
              )
            }
            className="w-full"
          />
        </div>
      </div>

      <div className="overflow-auto max-h-96 border border-border/60 rounded-lg">
        {records.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No records loaded.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
              <tr>
                <th className="w-10 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    onChange={onToggleAllOnPage}
                    aria-label="Select all on page"
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
                        checked={selectedRecordIds.has(id)}
                        disabled={!id}
                        onChange={() => onToggleRecord(id)}
                        aria-label={`Select record ${id}`}
                      />
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate"
                      >
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 rounded border border-border disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 rounded border border-border disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
