'use client';

import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getStreamUrl } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import {
  getSessionCache,
  hasFreshSessionCache,
  setSessionCache,
} from '@/lib/session-cache';
import type {
  ComparePhase,
  DeploymentRow,
  ItemDiffPayload,
  JobData,
  MetadataCompareItem,
  MetadataCompareSession,
  MetadataComparisonSummary,
  MetadataDeployForm,
  MetadataDiffType,
  MetadataDraft,
  Org,
  ProblemAnalysisResult,
  WorkspaceTab,
} from './types';
import {
  ACTIVE_STATUSES,
  isDeployableDiffType,
  itemKey,
  METADATA_DRAFT_KEY,
  METADATA_LOG_TAIL,
  parseItemKey,
  selectionsFromItems,
  TERMINAL_STATUSES,
} from './types';

const DEFAULT_FORM: MetadataDeployForm = {
  sourceOrgId: '',
  targetOrgId: '',
  testLevel: 'NoTestRun',
  deploymentName: '',
  deploymentNotes: '',
  chainDataDeploy: false,
  dataObjectName: 'Account',
  dataSoql: '',
};

const METADATA_HISTORY_KEY = 'metadata:deploy-history';

function capLogs(lines: string[], streams: string[]) {
  return {
    lines: lines.slice(-METADATA_LOG_TAIL),
    streams: streams.slice(-METADATA_LOG_TAIL),
  };
}

function loadDraft(): MetadataDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(METADATA_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as MetadataDraft) : null;
  } catch {
    return null;
  }
}

export function useMetadataCompare() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [history, setHistory] = useState<DeploymentRow[]>([]);
  const [form, setForm] = useState<MetadataDeployForm>(DEFAULT_FORM);
  const [tab, setTab] = useState<WorkspaceTab>('compare');
  const [phase, setPhase] = useState<ComparePhase>('setup');
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('pending');
  const [summary, setSummary] = useState<MetadataComparisonSummary | null>(null);
  const [items, setItems] = useState<MetadataCompareItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [diffFilter, setDiffFilter] = useState<MetadataDiffType | 'all'>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectionSnapshot, setSelectionSnapshot] = useState<Record<string, MetadataCompareItem>>({});
  const [selectedItem, setSelectedItem] = useState<MetadataCompareItem | null>(null);
  const [itemDiff, setItemDiff] = useState<ItemDiffPayload | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [children, setChildren] = useState<Array<{ type: string; count: number }>>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<{ source: number; target: number } | null>(null);
  const [compareStarting, setCompareStarting] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ProblemAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [packageXmlPreview, setPackageXmlPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldWarning, setFieldWarning] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logStreams, setLogStreams] = useState<string[]>([]);
  const [logsTruncated, setLogsTruncated] = useState(false);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [deployStartedAt, setDeployStartedAt] = useState<number | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [selectingDeploymentId, setSelectingDeploymentId] = useState<string | null>(null);
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);
  const [historyJobStatus, setHistoryJobStatus] = useState<string | null>(null);
  const [historyCurrentStep, setHistoryCurrentStep] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<string[]>([]);
  const [historyLogStreams, setHistoryLogStreams] = useState<string[]>([]);
  const [historyLogsTruncated, setHistoryLogsTruncated] = useState(false);
  const [historyLogCount, setHistoryLogCount] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectTokenRef = useRef(0);
  const sessionTokenRef = useRef(0);
  const previewTokenRef = useRef(0);
  const diffTokenRef = useRef(0);
  const diffAbortRef = useRef<AbortController | null>(null);

  const canCompare = Boolean(form.sourceOrgId && form.targetOrgId && form.sourceOrgId !== form.targetOrgId);

  const resolveItem = useCallback(
    (key: string): MetadataCompareItem | undefined => {
      if (selectionSnapshot[key]) return selectionSnapshot[key];
      const { metadataType, fullName } = parseItemKey(key);
      return items.find((i) => i.metadataType === metadataType && i.fullName === fullName);
    },
    [selectionSnapshot, items],
  );

  const getDeployableItems = useCallback((): MetadataCompareItem[] => {
    const result: MetadataCompareItem[] = [];
    for (const k of selectedKeys) {
      if (excludedKeys.has(k)) continue;
      const item = resolveItem(k);
      if (item && isDeployableDiffType(item.diffType)) result.push(item);
    }
    return result;
  }, [selectedKeys, excludedKeys, resolveItem]);

  const deployableCount = getDeployableItems().length;
  const selectedItems = getDeployableItems();
  const selectionCount = selectedKeys.size;

  const loadHistory = useCallback(async (force = false) => {
    if (!force && hasFreshSessionCache(METADATA_HISTORY_KEY)) {
      const cached = getSessionCache<DeploymentRow[]>(METADATA_HISTORY_KEY);
      if (cached) {
        setHistory(cached);
        return cached;
      }
    }
    const list = await api<DeploymentRow[]>('/deployments');
    const filtered = list.filter((d) => d.metadata?.deployMode === 'org_to_org' || d.repo === 'org-to-org');
    setSessionCache(METADATA_HISTORY_KEY, filtered);
    setHistory(filtered);
    return filtered;
  }, []);

  const applyJobData = useCallback((data: JobData) => {
    const lines = data.logs?.map((l) => l.line) ?? [];
    const streams = data.logs?.map((l) => l.stream ?? 'stdout') ?? [];
    const capped = capLogs(lines, streams);
    setJobStatus(data.status);
    setCurrentStep(data.currentStep ?? null);
    setLogs(capped.lines);
    setLogStreams(capped.streams);
    setLogsTruncated(Boolean(data.logsTruncated));
    setLogCount(data.logCount ?? lines.length);
    if (data.error && TERMINAL_STATUSES.includes(data.status)) {
      setError(data.error);
    }
  }, []);

  const applyHistoryJobData = useCallback((data: JobData) => {
    const lines = data.logs?.map((l) => l.line) ?? [];
    const streams = data.logs?.map((l) => l.stream ?? 'stdout') ?? [];
    const capped = capLogs(lines, streams);
    setHistoryJobStatus(data.status);
    setHistoryCurrentStep(data.currentStep ?? null);
    setHistoryLogs(capped.lines);
    setHistoryLogStreams(capped.streams);
    setHistoryLogsTruncated(Boolean(data.logsTruncated));
    setHistoryLogCount(data.logCount ?? lines.length);
    setHistoryError(data.error && TERMINAL_STATUSES.includes(data.status) ? data.error : null);
  }, []);

  const closeHistoryLogs = useCallback(() => {
    selectTokenRef.current += 1;
    setActiveDeploymentId(null);
    setSelectingDeploymentId(null);
    setHistoryJobId(null);
    setHistoryJobStatus(null);
    setHistoryCurrentStep(null);
    setHistoryLogs([]);
    setHistoryLogStreams([]);
    setHistoryLogsTruncated(false);
    setHistoryLogCount(null);
    setHistoryError(null);
  }, []);

  const selectHistory = useCallback(async (row: DeploymentRow) => {
    const jid = row.jobId ?? row.job?.id;
    if (!jid) return;

    if (activeDeploymentId === row.id) {
      closeHistoryLogs();
      return;
    }

    const token = ++selectTokenRef.current;
    setSelectingDeploymentId(row.id);
    setActiveDeploymentId(row.id);
    setHistoryJobId(jid);
    setHistoryJobStatus(row.job?.status ?? row.status);
    setHistoryCurrentStep(row.job?.currentStep ?? null);
    setHistoryError(row.job?.error ?? row.metadata?.error ?? null);
    setHistoryLogs([]);
    setHistoryLogStreams([]);
    setHistoryLogsTruncated(false);
    setHistoryLogCount(null);

    try {
      const data = await api<JobData>(`/jobs/${jid}`);
      if (selectTokenRef.current !== token) return;
      startTransition(() => applyHistoryJobData(data));
    } catch (err) {
      if (selectTokenRef.current === token) {
        setHistoryError(err instanceof Error ? err.message : 'Failed to load deployment logs');
      }
    } finally {
      if (selectTokenRef.current === token) setSelectingDeploymentId(null);
    }
  }, [activeDeploymentId, applyHistoryJobData, closeHistoryLogs]);

  const openHistory = useCallback(async (preferredDeploymentId?: string | null) => {
    setTab('history');
    const list = await loadHistory(true);
    const row =
      (preferredDeploymentId ? list.find((d) => d.id === preferredDeploymentId) : null) ??
      (deploymentId ? list.find((d) => d.id === deploymentId) : null) ??
      list[0];
    if (row) await selectHistory(row);
  }, [deploymentId, loadHistory, selectHistory]);

  useEffect(() => {
    if (tab !== 'history' || !historyJobId || !historyJobStatus || TERMINAL_STATUSES.includes(historyJobStatus)) {
      return;
    }
    const token = selectTokenRef.current;
    const id = setInterval(async () => {
      try {
        const data = await api<JobData>(`/jobs/${historyJobId}`);
        if (selectTokenRef.current !== token) return;
        startTransition(() => applyHistoryJobData(data));
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(id);
          void loadHistory(true);
        }
      } catch {
        // Keep the last known history state and retry transient failures.
      }
    }, 3000);
    return () => clearInterval(id);
  }, [applyHistoryJobData, historyJobId, historyJobStatus, loadHistory, tab]);

  useEffect(() => {
    const src = searchParams.get('sourceOrgId');
    const tgt = searchParams.get('targetOrgId');
    const draft = loadDraft();
    if (src || tgt || draft) {
      setForm((f) => ({
        ...f,
        sourceOrgId: src ?? draft?.sourceOrgId ?? f.sourceOrgId,
        targetOrgId: tgt ?? draft?.targetOrgId ?? f.targetOrgId,
        deploymentName: draft?.deploymentName ?? f.deploymentName,
      }));
      if (draft?.comparisonId) setComparisonId(draft.comparisonId);
      if (draft?.selectedKeys) setSelectedKeys(new Set(draft.selectedKeys));
      if (draft?.selectionSnapshot) setSelectionSnapshot(draft.selectionSnapshot);
      if (draft?.phase) setPhase(draft.phase);
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      hasFreshSessionCache('orgs:list')
        ? Promise.resolve(getSessionCache<Org[]>('orgs:list') ?? [])
        : fetchOrgsList(),
      loadHistory(),
    ])
      .then(([o]) => {
        setOrgs(o);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [loadHistory]);

  useEffect(() => {
    if (tab === 'history') {
      void loadHistory(true);
    }
  }, [tab, loadHistory]);

  const loadPreviewCounts = useCallback(async () => {
    if (!canCompare) return;
    const token = ++previewTokenRef.current;
    try {
      const res = await api<{ sourceCount: number; targetCount: number }>(
        `/metadata/compare/preview-counts?sourceOrgId=${form.sourceOrgId}&targetOrgId=${form.targetOrgId}`,
      );
      if (previewTokenRef.current !== token) return;
      setPreviewCounts({ source: res.sourceCount, target: res.targetCount });
    } catch {
      if (previewTokenRef.current !== token) return;
      setPreviewCounts(null);
    }
  }, [canCompare, form.sourceOrgId, form.targetOrgId]);

  useEffect(() => {
    if (phase === 'setup' && canCompare) void loadPreviewCounts();
  }, [phase, canCompare, loadPreviewCounts]);

  const refreshSession = useCallback(async () => {
    if (!comparisonId) return;
    const token = ++sessionTokenRef.current;
    setSessionLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '100',
      });
      if (activeType) params.set('type', activeType);
      if (diffFilter !== 'all') params.set('diffType', diffFilter);
      if (itemSearch.trim()) params.set('search', itemSearch.trim());
      const res = await api<MetadataCompareSession>(`/metadata/compare/${comparisonId}?${params}`);
      if (sessionTokenRef.current !== token) return;
      setSessionStatus(res.status);
      setSummary(res.summary);
      setItems(res.items);
      setItemsTotal(res.total);
      if (res.status === 'completed' && phase === 'compare' && res.summary) {
        /* session ready */
      }
    } catch (err) {
      if (sessionTokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      if (sessionTokenRef.current === token) setSessionLoading(false);
    }
  }, [comparisonId, page, activeType, diffFilter, itemSearch, phase]);

  useEffect(() => {
    if (comparisonId && (phase === 'compare' || phase === 'analysis' || phase === 'summary')) {
      void refreshSession();
    }
  }, [comparisonId, phase, refreshSession]);

  useEffect(() => {
    if (!comparisonId || sessionStatus !== 'running') return;
    const id = setInterval(() => void refreshSession(), 3000);
    return () => clearInterval(id);
  }, [comparisonId, sessionStatus, refreshSession]);

  const startComparison = useCallback(async () => {
    if (!canCompare) return;
    setCompareStarting(true);
    setError(null);
    try {
      const res = await api<{ comparisonId: string; status: string }>('/metadata/compare/start', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrgId: form.sourceOrgId,
          targetOrgId: form.targetOrgId,
        }),
      });
      setComparisonId(res.comparisonId);
      setSessionStatus(res.status);
      setPhase('compare');
      setPage(1);
      setActiveType(null);
      setDiffFilter('all');
      setSelectedKeys(new Set());
      setSelectedItem(null);
      setItemDiff(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start comparison');
    } finally {
      setCompareStarting(false);
    }
  }, [canCompare, form.sourceOrgId, form.targetOrgId]);

  const loadObjectFields = useCallback(async (objectName: string) => {
    if (!form.sourceOrgId) return [];
    setFieldWarning(null);
    try {
      const res = await api<{
        fields: Array<{ name: string; label: string; fullName: string }>;
        warning?: string;
        source: string;
      }>(`/metadata/org/${form.sourceOrgId}/objects/${encodeURIComponent(objectName)}/fields`);
      if (res.warning) setFieldWarning(res.warning);
      return res.fields;
    } catch (err) {
      setFieldWarning(err instanceof Error ? err.message : 'Failed to load object fields');
      return [];
    }
  }, [form.sourceOrgId]);

  const loadItemDiff = useCallback(async (item: MetadataCompareItem) => {
    if (!comparisonId) return;
    diffAbortRef.current?.abort();
    const controller = new AbortController();
    diffAbortRef.current = controller;
    const token = ++diffTokenRef.current;
    setSelectedItem(item);
    setDiffLoading(true);
    setItemDiff(null);
    setChildren([]);
    try {
      const res = await api<ItemDiffPayload>(
        `/metadata/compare/${comparisonId}/diff?type=${encodeURIComponent(item.metadataType)}&name=${encodeURIComponent(item.fullName)}`,
        { signal: controller.signal },
      );
      if (diffTokenRef.current !== token) return;
      setItemDiff(res);
      const key = itemKey(item.metadataType, item.fullName);
      if (res.loadStatus !== 'failed' && res.contentDiffers && (item.diffType === 'same' || item.diffType === 'unknown')) {
        const upgraded = { ...item, diffType: 'changed' as const };
        setSelectedItem(upgraded);
        setSelectionSnapshot((prev) => ({ ...prev, [key]: upgraded }));
        setItems((prev) =>
          prev.map((i) =>
            i.metadataType === item.metadataType && i.fullName === item.fullName ? upgraded : i,
          ),
        );
        void refreshSession();
      } else if (
        res.loadStatus !== 'failed'
        && !res.contentDiffers
        && (item.diffType === 'changed' || item.diffType === 'unknown')
      ) {
        const downgraded = { ...item, diffType: 'same' as const };
        setSelectedItem(downgraded);
        setSelectionSnapshot((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setItems((prev) =>
          prev.map((i) =>
            i.metadataType === item.metadataType && i.fullName === item.fullName ? downgraded : i,
          ),
        );
        void refreshSession();
      }
      if (item.metadataType === 'CustomObject') {
        setChildrenLoading(true);
        void loadObjectFields(item.fullName);
        const childRes = await api<{ childTypes: Array<{ type: string; count: number }> }>(
          `/metadata/compare/${comparisonId}/children?objectName=${encodeURIComponent(item.fullName)}`,
          { signal: controller.signal },
        );
        if (diffTokenRef.current !== token) return;
        setChildren(childRes.childTypes);
        setChildrenLoading(false);
      }
    } catch (err) {
      if (diffTokenRef.current !== token || controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      if (diffTokenRef.current === token) {
        setDiffLoading(false);
        setChildrenLoading(false);
      }
    }
  }, [comparisonId, loadObjectFields, refreshSession]);

  useEffect(() => () => {
    diffAbortRef.current?.abort();
    diffTokenRef.current += 1;
  }, []);

  const toggleSelect = useCallback((item: MetadataCompareItem) => {
    const key = itemKey(item.metadataType, item.fullName);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const willSelect = !prev.has(key);
      if (willSelect) next.add(key);
      else next.delete(key);
      setSelectionSnapshot((snap) => {
        const updated = { ...snap };
        if (willSelect) updated[key] = item;
        else delete updated[key];
        return updated;
      });
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const visible = items.filter((i) => isDeployableDiffType(i.diffType));
    const visibleKeys = visible.map((i) => itemKey(i.metadataType, i.fullName));
    const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleKeys.forEach((k) => next.delete(k));
      else visibleKeys.forEach((k) => next.add(k));
      return next;
    });
    setSelectionSnapshot((prev) => {
      const next = { ...prev };
      if (allSelected) visibleKeys.forEach((k) => delete next[k]);
      else visible.forEach((i) => { next[itemKey(i.metadataType, i.fullName)] = i; });
      return next;
    });
  }, [items, selectedKeys]);

  const runAnalysis = useCallback(async () => {
    if (!comparisonId) return;
    setAnalysisLoading(true);
    setError(null);
    try {
      const selected = [...selectedKeys].map((k) => {
        const { metadataType, fullName } = parseItemKey(k);
        const item = resolveItem(k);
        return { fullName, metadataType, diffType: item?.diffType };
      });
      const res = await api<ProblemAnalysisResult>(`/metadata/compare/${comparisonId}/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          selectedItems: selected,
          excludeFullNames: [...excludedKeys].map((k) => k.split('::').slice(1).join('::')),
        }),
      });
      setAnalysis(res);
      const autoExclude = new Set(excludedKeys);
      for (const fix of res.suggestedFixes) {
        if (fix.autoExclude) {
          for (const a of fix.affectedItems) {
            autoExclude.add(itemKey(a.metadataType, a.fullName));
          }
        }
      }
      setExcludedKeys(autoExclude);
      setPhase('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalysisLoading(false);
    }
  }, [comparisonId, selectedKeys, excludedKeys, resolveItem]);

  const refreshPreview = useCallback(async () => {
    const deployItems = getDeployableItems();
    const selections = selectionsFromItems(deployItems);
    if (!selections.length) {
      setPackageXmlPreview('');
      return;
    }
    try {
      const res = await api<{ packageXml: string }>('/metadata/org-to-org/preview-manifest', {
        method: 'POST',
        body: JSON.stringify({ selections, apiVersion: '62.0' }),
      });
      setPackageXmlPreview(res.packageXml);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid manifest');
    }
  }, [getDeployableItems]);

  useEffect(() => {
    if (phase === 'summary') void refreshPreview();
  }, [phase, refreshPreview]);

  const saveDraft = useCallback(() => {
    const draft: MetadataDraft = {
      sourceOrgId: form.sourceOrgId,
      targetOrgId: form.targetOrgId,
      comparisonId: comparisonId ?? undefined,
      selectedKeys: [...selectedKeys],
      selectionSnapshot,
      phase,
      deploymentName: form.deploymentName,
    };
    sessionStorage.setItem(METADATA_DRAFT_KEY, JSON.stringify(draft));
  }, [form, comparisonId, selectedKeys, selectionSnapshot, phase]);

  const deploy = useCallback(async () => {
    const deployItems = getDeployableItems();
    const selections = selectionsFromItems(deployItems);
    if (!canCompare) {
      setError('Select source and target orgs before deploying.');
      return;
    }
    if (!selections.length) {
      setError('No deployable items selected. Choose items marked New or Changed.');
      return;
    }

    setDeploying(true);
    setError(null);
    setDeployStartedAt(Date.now());
    setLogs([]);
    setLogStreams([]);
    setLogsTruncated(false);
    setLogCount(null);
    setPhase('deploying');
    try {
      const res = await api<{ jobId: string; deploymentId: string }>('/deployments/org-to-org-metadata/deploy', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrgId: form.sourceOrgId,
          targetOrgId: form.targetOrgId,
          testLevel: form.testLevel,
          selections,
          comparisonId: comparisonId ?? undefined,
          deploymentName: form.deploymentName || undefined,
          deploymentNotes: form.deploymentNotes || undefined,
          intelligentDeployEnabled: false,
          chainDataDeploy: form.chainDataDeploy,
          dataDeployConfig: form.chainDataDeploy
            ? [{ objectName: form.dataObjectName, soql: form.dataSoql || undefined, strategy: 'upsert' }]
            : undefined,
        }),
      });
      setJobId(res.jobId);
      setDeploymentId(res.deploymentId);
      setActiveDeploymentId(res.deploymentId);
      setJobStatus('running');
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
      setPhase('summary');
    } finally {
      setDeploying(false);
    }
  }, [getDeployableItems, canCompare, form, comparisonId, loadHistory]);

  useEffect(() => {
    if (!jobId) return;
    if (jobStatus && TERMINAL_STATUSES.includes(jobStatus)) {
      setSseConnected(false);
      setPhase('success');
      return;
    }

    let es: EventSource | null = null;
    let cancelled = false;

    void (async () => {
      const url = await getStreamUrl(['job_log', 'job_status']);
      if (cancelled) return;
      es = new EventSource(url);
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            payload: { jobId?: string; line?: string; status?: string; currentStep?: string; stream?: string };
          };
          if (data.payload.jobId !== jobId) return;
          if (data.type === 'job_status') {
            if (data.payload.status) setJobStatus(data.payload.status);
            if (data.payload.currentStep) setCurrentStep(data.payload.currentStep);
            if (data.payload.status && TERMINAL_STATUSES.includes(data.payload.status)) {
              void loadHistory();
              setPhase('success');
            }
          }
        } catch { /* ignore */ }
      };
    })();

    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const data = await api<JobData>(`/jobs/${jobId}`);
        startTransition(() => applyJobData(data));
        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(poll);
          es?.close();
          void loadHistory();
          setPhase('success');
        }
      } catch { /* ignore */ }
    }, 3000);
    pollRef.current = poll;

    return () => {
      cancelled = true;
      setSseConnected(false);
      es?.close();
      clearInterval(poll);
    };
  }, [jobId, jobStatus, applyJobData, loadHistory]);

  const resetFlow = useCallback(() => {
    sessionTokenRef.current += 1;
    previewTokenRef.current += 1;
    diffTokenRef.current += 1;
    diffAbortRef.current?.abort();
    setPhase('setup');
    setComparisonId(null);
    setSessionStatus('pending');
    setSummary(null);
    setItems([]);
    setItemsTotal(0);
    setActiveType(null);
    setDiffFilter('all');
    setItemSearch('');
    setPage(1);
    setSelectedKeys(new Set());
    setSelectionSnapshot({});
    setSelectedItem(null);
    setItemDiff(null);
    setDiffLoading(false);
    setChildren([]);
    setChildrenLoading(false);
    setPreviewCounts(null);
    setCompareStarting(false);
    setSessionLoading(false);
    setAnalysis(null);
    setAnalysisLoading(false);
    setExcludedKeys(new Set());
    setPackageXmlPreview('');
    setError(null);
    setFieldWarning(null);
    setDeploying(false);
    setJobId(null);
    setDeploymentId(null);
    setActiveDeploymentId(null);
    setSelectingDeploymentId(null);
    setHistoryJobId(null);
    setHistoryJobStatus(null);
    setHistoryCurrentStep(null);
    setHistoryLogs([]);
    setHistoryLogStreams([]);
    setHistoryLogsTruncated(false);
    setHistoryLogCount(null);
    setHistoryError(null);
    setJobStatus(null);
    setCurrentStep(null);
    setLogs([]);
    setLogStreams([]);
    setLogsTruncated(false);
    setLogCount(null);
    setSseConnected(false);
    setDeployStartedAt(null);
    sessionStorage.removeItem(METADATA_DRAFT_KEY);
  }, []);

  const orgById = useCallback((id: string) => orgs.find((o) => o.id === id), [orgs]);
  const isRunning = Boolean(jobId && jobStatus && ACTIVE_STATUSES.includes(jobStatus));

  return {
    loading,
    orgs,
    orgById,
    history,
    activeDeploymentId,
    selectingDeploymentId,
    historyJobId,
    historyJobStatus,
    historyCurrentStep,
    historyLogs,
    historyLogStreams,
    historyLogsTruncated,
    historyLogCount,
    historyError,
    selectHistory,
    closeHistoryLogs,
    openHistory,
    loadHistory,
    form,
    setForm,
    tab,
    setTab,
    phase,
    setPhase,
    comparisonId,
    sessionStatus,
    summary,
    items,
    itemsTotal,
    activeType,
    setActiveType,
    diffFilter,
    setDiffFilter,
    search: itemSearch,
    setSearch: setItemSearch,
    page,
    setPage,
    selectedKeys,
    selectedItems,
    selectionCount,
    deployableCount,
    getDeployableItems,
    selectedItem,
    itemDiff,
    diffLoading,
    children,
    childrenLoading,
    previewCounts,
    compareStarting,
    sessionLoading,
    analysis,
    analysisLoading,
    excludedKeys,
    setExcludedKeys,
    packageXmlPreview,
    error,
    setError,
    fieldWarning,
    setFieldWarning,
    canCompare,
    startComparison,
    refreshSession,
    loadItemDiff,
    toggleSelect,
    toggleSelectAllVisible,
    runAnalysis,
    saveDraft,
    deploy,
    deploying,
    jobId,
    deploymentId,
    jobStatus,
    currentStep,
    logs,
    logStreams,
    logsTruncated,
    logCount,
    sseConnected,
    deployStartedAt,
    isRunning,
    resetFlow,
    loadObjectFields,
  };
}

export type MetadataCompareHook = ReturnType<typeof useMetadataCompare>;
