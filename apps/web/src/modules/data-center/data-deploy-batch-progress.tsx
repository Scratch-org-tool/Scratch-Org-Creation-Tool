'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, InlineAlert, ListRow, ListRowGroup, StatusBadge } from '@/components/studio';
import { api } from '@/services/api';
import {
  isBatchCancellable,
  isRetrySafe,
  rollbackInsertedCount,
} from './data-center-contracts';

export interface DataDeployBatchChunk {
  id: string;
  chunkIndex: number;
  status: string;
  recordCount: number | null;
  error: string | null;
  errorDetails?: Record<string, unknown> | null;
  jobId: string | null;
  attempts?: number;
}

export interface DataDeployBatch {
  id: string;
  status: string;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  totalRecords: number;
  chunkSize: number;
  objectName: string | null;
  strategy: string;
  operation?: string;
  externalIdField?: string | null;
  idempotent?: boolean;
  objectKey?: string | null;
  dependsOn?: string[];
  maxParallelChunks?: number;
  quotaRemaining?: number | null;
  quotaConfidence?: string;
  rollbackPolicy?: string;
  rollbackStatus?: string | null;
  rollbackReport?: unknown;
  error?: string | null;
  chunks: DataDeployBatchChunk[];
}

interface DataDeployBatchProgressProps {
  batchId: string;
  onTerminal?: (batch: DataDeployBatch) => void;
}

const TERMINAL = ['completed', 'partial', 'failed', 'cancelled'];

export function DataDeployBatchProgress({ batchId, onTerminal }: DataDeployBatchProgressProps) {
  const [batch, setBatch] = useState<DataDeployBatch | null>(null);
  const [pollRevision, setPollRevision] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [confirmDeleteInserted, setConfirmDeleteInserted] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const loadRequest = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<boolean> => {
    const request = ++loadRequest.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    try {
      const data = await api<DataDeployBatch>(`/data/batches/${batchId}`, {
        signal: controller.signal,
      });
      if (request !== loadRequest.current || controller.signal.aborted) return false;
      setBatch(data);
      if (TERMINAL.includes(data.status)) {
        onTerminal?.(data);
        return true;
      }
    } catch (err) {
      if (!controller.signal.aborted && request === loadRequest.current) console.error(err);
    }
    return false;
  }, [batchId, onTerminal]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const terminal = await load();
      if (!cancelled && !terminal) timer = setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      cancelled = true;
      loadRequest.current += 1;
      loadAbort.current?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [load, pollRevision]);

  if (!batch) return null;

  const progressLabel = `${batch.completedChunks + batch.failedChunks}/${batch.totalChunks} chunks`;
  const retrySafe = isRetrySafe(batch);
  const failedChunks = batch.chunks.filter((chunk) => chunk.status === 'failed');
  const activeChunks = batch.chunks.filter((chunk) => ['queued', 'running'].includes(chunk.status)).length;
  const rollbackAvailable = retrySafe
    && batch.rollbackPolicy === 'capture'
    && ['completed', 'partial', 'failed'].includes(batch.status);
  const cancelAvailable = isBatchCancellable(batch.status);

  const runAction = async (key: string, path: string, body?: unknown) => {
    setActionLoading(key);
    setActionError(null);
    try {
      await api(path, {
        method: 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      await load();
      setPollRevision((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Batch action failed');
      await load();
    } finally {
      setActionLoading(null);
    }
  };
  const insertedCount = rollbackInsertedCount(batch.rollbackReport);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Load-balanced deploy</p>
          <p className="text-xs text-muted-foreground">
            {progressLabel} · {batch.totalRecords.toLocaleString()} records · chunks of{' '}
            {batch.chunkSize.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Scheduler: {activeChunks}/{batch.maxParallelChunks ?? '—'} active
            {' · '}
            {batch.operation ?? batch.strategy}
            {batch.externalIdField ? ` by ${batch.externalIdField}` : ''}
            {batch.dependsOn?.length ? ` · waits for ${batch.dependsOn.join(', ')}` : ' · ready'}
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>
      {batch.error && <InlineAlert variant="error">{batch.error}</InlineAlert>}
      {actionError && (
        <InlineAlert variant="error" onDismiss={() => setActionError(null)}>{actionError}</InlineAlert>
      )}
      <ListRowGroup>
        {batch.chunks.map((chunk) => (
          <div key={chunk.id} className="border-b border-border/40 last:border-b-0">
            <ListRow
              title={`Chunk ${chunk.chunkIndex + 1}`}
              subtitle={[
                chunk.recordCount != null ? `${chunk.recordCount.toLocaleString()} records` : null,
                chunk.attempts ? `${chunk.attempts} retry attempt(s)` : null,
              ].filter(Boolean).join(' · ') || undefined}
              trailing={(
                <div className="flex items-center gap-2">
                  {chunk.status === 'failed' && retrySafe && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={actionLoading === chunk.id}
                      onClick={() => void runAction(
                        chunk.id,
                        `/data/batches/${batch.id}/chunks/${chunk.id}/retry`,
                      )}
                    >
                      Retry chunk
                    </Button>
                  )}
                  <StatusBadge status={chunk.status} />
                </div>
              )}
            />
            {chunk.error && (
              <div className="px-3 pb-3 text-xs">
                <p className="font-medium text-destructive">{chunk.error}</p>
                {chunk.errorDetails && (
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2">
                    {JSON.stringify(chunk.errorDetails, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </ListRowGroup>
      {!retrySafe && failedChunks.length > 0 && (
        <InlineAlert variant="warning">
          Retry is blocked: only idempotent upserts with an explicit external ID can be retried safely.
        </InlineAlert>
      )}
      <div className="flex flex-wrap gap-2">
        {retrySafe && failedChunks.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            loading={actionLoading === 'retry-failed'}
            onClick={() => void runAction('retry-failed', `/data/batches/${batch.id}/retry-failed`)}
          >
            Retry failed
          </Button>
        )}
        {rollbackAvailable && (
          <Button size="sm" variant="outline" onClick={() => setConfirmRollback(true)}>
            Roll back
          </Button>
        )}
        {cancelAvailable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel batch
          </Button>
        )}
        {rollbackAvailable && insertedCount > 0 && (
          <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteInserted(true)}>
            Delete inserted records
          </Button>
        )}
      </div>
      {batch.rollbackStatus && (
        <InlineAlert variant={batch.rollbackStatus === 'completed' ? 'success' : 'warning'}>
          Rollback {batch.rollbackStatus}
          {batch.rollbackReport ? (
            <pre className="mt-2 max-h-40 overflow-auto text-xs">
              {JSON.stringify(batch.rollbackReport, null, 2)}
            </pre>
          ) : null}
        </InlineAlert>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this data batch?"
        message="Pending chunks will not be released. Queued and running Bulk API or SFDMU work will be cancelled on a best-effort basis."
        confirmLabel="Cancel batch"
        destructive
        loading={actionLoading === 'cancel'}
        onOpenChange={setConfirmCancel}
        onConfirm={() => {
          setConfirmCancel(false);
          void runAction('cancel', `/data/batches/${batch.id}/cancel`);
        }}
      />
      <ConfirmDialog
        open={confirmDeleteInserted}
        title="Delete records inserted by this batch?"
        message={`The rollback report identifies ${insertedCount} inserted record(s). This explicit second rollback action permanently deletes them.`}
        confirmLabel="Delete inserted records"
        destructive
        loading={actionLoading === 'rollback-delete-inserted'}
        onOpenChange={setConfirmDeleteInserted}
        onConfirm={() => {
          setConfirmDeleteInserted(false);
          void runAction(
            'rollback-delete-inserted',
            `/data/batches/${batch.id}/rollback`,
            { deleteInserted: true },
          );
        }}
      />
      <ConfirmDialog
        open={confirmRollback}
        title="Roll back this data batch?"
        message="Restore captured values for this idempotent upsert. Newly inserted records are retained unless the server report identifies a safe restoration action."
        confirmLabel="Roll back batch"
        loading={actionLoading === 'rollback'}
        onOpenChange={setConfirmRollback}
        onConfirm={() => {
          setConfirmRollback(false);
          void runAction('rollback', `/data/batches/${batch.id}/rollback`, { deleteInserted: false });
        }}
      />
    </div>
  );
}
