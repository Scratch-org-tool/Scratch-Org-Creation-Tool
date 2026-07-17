'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';

export interface RenewalConfigSummary {
  duration: number;
  devHubAlias: string | null;
  metadataSource: string | null;
  customSettings: boolean;
  dataSeed: boolean;
  accountPartners: boolean;
  userProvisioning: boolean;
}

export interface RenewalRecord {
  id: string;
  name: string;
  scratchOrgAlias: string;
  daysBeforeExpiry: number;
  enabled: boolean;
  nextRunAt: string | null;
  trackedOrg: {
    alias: string;
    username: string | null;
    status: string;
    expirationDate: string | null;
  };
  activeAutomationRunId: string | null;
  activeRunAlias: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  sourceAutomationRunId: string | null;
  summary: RenewalConfigSummary;
  createdAt: string;
  updatedAt: string;
}

export interface RenewalRunRecord {
  id: string;
  trigger: string;
  status: string;
  sourceAlias: string | null;
  newAlias: string | null;
  automationRunId: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface RenewalPreview {
  eligible: boolean;
  reason: string | null;
  scratchOrg: { alias: string; expirationDate: string | null };
  sourceRun: { id: string; status: string; createdAt: string } | null;
  summary: RenewalConfigSummary | null;
}

export interface ScratchOrgOption {
  id: string;
  alias: string;
  username: string;
  status: string;
  expirationDate: string | null;
}

export interface CreateRenewalInput {
  scratchOrgAlias: string;
  name?: string;
  daysBeforeExpiry: number;
  enabled?: boolean;
}

export interface UpdateRenewalInput {
  name?: string;
  daysBeforeExpiry?: number;
  enabled?: boolean;
}

export function useScratchOrgRenewals() {
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [scratchOrgs, setScratchOrgs] = useState<ScratchOrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rules, orgs] = await Promise.all([
        api<RenewalRecord[]>('/environment/scratch-org-renewals'),
        api<ScratchOrgOption[]>('/environment/scratch-orgs'),
      ]);
      setRenewals(rules);
      setScratchOrgs(orgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load renewal automations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useCallback(
    (scratchOrgAlias: string) =>
      api<RenewalPreview>('/environment/scratch-org-renewals/preview', {
        method: 'POST',
        body: JSON.stringify({ scratchOrgAlias }),
      }),
    [],
  );

  const create = useCallback(async (input: CreateRenewalInput) => {
    const created = await api<RenewalRecord>('/environment/scratch-org-renewals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setRenewals((current) => [created, ...current]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateRenewalInput) => {
    const updated = await api<RenewalRecord>(`/environment/scratch-org-renewals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setRenewals((current) => current.map((rule) => (rule.id === id ? updated : rule)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api(`/environment/scratch-org-renewals/${id}`, { method: 'DELETE' });
    setRenewals((current) => current.filter((rule) => rule.id !== id));
  }, []);

  const runNow = useCallback(
    async (id: string) => {
      const started = await api<{ automationRunId: string }>(
        `/environment/scratch-org-renewals/${id}/run-now`,
        { method: 'POST' },
      );
      await load();
      return started;
    },
    [load],
  );

  const listRuns = useCallback(
    (id: string) => api<RenewalRunRecord[]>(`/environment/scratch-org-renewals/${id}/runs`),
    [],
  );

  return {
    renewals,
    scratchOrgs,
    loading,
    error,
    refresh: load,
    preview,
    create,
    update,
    remove,
    runNow,
    listRuns,
  };
}

/** Whole days until the given ISO date (negative when already past). */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}
