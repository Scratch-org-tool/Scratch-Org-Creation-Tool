'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { getSessionCache, hasFreshSessionCache, setSessionCache } from '@/lib/session-cache';
import type { DashboardData, DashboardDays } from './types';

export function useDashboard(days: DashboardDays = 7) {
  const cacheKey = `dashboard:${days}`;
  const cached = getSessionCache<DashboardData>(cacheKey);
  const [data, setData] = useState<DashboardData | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const fetchDashboard = useCallback(async (manual = false) => {
    const request = ++requestRef.current;
    if (manual) {
      setRefreshing(true);
    } else if (!getSessionCache<DashboardData>(cacheKey)) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await api<DashboardData>(`/monitoring/dashboard?days=${days}`);
      if (requestRef.current !== request) return;
      setData(result);
      setSessionCache(cacheKey, result);
    } catch (err) {
      if (requestRef.current !== request) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      if (!manual && !getSessionCache<DashboardData>(cacheKey)) setData(null);
    } finally {
      if (requestRef.current === request) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey, days]);

  useEffect(() => {
    requestRef.current += 1;
    const periodCache = getSessionCache<DashboardData>(cacheKey);
    setData(periodCache);
    setLoading(!periodCache);
    setRefreshing(false);
    setError(null);
    if (hasFreshSessionCache(cacheKey)) return;
    void fetchDashboard(false);
  }, [cacheKey, fetchDashboard]);

  const refetch = useCallback(() => fetchDashboard(true), [fetchDashboard]);

  return { data, loading, refreshing, error, refetch };
}
