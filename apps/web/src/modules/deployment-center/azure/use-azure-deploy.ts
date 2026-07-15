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
import { useGitMetadataSource } from '@/modules/source-control/use-git-metadata-source';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import type {
  AzureDeployForm,
  DeploymentRow,
  JobData,
  Org,
  TestLevel,
} from './types';
import { ACTIVE_STATUSES, AZURE_LOG_TAIL, TERMINAL_STATUSES } from './types';

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
  history: DeploymentRow[];
}

export function useAzureDeploy() {
  const metadataSource = useGitMetadataSource({
    defaultManifestPath: DEFAULT_AZURE_MANIFEST_PATH,
  });
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [history, setHistory] = useState<DeploymentRow[]>([]);
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
  const [deployError, setDeployError] = useState<string | null>(null);
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
        setHistory(cached.history);
        setLoading(false);
        return;
      }
    }

    const o = await fetchOrgsList();
    setOrgs(o);
    const list = await api<DeploymentRow[]>('/deployments');
    const filteredHistory = list.filter((d) => d.strategy === 'azure');
    setHistory(filteredHistory);
    setSessionCache(AZURE_BOOTSTRAP_KEY, {
      history: filteredHistory,
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

  const deploy = async () => {
    setDeploying(true);
    setDeployError(null);
    setLogs([]);
    setLogStreams([]);
    setLogsTruncated(false);
    setLogCount(null);
    setJobId(null);
    setActiveDeploymentId(null);
    setJobStatus('running');
    setCurrentStep(
      metadataSource.source.provider
        ? `Connecting to ${SCM_PROVIDER_LABELS[metadataSource.source.provider]}`
        : 'Connecting to source control',
    );
    setDeployStartedAt(Date.now());
    try {
      const res = await api<{ deploymentId: string; jobId: string; status: string }>(
        '/deployments/deploy',
        {
          method: 'POST',
          body: JSON.stringify({
            targetOrgId: form.targetOrgId,
            repo: metadataSource.gitSource?.repo,
            branch: metadataSource.gitSource?.branch,
            strategy: 'azure',
            project: metadataSource.gitSource?.project,
            manifestPath: metadataSource.gitSource?.manifestPath,
            gitSource: metadataSource.gitSource,
            testLevel: form.testLevel,
          }),
        },
      );
      setActiveDeploymentId(res.deploymentId);
      setJobId(res.jobId);
      setJobStatus(res.status);
      await loadHistory(true);
    } catch (err) {
      setJobId(null);
      setActiveDeploymentId(null);
      setJobStatus(null);
      setCurrentStep(null);
      setDeployStartedAt(null);
      setLogs([]);
      setLogStreams([]);
      setLogsTruncated(false);
      setLogCount(null);
      const provider = metadataSource.source.provider
        ? SCM_PROVIDER_LABELS[metadataSource.source.provider]
        : 'Source-control provider';
      setDeployError(`${provider}: ${err instanceof Error ? err.message : 'Failed to submit deployment'}`);
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
    !!metadataSource.gitSource &&
    !!form.targetOrgId &&
    !isRunning;

  return {
    loading,
    orgs,
    repos: metadataSource.repositories.map((repository) => ({
      id: repository.id,
      name: repository.fullName || repository.name,
      project: metadataSource.source.project,
    })),
    branches: metadataSource.branches,
    history,
    azureStatus: { connected: metadataSource.connected },
    metadataSource,
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
    deployError,
    setDeployError,
    targetOrgAlias,
    isRunning,
    canDeploy,
    onRepoChange: () => undefined,
    deploy,
    cancelDeploy,
    selectHistory,
    loadHistory,
  };
}

export type AzureDeployState = ReturnType<typeof useAzureDeploy>;
