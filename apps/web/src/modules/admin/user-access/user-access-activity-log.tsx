'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { auditEventLabel, isAuditEventFailure } from '@sfcc/shared';
import { api } from '@/services/api';
import { GlassCard, InlineAlert } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { relativeTime } from '@/lib/ui-utils';
import { cn } from '@/utils/cn';
import type { AuthAuditEventView, AuthAuditEventsPage, UserAccessRow } from './types';

const PAGE_SIZE = 25;

function metaString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return String(value);
}

function summarize(
  event: AuthAuditEventView,
  nameFor: (id: string | null) => string,
): string {
  const meta = event.metadata ?? {};
  if (event.eventType === 'user_access_updated') {
    const parts: string[] = [];
    if (meta.roleChanged) parts.push(`role → ${metaString(meta.nextRole) ?? '—'}`);
    if (meta.statusChanged) parts.push(`status → ${metaString(meta.nextStatus) ?? '—'}`);
    if (meta.modulesChanged) parts.push(`${Number(meta.moduleCount ?? 0)} module(s)`);
    const actor = typeof meta.actorId === 'string' ? nameFor(meta.actorId) : 'An administrator';
    return `${actor} updated ${nameFor(event.userId)}${parts.length ? ` — ${parts.join(', ')}` : ''}`;
  }
  if (event.eventType === 'user_access_update_denied') {
    return `Change to ${nameFor(event.userId)} was blocked (${metaString(meta.reason) ?? 'policy'})`;
  }
  const reason = metaString(meta.reason);
  return `${nameFor(event.userId)}${reason ? ` — ${reason}` : ''}`;
}

export function UserAccessActivityLog({ users }: { users: UserAccessRow[] }) {
  const [page, setPage] = useState<AuthAuditEventsPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nameFor = useCallback(
    (id: string | null): string => {
      if (!id) return 'System';
      return users.find((u) => u.id === id)?.displayName ?? id;
    },
    [users],
  );

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuthAuditEventsPage>(
        `/auth/audit-events?limit=${PAGE_SIZE}&offset=${nextOffset}`,
      );
      setPage(data);
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  const events = page?.events ?? [];
  const total = page?.total ?? 0;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + PAGE_SIZE, total);

  return (
    <GlassCard
      title="Activity logs"
      description="Security events: access changes, session revocations, and password activity"
      headerAction={
        <Button variant="outline" size="sm" onClick={() => void load(offset)} loading={loading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      }
    >
      {error && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}

      {loading && !page ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {events.map((event) => {
            const failure = isAuditEventFailure(event.eventType);
            return (
              <li key={event.id} className="flex items-start gap-3 py-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    failure
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-400',
                  )}
                >
                  {failure ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{auditEventLabel(event.eventType)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {summarize(event, nameFor)}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={event.createdAt}
                  title={new Date(event.createdAt).toLocaleString()}
                >
                  {relativeTime(event.createdAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>
            Showing {start}–{end} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={offset <= 0 || loading}
              onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={end >= total || loading}
              onClick={() => void load(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
