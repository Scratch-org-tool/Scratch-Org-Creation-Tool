'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  DeploymentEnvironment,
  DeploymentWorkbenchInput,
  ScmProvider,
} from '@sfcc/shared';
import { fetchOrgsList, type ConnectedOrg } from '@/hooks/use-orgs';
import { useGitMetadataSource } from '@/modules/source-control/use-git-metadata-source';
import { api, getStreamUrl } from '@/services/api';
import type {
  CompareItem,
  CompareSummary,
  DeploymentHistoryFilters,
  DeploymentHistoryResponse,
  WorkbenchForm,
  WorkbenchPreview,
  WorkbenchProgress,
  WorkbenchResults,
  WorkbenchStage,
  WorkbenchStatus,
} from './types';
import {
  applyProductionLocks,
  createInitialForm,
  payloadFromForm,
  policyForEnvironment,
  profileForOrgType,
  selectionsFromCompareItems,
  TERMINAL_RUN_STATUSES,
  validateWorkbenchForm,
} from './workbench-utils';

interface ComparisonResponse {
  id: string;
  status: string;
  summary: CompareSummary | null;
  items: CompareItem[];
  total: number;
}

interface TestClassResponse {
  classes: Array<{ name: string; likelyTest: boolean }>;
}

const DEFAULT_MANIFEST = 'manifest/package.xml';
const DEFAULT_HISTORY_FILTERS: DeploymentHistoryFilters = {
  page: 1,
  pageSize: 20,
  source: '',
  target: '',
  environment: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  owner: '',
};

function historyUrl(filters: DeploymentHistoryFilters): string {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  for (const key of ['source', 'target', 'environment', 'status', 'dateFrom', 'dateTo', 'owner'] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  return `/deployment-workbench/history?${query.toString()}`;
}

function initialMode(value: string | null): WorkbenchForm['sourceMode'] {
  return value === 'scm' || value === 'git' ? 'scm' : 'org_compare';
}

export function useDeploymentWorkbench(forcedSourceMode?: WorkbenchForm['sourceMode']) {
  const params = useSearchParams();
  const scm = useGitMetadataSource({ defaultManifestPath: DEFAULT_MANIFEST });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WorkbenchForm>(() =>
    createInitialForm(forcedSourceMode ?? initialMode(params.get('sourceType') ?? params.get('source'))));
  const [orgs, setOrgs] = useState<ConnectedOrg[]>([]);
  const [capabilities, setCapabilities] = useState<WorkbenchPreview['capabilities'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comparisonStatus, setComparisonStatus] = useState('idle');
  const [comparisonSummary, setComparisonSummary] = useState<CompareSummary | null>(null);
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [preview, setPreview] = useState<WorkbenchPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkbenchStatus | null>(null);
  const [stages, setStages] = useState<WorkbenchStage[]>([]);
  const [results, setResults] = useState<WorkbenchResults | null>(null);
  const [progress, setProgress] = useState<WorkbenchProgress | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [testClasses, setTestClasses] = useState<TestClassResponse['classes']>([]);
  const [testClassesLoading, setTestClassesLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<DeploymentHistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [historyResponse, setHistoryResponse] = useState<DeploymentHistoryResponse>({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const compareRequest = useRef(0);

  const loadRun = useCallback(async (id: string) => {
    const [nextStatus, nextStages, nextResults, nextProgress] = await Promise.all([
      api<WorkbenchStatus>(`/deployment-workbench/${id}/status`),
      api<WorkbenchStage[]>(`/deployment-workbench/${id}/stages`),
      api<WorkbenchResults>(`/deployment-workbench/${id}/results`),
      api<WorkbenchProgress>(`/deployment-workbench/${id}/progress`),
    ]);
    startTransition(() => {
      setStatus(nextStatus);
      setStages(nextStages);
      setResults(nextResults);
      setProgress(nextProgress);
    });
    return nextStatus;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchOrgsList(),
      api<WorkbenchPreview['capabilities']>('/deployment-workbench/capabilities'),
      api<DeploymentHistoryResponse>(historyUrl(DEFAULT_HISTORY_FILTERS)).catch(() => ({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      })),
    ]).then(async ([nextOrgs, nextCapabilities, nextHistory]) => {
      if (cancelled) return;
      setOrgs(nextOrgs);
      setCapabilities(nextCapabilities);
      setHistoryResponse(nextHistory);
      const sourceOrgId = params.get('sourceOrgId') ?? '';
      const targetOrgId = params.get('targetOrgId') ?? '';
      const requestedMode = forcedSourceMode ?? initialMode(params.get('sourceType') ?? params.get('source'));
      const target = nextOrgs.find((org) => org.id === targetOrgId);
      const profile = profileForOrgType(target?.type);
      setForm((current) => ({
        ...current,
        sourceMode: requestedMode,
        sourceOrgId: sourceOrgId || current.sourceOrgId,
        targetOrgId: targetOrgId || current.targetOrgId,
        targetProfile: targetOrgId ? profile : current.targetProfile,
        policy: targetOrgId ? policyForEnvironment(profile) : current.policy,
      }));
      const requestedRun = params.get('runId') ?? params.get('run');
      if (requestedRun) {
        setRunId(requestedRun);
        setStep(5);
        try {
          await loadRun(requestedRun);
        } catch (cause) {
          if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open deployment run.');
        }
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load the workbench.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [forcedSourceMode, loadRun, params]);

  const loadHistory = useCallback(async (next: DeploymentHistoryFilters) => {
    setHistoryLoading(true);
    setError(null);
    try {
      const response = await api<DeploymentHistoryResponse>(historyUrl(next));
      setHistoryFilters(next);
      setHistoryResponse(response);
      return response;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load deployment history.');
      return null;
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshComparison = useCallback(async (id: string) => {
    const request = ++compareRequest.current;
    const response = await api<ComparisonResponse>(
      `/metadata/compare/${id}?page=1&pageSize=5000`,
    );
    if (request !== compareRequest.current) return response;
    setComparisonStatus(response.status);
    setComparisonSummary(response.summary);
    setCompareItems(response.items);
    return response;
  }, []);

  useEffect(() => {
    if (!form.comparisonId || comparisonStatus !== 'running') return;
    const timer = setInterval(() => {
      void refreshComparison(form.comparisonId!).catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Comparison refresh failed.');
      });
    }, 2500);
    return () => clearInterval(timer);
  }, [comparisonStatus, form.comparisonId, refreshComparison]);

  const startComparison = useCallback(async () => {
    if (!form.sourceOrgId || !form.targetOrgId || form.sourceOrgId === form.targetOrgId) return;
    setComparing(true);
    setError(null);
    setCompareItems([]);
    setSelectedKeys(new Set());
    try {
      const response = await api<{ comparisonId: string; status: string }>('/metadata/compare/start', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrgId: form.sourceOrgId,
          targetOrgId: form.targetOrgId,
        }),
      });
      setForm((current) => ({ ...current, comparisonId: response.comparisonId }));
      setComparisonStatus(response.status);
      const comparison = await refreshComparison(response.comparisonId);
      if (comparison.status === 'completed') {
        setNotice('Background comparison completed. Select changed, new, and destructive components.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not compare orgs.');
    } finally {
      setComparing(false);
    }
  }, [form.sourceOrgId, form.targetOrgId, refreshComparison]);

  const toggleCompareItem = useCallback((item: CompareItem) => {
    const key = `${item.metadataType}::${item.fullName}`;
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectDiffType = useCallback((diffType: CompareItem['diffType'], selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const item of compareItems.filter((candidate) => candidate.diffType === diffType)) {
        const key = `${item.metadataType}::${item.fullName}`;
        if (selected) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, [compareItems]);

  useEffect(() => {
    const selected = compareItems.filter((item) =>
      selectedKeys.has(`${item.metadataType}::${item.fullName}`));
    setForm((current) => ({
      ...current,
      components: selectionsFromCompareItems(selected),
      destructiveSelections: selectionsFromCompareItems(selected, true),
    }));
  }, [compareItems, selectedKeys]);

  const selectTarget = useCallback((targetOrgId: string) => {
    const profile = profileForOrgType(orgs.find((org) => org.id === targetOrgId)?.type);
    setForm((current) => ({
      ...current,
      targetOrgId,
      targetProfile: profile,
      policy: policyForEnvironment(profile),
    }));
  }, [orgs]);

  const selectProfile = useCallback((targetProfile: DeploymentEnvironment) => {
    setForm((current) => ({
      ...current,
      targetProfile,
      policy: policyForEnvironment(targetProfile),
    }));
  }, []);

  const setPolicy = useCallback((updater: (policy: WorkbenchForm['policy']) => WorkbenchForm['policy']) => {
    setForm((current) => {
      const next = updater(current.policy);
      return {
        ...current,
        policy: current.targetProfile === 'production' ? applyProductionLocks(next) : next,
      };
    });
  }, []);

  const scmSource = useMemo<DeploymentWorkbenchInput['source'] | null>(() => {
    const source = scm.gitSource;
    if (!source) return null;
    return {
      type: 'scm',
      provider: source.provider as ScmProvider,
      ...(source.connectionId ? { connectionId: source.connectionId } : {}),
      ...(source.namespace ? { namespace: source.namespace } : {}),
      ...(source.project ? { project: source.project } : {}),
      ...(source.repositoryId ? { repositoryId: source.repositoryId } : {}),
      repo: source.repo,
      branch: source.branch,
      ...(source.manifestPath ? { manifestPath: source.manifestPath } : {}),
    };
  }, [scm.gitSource]);

  const validation = useMemo(
    () => validateWorkbenchForm(form, Boolean(scmSource)),
    [form, scmSource],
  );

  const buildPayload = useCallback(
    () => payloadFromForm(form, scmSource),
    [form, scmSource],
  );

  const previewPlan = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    try {
      const response = await api<WorkbenchPreview>('/deployment-workbench/preview', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      });
      setPreview(response);
      setStep(4);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#workbench-main')?.focus());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not preview the deployment plan.');
      return false;
    } finally {
      setPreviewing(false);
    }
  }, [buildPayload]);

  const createRun = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await api<{ id: string }>('/deployment-workbench/plans', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      });
      setRunId(response.id);
      setStep(5);
      await loadRun(response.id);
      return response.id;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the deployment run.');
      return null;
    } finally {
      setCreating(false);
    }
  }, [buildPayload, loadRun]);

  useEffect(() => {
    if (!runId || !status || TERMINAL_RUN_STATUSES.includes(status.status as never)) return;
    const timer = setInterval(() => {
      void loadRun(runId).catch(() => undefined);
    }, sseConnected ? 5000 : 2000);
    return () => clearInterval(timer);
  }, [loadRun, runId, sseConnected, status]);

  useEffect(() => {
    if (!runId || (status && TERMINAL_RUN_STATUSES.includes(status.status as never))) {
      setSseConnected(false);
      return;
    }
    let stream: EventSource | null = null;
    let cancelled = false;
    void getStreamUrl(['deployment_stage', 'deployment_result']).then((url) => {
      if (cancelled) return;
      stream = new EventSource(url);
      stream.onopen = () => setSseConnected(true);
      stream.onerror = () => setSseConnected(false);
      stream.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as {
            type: string;
            payload?: { workbenchRunId?: string };
          };
          if (message.payload?.workbenchRunId !== runId) return;
          void loadRun(runId);
        } catch {
          // Polling remains the authoritative fallback.
        }
      };
    }).catch(() => setSseConnected(false));
    return () => {
      cancelled = true;
      stream?.close();
      setSseConnected(false);
    };
  }, [loadRun, runId, status?.status]);

  useEffect(() => {
    if (form.policy.tests.level !== 'RunSpecifiedTests' || !form.targetOrgId) return;
    let cancelled = false;
    setTestClassesLoading(true);
    api<TestClassResponse>(`/deployments/test-classes?orgId=${encodeURIComponent(form.targetOrgId)}`)
      .then((response) => {
        if (!cancelled) setTestClasses(response.classes);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load Apex classes.');
      })
      .finally(() => {
        if (!cancelled) setTestClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.policy.tests.level, form.targetOrgId]);

  const runAction = useCallback(async (
    action: 'approve' | 'reject' | 'cancel' | 'resume' | 'quick-deploy' | 'rollback',
    body?: Record<string, unknown>,
  ) => {
    if (!runId || !status) return;
    const authoritative = status;
    setActionPending(action);
    setError(null);
    if (action === 'approve') {
      setStatus((current) => current ? { ...current, status: 'approved' } : current);
    }
    try {
      await api(`/deployment-workbench/${runId}/${action}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await loadRun(runId);
    } catch (cause) {
      setStatus(authoritative);
      await loadRun(runId).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : `Could not ${action.replace('-', ' ')}.`);
    } finally {
      setActionPending(null);
    }
  }, [loadRun, runId, status]);

  const openHistoryRun = useCallback(async (id: string) => {
    setRunId(id);
    setStep(5);
    setError(null);
    try {
      await loadRun(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open deployment history.');
    }
  }, [loadRun]);

  return {
    step,
    setStep,
    form,
    setForm,
    setPolicy,
    orgs,
    capabilities,
    loading,
    error,
    setError,
    notice,
    setNotice,
    scm,
    scmSource,
    selectTarget,
    selectProfile,
    comparisonStatus,
    comparisonSummary,
    compareItems,
    selectedKeys,
    comparing,
    startComparison,
    refreshComparison,
    toggleCompareItem,
    selectDiffType,
    preview,
    previewing,
    previewPlan,
    creating,
    createRun,
    runId,
    status,
    stages,
    results,
    progress,
    sseConnected,
    actionPending,
    runAction,
    testClasses,
    testClassesLoading,
    history: historyResponse.items,
    historyResponse,
    historyFilters,
    setHistoryFilters,
    historyLoading,
    loadHistory,
    openHistoryRun,
    validation,
  };
}

export type DeploymentWorkbenchState = ReturnType<typeof useDeploymentWorkbench>;
