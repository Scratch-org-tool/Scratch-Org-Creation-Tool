'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, InlineAlert, PageHeader, StatusBadge } from '@/components/studio';
import { useAuth } from '@/contexts/auth-context';
import { api, apiBlob } from '@/services/api';

interface AuditEntry {
  id: string;
  source: 'auth' | 'deployment' | 'workbench';
  action: string;
  actorId: string | null;
  actorName: string | null;
  target: string | null;
  status: string | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

const SOURCE_LABELS: Record<AuditEntry['source'], string> = {
  auth: 'Authentication',
  deployment: 'Deployments',
  workbench: 'Workbench',
};

const PAGE_SIZE = 50;

export function AuditReportWorkspace() {
  const { profile } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<'all' | AuditEntry['source']>('all');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.replace('/dashboard');
  }, [profile, router]);

  const buildQuery = useCallback(
    (nextOffset: number) => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(nextOffset));
      params.set('source', source);
      if (action.trim()) params.set('action', action.trim());
      if (actor.trim()) params.set('actor', actor.trim());
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      return params.toString();
    },
    [source, action, actor, from, to],
  );

  const load = useCallback(async (nextOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuditResponse>(`/admin/audit-report?${buildQuery(nextOffset)}`);
      setEntries(data.entries);
      setTotal(data.total);
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the audit report');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    if (profile?.role === 'admin') void load(0);
  }, [profile, load]);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await apiBlob(`/admin/audit-report/export?${buildQuery(0)}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!profile || profile.role !== 'admin') return null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHeader
        title="Audit Report"
        subtitle="Who deployed what, where, and when — plus authentication and workbench activity. Export for compliance requests."
        showBreadcrumbs={false}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => void load(0)} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </Button>
            <Button size="sm" onClick={() => void exportCsv()} loading={exporting}>
              <Download aria-hidden />
              Export CSV
            </Button>
          </>
        )}
      />

      {error && <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>}

      <GlassCard title="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label htmlFor="audit-source">Source</Label>
            <Select
              id="audit-source"
              value={source}
              onChange={(event) => setSource(event.target.value as typeof source)}
            >
              <option value="all">All sources</option>
              <option value="auth">Authentication</option>
              <option value="deployment">Deployments</option>
              <option value="workbench">Workbench</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="audit-action">Action contains</Label>
            <Input
              id="audit-action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="deploy_enqueued"
            />
          </div>
          <div>
            <Label htmlFor="audit-actor">Actor contains</Label>
            <Input
              id="audit-actor"
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              placeholder="DPT_…"
            />
          </div>
          <div>
            <Label htmlFor="audit-from">From</Label>
            <Input
              id="audit-from"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="audit-to">To</Label>
            <Input
              id="audit-to"
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => void load(0)} loading={loading}>
            Apply filters
          </Button>
        </div>
      </GlassCard>

      <GlassCard
        title={(
          <span className="flex items-center gap-2 text-base font-semibold">
            <ScrollText className="size-4 text-primary" aria-hidden />
            Activity ({total})
          </span>
        )}
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No audit activity matches these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Actor</th>
                  <th className="py-2 pr-3 font-medium">Target</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/40 last:border-0 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{SOURCE_LABELS[entry.source]}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{entry.action}</td>
                    <td className="py-2 pr-3">
                      {entry.actorName ?? entry.actorId ?? '—'}
                    </td>
                    <td className="max-w-[280px] truncate py-2 pr-3 text-muted-foreground" title={entry.target ?? ''}>
                      {entry.target || '—'}
                    </td>
                    <td className="py-2">{entry.status ? <StatusBadge status={entry.status} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => void load(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
