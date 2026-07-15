'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/services/api';
import { getSessionCache, hasFreshSessionCache, setSessionCache, clearSessionCache } from '@/lib/session-cache';
import type {
  AzureWorkItemAttachment,
  AzureWorkItemComment,
  AzureWorkItemDetail,
  AzureWorkItemHistoryEvent,
  AzureWorkItemStateOption,
  AzureWorkItemSummary,
  DefectInvestigationResult,
  DefectStatusFilter,
  DefectsOverview,
  DefectsProjectsResponse,
  DefectsWorkItemsResponse,
} from './types';

const PAGE_SIZE = 15;
const PROJECT_STORAGE_KEY = 'defects:selected-project';

function readStoredProject(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(PROJECT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeStoredProject(project: string) {
  try {
    if (project) sessionStorage.setItem(PROJECT_STORAGE_KEY, project);
    else sessionStorage.removeItem(PROJECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function useDefectsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get('id');
  const projectFromUrl = searchParams.get('project') ?? '';

  const [projectsMeta, setProjectsMeta] = useState<DefectsProjectsResponse | null>(null);
  const [selectedProject, setSelectedProjectState] = useState(
    projectFromUrl || readStoredProject(),
  );
  const [projectsLoading, setProjectsLoading] = useState(true);

  const overviewKey = `defects:overview:${selectedProject || 'default'}`;
  const cachedOverview = getSessionCache<DefectsOverview>(overviewKey);

  const [overview, setOverview] = useState<DefectsOverview | null>(cachedOverview);
  const [items, setItems] = useState<AzureWorkItemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!cachedOverview);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DefectStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    selectedFromUrl ? parseInt(selectedFromUrl, 10) : null,
  );
  const [detail, setDetail] = useState<AzureWorkItemDetail | null>(null);
  const [comments, setComments] = useState<AzureWorkItemComment[]>([]);
  const [history, setHistory] = useState<AzureWorkItemHistoryEvent[]>([]);
  const [attachments, setAttachments] = useState<AzureWorkItemAttachment[]>([]);
  const [states, setStates] = useState<AzureWorkItemStateOption[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [investigation, setInvestigation] = useState<DefectInvestigationResult | null>(null);
  const detailTokenRef = useRef(0);
  const detailAbortRef = useRef<AbortController | null>(null);

  const projectQuery = useMemo(() => {
    if (!selectedProject) return '';
    return `project=${encodeURIComponent(selectedProject)}`;
  }, [selectedProject]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (selectedProject) params.set('project', selectedProject);
    if (statusFilter !== 'all') params.set('state', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (search.trim()) params.set('q', search.trim());
    return params.toString();
  }, [page, selectedProject, statusFilter, typeFilter, search]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await api<DefectsProjectsResponse>('/defects/projects');
      setProjectsMeta(data);
      return data;
    } catch (err) {
      setProjectsMeta({
        projects: [],
        defaultProject: null,
        connected: false,
        orgSlug: null,
      });
      setError(err instanceof Error ? err.message : 'Failed to load Azure projects');
      return null;
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const setSelectedProject = useCallback(
    (project: string) => {
      detailAbortRef.current?.abort();
      detailTokenRef.current += 1;
      setSelectedProjectState(project);
      writeStoredProject(project);
      setSelectedId(null);
      setInvestigation(null);
      setPage(1);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('id');
      if (project) params.set('project', project);
      else params.delete('project');
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/defects-command-centre', { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    void loadProjects().then((data) => {
      if (!data) return;
      const initial =
        projectFromUrl ||
        readStoredProject() ||
        data.defaultProject ||
        data.projects[0]?.name ||
        '';
      if (initial && initial !== selectedProject) {
        setSelectedProjectState(initial);
        writeStoredProject(initial);
      } else if (!selectedProject && initial) {
        setSelectedProjectState(initial);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, [loadProjects]);

  const loadOverview = useCallback(async () => {
    if (!selectedProject && projectsMeta?.connected && projectsMeta.projects.length > 0) {
      return null;
    }
    const qs = projectQuery ? `?${projectQuery}` : '';
    const data = await api<DefectsOverview>(`/defects/overview${qs}`);
    setOverview(data);
    setSessionCache(overviewKey, data);
    return data;
  }, [selectedProject, projectsMeta, projectQuery, overviewKey]);

  const loadList = useCallback(async () => {
    if (!selectedProject && projectsMeta?.connected && projectsMeta.projects.length > 0) {
      setItems([]);
      setTotal(0);
      return null;
    }
    const data = await api<DefectsWorkItemsResponse>(`/defects/work-items?${listQuery}`);
    setItems(data.items);
    setTotal(data.total);
    return data;
  }, [listQuery, selectedProject, projectsMeta]);

  const refreshAll = useCallback(
    async (opts?: { manual?: boolean }) => {
      if (opts?.manual) {
        setRefreshing(true);
        clearSessionCache(overviewKey);
      } else if (!overview) {
        setLoading(true);
      }
      setError(null);

      try {
        if (opts?.manual) {
          await loadProjects();
        }

        if (!selectedProject) {
          return;
        }

        const overviewParams = new URLSearchParams();
        if (selectedProject) overviewParams.set('project', selectedProject);
        if (opts?.manual) overviewParams.set('_t', String(Date.now()));

        const listParams = new URLSearchParams(listQuery);
        if (opts?.manual) listParams.set('_t', String(Date.now()));

        const overviewQs = overviewParams.toString();
        const listQs = listParams.toString();

        const [overviewData, listData] = await Promise.all([
          api<DefectsOverview>(`/defects/overview${overviewQs ? `?${overviewQs}` : ''}`),
          api<DefectsWorkItemsResponse>(`/defects/work-items?${listQs}`),
        ]);

        setOverview(overviewData);
        setSessionCache(overviewKey, overviewData);
        setItems(listData.items);
        setTotal(listData.total);

        if (selectedId && !Number.isNaN(selectedId)) {
          const detailToken = detailTokenRef.current;
          const detailParams = new URLSearchParams();
          if (selectedProject) detailParams.set('project', selectedProject);
          if (opts?.manual) detailParams.set('_t', String(Date.now()));
          const pq = detailParams.toString() ? `?${detailParams.toString()}` : '';
          const [item, commentList, stateList, historyData, attachmentData] = await Promise.all([
            api<AzureWorkItemDetail>(`/defects/work-items/${selectedId}${pq}`),
            api<AzureWorkItemComment[]>(`/defects/work-items/${selectedId}/comments${pq}`),
            api<AzureWorkItemStateOption[]>(`/defects/work-items/${selectedId}/states${pq}`),
            api<{ events: AzureWorkItemHistoryEvent[] }>(`/defects/work-items/${selectedId}/history${pq}`),
            api<{ attachments: AzureWorkItemAttachment[] }>(
              `/defects/work-items/${selectedId}/attachments${pq}`,
            ),
          ]);
          if (detailTokenRef.current === detailToken) {
            setDetail(item);
            setComments(commentList);
            setStates(stateList);
            setHistory(historyData.events);
            setAttachments(attachmentData.attachments);
            setInvestigation(null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load defects');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      overview,
      overviewKey,
      selectedProject,
      projectQuery,
      listQuery,
      selectedId,
      loadProjects,
    ],
  );

  useEffect(() => {
    if (!selectedProject) return;
    if (hasFreshSessionCache(overviewKey)) return;
    void refreshAll();
  }, [refreshAll, selectedProject, overviewKey]);

  useEffect(() => {
    if (!selectedProject) return;
    void loadList().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load work items');
    });
  }, [loadList, selectedProject]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, search, selectedProject]);

  const selectWorkItem = useCallback(
    (id: number | null) => {
      detailAbortRef.current?.abort();
      detailTokenRef.current += 1;
      setSelectedId(id);
      setInvestigation(null);
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('id', String(id));
      else params.delete('id');
      if (selectedProject) params.set('project', selectedProject);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/defects-command-centre', { scroll: false });
    },
    [router, searchParams, selectedProject],
  );

  const loadDetail = useCallback(
    async (id: number) => {
      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;
      const token = ++detailTokenRef.current;
      setDetailLoading(true);
      const pq = projectQuery ? `?${projectQuery}` : '';
      try {
        const [item, commentList, stateList, historyData, attachmentData] = await Promise.all([
          api<AzureWorkItemDetail>(`/defects/work-items/${id}${pq}`, { signal: controller.signal }),
          api<AzureWorkItemComment[]>(`/defects/work-items/${id}/comments${pq}`, { signal: controller.signal }),
          api<AzureWorkItemStateOption[]>(`/defects/work-items/${id}/states${pq}`, { signal: controller.signal }),
          api<{ events: AzureWorkItemHistoryEvent[] }>(`/defects/work-items/${id}/history${pq}`, {
            signal: controller.signal,
          }),
          api<{ attachments: AzureWorkItemAttachment[] }>(`/defects/work-items/${id}/attachments${pq}`, {
            signal: controller.signal,
          }),
        ]);
        if (detailTokenRef.current !== token) return;
        setDetail(item);
        setComments(commentList);
        setStates(stateList);
        setHistory(historyData.events);
        setAttachments(attachmentData.attachments);
      } catch (err) {
        if (detailTokenRef.current !== token || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load work item detail');
        setDetail(null);
        setComments([]);
        setHistory([]);
        setAttachments([]);
        setStates([]);
      } finally {
        if (detailTokenRef.current === token) setDetailLoading(false);
      }
    },
    [projectQuery],
  );

  useEffect(() => {
    if (selectedId && !Number.isNaN(selectedId) && selectedProject) {
      void loadDetail(selectedId);
    } else {
      detailAbortRef.current?.abort();
      detailTokenRef.current += 1;
      setDetailLoading(false);
      setDetail(null);
      setComments([]);
      setHistory([]);
      setAttachments([]);
      setStates([]);
    }
  }, [selectedId, selectedProject, loadDetail]);

  useEffect(() => () => {
    detailAbortRef.current?.abort();
    detailTokenRef.current += 1;
  }, []);

  const updateStatus = useCallback(
    async (state: string) => {
      if (!selectedId) return;
      setStatusUpdating(true);
      setError(null);
      const prevDetail = detail;
      const prevItems = items;
      if (detail) setDetail({ ...detail, state });
      setItems((prev) => prev.map((i) => (i.id === selectedId ? { ...i, state } : i)));
      const pq = projectQuery ? `?${projectQuery}` : '';
      try {
        const updated = await api<AzureWorkItemDetail>(`/defects/work-items/${selectedId}/state${pq}`, {
          method: 'PATCH',
          body: JSON.stringify({ state }),
        });
        setDetail(updated);
        setItems((prev) => prev.map((i) => (i.id === selectedId ? { ...i, state: updated.state } : i)));
        const historyData = await api<{ events: AzureWorkItemHistoryEvent[] }>(
          `/defects/work-items/${selectedId}/history${pq}`,
        );
        setHistory(historyData.events);
        await loadOverview();
      } catch (err) {
        if (prevDetail) setDetail(prevDetail);
        setItems(prevItems);
        throw err;
      } finally {
        setStatusUpdating(false);
      }
    },
    [selectedId, detail, items, loadOverview, projectQuery],
  );

  const investigate = useCallback(async () => {
    if (!selectedId) return;
    setInvestigating(true);
    setInvestigation(null);
    const pq = projectQuery ? `?${projectQuery}` : '';
    try {
      const result = await api<DefectInvestigationResult>(
        `/defects/work-items/${selectedId}/investigate${pq}`,
        { method: 'POST' },
      );
      setInvestigation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI investigation failed');
    } finally {
      setInvestigating(false);
    }
  }, [selectedId, projectQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedSummary = items.find((i) => i.id === selectedId) ?? null;
  const needsProjectSelection =
    Boolean(projectsMeta?.connected) &&
    (projectsMeta?.projects.length ?? 0) > 0 &&
    !selectedProject;

  return {
    overview,
    projectsMeta,
    projectsLoading,
    selectedProject,
    setSelectedProject,
    needsProjectSelection,
    items,
    total,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    loading,
    refreshing,
    error,
    setError,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    search,
    setSearch,
    selectedId,
    selectWorkItem,
    selectedSummary,
    detail,
    comments,
    history,
    attachments,
    states,
    detailLoading,
    statusUpdating,
    investigating,
    investigation,
    refreshAll,
    updateStatus,
    investigate,
  };
}

export type DefectsWorkspaceState = ReturnType<typeof useDefectsWorkspace>;
