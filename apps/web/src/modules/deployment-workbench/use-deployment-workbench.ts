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
import { CURATED_COMPARE_TYPES } from '@sfcc/shared';
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
  CompareItemDiff,
  CompareSummary,
  DestructiveReview,
  DeploymentHistoryFilters,
  DeploymentHistoryResponse,
  WorkbenchCapabilities,
  WorkbenchForm,
  WorkbenchPreview,
  WorkbenchProgress,
  WorkbenchResults,
  WorkbenchStage,
  WorkbenchStatus,
} from './types';
import {
  applyProductionLocks,
  componentCount,
  createInitialForm,
  invalidateSourceState,
  payloadFromForm,
  policyForEnvironment,
  profileForOrgType,
  selectionsFromCompareItems,
  serverRunActions,
  supportsDestructiveAcknowledgement,
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
const WORKBENCH_COMPARISON_DRAFT_KEY = 'deployment-workbench:comparison';
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

interface WorkbenchComparisonDraft {
  sourceOrgId: string;
  targetOrgId: string;
  comparisonId: string;
  selectedKeys: string[];
}

function readComparisonDraft(): WorkbenchComparisonDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(WORKBENCH_COMPARISON_DRAFT_KEY) ?? 'null') as
      | WorkbenchComparisonDraft
      | null;
    if (
      !parsed
      || typeof parsed.sourceOrgId !== 'string'
      || typeof parsed.targetOrgId !== 'string'
      || typeof parsed.comparisonId !== 'string'
      || !Array.isArray(parsed.selectedKeys)
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
  const [capabilities, setCapabilities] = useState<WorkbenchCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comparisonStatus, setComparisonStatus] = useState('idle');
  const [comparisonSummary, setComparisonSummary] = useState<CompareSummary | null>(null);
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableTypesLoading, setAvailableTypesLoading] = useState(false);
  const [availableTypesError, setAvailableTypesError] = useState<string | null>(null);
  const [compareTypes, setCompareTypesState] = useState<string[]>([]);
  const [selectedCompareItem, setSelectedCompareItem] = useState<CompareItem | null>(null);
  const [compareItemDiff, setCompareItemDiff] = useState<CompareItemDiff | null>(null);
  const [compareItemDiffLoading, setCompareItemDiffLoading] = useState(false);
  const [compareItemDiffError, setCompareItemDiffError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkbenchPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [destructiveReview, setDestructiveReview] = useState<DestructiveReview | null>(null);
  const [destructiveReviewLoading, setDestructiveReviewLoading] = useState(false);
  const [destructiveAcknowledgedHash, setDestructiveAcknowledgedHash] = useState<string | null>(null);
  const [destructiveSubmittedHash, setDestructiveSubmittedHash] = useState<string | null>(null);
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
  const comparisonAbort = useRef<AbortController | null>(null);
  const comparisonAttemptKey = useRef<string | null>(null);
  const comparisonDraftRestored = useRef(false);
  const compareTypesTouched = useRef(false);
  const availableTypesKey = useRef<string | null>(null);
  const availableTypesAbort = useRef<AbortController | null>(null);
  const diffRequest = useRef(0);
  const diffAbort = useRef<AbortController | null>(null);
  const previewRequest = useRef(0);
  const previewAbort = useRef<AbortController | null>(null);
  const runRequest = useRef(0);
  const runAbort = useRef<AbortController | null>(null);
  const activeRunId = useRef<string | null>(null);
  const historyRequest = useRef(0);
  const historyAbort = useRef<AbortController | null>(null);

  useEffect(() => () => {
    comparisonAbort.current?.abort();
    diffAbort.current?.abort();
    previewAbort.current?.abort();
    runAbort.current?.abort();
    historyAbort.current?.abort();
    availableTypesAbort.current?.abort();
  }, []);

  const clearPlanResolution = useCallback(() => {
    previewRequest.current += 1;
    previewAbort.current?.abort();
    setPreview(null);
    setDestructiveReview(null);
    setDestructiveAcknowledgedHash(null);
    setDestructiveSubmittedHash(null);
    setDestructiveReviewLoading(false);
  }, []);

  const clearComparison = useCallback(() => {
    compareRequest.current += 1;
    comparisonAbort.current?.abort();
    diffRequest.current += 1;
    diffAbort.current?.abort();
    comparisonAttemptKey.current = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(WORKBENCH_COMPARISON_DRAFT_KEY);
    }
    setComparisonStatus('idle');
    setComparisonSummary(null);
    setCompareItems([]);
    setSelectedKeys(new Set());
    setComparing(false);
    setSelectedCompareItem(null);
    setCompareItemDiff(null);
    setCompareItemDiffLoading(false);
    setCompareItemDiffError(null);
  }, []);

  const loadRun = useCallback(async (id: string) => {
    const request = ++runRequest.current;
    runAbort.current?.abort();
    const controller = new AbortController();
    runAbort.current = controller;
    const [nextStatus, nextStages, nextResults, nextProgress] = await Promise.all([
      api<WorkbenchStatus>(`/deployment-workbench/${id}/status`, { signal: controller.signal }),
      api<WorkbenchStage[]>(`/deployment-workbench/${id}/stages`, { signal: controller.signal }),
      api<WorkbenchResults>(`/deployment-workbench/${id}/results`, { signal: controller.signal }),
      api<WorkbenchProgress>(`/deployment-workbench/${id}/progress`, { signal: controller.signal }),
    ]);
    if (
      request !== runRequest.current
      || controller.signal.aborted
      || activeRunId.current !== id
    ) return nextStatus;
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
    const controller = new AbortController();
    const initialHistoryRequest = ++historyRequest.current;
    historyAbort.current?.abort();
    historyAbort.current = controller;
    Promise.all([
      fetchOrgsList(),
      api<WorkbenchCapabilities>('/deployment-workbench/capabilities', { signal: controller.signal }),
      api<DeploymentHistoryResponse>(historyUrl(DEFAULT_HISTORY_FILTERS), {
        signal: controller.signal,
      }).catch(() => ({
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
      if (initialHistoryRequest === historyRequest.current) setHistoryResponse(nextHistory);
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
        activeRunId.current = requestedRun;
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
      controller.abort();
    };
  }, [forcedSourceMode, loadRun, params]);

  const loadHistory = useCallback(async (next: DeploymentHistoryFilters) => {
    const request = ++historyRequest.current;
    historyAbort.current?.abort();
    const controller = new AbortController();
    historyAbort.current = controller;
    setHistoryLoading(true);
    setError(null);
    try {
      const response = await api<DeploymentHistoryResponse>(historyUrl(next), {
        signal: controller.signal,
      });
      if (request !== historyRequest.current || controller.signal.aborted) return null;
      setHistoryFilters(next);
      setHistoryResponse(response);
      return response;
    } catch (cause) {
      if (request === historyRequest.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not load deployment history.');
      }
      return null;
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false);
    }
  }, []);

  const refreshComparison = useCallback(async (id: string) => {
    const request = ++compareRequest.current;
    comparisonAbort.current?.abort();
    const controller = new AbortController();
    comparisonAbort.current = controller;
    const response = await api<ComparisonResponse>(
      `/metadata/compare/${id}?page=1&pageSize=100000`,
      { signal: controller.signal },
    );
    if (request !== compareRequest.current || controller.signal.aborted) return response;
    setComparisonStatus(response.status);
    setComparisonSummary(response.summary);
    setCompareItems(response.items);
    return response;
  }, []);

  useEffect(() => {
    if (loading || comparisonDraftRestored.current) return;
    comparisonDraftRestored.current = true;
    const draft = readComparisonDraft();
    if (!draft) return;
    if (
      (form.sourceOrgId && form.sourceOrgId !== draft.sourceOrgId)
      || (form.targetOrgId && form.targetOrgId !== draft.targetOrgId)
    ) return;
    comparisonAttemptKey.current = `${draft.sourceOrgId}:${draft.targetOrgId}`;
    setForm((current) => ({
      ...current,
      sourceMode: 'org_compare',
      sourceOrgId: draft.sourceOrgId,
      targetOrgId: draft.targetOrgId,
      comparisonId: draft.comparisonId,
    }));
    setSelectedKeys(new Set(draft.selectedKeys));
    setComparisonStatus('running');
    void refreshComparison(draft.comparisonId).catch((cause) => {
      setComparisonStatus('failed');
      setError(cause instanceof Error ? cause.message : 'Could not restore metadata comparison.');
    });
  }, [form.sourceOrgId, form.targetOrgId, loading, refreshComparison]);

  useEffect(() => {
    if (
      form.sourceMode !== 'org_compare'
      || !form.sourceOrgId
      || !form.targetOrgId
      || !form.comparisonId
      || typeof window === 'undefined'
    ) return;
    const draft: WorkbenchComparisonDraft = {
      sourceOrgId: form.sourceOrgId,
      targetOrgId: form.targetOrgId,
      comparisonId: form.comparisonId,
      selectedKeys: [...selectedKeys],
    };
    sessionStorage.setItem(WORKBENCH_COMPARISON_DRAFT_KEY, JSON.stringify(draft));
  }, [
    form.comparisonId,
    form.sourceMode,
    form.sourceOrgId,
    form.targetOrgId,
    selectedKeys,
  ]);

  useEffect(() => {
    if (!form.comparisonId || comparisonStatus !== 'running') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      await refreshComparison(form.comparisonId!).catch(() => undefined);
      if (!cancelled) timer = setTimeout(() => void poll(), 2500);
    };
    timer = setTimeout(() => void poll(), 2500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [comparisonStatus, form.comparisonId, refreshComparison]);

  const curatedAvailable = useMemo(() => {
    if (!availableTypes.length) return [] as string[];
    const available = new Set(availableTypes);
    const curated = (CURATED_COMPARE_TYPES as readonly string[]).filter((type) => available.has(type));
    return curated.length ? curated : availableTypes;
  }, [availableTypes]);

  const setCompareTypes = useCallback((next: string[]) => {
    compareTypesTouched.current = true;
    setCompareTypesState(next);
  }, []);

  const toggleCompareType = useCallback((type: string) => {
    compareTypesTouched.current = true;
    setCompareTypesState((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }, []);

  const selectCommonCompareTypes = useCallback(() => {
    compareTypesTouched.current = true;
    setCompareTypesState(curatedAvailable);
  }, [curatedAvailable]);

  const selectAllCompareTypes = useCallback(() => {
    compareTypesTouched.current = true;
    setCompareTypesState(availableTypes);
  }, [availableTypes]);

  const clearCompareTypes = useCallback(() => {
    compareTypesTouched.current = true;
    setCompareTypesState([]);
  }, []);

  // Load the metadata type catalog (union of both orgs) so the user can choose
  // exactly which types to compare instead of comparing every supported type.
  useEffect(() => {
    if (form.sourceMode !== 'org_compare') return;
    const sourceOrgId = form.sourceOrgId;
    const targetOrgId = form.targetOrgId;
    if (!sourceOrgId || !targetOrgId || sourceOrgId === targetOrgId) return;
    const key = `${sourceOrgId}:${targetOrgId}`;
    if (availableTypesKey.current === key) return;
    availableTypesKey.current = key;
    availableTypesAbort.current?.abort();
    const controller = new AbortController();
    availableTypesAbort.current = controller;
    setAvailableTypesLoading(true);
    setAvailableTypesError(null);
    void Promise.all([
      api<{ types: Array<{ xmlName: string }> }>(
        `/metadata/org/${sourceOrgId}/types?pageSize=2000`,
        { signal: controller.signal },
      ).catch(() => null),
      api<{ types: Array<{ xmlName: string }> }>(
        `/metadata/org/${targetOrgId}/types?pageSize=2000`,
        { signal: controller.signal },
      ).catch(() => null),
    ]).then(([source, target]) => {
      if (controller.signal.aborted) return;
      const merged = [...new Set(
        [...(source?.types ?? []), ...(target?.types ?? [])]
          .map((type) => type.xmlName?.trim())
          .filter((name): name is string => Boolean(name)),
      )].sort((left, right) => left.localeCompare(right));
      if (merged.length) {
        setAvailableTypes(merged);
        if (!source || !target) {
          setAvailableTypesError('Some metadata types could not be read from one org, so the list may be incomplete.');
        }
        if (!compareTypesTouched.current) {
          const curated = merged.filter((type) => (CURATED_COMPARE_TYPES as readonly string[]).includes(type));
          setCompareTypesState(curated.length ? curated : merged);
        }
      } else {
        const fallback = [...CURATED_COMPARE_TYPES];
        setAvailableTypes(fallback);
        setAvailableTypesError('Could not load metadata types from the orgs. Showing common types you can compare.');
        if (!compareTypesTouched.current) setCompareTypesState(fallback);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setAvailableTypesLoading(false);
    });
  }, [form.sourceMode, form.sourceOrgId, form.targetOrgId]);

  // Changing the selected types after a comparison exists makes it stale, so
  // invalidate it and let the user re-run with the new scope. Guarded by the
  // "touched" ref so the initial system default never wipes a restored draft.
  useEffect(() => {
    if (compareTypesTouched.current && form.comparisonId) clearComparison();
  }, [compareTypes, form.comparisonId, clearComparison]);

  const startComparison = useCallback(async () => {
    if (!form.sourceOrgId || !form.targetOrgId || form.sourceOrgId === form.targetOrgId) return;
    if (!compareTypes.length) return;
    comparisonAttemptKey.current = `${form.sourceOrgId}:${form.targetOrgId}`;
    const request = ++compareRequest.current;
    comparisonAbort.current?.abort();
    const controller = new AbortController();
    comparisonAbort.current = controller;
    setComparing(true);
    setComparisonStatus('running');
    setError(null);
    setCompareItems([]);
    setSelectedKeys(new Set());
    setSelectedCompareItem(null);
    setCompareItemDiff(null);
    setCompareItemDiffError(null);
    try {
      const response = await api<{ comparisonId: string; status: string }>('/metadata/compare/start', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          sourceOrgId: form.sourceOrgId,
          targetOrgId: form.targetOrgId,
          types: compareTypes,
        }),
      });
      if (request !== compareRequest.current || controller.signal.aborted) return;
      setForm((current) => ({ ...current, comparisonId: response.comparisonId }));
      setComparisonStatus(response.status);
      setComparing(false);
      const comparison = await refreshComparison(response.comparisonId);
      if (comparison.status === 'completed') {
        setNotice('Background comparison completed. Select changed, new, and destructive components.');
      }
    } catch (cause) {
      if (request === compareRequest.current && !controller.signal.aborted) {
        setComparisonStatus('failed');
        setError(cause instanceof Error ? cause.message : 'Could not compare orgs.');
      }
    } finally {
      if (request === compareRequest.current) setComparing(false);
    }
  }, [form.sourceOrgId, form.targetOrgId, compareTypes, refreshComparison]);

  useEffect(() => {
    if (
      step !== 1
      || form.sourceMode !== 'org_compare'
      || !form.sourceOrgId
      || !form.targetOrgId
      || form.sourceOrgId === form.targetOrgId
      || !compareTypes.length
      || form.comparisonId
      || comparisonStatus !== 'idle'
      || comparing
    ) return;
    const key = `${form.sourceOrgId}:${form.targetOrgId}`;
    if (comparisonAttemptKey.current === key) return;
    comparisonAttemptKey.current = key;
    void startComparison();
  }, [
    comparing,
    comparisonStatus,
    compareTypes.length,
    form.comparisonId,
    form.sourceMode,
    form.sourceOrgId,
    form.targetOrgId,
    startComparison,
    step,
  ]);

  const retryComparison = useCallback(() => {
    comparisonAttemptKey.current = null;
    setError(null);
    setForm((current) => ({ ...current, comparisonId: undefined }));
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(WORKBENCH_COMPARISON_DRAFT_KEY);
    }
    void startComparison();
  }, [startComparison]);

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

  const selectCompareItems = useCallback((items: CompareItem[], selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const item of items) {
        const key = `${item.metadataType}::${item.fullName}`;
        if (selected) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  const loadCompareItemDiff = useCallback(async (item: CompareItem) => {
    if (!form.comparisonId) return null;
    const request = ++diffRequest.current;
    diffAbort.current?.abort();
    const controller = new AbortController();
    diffAbort.current = controller;
    setSelectedCompareItem(item);
    setCompareItemDiff(null);
    setCompareItemDiffError(null);
    setCompareItemDiffLoading(true);
    try {
      const query = new URLSearchParams({
        type: item.metadataType,
        name: item.fullName,
      });
      const response = await api<CompareItemDiff>(
        `/metadata/compare/${form.comparisonId}/diff?${query.toString()}`,
        { signal: controller.signal },
      );
      if (request !== diffRequest.current || controller.signal.aborted) return null;
      const resolvedDiffType = item.diffType === 'new' || item.diffType === 'deleted'
        ? item.diffType
        : response.contentDiffers
          ? 'changed'
          : 'same';
      const resolvedItem = { ...item, diffType: resolvedDiffType } as CompareItem;
      setCompareItemDiff(response);
      setSelectedCompareItem(resolvedItem);
      if (resolvedDiffType !== item.diffType) {
        setCompareItems((current) => current.map((candidate) =>
          candidate.metadataType === item.metadataType && candidate.fullName === item.fullName
            ? resolvedItem
            : candidate));
      }
      return response;
    } catch (cause) {
      if (request === diffRequest.current && !controller.signal.aborted) {
        setCompareItemDiffError(cause instanceof Error ? cause.message : 'Could not load metadata XML.');
      }
      return null;
    } finally {
      if (request === diffRequest.current) setCompareItemDiffLoading(false);
    }
  }, [form.comparisonId]);

  useEffect(() => {
    const selected = compareItems.filter((item) =>
      selectedKeys.has(`${item.metadataType}::${item.fullName}`));
    setForm((current) => ({
      ...current,
      components: selectionsFromCompareItems(selected),
      destructiveSelections: selectionsFromCompareItems(selected, true),
    }));
  }, [compareItems, selectedKeys]);

  const selectSourceMode = useCallback((sourceMode: WorkbenchForm['sourceMode']) => {
    clearComparison();
    clearPlanResolution();
    setStep(0);
    setForm((current) => invalidateSourceState(current, {
      sourceMode,
      sourceOrgId: sourceMode === 'scm' ? '' : current.sourceOrgId,
    }));
  }, [clearComparison, clearPlanResolution]);

  const selectSource = useCallback((sourceOrgId: string) => {
    clearComparison();
    clearPlanResolution();
    setForm((current) => invalidateSourceState(current, { sourceOrgId }));
  }, [clearComparison, clearPlanResolution]);

  const selectTarget = useCallback((targetOrgId: string) => {
    const profile = profileForOrgType(orgs.find((org) => org.id === targetOrgId)?.type);
    clearComparison();
    clearPlanResolution();
    setForm((current) => ({
      ...invalidateSourceState(current, { targetOrgId }),
      targetOrgId,
      targetProfile: profile,
      policy: policyForEnvironment(profile),
    }));
  }, [clearComparison, clearPlanResolution, orgs]);

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
  const scmResolutionKey = scmSource?.type === 'scm' ? JSON.stringify(scmSource) : '';
  const previousScmResolutionKey = useRef(scmResolutionKey);
  useEffect(() => {
    if (
      form.sourceMode === 'scm'
      && previousScmResolutionKey.current
      && previousScmResolutionKey.current !== scmResolutionKey
    ) {
      clearPlanResolution();
    }
    previousScmResolutionKey.current = scmResolutionKey;
  }, [clearPlanResolution, form.sourceMode, scmResolutionKey]);

  const validation = useMemo(
    () => validateWorkbenchForm(form, Boolean(scmSource)),
    [form, scmSource],
  );

  const buildPayload = useCallback(
    () => payloadFromForm(form, scmSource),
    [form, scmSource],
  );

  const loadDestructiveReview = useCallback(async (id: string) => {
    setDestructiveReviewLoading(true);
    try {
      const review = await api<{
        manifestXml: string | null;
        digest: string;
        componentCount: number;
        selections?: DestructiveReview['selections'];
        apiVersion?: string;
        warning?: string;
        requiresReview: boolean;
      }>(`/deployment-workbench/${id}/destructive-review`);
      const normalized = review.requiresReview && review.manifestXml
        ? {
            manifestXml: review.manifestXml,
            manifestHash: review.digest,
            componentCount: review.componentCount,
            selections: review.selections,
            apiVersion: review.apiVersion,
            warning: review.warning,
          }
        : null;
      setDestructiveReview(normalized);
      setDestructiveAcknowledgedHash(null);
      setDestructiveSubmittedHash(null);
      return normalized;
    } catch (cause) {
      setDestructiveReview(null);
      setError(cause instanceof Error ? cause.message : 'Could not load destructive manifest.');
      return null;
    } finally {
      setDestructiveReviewLoading(false);
    }
  }, []);

  const previewPlan = useCallback(async () => {
    const request = ++previewRequest.current;
    previewAbort.current?.abort();
    const controller = new AbortController();
    previewAbort.current = controller;
    setPreviewing(true);
    setDestructiveReview(null);
    setDestructiveAcknowledgedHash(null);
    setError(null);
    try {
      const payload = buildPayload();
      const response = await api<WorkbenchPreview>('/deployment-workbench/preview', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      if (request !== previewRequest.current || controller.signal.aborted) return false;
      setPreview(response);
      const destructiveCount = componentCount(form.destructiveSelections);
      if (response.destructiveReview) {
        setDestructiveReviewLoading(true);
        try {
          const review = response.destructiveReview ?? (
            supportsDestructiveAcknowledgement(capabilities)
              ? await api<DestructiveReview>('/deployment-workbench/destructive-review', {
                  method: 'POST',
                  signal: controller.signal,
                  body: JSON.stringify(payload),
                })
              : null
          );
          if (request === previewRequest.current && !controller.signal.aborted) {
            setDestructiveReview(
              review?.manifestXml && review.manifestHash ? review : null,
            );
          }
        } catch (cause) {
          if (request === previewRequest.current && !controller.signal.aborted) {
            setError(cause instanceof Error
              ? `Destructive manifest review failed: ${cause.message}`
              : 'Destructive manifest review failed.');
          }
        } finally {
          if (request === previewRequest.current) setDestructiveReviewLoading(false);
        }
      }
      setStep(4);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#workbench-main')?.focus());
      return true;
    } catch (cause) {
      if (request === previewRequest.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not preview the deployment plan.');
      }
      return false;
    } finally {
      if (request === previewRequest.current) setPreviewing(false);
    }
  }, [buildPayload, capabilities, form.destructiveSelections]);

  const createRun = useCallback(async () => {
    const destructiveCount = componentCount(form.destructiveSelections);
    const request = ++previewRequest.current;
    previewAbort.current?.abort();
    const controller = new AbortController();
    previewAbort.current = controller;
    setCreating(true);
    setError(null);
    try {
      const payload = buildPayload();
      const response = await api<{ id: string }>('/deployment-workbench/plans', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      if (request !== previewRequest.current || controller.signal.aborted) return null;
      activeRunId.current = response.id;
      setRunId(response.id);
      setStep(5);
      await loadRun(response.id);
      if (destructiveCount > 0) await loadDestructiveReview(response.id);
      return response.id;
    } catch (cause) {
      if (request === previewRequest.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not start the deployment run.');
      }
      return null;
    } finally {
      if (request === previewRequest.current) setCreating(false);
    }
  }, [
    buildPayload,
    form.destructiveSelections,
    loadDestructiveReview,
    loadRun,
  ]);

  const submitDestructiveReview = useCallback(async () => {
    if (
      !runId
      || !destructiveReview
      || destructiveAcknowledgedHash !== destructiveReview.manifestHash
    ) {
      setError('Explicitly acknowledge the displayed destructive manifest hash first.');
      return false;
    }
    setActionPending('destructive-review');
    setError(null);
    try {
      await api(`/deployment-workbench/${runId}/destructive-review`, {
        method: 'POST',
        body: JSON.stringify({
          digest: destructiveReview.manifestHash,
          approved: true,
        }),
      });
      setDestructiveSubmittedHash(destructiveReview.manifestHash);
      await loadRun(runId);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not approve destructive manifest.');
      return false;
    } finally {
      setActionPending(null);
    }
  }, [destructiveAcknowledgedHash, destructiveReview, loadRun, runId]);

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
          void loadRun(runId).catch(() => undefined);
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
    const controller = new AbortController();
    setTestClassesLoading(true);
    api<TestClassResponse>(
      `/deployments/test-classes?orgId=${encodeURIComponent(form.targetOrgId)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!controller.signal.aborted) setTestClasses(response.classes);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load Apex classes.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTestClassesLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [form.policy.tests.level, form.targetOrgId]);

  const runAction = useCallback(async (
    action: 'approve' | 'reject' | 'cancel' | 'resume' | 'quick-deploy' | 'rollback',
    body?: Record<string, unknown>,
  ) => {
    if (!runId || !status) return;
    const allowed = serverRunActions(status);
    const permitted = action === 'approve'
      ? allowed.canApprove
      : action === 'reject'
        ? allowed.canReject
        : action === 'cancel'
          ? allowed.canCancel
          : action === 'resume'
            ? allowed.canResume
            : action === 'quick-deploy'
              ? allowed.canQuickDeploy
              : allowed.canRollback;
    if (!permitted) {
      setError(`The server has not authorized ${action.replace('-', ' ')} for this run.`);
      return;
    }
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
    activeRunId.current = id;
    setRunId(id);
    setStep(5);
    setError(null);
    try {
      await loadRun(id);
      await loadDestructiveReview(id).catch(() => null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open deployment history.');
    }
  }, [loadDestructiveReview, loadRun]);

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
    selectSourceMode,
    selectSource,
    selectTarget,
    selectProfile,
    comparisonStatus,
    comparisonSummary,
    compareItems,
    selectedKeys,
    comparing,
    availableTypes,
    availableTypesLoading,
    availableTypesError,
    compareTypes,
    commonCompareTypes: curatedAvailable,
    setCompareTypes,
    toggleCompareType,
    selectCommonCompareTypes,
    selectAllCompareTypes,
    clearCompareTypes,
    startComparison,
    retryComparison,
    refreshComparison,
    toggleCompareItem,
    selectDiffType,
    selectCompareItems,
    selectedCompareItem,
    compareItemDiff,
    compareItemDiffLoading,
    compareItemDiffError,
    loadCompareItemDiff,
    preview,
    previewing,
    previewPlan,
    destructiveReview,
    destructiveReviewLoading,
    destructiveAcknowledgedHash,
    setDestructiveAcknowledgedHash,
    destructiveSubmittedHash,
    submitDestructiveReview,
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
