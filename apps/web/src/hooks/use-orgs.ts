'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import {
  clearSessionCache,
  getSessionCache,
  hasFreshSessionCache,
  setSessionCache,
} from '@/lib/session-cache';

export interface ConnectedOrg {
  id: string;
  alias: string;
  type?: string;
  username?: string | null;
}

const CACHE_KEY = 'orgs:list';

/** Fetch org list with session cache — safe to call outside React hooks. */
export async function fetchOrgsList(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<ConnectedOrg[]> {
  if (!options?.force && hasFreshSessionCache(CACHE_KEY)) {
    return getSessionCache<ConnectedOrg[]>(CACHE_KEY) ?? [];
  }
  const orgs = await api<ConnectedOrg[]>('/orgs', { signal: options?.signal });
  setSessionCache(CACHE_KEY, orgs);
  return orgs;
}

export function invalidateOrgsCache(): void {
  clearSessionCache(CACHE_KEY);
}

export function useOrgs() {
  const cached = getSessionCache<ConnectedOrg[]>(CACHE_KEY);
  const [orgs, setOrgs] = useState<ConnectedOrg[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchOrgsList({ force: true });
      setOrgs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orgs');
      if (!getSessionCache<ConnectedOrg[]>(CACHE_KEY)) setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFreshSessionCache(CACHE_KEY)) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchOrgsList();
        setOrgs(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orgs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { orgs, loading, error, refetch };
}
