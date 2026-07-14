'use client';

import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import { api, getStreamUrl } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import {
  getSessionCache,
  hasFreshSessionCache,
  setSessionCache,
} from '@/lib/session-cache';
import { DEFAULT_AZURE_MANIFEST_PATH } from '@sfcc/shared';
import type {
  AzureDefaults,
  AzureDeployForm,
  AzureRepo,
  AzureStatus,
  DeploymentRow,
  JobData,
  Org,
  TestLevel,
} from './types';
import { ACTIVE_STATUSES, AZURE_LOG_TAIL, TERMINAL_STATUSES } from './types';

async function fetchAzureBranches(project: string, repo: string): Promise<string[]> {
  const params = new URLSearchParams({ repo, project });
  return api<string[]>(`/environment/azure-branches?${params.toString()}`);
}

function capLogs(lines: string[], streams: string[]) {
  return {
    lines: lines.slice(-AZURE_LOG_TAIL),
    streams: streams.slice(-AZURE_LOG_TAIL),
  };
}

const DEFAULT_FORM: AzureDeployForm = {
  targetOrgId: '',
  repo: '',
  branch: '',
  project: '',
  manifestPath: DEFAULT_AZURE_MANIFEST_PATH,
  testLevel: 'NoTestRun',
};

const AZURE_BOOTSTRAP_KEY = 'azure:deploy-bootstrap';

interface AzureBootstrapCache {
  azureStatus: AzureStatus;
  repos: AzureRepo[];
  history: DeploymentRow[];
  branches: string[];
  formPatch: Pick<AzureDeployForm, 'manifestPath' | 'project' | 'repo' | 'branch'>;
}

export function useAzureDeploy() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [repos, setRepos] = useState<AzureRepo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [history, setHistory] = useState<DeploymentRow[]>([]);
  const [azureStatus, setAzureStatus] = useState<AzureStatus>({ connected: false });
  const [form, setForm] = useState<AzureDeployForm>(DEFAULT_FORM);
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [selectingDeploymentId, setSelectingDeploymentId] = useState<string | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logStreams, setLogStreams] = useState<string[]>([]);
  const [logsTruncated, setLogsTruncated] = useState(false);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [deployStartedAt, setDeployStartedAt] = useState<number | null>(null);
  const selectTokenRef = useRef(0);

  const loadHistory = useCallback(async (force = false) => {
    if (!force && hasFreshSessionCache(AZURE_BOOTSTRAP_KEY)) {
      const cached = getSessionCache<AzureBootstrapCache>(AZURE_BOOTSTRAP_KEY);
      if (cached) {
        setHistory(cached.history);
        return;
      }
    }
    const list = await api<DeploymentRow[]>('/deployments');
    const filtered = list.filter((d) => d.strategy === 'azure');
    setHistory(filtered);
    const cached = getSessionCache<AzureBootstrapCache>(AZURE_BOOTSTRAP_KEY);
    if (cached) {
      setSessionCache(AZURE_BOOTSTRAP_KEY, { ...cached, history: filtered });
    }
  }, []);

  const applyJobData = useCallback((data: JobData) => {
    const lines = data.logs?.map((l) => l.line) ?? [];
    const streams = data.logs?.map((l) => l.stream ?? 'stdout') ?? [];
    const capped = capLogs(lines, streams);
    setJobStatus(data.status);
    setCurrentStep(data.currentStep ?? null);
    setLogs(capped.lines);
    setLogStreams(capped.streams);
    setLogsTruncated(Boolean(data.logsTruncated) || lines.length > AZURE_LOG_TAIL);
    setLogCount(data.logCount ?? lines.length);
  }, []);

  const loadInitial = useCallback(async () => {
    if (hasFreshSessionCache(AZURE_BOOTSTRAP_KEY)) {
      const cached = getSessionCache<AzureBootstrapCache>(AZURE_BOOTSTRAP_KEY);
      if (cached) {
        const o = await fetchOrgsList();
        setOrgs(o);
        setAzureStatus(cached.azureStatus);
        setRepos(cached.repos);
        setBranches(cached.branches);
        setHistory(cached.history);
        setForm((f) => ({ ...f, ...cached.formPatch }));
        setLoading(false);
        return;
      }
    }

    const [o, azure, defaults, repoList] = await Promise.all([
      fetchOrgsList(),
      api<AzureStatus>('/environment/azure-connection').catch(() => ({ connected: false })),
      api<AzureDefaults>('/environment/azure-defaults').catch(() => ({ manifestPath: DEFAULT_AZURE_MANIFEST_PATH })),
      api<AzureRepo[]>('/environment/azure-repos').catch(() => []),
    ]);
    setOrgs(o);
    setAzureStatus(azure);
    setRepos(repoList);
    const azureProject =
      ('project' in azure ? azure.project : null) ?? ('project' in defaults ? defaults.project : null) ?? '';
    let branches: string[] = [];
    let formPatch: AzureBootstrapCache['formPatch'] = {
      manifestPath: defaults.manifestPath || DEFAULT_FORM.manifestPath,
      project: azureProject || DEFAULT_FORM.project,
      repo: DEFAULT_FORM.repo,
      branch: DEFAULT_FORM.branch,
    };
    setForm((f) => ({
      ...f,
      manifestPath: formPatch.manifestPath,
      project: formPatch.project || f.project,
    }));
    if (repoList[0]) {
      const defaultRepo = 'repo' in defaults ? defaults.repo : undefined;
      const defaultBranch = 'branch' in defaults ? defaults.branch : undefined;
      const preferred =
        (defaultRepo ? repoList.find((r) => r.name === defaultRepo) : null) ?? repoList[0];
      const b = await fetchAzureBranches(preferred.project, preferred.name).catch(() => []);
      branches = b;
      formPatch = {
        ...formPatch,
        repo: preferred.name,
        project: preferred.project,
        branch: (defaultBranch ? b.find((x) => x === defaultBranch) : null) ?? b[0] ?? '',
      };
      setBranches(b);
      setForm((f) => ({
        ...f,
        repo: formPatch.repo,
        project: formPatch.project,
        branch: formPatch.branch,
      }));
    }
    const list = await api<DeploymentRow[]>('/deployments');
    const filteredHistory = list.filter((d) => d.strategy === 'azure');
    setHistory(filteredHistory);
    setSessionCache(AZURE_BOOTSTRAP_KEY, {
      azureStatus: azure,
      repos: repoList,
      history: filteredHistory,
      branches,
      formPatch,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInitial().catch(() => setLoading(false));
  }, [loadInitial]);

  const refreshJob = useCallback(async (jid: string) => {
    const data = await api<JobData>(`/jobs/${jid}`);
    startTransition(() => applyJobData(data));
    return data;
  }, [applyJobData]);

  useEffect(() => {
    if (!jobId) return;
    if (jobStatus && TERMINAL_STATUSES.includes(jobStatus)) return;

    const poll = setInterval(() => {
      refreshJob(jobId)
        .then((data) => {
          if (TERMINAL_STATUSES.includes(data.status)) void loadHistory(true);
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId, jobStatus, refreshJob, loadHistory]);

  useEffect(() => {
    if (!jobId) return;
    if (jobStatus && TERMINAL_STATUSES.includes(jobStatus)) {
      setSseConnected(false);
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
            payload: {
              jobId?: string;
              line?: string;
              status?: string;
              currentStep?: string;
              stream?: string;
            };
          };
          if (data.payload.jobId !== jobId) return;
          if (data.type === 'job_log' && data.payload.line) {
            setLogs((l) => [...l, data.payload.line!].slice(-AZURE_LOG_TAIL));
            setLogStreams((s) => [...s, data.payload.stream ?? 'stdout'].slice(-AZURE_LOG_TAIL));
            setLogCount((c) => (c ?? 0) + 1);
          }
          if (data.type === 'job_status') {
            if (data.payload.status) setJobStatus(data.payload.status);
            if (data.payload.currentStep) setCurrentStep(data.payload.currentStep);
            if (data.payload.status && TERMINAL_STATUSES.includes(data.payload.status)) {
              void loadHistory(true);
            }
          }
        } catch { /* ignore */ }
      };
    })();

    return () => {
      cancelled = true;
      setSseConnected(false);
      es?.close();
    };
  }, [jobId, jobStatus, loadHistory]);

  const onRepoChange = async (repoName: string) => {
    const selected = repos.find((r) => r.name === repoName);
    const project = selected?.project ?? '';
    setForm((f) => ({ ...f, repo: repoName, project, branch: '' }));
    const b = await fetchAzureBranches(project, repoName).catch(() => []);
    setBranches(b);
    if (b[0]) setForm((f) => ({ ...f, branch: b[0] }));
  };

  const deploy = async () => {
    setDeploying(true);
    setLogs([]);
    setLogStreams([]);
    setLogsTruncated(false);
    setLogCount(null);
    setJobId(null);
    setJobStatus('running');
    setCurrentStep('Connecting to Azure DevOps');
    setDeployStartedAt(Date.now());
    try {
      const res = await api<{ deploymentId: string; jobId: string; status: string }>(
        '/deployments/deploy',
        {
          method: 'POST',
          body: JSON.stringify({
            targetOrgId: form.targetOrgId,
            repo: form.repo,
            branch: form.branch,
            strategy: 'azure',
            project: form.project || undefined,
            manifestPath: form.manifestPath || undefined,
            testLevel: form.testLevel,
          }),
        },
      );
      setActiveDeploymentId(res.deploymentId);
      setJobId(res.jobId);
      setJobStatus(res.status);
      await loadHistory(true);
    } finally {
      setDeploying(false);
    }
  };

  const cancelDeploy = async () => {
    if (!activeDeploymentId) return;
    setStopping(true);
    try {
      await api(`/deployments/${activeDeploymentId}/cancel`, { method: 'POST' });
      setJobStatus('cancelled');
      await loadHistory(true);
    } finally {
      setStopping(false);
    }
  };

  const selectHistory = useCallback(async (row: DeploymentRow) => {
    const jid = row.jobId ?? row.job?.id;
    if (!jid) return;

    const token = ++selectTokenRef.current;
    setSelectingDeploymentId(row.id);
    setActiveDeploymentId(row.id);
    setJobId(jid);
    setJobStatus(row.status);
    setCurrentStep(row.job?.currentStep ?? null);
    setLogs([]);
    setLogStreams([]);
    setLogsTruncated(false);
    setLogCount(null);
    setDeployStartedAt(null);

    try {
      const data = await refreshJob(jid);
      if (selectTokenRef.current !== token) return;
      if (TERMINAL_STATUSES.includes(data.status)) setSseConnected(false);
    } finally {
      if (selectTokenRef.current === token) setSelectingDeploymentId(null);
    }
  }, [refreshJob]);

  const targetOrgAlias = orgs.find((o) => o.id === form.targetOrgId)?.alias ?? '';
  const isRunning = !!jobStatus && ACTIVE_STATUSES.includes(jobStatus);
  const canDeploy =
    azureStatus.connected &&
    !!form.targetOrgId &&
    !!form.repo &&
    !!form.branch &&
    !isRunning;

  return {
    loading,
    orgs,
    repos,
    branches,
    history,
    azureStatus,
    form,
    setForm,
    deploying,
    stopping,
    selectingDeploymentId,
    activeDeploymentId,
    jobId,
    jobStatus,
    currentStep,
    logs,
    logStreams,
    logsTruncated,
    logCount,
    sseConnected,
    deployStartedAt,
    targetOrgAlias,
    isRunning,
    canDeploy,
    onRepoChange,
    deploy,
    cancelDeploy,
    selectHistory,
    loadHistory,
  };
}

export type AzureDeployState = ReturnType<typeof useAzureDeploy>;
