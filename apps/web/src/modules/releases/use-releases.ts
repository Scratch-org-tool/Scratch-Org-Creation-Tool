'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReleaseItemAddInput, ReleaseRecord } from '@sfcc/shared';
import { api } from '@/services/api';

export interface ReleaseCreatePayload {
  name: string;
  version: string;
  description?: string;
  targetOrgId?: string;
}

export function useReleases() {
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReleases(await api<ReleaseRecord[]>('/releases'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (payload: ReleaseCreatePayload) => {
    const created = await api<ReleaseRecord>('/releases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setReleases((current) => [created, ...current]);
    return created;
  }, []);

  return { releases, loading, error, refresh, create, setReleases };
}

export function useReleaseDetail(id: string | null) {
  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) {
      setRelease(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRelease(await api<ReleaseRecord>(`/releases/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load release');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const action = useCallback(
    async (name: 'submit' | 'approve' | 'reject' | 'release' | 'reopen' | 'cancel' | 'generate-notes', body?: unknown) => {
      if (!id) return null;
      const updated = await api<ReleaseRecord>(
        `/releases/${encodeURIComponent(id)}/${name}`,
        { method: 'POST', body: body ? JSON.stringify(body) : undefined },
      );
      await refresh();
      return updated;
    },
    [id, refresh],
  );

  const addItem = useCallback(
    async (payload: ReleaseItemAddInput) => {
      if (!id) return;
      await api(`/releases/${encodeURIComponent(id)}/items`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refresh();
    },
    [id, refresh],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!id) return;
      await api(`/releases/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      await refresh();
    },
    [id, refresh],
  );

  return { release, loading, error, refresh, action, addItem, removeItem, setError };
}
