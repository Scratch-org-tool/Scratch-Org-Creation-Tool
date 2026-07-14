'use client';

const PREFERRED_COLUMNS = [
  'Name',
  'Id',
  'cfs_ob__Bottler__c',
  'cfs_ob__Primary_Group__c',
  'cfs_ob__Record_Category__c',
  'cfs_ob__Status__c',
  'RecordTypeId',
];

function pickColumns(records: Array<Record<string, unknown>>, maxCols = 8): string[] {
  if (records.length === 0) return [];
  const keys = Object.keys(records[0]).filter((k) => k !== 'attributes');
  const preferred = PREFERRED_COLUMNS.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !preferred.includes(k));
  return [...preferred, ...rest].slice(0, maxCols);
}

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface DataPreviewTableProps {
  records: unknown[];
  totalSize: number;
  maxRows?: number;
  previewCapped?: boolean;
  previewLimit?: number;
  className?: string;
}

export function DataPreviewTable({
  records,
  totalSize,
  maxRows = 15,
  previewCapped,
  previewLimit,
  className,
}: DataPreviewTableProps) {
  const rows = records.slice(0, maxRows) as Array<Record<string, unknown>>;
  const columns = pickColumns(rows);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No records returned for preview.</p>;
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium mb-1">{totalSize.toLocaleString()} record(s) matched</p>
      {(previewCapped || records.length < totalSize) && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
          Preview shows up to {previewLimit ?? maxRows} rows
          {previewCapped ? ` — total count from SELECT COUNT()` : ''}.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-secondary/30">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
