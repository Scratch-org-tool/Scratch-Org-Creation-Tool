'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListRow, ListRowGroup, StatusBadge, relativeTime } from '@/components/studio';
import { api } from '@/services/api';
import { DataMovementControls, type ControllableDataMovement } from './data-movement-controls';

interface OrgToOrgMovement extends ControllableDataMovement {
  objectName: string | null;
  operation?: string | null;
  externalIdField?: string | null;
  recordCount?: number | null;
  createdAt: string;
  sourceOrg: { alias: string };
  targetOrg: { alias: string };
}

const ACTIVE_STATUSES = ['pending', 'queued', 'planning', 'running', 'paused'];

/** Past org-to-org data deployments with cancel / rollback controls. */
export function OrgToOrgHistoryPanel() {
  const [movements, setMovements] = useState<OrgToOrgMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (options?: { manual?: boolean }) => {
    const request = ++requestRef.current;
    if (options?.manual) setRefreshing(true);
    try {
      const data = await api<OrgToOrgMovement[]>('/data/movements?movementType=org_to_org');
      if (request !== requestRef.current) return;
      setMovements(data);
      setError(null);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load deployment history');
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  // Keep refreshing while any deployment is still active.
  useEffect(() => {
    if (!movements.some((m) => ACTIVE_STATUSES.includes(m.status))) return;
    const timer = setTimeout(() => void load(), 5000);
    return () => clearTimeout(timer);
  }, [movements, load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Latest 50 org-to-org data deployments you started.
        </p>
        <Button size="sm" variant="outline" onClick={() => void load({ manual: true })} loading={refreshing}>
          {!refreshing && <RefreshCw />}
          Refresh
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ListRowGroup
        loading={loading}
        emptyMessage="No org-to-org deployments yet — run one from the New deployment tab."
        maxHeight="540px"
      >
        {movements.map((m) => (
          <div key={m.id} className="border-b border-border/40 p-2 last:border-0">
            <ListRow
              title={`${m.objectName ?? 'Data'} · ${m.sourceOrg.alias} → ${m.targetOrg.alias}`}
              subtitle={[
                relativeTime(m.createdAt),
                m.operation ? m.operation : null,
                m.externalIdField ? `by ${m.externalIdField}` : null,
                m.recordCount != null ? `${m.recordCount.toLocaleString()} records` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              status={m.status}
              trailing={<StatusBadge status={m.status} />}
            />
            <DataMovementControls
              movement={m}
              onUpdated={(next) =>
                setMovements((current) =>
                  current.map((item) => (item.id === next.id ? { ...item, ...next } : item)),
                )
              }
            />
          </div>
        ))}
      </ListRowGroup>
    </div>
  );
}
