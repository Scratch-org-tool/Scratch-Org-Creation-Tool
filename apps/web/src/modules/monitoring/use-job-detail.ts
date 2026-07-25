'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useJobEventStream } from '@/hooks/use-job-event-stream';
import { api } from '@/services/api';
import {
  canStopJobDetail,
  isActiveAutomationRunStatus,
  isActiveJobStatus,
} from './job-status-utils';
import type { JobDetailResponse } from './types';

export function useJobDetail(jobId: string) {
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api<JobDetailResponse>(`/monitoring/jobs/${jobId}`);
      setDetail(data);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : 'Failed to load job details');
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isActive = useMemo(
    () => (detail ? isActiveJobStatus(detail.job.status) : false),
    [detail],
  );

  const canStop = useMemo(
    () => (detail ? canStopJobDetail(detail) : false),
    [detail],
  );

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      void load({ silent: true });
    }, 3000);
    return () => clearInterval(timer);
  }, [isActive, load]);

  useJobEventStream({
    enabled: isActive,
    jobIds: [jobId],
    automationRunId: detail?.automationRun?.id ?? null,
    onJobStatus: (payload) => {
      if (payload.jobId !== jobId) return;
      void load({ silent: true });
    },
    onRunStatus: () => {
      void load({ silent: true });
    },
  });

  const stop = useCallback(async () => {
    if (!detail || !canStop) return;
    setStopping(true);
    setError(null);
    try {
      if (
        detail.automationRun
        && isActiveAutomationRunStatus(detail.automationRun.status)
      ) {
        await api(`/environment/automation-runs/${detail.automationRun.id}/cancel`, {
          method: 'POST',
        });
      } else {
        await api(`/environment/jobs/${detail.job.id}/cancel`, { method: 'POST' });
      }
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop job');
      throw err;
    } finally {
      setStopping(false);
    }
  }, [canStop, detail, load]);

  return {
    detail,
    loading,
    error,
    stopping,
    canStop,
    isActive,
    refresh: load,
    stop,
  };
}
