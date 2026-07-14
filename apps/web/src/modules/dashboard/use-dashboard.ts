'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const fetchDashboard = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else if (!getSessionCache<DashboardData>(cacheKey)) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await api<DashboardData>(`/monitoring/dashboard?days=${days}`);
      setData(result);
      setSessionCache(cacheKey, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      if (!manual && !getSessionCache<DashboardData>(cacheKey)) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, days]);

  useEffect(() => {
    if (hasFreshSessionCache(cacheKey)) return;
    void fetchDashboard(false);
  }, [cacheKey, fetchDashboard]);

  const refetch = useCallback(() => fetchDashboard(true), [fetchDashboard]);

  return { data, loading, refreshing, error, refetch };
}
