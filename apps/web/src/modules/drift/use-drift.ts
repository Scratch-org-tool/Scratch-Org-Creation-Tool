'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DeploymentSchedule,
  DriftMonitorRecord,
  DriftSnapshotRecord,
} from '@sfcc/shared';
import { api } from '@/services/api';

export interface CreateMonitorInput {
  name: string;
  description?: string;
  sourceOrgId: string;
  targetOrgId: string;
  metadataTypes?: string[];
  schedule?: DeploymentSchedule;
  scheduleEnabled: boolean;
  notifyOnDrift: boolean;
}

export function useDriftMonitors() {
  const [monitors, setMonitors] = useState<DriftMonitorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMonitors(await api<DriftMonitorRecord[]>('/drift/monitors'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drift monitors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (input: CreateMonitorInput) => {
    const created = await api<DriftMonitorRecord>('/drift/monitors', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setMonitors((current) => [created, ...current]);
    return created;
  }, []);

  const runNow = useCallback(async (id: string) => {
    setActionError(null);
    setCheckingId(id);
    try {
      await api(`/drift/monitors/${id}/check`, { method: 'POST' });
      setMonitors((current) =>
        current.map((monitor) => (monitor.id === id ? { ...monitor, lastStatus: 'checking' } : monitor)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start the drift check');
    } finally {
      setCheckingId(null);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setActionError(null);
    setRemovingId(id);
    try {
      await api(`/drift/monitors/${id}`, { method: 'DELETE' });
      setMonitors((current) => current.filter((monitor) => monitor.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete the drift monitor');
      throw err;
    } finally {
      setRemovingId(null);
    }
  }, []);

  return {
    monitors,
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    checkingId,
    removingId,
    refresh: load,
    create,
    runNow,
    remove,
  };
}

export function useDriftMonitor(id: string) {
  const [monitor, setMonitor] = useState<DriftMonitorRecord | null>(null);
  const [snapshots, setSnapshots] = useState<DriftSnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [monitorData, snapshotData] = await Promise.all([
        api<DriftMonitorRecord>(`/drift/monitors/${id}`),
        api<DriftSnapshotRecord[]>(`/drift/monitors/${id}/snapshots`),
      ]);
      setMonitor(monitorData);
      setSnapshots(snapshotData);
      return monitorData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drift monitor');
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  // While a check is running, poll until it settles so the timeline updates.
  useEffect(() => {
    if (monitor?.lastStatus !== 'checking') return;
    pollRef.current = setTimeout(() => {
      void load();
    }, 4000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [monitor?.lastStatus, monitor?.lastCheckedAt, load]);

  const runNow = useCallback(async () => {
    await api(`/drift/monitors/${id}/check`, { method: 'POST' });
    setMonitor((current) => (current ? { ...current, lastStatus: 'checking' } : current));
  }, [id]);

  const update = useCallback(
    async (patch: Partial<CreateMonitorInput>) => {
      const updated = await api<DriftMonitorRecord>(`/drift/monitors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setMonitor(updated);
      return updated;
    },
    [id],
  );

  const getSnapshot = useCallback(
    (snapshotId: string) =>
      api<DriftSnapshotRecord>(`/drift/monitors/${id}/snapshots/${snapshotId}`),
    [id],
  );

  return { monitor, snapshots, loading, error, refresh: load, runNow, update, getSnapshot };
}
