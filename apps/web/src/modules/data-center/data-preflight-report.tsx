'use client';

import { InlineAlert, StatusBadge } from '@/components/studio';
import type { DataPreflightReport } from './data-center-contracts';

export function DataPreflightReportView({
  report,
  title = 'Preflight report',
}: {
  report: DataPreflightReport;
  title?: string;
}) {
  const quota = report.bulkApi;
  return (
    <section
      className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {report.operation}
            {report.externalIdField ? ` by ${report.externalIdField}` : ''}
            {' · '}
            {report.idempotent ? 'idempotent' : 'non-idempotent'}
          </p>
        </div>
        <StatusBadge status={report.ok ? 'completed' : 'failed'} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Matching records</dt>
          <dd className="font-medium">{report.sourceCount?.toLocaleString() ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Chunks</dt>
          <dd className="font-medium">{report.estimatedChunks ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Bulk batches</dt>
          <dd className="font-medium">{report.estimatedBulkBatches ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target quota</dt>
          <dd className="font-medium">
            {quota.dailyBatchesRemaining == null
              ? `Unknown (${quota.unknownPolicy})`
              : `${quota.dailyBatchesRemaining.toLocaleString()} / ${quota.dailyBatchesMax?.toLocaleString() ?? '—'} left`}
          </dd>
        </div>
      </dl>

      {report.mappings.length > 0 && (
        <div className="overflow-x-auto rounded border border-border/50">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-1.5 text-left">Source field</th>
                <th className="px-2 py-1.5 text-left">Target field</th>
                <th className="px-2 py-1.5 text-left">Access</th>
              </tr>
            </thead>
            <tbody>
              {report.mappings.map((mapping) => (
                <tr key={`${mapping.sourceField}:${mapping.targetField}`} className="border-t border-border/40">
                  <td className="px-2 py-1 font-mono">{mapping.sourceField}</td>
                  <td className="px-2 py-1 font-mono">{mapping.targetField}</td>
                  <td className="px-2 py-1">
                    {mapping.createable ? 'create' : 'no create'}
                    {' / '}
                    {mapping.updateable ? 'update' : 'no update'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.errors.map((error) => (
        <InlineAlert key={error} variant="error">{error}</InlineAlert>
      ))}
      {report.fieldIssues.map((issue) => (
        <InlineAlert key={`${issue.field}:${issue.issue}`} variant="error">
          {issue.detail}
        </InlineAlert>
      ))}
      {report.warnings.map((warning) => (
        <InlineAlert key={warning} variant="warning">{warning}</InlineAlert>
      ))}
    </section>
  );
}
