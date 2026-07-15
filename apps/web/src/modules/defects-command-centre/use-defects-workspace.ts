'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api } from '@/services/api';
import {
  clearSessionCache,
  getSessionCache,
  hasFreshSessionCache,
  setSessionCache,
} from '@/lib/session-cache';
import type {
  DefectInvestigationResult,
  DefectStatusFilter,
  DefectsContextsResponse,
  DefectsOverview,
  DefectsProjectsResponse,
  DefectsWorkItemsResponse,
  ProjectBindingOption,
  WorkItemAttachment,
  WorkItemComment,
  WorkItemDetail,
  WorkItemHistoryEvent,
  WorkItemMutationInput,
  WorkItemProvider,
  WorkItemState,
  WorkItemSummary,
  WorkItemUser,
} from './types';
import {
  contextParams,
  defectsCacheKey,
  isWorkItemProvider,
  projectValue,
  providerEndpoint,
  selectableWorkItemProjects,
  workItemOperationCapabilities,
  workItemEndpoint,
  type GranularIntegrationCapabilities,
  type WorkItemContext,
} from './work-item-contracts';

const PAGE_SIZE = 15;
const CONTEXT_STORAGE_KEY = 'defects:selected-context:v2';
const EMPTY_CAPABILITIES: GranularIntegrationCapabilities = {
  read: false,
  write: false,
  create: false,
  update: false,
  comments: false,
  webhooks: false,
  attachments: false,
  attachmentUploads: false,
  attachmentDeletes: false,
  history: false,
  stateTransitions: false,
  issueTypes: false,
  users: false,
  labels: false,
  subIssues: false,
};

type SectionName = 'comments' | 'history' | 'attachments' | 'states' | 'subissues' | 'metadata';
type SectionErrors = Partial<Record<SectionName, string>>;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function readStoredContext(): Partial<WorkItemContext> {
  if (typeof window === 'undefined') return {};
  try {
    const value = JSON.parse(sessionStorage.getItem(CONTEXT_STORAGE_KEY) ?? '{}') as Partial<WorkItemContext>;
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeStoredContext(context: WorkItemContext) {
  try {
    sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    /* Session storage is an optional convenience. */
  }
}

export function useDefectsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stored = useMemo(readStoredContext, []);
  const providerFromUrl = searchParams.get('provider');
  const initialProvider = isWorkItemProvider(providerFromUrl)
    ? providerFromUrl
    : stored.provider ?? 'azure_boards';

  const [provider, setProviderState] = useState<WorkItemProvider>(initialProvider);
  const [connectionId, setConnectionIdState] = useState(searchParams.get('connectionId') ?? stored.connectionId ?? '');
  const [bindingId, setBindingIdState] = useState(searchParams.get('bindingId') ?? stored.bindingId ?? '');
  const [selectedProject, setSelectedProjectState] = useState(searchParams.get('project') ?? stored.project ?? '');
  const [contexts, setContexts] = useState<DefectsContextsResponse | null>(null);
  const [projectsMeta, setProjectsMeta] = useState<DefectsProjectsResponse | null>(null);
  const [contextsLoading, setContextsLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [unboundGitHubProjects, setUnboundGitHubProjects] = useState(0);
  const [setupError, setSetupError] = useState<{ code: string; message: string } | null>(null);

  const context = useMemo<WorkItemContext>(
    () => ({ provider, connectionId, bindingId, project: selectedProject }),
    [provider, connectionId, bindingId, selectedProject],
  );
  const overviewKey = defectsCacheKey('overview', context);
  const cachedOverview = getSessionCache<DefectsOverview>(overviewKey);

  const [overview, setOverview] = useState<DefectsOverview | null>(cachedOverview);
  const [items, setItems] = useState<WorkItemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!cachedOverview);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DefectStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [detail, setDetail] = useState<WorkItemDetail | null>(null);
  const [comments, setComments] = useState<WorkItemComment[]>([]);
  const [history, setHistory] = useState<WorkItemHistoryEvent[]>([]);
  const [attachments, setAttachments] = useState<WorkItemAttachment[]>([]);
  const [states, setStates] = useState<WorkItemState[]>([]);
  const [subissues, setSubissues] = useState<WorkItemSummary[]>([]);
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [users, setUsers] = useState<WorkItemUser[]>([]);
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRevision, setDetailRevision] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [investigation, setInvestigation] = useState<DefectInvestigationResult | null>(null);
  const detailTokenRef = useRef(0);
  const detailAbortRef = useRef<AbortController | null>(null);

  const connectionOptions = useMemo(
    () => contexts?.connections.filter((connection) => connection.provider === provider) ?? [],
    [contexts, provider],
  );
  const bindingOptions = useMemo(
    () => contexts?.bindings.filter(
      (binding) => binding.provider === provider && (!connectionId || binding.connectionId === connectionId),
    ) ?? [],
    [contexts, provider, connectionId],
  );
  const selectedConnection = connectionOptions.find((connection) => connection.id === connectionId)
    ?? connectionOptions.find((connection) => connection.id === null)
    ?? null;
  const capabilities =
    projectsMeta?.capabilities ??
    overview?.capabilities ??
    selectedConnection?.capabilities ??
    EMPTY_CAPABILITIES;
  const operations = useMemo(
    () => workItemOperationCapabilities(provider, capabilities),
    [capabilities, provider],
  );

  const replaceLocation = useCallback((next: WorkItemContext, id: string | null = null) => {
    writeStoredContext(next);
    const params = new URLSearchParams();
    params.set('provider', next.provider);
    if (next.connectionId) params.set('connectionId', next.connectionId);
    if (next.bindingId) params.set('bindingId', next.bindingId);
    if (next.project) params.set('project', next.project);
    if (id) params.set('id', id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router]);

  const clearDetail = useCallback(() => {
    detailAbortRef.current?.abort();
    detailTokenRef.current += 1;
    setSelectedId(null);
    setDetail(null);
    setComments([]);
    setHistory([]);
    setAttachments([]);
    setStates([]);
    setSubissues([]);
    setInvestigation(null);
    setSectionErrors({});
  }, []);

  const setProvider = useCallback((nextProvider: WorkItemProvider) => {
    const nextConnection = contexts?.connections.find(
      (candidate) => candidate.provider === nextProvider && ['connected', 'degraded'].includes(candidate.status),
    )?.id ?? '';
    clearDetail();
    setProviderState(nextProvider);
    setConnectionIdState(nextConnection);
    setBindingIdState('');
    setSelectedProjectState('');
    setProjectsMeta(null);
    setOverview(null);
    setItems([]);
    setPage(1);
    setSetupError(null);
    replaceLocation({
      provider: nextProvider,
      connectionId: nextConnection,
      bindingId: '',
      project: '',
    });
  }, [clearDetail, contexts, replaceLocation]);

  const setConnectionId = useCallback((nextConnectionId: string) => {
    clearDetail();
    setConnectionIdState(nextConnectionId);
    setBindingIdState('');
    setSelectedProjectState('');
    setProjectsMeta(null);
    setPage(1);
    setSetupError(null);
    replaceLocation({ provider, connectionId: nextConnectionId, bindingId: '', project: '' });
  }, [clearDetail, provider, replaceLocation]);

  const setBindingId = useCallback((nextBindingId: string) => {
    const binding = bindingOptions.find((candidate) => candidate.id === nextBindingId);
    const nextConnectionId = binding?.connectionId ?? connectionId;
    const nextProject = binding
      ? provider === 'github_issues'
        ? binding.externalProjectId
        : binding.projectKey || binding.externalProjectId
      : '';
    clearDetail();
    setConnectionIdState(nextConnectionId);
    setBindingIdState(nextBindingId);
    setSelectedProjectState(nextProject);
    setProjectsMeta(null);
    setPage(1);
    setSetupError(null);
    replaceLocation({
      provider,
      connectionId: nextConnectionId,
      bindingId: nextBindingId,
      project: nextProject,
    });
  }, [bindingOptions, clearDetail, connectionId, provider, replaceLocation]);

  const setSelectedProject = useCallback((project: string) => {
    clearDetail();
    setSelectedProjectState(project);
    setPage(1);
    replaceLocation({ provider, connectionId, bindingId, project });
  }, [bindingId, clearDetail, connectionId, provider, replaceLocation]);

  const loadContexts = useCallback(async () => {
    setContextsLoading(true);
    try {
      const data = await api<DefectsContextsResponse>('/defects/contexts');
      setContexts(data);
      const hasSelected = data.connections.some(
        (connection) => connection.provider === provider && connection.id === (connectionId || null),
      );
      if (!connectionId && !hasSelected) {
        const first = data.connections.find(
          (connection) => connection.provider === provider && ['connected', 'degraded'].includes(connection.status),
        );
        if (first?.id) setConnectionIdState(first.id);
      }
      return data;
    } catch (loadError) {
      setError(errorMessage(loadError, 'Failed to load provider connections'));
      return null;
    } finally {
      setContextsLoading(false);
    }
  }, [connectionId, provider]);

  useEffect(() => {
    void loadContexts();
    // Bootstrap once; provider changes use already loaded context options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setSetupError(null);
    const query = contextParams(context).toString();
    try {
      const data = await api<DefectsProjectsResponse>(
        `${providerEndpoint(provider, 'projects')}${query ? `?${query}` : ''}`,
      );
      const selectable = selectableWorkItemProjects(
        provider,
        data.projects,
        bindingOptions,
        connectionId,
      );
      const nextData = { ...data, projects: selectable.projects };
      setProjectsMeta(nextData);
      setUnboundGitHubProjects(selectable.unboundGitHubProjects);
      const selectedIsAvailable = selectable.projects.some(
        (project) => projectValue(provider, project) === selectedProject,
      );
      if (!selectedProject || !selectedIsAvailable) {
        const defaultIsAvailable = selectable.projects.some(
          (project) => projectValue(provider, project) === data.defaultProject,
        );
        const initial =
          (defaultIsAvailable ? data.defaultProject : null) ||
          (selectable.projects[0] ? projectValue(provider, selectable.projects[0]) : '');
        const initialBinding = bindingOptions.find(
          (binding) => binding.externalProjectId === initial,
        );
        setSelectedProjectState(initial);
        setBindingIdState(initialBinding?.id ?? '');
        if (initial) {
          replaceLocation({
            ...context,
            bindingId: initialBinding?.id ?? '',
            project: initial,
          });
        } else if (selectedProject) {
          replaceLocation({ ...context, bindingId: '', project: '' });
        }
      }
      return nextData;
    } catch (loadError) {
      setProjectsMeta(null);
      setUnboundGitHubProjects(0);
      if (loadError instanceof ApiError && loadError.code) {
        setSetupError({ code: loadError.code, message: loadError.message });
      } else {
        setError(errorMessage(loadError, `Failed to load ${provider} projects`));
      }
      return null;
    } finally {
      setProjectsLoading(false);
    }
  }, [bindingOptions, connectionId, context, provider, replaceLocation, selectedProject]);

  useEffect(() => {
    const unbound =
      selectedConnection &&
      provider !== 'azure_boards' &&
      !selectedConnection.identityBound &&
      !contexts?.isAdmin;
    if (unbound) {
      setProjectsLoading(false);
      setProjectsMeta(null);
      setSetupError({
        code: 'EXTERNAL_IDENTITY_NOT_BOUND',
        message: `Your account is not bound to this ${provider} connection.`,
      });
      return;
    }
    void loadProjects();
  }, [contexts?.isAdmin, loadProjects, provider, selectedConnection]);

  const listQuery = useMemo(() => {
    const params = contextParams(context);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (statusFilter !== 'all') params.set('state', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (search.trim()) params.set('q', search.trim());
    return params.toString();
  }, [context, page, search, statusFilter, typeFilter]);

  const loadOverview = useCallback(async () => {
    if (!selectedProject) return null;
    const query = contextParams(context).toString();
    const data = await api<DefectsOverview>(
      `${providerEndpoint(provider, 'overview')}${query ? `?${query}` : ''}`,
    );
    setOverview(data);
    setSessionCache(overviewKey, data);
    return data;
  }, [context, overviewKey, provider, selectedProject]);

  const loadList = useCallback(async () => {
    if (!selectedProject) {
      setItems([]);
      setTotal(0);
      return null;
    }
    const data = await api<DefectsWorkItemsResponse>(
      `${providerEndpoint(provider, 'work-items')}?${listQuery}`,
    );
    setItems(data.items);
    setTotal(data.total);
    return data;
  }, [listQuery, provider, selectedProject]);

  const refreshAll = useCallback(async (options?: { manual?: boolean }) => {
    if (!selectedProject || setupError) return;
    if (options?.manual) {
      setRefreshing(true);
      clearSessionCache(overviewKey);
    } else if (!overview) {
      setLoading(true);
    }
    setError(null);
    try {
      if (options?.manual) await Promise.all([loadContexts(), loadProjects()]);
      await Promise.all([loadOverview(), loadList()]);
      if (selectedId) setDetailRevision((revision) => revision + 1);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Failed to load work items'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    loadContexts,
    loadList,
    loadOverview,
    loadProjects,
    overview,
    overviewKey,
    selectedId,
    selectedProject,
    setupError,
  ]);

  useEffect(() => {
    if (!selectedProject || setupError) {
      setLoading(false);
      return;
    }
    if (!hasFreshSessionCache(overviewKey)) void loadOverview().catch((loadError) => {
      setError(errorMessage(loadError, 'Failed to load overview'));
      setLoading(false);
    });
    void loadList().catch((loadError) => setError(errorMessage(loadError, 'Failed to load work items')));
    setLoading(false);
  }, [loadList, loadOverview, overviewKey, selectedProject, setupError]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, search, selectedProject]);

  useEffect(() => {
    if (!selectedProject || (!operations.issueTypes && !operations.users)) {
      setIssueTypes([]);
      setUsers([]);
      return;
    }
    const params = contextParams(context).toString();
    const loadMetadata = async () => {
      const [typesResult, usersResult] = await Promise.allSettled([
        operations.issueTypes
          ? api<{ types: string[] }>(`${providerEndpoint(provider, 'work-items/types')}?${params}`)
          : Promise.resolve({ types: [] }),
        operations.users
          ? api<{ users: WorkItemUser[] }>(`${providerEndpoint(provider, 'work-items/users')}?${params}`)
          : Promise.resolve({ users: [] }),
      ]);
      setIssueTypes(typesResult.status === 'fulfilled' ? typesResult.value.types : []);
      setUsers(usersResult.status === 'fulfilled' ? usersResult.value.users : []);
      const failures = [typesResult, usersResult].filter((result) => result.status === 'rejected');
      setSectionErrors((current) => ({
        ...current,
        metadata: failures.length
          ? errorMessage((failures[0] as PromiseRejectedResult).reason, 'Provider metadata is unavailable')
          : undefined,
      }));
    };
    void loadMetadata();
  }, [context, operations.issueTypes, operations.users, provider, selectedProject]);

  const selectWorkItem = useCallback((id: string | null) => {
    detailAbortRef.current?.abort();
    detailTokenRef.current += 1;
    setSelectedId(id);
    setInvestigation(null);
    replaceLocation(context, id);
  }, [context, replaceLocation]);

  const loadDetail = useCallback(async (id: string) => {
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const token = ++detailTokenRef.current;
    setDetailLoading(true);
    setSectionErrors({});
    try {
      const item = await api<WorkItemDetail>(workItemEndpoint(context, id), {
        signal: controller.signal,
      });
      if (detailTokenRef.current !== token) return;
      setDetail(item);

      const requests: Array<{
        section: SectionName;
        run: () => Promise<unknown>;
        apply: (value: unknown) => void;
      }> = [];
      if (operations.readComments) {
        requests.push({
          section: 'comments',
          run: () => api<WorkItemComment[]>(workItemEndpoint(context, id, 'comments'), { signal: controller.signal }),
          apply: (value) => setComments(value as WorkItemComment[]),
        });
      } else {
        setComments([]);
      }
      if (operations.readSubissues) {
        requests.push({
          section: 'subissues',
          run: () => api<{ items: WorkItemSummary[] }>(workItemEndpoint(context, id, 'subissues'), {
            signal: controller.signal,
          }),
          apply: (value) => setSubissues((value as { items: WorkItemSummary[] }).items),
        });
      } else {
        setSubissues([]);
      }
      if (operations.transitionState) {
        requests.push({
          section: 'states',
          run: () => api<WorkItemState[]>(workItemEndpoint(context, id, 'states'), { signal: controller.signal }),
          apply: (value) => setStates(value as WorkItemState[]),
        });
      } else {
        setStates([]);
      }
      if (operations.readHistory) {
        requests.push({
          section: 'history',
          run: () => api<WorkItemHistoryEvent[]>(workItemEndpoint(context, id, 'history'), {
            signal: controller.signal,
          }),
          apply: (value) => setHistory(value as WorkItemHistoryEvent[]),
        });
      } else {
        setHistory([]);
      }
      if (operations.readAttachments) {
        requests.push({
          section: 'attachments',
          run: () => api<{ attachments: WorkItemAttachment[] }>(
            workItemEndpoint(context, id, 'attachments'),
            { signal: controller.signal },
          ),
          apply: (value) => setAttachments((value as { attachments: WorkItemAttachment[] }).attachments),
        });
      } else {
        setAttachments([]);
      }
      const results = await Promise.allSettled(requests.map((request) => request.run()));
      if (detailTokenRef.current !== token) return;
      const nextErrors: SectionErrors = {};
      results.forEach((result, index) => {
        const request = requests[index];
        if (result.status === 'fulfilled') request.apply(result.value);
        else nextErrors[request.section] = errorMessage(result.reason, `${request.section} are unavailable`);
      });
      setSectionErrors((current) => ({ ...current, ...nextErrors }));
    } catch (loadError) {
      if (detailTokenRef.current !== token || controller.signal.aborted) return;
      setError(errorMessage(loadError, 'Failed to load work item detail'));
      setDetail(null);
    } finally {
      if (detailTokenRef.current === token) setDetailLoading(false);
    }
  }, [
    context,
    operations.readAttachments,
    operations.readComments,
    operations.readHistory,
    operations.readSubissues,
    operations.transitionState,
  ]);

  useEffect(() => {
    if (selectedId && selectedProject) void loadDetail(selectedId);
    else {
      detailAbortRef.current?.abort();
      setDetail(null);
    }
  }, [detailRevision, loadDetail, selectedId, selectedProject]);

  useEffect(() => () => detailAbortRef.current?.abort(), []);

  const updateStatus = useCallback(async (state: string) => {
    if (!selectedId) return;
    if (!operations.transitionState) throw new Error('State transitions are not supported by this provider.');
    setStatusUpdating(true);
    const previous = detail;
    if (detail) setDetail({ ...detail, state: { ...detail.state, name: state } });
    try {
      const updated = await api<WorkItemDetail>(workItemEndpoint(context, selectedId, 'state'), {
        method: 'PATCH',
        body: JSON.stringify({ state }),
      });
      setDetail(updated);
      setItems((current) => current.map((item) => item.id === selectedId ? updated : item));
      await Promise.all([loadOverview(), loadDetail(selectedId)]);
    } catch (updateError) {
      if (previous) setDetail(previous);
      throw updateError;
    } finally {
      setStatusUpdating(false);
    }
  }, [context, detail, loadDetail, loadOverview, operations.transitionState, selectedId]);

  const createWorkItem = useCallback(async (input: WorkItemMutationInput) => {
    if (!operations.create) throw new Error('Creating work items is not supported by this provider.');
    if (!selectedProject) throw new Error('Select a project before creating a work item.');
    setMutating(true);
    try {
      const query = contextParams(context).toString();
      const created = await api<WorkItemDetail>(
        `${providerEndpoint(provider, 'work-items')}?${query}`,
        {
          method: 'POST',
          body: JSON.stringify({ ...input, project: selectedProject }),
        },
      );
      await Promise.all([loadOverview(), loadList()]);
      selectWorkItem(created.id);
      return created;
    } finally {
      setMutating(false);
    }
  }, [context, loadList, loadOverview, operations.create, provider, selectWorkItem, selectedProject]);

  const updateWorkItem = useCallback(async (input: WorkItemMutationInput) => {
    if (!operations.edit) throw new Error('Editing work items is not supported by this provider.');
    if (!selectedId) throw new Error('Select a work item before updating it.');
    setMutating(true);
    try {
      const updated = await api<WorkItemDetail>(workItemEndpoint(context, selectedId), {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setDetail(updated);
      await Promise.all([loadOverview(), loadList(), loadDetail(selectedId)]);
      return updated;
    } finally {
      setMutating(false);
    }
  }, [context, loadDetail, loadList, loadOverview, operations.edit, selectedId]);

  const addComment = useCallback(async (body: string) => {
    if (!selectedId) return;
    if (!operations.addComments) throw new Error('Adding comments is not supported by this provider.');
    setMutating(true);
    try {
      const comment = await api<WorkItemComment>(workItemEndpoint(context, selectedId, 'comments'), {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setComments((current) => [...current, comment]);
    } finally {
      setMutating(false);
    }
  }, [context, operations.addComments, selectedId]);

  const uploadAttachment = useCallback(async (file: File) => {
    if (!selectedId) return;
    if (!operations.uploadAttachments) throw new Error('Attachment uploads are not supported by this provider.');
    setMutating(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const attachment = await api<WorkItemAttachment>(
        workItemEndpoint(context, selectedId, 'attachments'),
        { method: 'POST', body: form },
      );
      setAttachments((current) => [...current, attachment]);
    } finally {
      setMutating(false);
    }
  }, [context, operations.uploadAttachments, selectedId]);

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    if (!selectedId) return;
    if (!operations.deleteAttachments) throw new Error('Attachment deletion is not supported by this provider.');
    setMutating(true);
    try {
      await api(
        workItemEndpoint(context, selectedId, `attachments/${encodeURIComponent(attachmentId)}`),
        { method: 'DELETE' },
      );
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    } finally {
      setMutating(false);
    }
  }, [context, operations.deleteAttachments, selectedId]);

  const addSubIssue = useCallback(async (subIssueId: string) => {
    if (!selectedId) return;
    if (!operations.addSubissues) throw new Error('Subissues are not supported by this provider.');
    setMutating(true);
    try {
      await api(workItemEndpoint(context, selectedId, 'subissues'), {
        method: 'POST',
        body: JSON.stringify({ subIssueId }),
      });
      const response = await api<{ items: WorkItemSummary[] }>(
        workItemEndpoint(context, selectedId, 'subissues'),
      );
      setSubissues(response.items);
    } finally {
      setMutating(false);
    }
  }, [context, operations.addSubissues, selectedId]);

  const investigate = useCallback(async () => {
    if (!selectedId) return;
    setInvestigating(true);
    setInvestigation(null);
    try {
      setInvestigation(await api<DefectInvestigationResult>(
        workItemEndpoint(context, selectedId, 'investigate'),
        { method: 'POST' },
      ));
    } catch (investigationError) {
      setError(errorMessage(investigationError, 'AI investigation failed'));
    } finally {
      setInvestigating(false);
    }
  }, [context, selectedId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedSummary = items.find((item) => item.id === selectedId) ?? null;
  const connected = projectsMeta?.connected ?? ['connected', 'degraded'].includes(selectedConnection?.status ?? '');
  const needsProjectSelection = connected && !selectedProject && (projectsMeta?.projects.length ?? 0) > 0;

  return {
    provider,
    setProvider,
    contexts,
    contextsLoading,
    connectionOptions,
    connectionId,
    setConnectionId,
    selectedConnection,
    bindingOptions,
    bindingId,
    setBindingId,
    projectsMeta,
    projectsLoading,
    selectedProject,
    setSelectedProject,
    setupError,
    unboundGitHubProjects,
    connected,
    capabilities,
    operations,
    overview,
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
    subissues,
    issueTypes,
    users,
    sectionErrors,
    detailLoading,
    statusUpdating,
    mutating,
    investigating,
    investigation,
    refreshAll,
    updateStatus,
    createWorkItem,
    updateWorkItem,
    addComment,
    uploadAttachment,
    deleteAttachment,
    addSubIssue,
    investigate,
    context,
  };
}

export type DefectsWorkspaceState = ReturnType<typeof useDefectsWorkspace>;
