'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, InlineAlert } from '@/components/studio';
import { api } from '@/services/api';

export interface ControllableDataMovement {
  id: string;
  status: string;
  canCancel?: boolean;
  canRollback?: boolean;
  batchId?: string | null;
  rollbackStatus?: string | null;
  rollbackReport?: unknown;
}

export function DataMovementControls({
  movement,
  onUpdated,
}: {
  movement: ControllableDataMovement | null;
  onUpdated?: (movement: ControllableDataMovement) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<unknown>(movement?.rollbackReport);
  const [confirm, setConfirm] = useState<'cancel' | 'rollback' | 'delete-inserted' | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    setReport(movement?.rollbackReport);
    setError(null);
    setConfirm(null);
  }, [movement?.id, movement?.rollbackReport]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  if (!movement) return null;
  const cancelAllowed = movement.canCancel ?? (
    !movement.batchId
    && ['pending', 'queued', 'planning', 'running', 'paused'].includes(movement.status)
  );
  const rollbackAllowed = movement.canRollback ?? Boolean(
    movement.rollbackStatus
    && !['not_available', 'blocked'].includes(movement.rollbackStatus),
  );
  if (!cancelAllowed && !rollbackAllowed && !report) return null;

  const refresh = async (request: number) => {
    const current = await api<ControllableDataMovement>(`/data/movements/${movement.id}`);
    if (request !== requestRef.current) return;
    setReport(current.rollbackReport);
    onUpdated?.(current);
  };

  const run = async (action: 'cancel' | 'rollback', deleteInserted = false) => {
    const request = ++requestRef.current;
    setConfirm(null);
    setPending(deleteInserted ? 'delete-inserted' : action);
    setError(null);
    try {
      const result = await api<unknown>(`/data/movements/${movement.id}/${action}`, {
        method: 'POST',
        body: action === 'rollback' ? JSON.stringify({ deleteInserted }) : undefined,
      });
      if (request !== requestRef.current) return;
      if (action === 'rollback') setReport(result);
      await refresh(request);
    } catch (cause) {
      if (request !== requestRef.current) return;
      await refresh(request).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : `Movement ${action} failed`);
    } finally {
      if (request === requestRef.current) setPending(null);
    }
  };

  const deleteInsertedRequired = insertedCount(report) > 0
    || reportFlag(report, 'deleteInsertedRequired')
    || reportFlag(report, 'requiresDeleteInserted')
    || reportFlag(report, 'requiresDeleteInsertedConfirmation');

  return (
    <div className="space-y-3">
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {report != null && (
        <InlineAlert variant={deleteInsertedRequired ? 'warning' : 'info'} title="Rollback report">
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(report, null, 2)}
          </pre>
        </InlineAlert>
      )}
      <div className="flex flex-wrap gap-2">
        {cancelAllowed && (
          <Button size="sm" variant="outline" onClick={() => setConfirm('cancel')}>
            Cancel movement
          </Button>
        )}
        {rollbackAllowed && (
          <Button size="sm" variant="outline" onClick={() => setConfirm('rollback')}>
            Review rollback
          </Button>
        )}
        {rollbackAllowed && deleteInsertedRequired && (
          <Button size="sm" variant="destructive" onClick={() => setConfirm('delete-inserted')}>
            Delete inserted records
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this data movement?"
        message="The server will stop work that has not reached a terminal state."
        confirmLabel="Cancel movement"
        loading={pending === 'cancel'}
        onOpenChange={(open) => setConfirm(open ? 'cancel' : null)}
        onConfirm={() => void run('cancel')}
      />
      <ConfirmDialog
        open={confirm === 'rollback'}
        title="Generate and apply the safe rollback?"
        message="The first rollback request restores captured updates without deleting inserted records. Review the resulting report before any deletion."
        confirmLabel="Run safe rollback"
        destructive={false}
        loading={pending === 'rollback'}
        onOpenChange={(open) => setConfirm(open ? 'rollback' : null)}
        onConfirm={() => void run('rollback')}
      />
      <ConfirmDialog
        open={confirm === 'delete-inserted'}
        title="Delete records inserted by this movement?"
        message={`The rollback report identifies ${insertedCount(report)} inserted record(s). This explicit second action is destructive and cannot be undone.`}
        confirmLabel="Delete inserted records"
        loading={pending === 'delete-inserted'}
        onOpenChange={(open) => setConfirm(open ? 'delete-inserted' : null)}
        onConfirm={() => void run('rollback', true)}
      />
    </div>
  );
}

function insertedCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + insertedCount(item), 0);
  }
  const record = value as Record<string, unknown>;
  const direct = record.insertedCount;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  return Object.values(record).reduce<number>(
    (total, item) => total + insertedCount(item),
    0,
  );
}

function reportFlag(value: unknown, key: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => reportFlag(item, key));
  const record = value as Record<string, unknown>;
  return record[key] === true || Object.values(record).some((item) => reportFlag(item, key));
}
