'use client';

import { cn } from '@/utils/cn';
import type { OrgToOrgCompareResult } from './types';

interface OrgToOrgComparePanelProps {
  result: OrgToOrgCompareResult;
  activeTab: 'summary' | 'source';
  onTabChange: (tab: 'summary' | 'source') => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function OrgToOrgComparePanel({
  result,
  activeTab,
  onTabChange,
  page,
  totalPages,
  onPageChange,
  loading,
}: OrgToOrgComparePanelProps) {
  const tabs: Array<{ id: 'summary' | 'source'; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'source', label: 'Source records' },
  ];

  const records = result.sourceRecords.records as Array<Record<string, unknown>>;
  const columns =
    records.length > 0
      ? Object.keys(records[0]).filter((k) => k !== 'attributes')
      : [];

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 bg-card px-3 py-2">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                activeTab === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Match field: <span className="font-mono">{result.matchField}</span>
        </span>
      </div>

      {result.warning && (
        <p className="text-xs text-amber-600 dark:text-amber-400 px-3 py-2 border-b border-border/40">
          {result.warning}
        </p>
      )}

      <div className={cn('p-4', loading && 'opacity-60 pointer-events-none')}>
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="Source total" value={result.summary.sourceTotal} />
              <Stat label="Target total" value={result.summary.targetTotal} />
              <Stat label="Only in source" value={result.summary.onlyInSource} />
              <Stat label="Only in target" value={result.summary.onlyInTarget} />
              <Stat label="In both" value={result.summary.inBoth} />
            </div>

            <div className="grid md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-medium mb-1 text-muted-foreground">Only in source (sample)</p>
                <pre className="studio-console p-2 rounded max-h-32 overflow-auto">
                  {result.onlyInSourceKeys.length
                    ? result.onlyInSourceKeys.join('\n')
                    : '—'}
                </pre>
              </div>
              <div>
                <p className="font-medium mb-1 text-muted-foreground">Only in target (sample)</p>
                <pre className="studio-console p-2 rounded max-h-32 overflow-auto">
                  {result.onlyInTargetKeys.length
                    ? result.onlyInTargetKeys.join('\n')
                    : '—'}
                </pre>
              </div>
              <div>
                <p className="font-medium mb-1 text-muted-foreground">In both (sample)</p>
                <pre className="studio-console p-2 rounded max-h-32 overflow-auto">
                  {result.inBothKeys.length ? result.inBothKeys.join('\n') : '—'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'source' && (
          <div className="space-y-3">
            <nav className="flex items-center justify-between text-xs text-muted-foreground" aria-label="Source records pagination">
              <span aria-current="page">
                Page {page} of {totalPages} · {result.sourceRecords.totalSize} record(s) in source
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => onPageChange(page - 1)}
                  aria-label="Previous source records page"
                  className="px-2 py-1 rounded border border-border disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => onPageChange(page + 1)}
                  aria-label="Next source records page"
                  className="px-2 py-1 rounded border border-border disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </nav>

            <div className="overflow-auto max-h-96 border border-border/40 rounded">
              {columns.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-card [&_th]:bg-card border-b border-border/60">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, i) => (
                      <tr key={i} className="border-t border-border/30">
                        {columns.map((col) => (
                          <td key={col} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <pre className="p-3 text-xs overflow-auto">
                  {JSON.stringify(records, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
