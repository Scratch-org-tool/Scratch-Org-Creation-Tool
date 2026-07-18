'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GitSourceConfig, Repository, ScmProvider } from '@sfcc/shared';
import { api } from '@/services/api';
import type { PublicIntegrationConnection } from '@/modules/environment-center/integrations/types';
import { gitSourceConnectionId, gitSourceNamespace } from './provider-config';

interface ConnectionsResponse {
  scm: PublicIntegrationConnection[];
}

export interface GitMetadataSourceState {
  provider: ScmProvider | '';
  connectionId: string;
  namespace: string;
  project: string;
  repositoryId: string;
  repo: string;
  branch: string;
  manifestPath: string;
}

export interface UseGitMetadataSourceOptions {
  initial?: Partial<GitSourceConfig>;
  defaultManifestPath: string;
}

export function gitBranchRequestKey(source: GitMetadataSourceState): string | null {
  if (!source.provider || !source.connectionId || !source.repo) return null;
  return [
    source.provider,
    source.connectionId,
    source.project,
    source.repositoryId,
    source.repo,
  ].join('\u0000');
}

export function isValidatedBranchSelection(
  source: GitMetadataSourceState,
  branches: readonly string[],
  validatedKey: string | null,
  loadingBranches: boolean,
): boolean {
  const currentKey = gitBranchRequestKey(source);
  return Boolean(
    currentKey
    && !loadingBranches
    && validatedKey === currentKey
    && branches.includes(source.branch),
  );
}

export function useGitMetadataSource({
  initial,
  defaultManifestPath,
}: UseGitMetadataSourceOptions) {
  const [connections, setConnections] = useState<PublicIntegrationConnection[]>([]);
  const [source, setSource] = useState<GitMetadataSourceState>({
    provider: initial?.provider ?? '',
    connectionId: initial?.connectionId ?? '',
    namespace: initial?.provider === 'azure_devops' ? '' : initial?.namespace ?? '',
    project:
      initial?.project
      ?? (initial?.provider === 'azure_devops' ? initial.namespace : undefined)
      ?? '',
    repositoryId: initial?.repositoryId ?? '',
    repo: initial?.repo ?? '',
    branch: initial?.branch ?? '',
    manifestPath: initial?.manifestPath ?? defaultManifestPath,
  });
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [validatedBranchKey, setValidatedBranchKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const repositoryRequest = useRef(0);
  const branchRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api<ConnectionsResponse>('/integrations/admin/connections')
      .then(({ scm }) => {
        if (cancelled) return;
        const active = scm.filter((connection) =>
          connection.status === 'connected' || connection.status === 'degraded');
        setConnections(active);
        setSource((current) => {
          const selected =
            active.find((connection) => connection.id === current.connectionId) ??
            active.find((connection) => connection.provider === current.provider) ??
            active[0];
          if (!selected) return current;
          return {
            ...current,
            provider: selected.provider as ScmProvider,
            connectionId: selected.id,
            namespace: current.namespace || gitSourceNamespace(selected),
          };
        });
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load connected providers.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRepositories = useCallback(async (next: GitMetadataSourceState) => {
    const request = ++repositoryRequest.current;
    if (!next.provider || !next.connectionId) {
      setRepositories([]);
      setLoadingRepositories(false);
      return;
    }
    setLoadingRepositories(true);
    setError(null);
    const connection = connections.find((candidate) => candidate.id === next.connectionId);
    const effectiveConnectionId = gitSourceConnectionId(connection);
    const params = new URLSearchParams({ provider: next.provider });
    if (effectiveConnectionId) params.set('connectionId', effectiveConnectionId);
    if (next.namespace && next.provider !== 'azure_devops') {
      params.set('namespace', next.namespace);
    }
    if (next.project) params.set('project', next.project);
    try {
      const list = await api<Repository[]>(`/deployments/repos?${params}`);
      if (request !== repositoryRequest.current) return;
      setRepositories(list);
      const selected =
        list.find((repository) => repository.id === next.repositoryId) ??
        list.find((repository) => repository.name === next.repo || repository.fullName === next.repo) ??
        list[0];
      const selectedRepo =
        next.provider === 'azure_devops'
          ? selected?.name
          : selected?.fullName || selected?.name;
      setSource((current) => {
        if (
          current.provider !== next.provider ||
          current.connectionId !== next.connectionId ||
          current.namespace !== next.namespace ||
          current.project !== next.project
        ) return current;
        return selected
          ? {
              ...current,
              repositoryId: selected.id,
              repo: selectedRepo ?? '',
              branch: current.repo === selectedRepo ? current.branch : '',
              namespace:
                next.provider === 'azure_devops'
                  ? current.namespace
                  : selected.namespace || current.namespace,
              project:
                next.provider === 'azure_devops'
                  ? selected.namespace || current.project
                  : current.project,
            }
          : { ...current, repositoryId: '', repo: '', branch: '' };
      });
    } catch (cause) {
      if (request === repositoryRequest.current) {
        setRepositories([]);
        setError(cause instanceof Error ? cause.message : 'Could not load repositories.');
      }
    } finally {
      if (request === repositoryRequest.current) setLoadingRepositories(false);
    }
  }, [connections]);

  useEffect(() => {
    if (loading) return;
    void loadRepositories(source);
  }, [
    loading,
    source.provider,
    source.connectionId,
    source.namespace,
    source.project,
    loadRepositories,
  ]);

  const loadBranches = useCallback(async (next: GitMetadataSourceState) => {
    const request = ++branchRequest.current;
    const validationKey = gitBranchRequestKey(next);
    setValidatedBranchKey(null);
    if (!validationKey) {
      setBranches([]);
      setLoadingBranches(false);
      return;
    }
    setLoadingBranches(true);
    setError(null);
    const connection = connections.find((candidate) => candidate.id === next.connectionId);
    const effectiveConnectionId = gitSourceConnectionId(connection);
    const params = new URLSearchParams({
      provider: next.provider,
      repo: next.repo,
    });
    if (effectiveConnectionId) params.set('connectionId', effectiveConnectionId);
    if (next.namespace && next.provider !== 'azure_devops') {
      params.set('namespace', next.namespace);
    }
    if (next.project) params.set('project', next.project);
    if (next.repositoryId) params.set('repositoryId', next.repositoryId);
    try {
      const list = await api<string[]>(`/deployments/branches?${params}`);
      if (request !== branchRequest.current) return;
      setBranches(list);
      setValidatedBranchKey(validationKey);
      setSource((current) => {
        if (current.repo !== next.repo || current.connectionId !== next.connectionId) return current;
        return { ...current, branch: list.includes(current.branch) ? current.branch : list[0] ?? '' };
      });
    } catch (cause) {
      if (request === branchRequest.current) {
        setBranches([]);
        setValidatedBranchKey(null);
        setError(cause instanceof Error ? cause.message : 'Could not load branches.');
      }
    } finally {
      if (request === branchRequest.current) setLoadingBranches(false);
    }
  }, [connections]);

  useEffect(() => {
    void loadBranches(source);
  }, [
    source.provider,
    source.connectionId,
    source.namespace,
    source.project,
    source.repositoryId,
    source.repo,
    loadBranches,
  ]);

  const selectProvider = useCallback((provider: ScmProvider) => {
    const selected = connections.find((connection) => connection.provider === provider);
    setRepositories([]);
    setBranches([]);
    setSource((current) => ({
      ...current,
      provider,
      connectionId: selected?.id ?? '',
      namespace: gitSourceNamespace(selected),
      project: '',
      repositoryId: '',
      repo: '',
      branch: '',
    }));
  }, [connections]);

  const selectConnection = useCallback((connectionId: string) => {
    const selected = connections.find((connection) => connection.id === connectionId);
    setRepositories([]);
    setBranches([]);
    setSource((current) => ({
      ...current,
      provider: (selected?.provider as ScmProvider | undefined) ?? current.provider,
      connectionId,
      namespace: gitSourceNamespace(selected),
      project: '',
      repositoryId: '',
      repo: '',
      branch: '',
    }));
  }, [connections]);

  const selectRepository = useCallback((repositoryId: string) => {
    const repository = repositories.find((item) => item.id === repositoryId);
    setBranches([]);
    setValidatedBranchKey(null);
    setSource((current) => ({
      ...current,
      repositoryId,
      repo:
        current.provider === 'azure_devops'
          ? repository?.name ?? ''
          : repository?.fullName || repository?.name || '',
      branch: repository?.defaultBranch ?? '',
      namespace:
        current.provider === 'azure_devops'
          ? current.namespace
          : repository?.namespace || current.namespace,
      project:
        current.provider === 'azure_devops'
          ? repository?.namespace || current.project
          : current.project,
    }));
  }, [repositories]);

  const connectedProviders = useMemo(
    () => [...new Set(connections.map((connection) => connection.provider as ScmProvider))],
    [connections],
  );

  const gitSource = useMemo<GitSourceConfig | null>(() => {
    if (!source.provider || !source.connectionId || !source.repo || !source.branch) return null;
    if (!isValidatedBranchSelection(
      source,
      branches,
      validatedBranchKey,
      loadingBranches,
    )) return null;
    const connection = connections.find((candidate) => candidate.id === source.connectionId);
    return {
      provider: source.provider,
      connectionId: gitSourceConnectionId(connection),
      namespace: source.namespace || undefined,
      project: source.project || undefined,
      repositoryId: source.repositoryId || undefined,
      repo: source.repo,
      branch: source.branch,
      manifestPath: source.manifestPath || undefined,
    };
  }, [branches, connections, loadingBranches, source, validatedBranchKey]);

  return {
    source,
    setSource,
    connections,
    connectedProviders,
    repositories,
    branches,
    loading,
    loadingRepositories,
    loadingBranches,
    branchSelectionValid: isValidatedBranchSelection(
      source,
      branches,
      validatedBranchKey,
      loadingBranches,
    ),
    error,
    setError,
    selectProvider,
    selectConnection,
    selectRepository,
    reloadRepositories: () => loadRepositories(source),
    reloadBranches: () => loadBranches(source),
    gitSource,
    connected: connectedProviders.length > 0,
  };
}

export type GitMetadataSourceHook = ReturnType<typeof useGitMetadataSource>;
