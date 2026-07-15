'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/services/api';
import { getSessionCache, hasFreshSessionCache, setSessionCache } from '@/lib/session-cache';
import { isJobLive } from './format-utils';
import type {
  JobStatusFilter,
  MonitoringDays,
  MonitoringJobRow,
  MonitoringOverview,
} from './types';

const PAGE_SIZE = 10;

function matchesFilter(job: MonitoringJobRow, filter: JobStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'completed') return job.status === 'completed';
  if (filter === 'failed') return job.status === 'failed';
  if (filter === 'running') return isJobLive(job.status);
  return true;
}

export function useMonitoringWorkspace() {
  const [days, setDays] = useState<MonitoringDays>(7);
  const cacheKey = `monitoring:overview:${days}`;
  const cached = getSessionCache<MonitoringOverview>(cacheKey);
  const [overview, setOverview] = useState<MonitoringOverview | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const loadOverview = useCallback(async (period: MonitoringDays) => {
    const request = ++requestRef.current;
    const key = `monitoring:overview:${period}`;
    if (!getSessionCache<MonitoringOverview>(key)) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await api<MonitoringOverview>(`/monitoring/overview?days=${period}`);
      if (requestRef.current !== request) return;
      setOverview(data);
      setSessionCache(key, data);
      setSelectedJobId((prev) =>
        prev && data.recentJobs.some((j) => j.id === prev) ? prev : null,
      );
    } catch (err) {
      if (requestRef.current !== request) return;
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    const periodCache = getSessionCache<MonitoringOverview>(cacheKey);
    setOverview(periodCache);
    setLoading(!periodCache);
    setRefreshing(false);
    setError(null);
    setSelectedJobId((prev) =>
      prev && periodCache?.recentJobs.some((j) => j.id === prev) ? prev : null,
    );
    if (hasFreshSessionCache(cacheKey)) return;
    void loadOverview(days);
  }, [cacheKey, days, loadOverview]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, days]);

  const filteredJobs = useMemo(() => {
    const jobs = overview?.recentJobs ?? [];
    return jobs.filter((j) => matchesFilter(j, statusFilter));
  }, [overview?.recentJobs, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, page]);

  const selectedJob = useMemo(
    () => overview?.recentJobs.find((j) => j.id === selectedJobId) ?? null,
    [overview?.recentJobs, selectedJobId],
  );

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setRefreshing(true);
    try {
      const data = await api<MonitoringOverview>(`/monitoring/overview?days=${days}`);
      if (requestRef.current !== request) return;
      setOverview(data);
      setSessionCache(`monitoring:overview:${days}`, data);
      setSelectedJobId((prev) =>
        prev && data.recentJobs.some((j) => j.id === prev) ? prev : null,
      );
    } catch (err) {
      if (requestRef.current !== request) return;
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      if (requestRef.current === request) setRefreshing(false);
    }
  }, [days]);

  return {
    days,
    setDays,
    overview,
    loading,
    refreshing,
    error,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    filteredJobs,
    paginatedJobs,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    refresh,
  };
}

export type MonitoringWorkspaceState = ReturnType<typeof useMonitoringWorkspace>;
