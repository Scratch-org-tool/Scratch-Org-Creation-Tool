'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DeploymentSchedule } from '@sfcc/shared';
import { api } from '@/services/api';

export interface PlanRecord {
  id: string;
  name: string;
  description: string | null;
  sourceOrgId: string | null;
  targetOrgId: string | null;
  planType: string;
  enabled: boolean;
  schedule: DeploymentSchedule | null;
  scheduleEnabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanRunRecord {
  id: string;
  trigger: string;
  status: string;
  planType: string | null;
  jobId: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  sourceOrgId: string;
  targetOrgId: string;
  packageXml: string;
}

export function useDeploymentAutomations() {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await api<PlanRecord[]>('/plans'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployment plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (input: CreatePlanInput) => {
    const created = await api<PlanRecord>('/plans', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        planType: 'metadata',
        metadataConfig: { packageXml: input.packageXml },
      }),
    });
    setPlans((current) => [created, ...current]);
    return created;
  }, []);

  const updateSchedule = useCallback(
    async (id: string, schedule: DeploymentSchedule | null, scheduleEnabled: boolean) => {
      const updated = await api<PlanRecord>(`/plans/${id}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ schedule: schedule ?? undefined, scheduleEnabled }),
      });
      setPlans((current) => current.map((plan) => (plan.id === id ? updated : plan)));
      return updated;
    },
    [],
  );

  const execute = useCallback(async (id: string) => {
    await api(`/plans/${id}/execute`, { method: 'POST' });
    setPlans((current) =>
      current.map((plan) =>
        plan.id === id ? { ...plan, lastRunAt: new Date().toISOString(), lastRunStatus: 'started' } : plan,
      ),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await api(`/plans/${id}`, { method: 'DELETE' });
    setPlans((current) => current.filter((plan) => plan.id !== id));
  }, []);

  const listRuns = useCallback(
    (id: string) => api<PlanRunRecord[]>(`/plans/${id}/runs`),
    [],
  );

  return { plans, loading, error, refresh: load, create, updateSchedule, execute, remove, listRuns };
}
