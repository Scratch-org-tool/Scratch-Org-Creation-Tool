'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import { useJobEventStream } from '@/hooks/use-job-event-stream';
import {
  buildSkipSteps,
  getStepStates,
  isPipelineResumable,
  type AutomationRunView,
  type ConnectedOrgRow,
  type PipelineStepLabel,
  type ScratchOrgFormState,
  type SkipStepKey,
} from '@/components/scratch-org/types';
import {
  clearWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type ScratchOrgWorkspaceSnapshot,
} from './scratch-org-workspace-storage';
import {
  DEFAULT_FORM,
  type AzureDefaults,
  type AzureRepo,
  type AzureStatus,
  type DesktopStep,
  type MobileView,
  type ScratchCredentials,
} from './types';

async function fetchAzureBranches(project: string, repo: string): Promise<string[]> {
  const params = new URLSearchParams({ repo, project });
  return api<string[]>(`/environment/azure-branches?${params.toString()}`);
}

async function loadRepoBranches(
  repoList: AzureRepo[],
  repoName: string,
  projectHint?: string,
): Promise<string[]> {
  const match =
    repoList.find((r) => r.name === repoName) ?? repoList.find((r) => r.id === repoName);
  const project = match?.project ?? projectHint ?? '';
  if (!project || !repoName) return [];
  return fetchAzureBranches(project, match?.name ?? repoName).catch(() => []);
}

function hydrateRunLogs(run: AutomationRunView): string[] {
  return run.jobs?.flatMap((j) => j.logs?.map((l) => l.line) ?? []) ?? [];
}

const AUTO_PIPELINE_STEPS = 5;
const SCRATCH_ORG_PAGE = '/environment-center/create-scratch-org';

function getUrlRunId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('runId');
}

function readEagerSnapshot(): ScratchOrgWorkspaceSnapshot | null {
  if (typeof window === 'undefined') return null;
  return loadWorkspaceSnapshot();
}

function isNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('404') || msg.toLowerCase().includes('not found');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapMetaSubtext(step?: string): string | undefined {
  if (!step) return undefined;
  if (step.includes('Connecting')) return 'Connecting to Azure DevOps…';
  if (step.includes('Fetching')) return 'Fetching repository from Azure…';
  if (step.includes('Deploying')) return 'Deploying metadata to scratch org…';
  if (step.includes('Deployment Completed')) return 'Metadata deployment finished';
  if (step.includes('Assign')) return 'Assigning permission set…';
  return step;
}

function formFromRunConfig(
  run: AutomationRunView,
  fallback: ScratchOrgFormState,
): ScratchOrgFormState {
  const cfg = run.config as Record<string, unknown> | undefined;
  if (!cfg) return fallback;
  const azure = cfg.azureDeploy as
    | { project?: string; repo?: string; branch?: string; manifestPath?: string }
    | undefined;
  const scratchJob = run.jobs?.find((j) => j.type === 'scratch_org_workflow');
  const alias =
    (scratchJob && 'alias' in scratchJob ? (scratchJob as { alias?: string }).alias : undefined) ??
    (cfg.alias as string | undefined);
  return {
    ...fallback,
    alias: alias ?? fallback.alias,
    duration: (cfg.duration as number | undefined) ?? fallback.duration,
    devHubAlias: (cfg.devHubAlias as string | undefined) ?? fallback.devHubAlias,
    template: (cfg.template as string | undefined) ?? fallback.template,
    description: (cfg.description as string | undefined) ?? fallback.description,
    sourceOrgId: (cfg.sourceOrgId as string | undefined) ?? fallback.sourceOrgId,
    templateId: (cfg.templateId as string | undefined) ?? fallback.templateId,
    azureProject: azure?.project ?? fallback.azureProject,
    azureRepo: azure?.repo ?? fallback.azureRepo,
    azureBranch: azure?.branch ?? fallback.azureBranch,
    azureManifestPath: azure?.manifestPath ?? fallback.azureManifestPath,
  };
}

export function useScratchOrgWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTemplateId = searchParams.get('templateId');
  const urlRunId = searchParams.get('runId');

  const eagerSnapshot = useMemo(() => readEagerSnapshot(), []);
  const eagerRunId = getUrlRunId() ?? eagerSnapshot?.automationRunId ?? null;

  const isMountedRef = useRef(true);
  const formRef = useRef<ScratchOrgFormState>({ ...DEFAULT_FORM });
  const terminalHandledRef = useRef<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [orgs, setOrgs] = useState<ConnectedOrgRow[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; isSystem: boolean }>>([]);
  const [sourceOrgs, setSourceOrgs] = useState<Array<{ id: string; alias: string }>>([]);
  const [azureStatus, setAzureStatus] = useState<AzureStatus>({ connected: false });
  const [repos, setRepos] = useState<AzureRepo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [form, setForm] = useState<ScratchOrgFormState>(() =>
    eagerSnapshot?.form ? { ...eagerSnapshot.form } : { ...DEFAULT_FORM },
  );
  const [installPackage, setInstallPackage] = useState(
    () => eagerSnapshot?.installPackage ?? true,
  );
  const [desktopStep, setDesktopStep] = useState<DesktopStep>(
    () => eagerSnapshot?.desktopStep ?? (eagerRunId ? 2 : 0),
  );
  const [wizardStep, setWizardStep] = useState<0 | 1>(() => eagerSnapshot?.wizardStep ?? 0);
  const [mobileView, setMobileView] = useState<MobileView>(
    () => eagerSnapshot?.mobileView ?? (eagerRunId ? 'progress' : 'wizard'),
  );
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [automationRunId, setAutomationRunId] = useState<string | null>(() => eagerRunId);
  const [run, setRun] = useState<AutomationRunView | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<ScratchCredentials | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    eagerSnapshot?.startedAt ? new Date(eagerSnapshot.startedAt).getTime() : null,
  );
  const [restoredBanner, setRestoredBanner] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [templateMeta, setTemplateMeta] = useState<{
    name: string;
    config: Record<string, unknown>;
  } | null>(null);

  formRef.current = form;

  const jobIds = useMemo(() => run?.jobs?.map((j) => j.id) ?? [], [run?.jobs]);
  const jobIdsKey = jobIds.join(',');

  const isRunning = run?.status === 'running';
  const isPaused = run?.status === 'paused';
  const isCancelled = run?.status === 'cancelled';
  const canResume = isPaused && isPipelineResumable(run?.failedStep);
  const scratchJob = run?.jobs?.find((j) => j.type === 'scratch_org_workflow');
  const skippedSteps = useMemo(() => {
    const s = new Set<SkipStepKey>(['deployMetadata', 'assignPermissions']);
    if (!installPackage) s.add('installPackages');
    return s;
  }, [installPackage]);

  const devHubs = useMemo(
    () => orgs.filter((o) => o.isDevHub || o.orgType === 'Dev Hub'),
    [orgs],
  );

  const syncRunIdInUrl = useCallback(
    (runId: string | null) => {
      const params = new URLSearchParams();
      const templateId = urlTemplateId ?? formRef.current.templateId;
      if (templateId) params.set('templateId', templateId);
      if (runId) params.set('runId', runId);
      const qs = params.toString();
      router.replace(qs ? `${SCRATCH_ORG_PAGE}?${qs}` : SCRATCH_ORG_PAGE, { scroll: false });
    },
    [router, urlTemplateId],
  );

  const persistSnapshot = useCallback(
    (overrides?: Partial<{
      automationRunId: string | null;
      form: ScratchOrgFormState;
      installPackage: boolean;
      desktopStep: DesktopStep;
      wizardStep: 0 | 1;
      mobileView: MobileView;
      startedAt: number | null;
    }>) => {
      const id = overrides?.automationRunId ?? automationRunId;
      if (!id) return;
      saveWorkspaceSnapshot({
        automationRunId: id,
        form: overrides?.form ?? formRef.current,
        installPackage: overrides?.installPackage ?? installPackage,
        desktopStep: overrides?.desktopStep ?? desktopStep,
        wizardStep: overrides?.wizardStep ?? wizardStep,
        mobileView: overrides?.mobileView ?? mobileView,
        startedAt: new Date(overrides?.startedAt ?? startedAt ?? Date.now()).toISOString(),
      });
    },
    [automationRunId, installPackage, desktopStep, wizardStep, mobileView, startedAt],
  );

  const loadDefaults = useCallback(async () => {
    const defaults = await api<AzureDefaults>('/environment/azure-defaults');
    setForm((f) => ({
      ...f,
      template: 'config/project-scratch-def.json',
      azureManifestPath: defaults.manifestPath ?? f.azureManifestPath,
    }));
    if (azureStatus.connected && repos.length) {
      const preferred =
        repos.find((r) => r.name === defaults.repo) ??
        repos.find((r) => defaults.repo && r.id === defaults.repo) ??
        repos[0];
      if (preferred) {
        const branchList = await loadRepoBranches(repos, preferred.name, preferred.project);
        setBranches(branchList);
        setForm((f) => ({
          ...f,
          azureProject: preferred.project || f.azureProject,
          azureRepo: preferred.name,
          azureBranch:
            branchList.find((b) => b === defaults.branch) ?? branchList[0] ?? defaults.branch ?? '',
          azureManifestPath: defaults.manifestPath ?? f.azureManifestPath,
        }));
      }
    }
  }, [azureStatus.connected, repos]);

  const refreshRun = useCallback(async (runId: string) => {
    const r = await api<AutomationRunView>(`/environment/automation-runs/${runId}`);
    if (!isMountedRef.current) return r;
    setRun(r);
    const persisted = hydrateRunLogs(r);
    setLogs((prev) => {
      if (persisted.length >= prev.length) return persisted.slice(-500);
      return prev;
    });
    return r;
  }, []);

  const refreshRunWithRetry = useCallback(
    async (runId: string) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await refreshRun(runId);
        } catch (err) {
          lastError = err;
          if (isNotFoundError(err)) throw err;
          if (attempt < 2) await sleep(400 * (attempt + 1));
        }
      }
      throw lastError;
    },
    [refreshRun],
  );

  const hydrateRunState = useCallback(
    async (r: AutomationRunView, opts?: { fromRestore?: boolean; alias?: string }) => {
      if (!isMountedRef.current) return;

      const alias = opts?.alias ?? formRef.current.alias;
      const runId = r.id;

      if (r.status === 'running' || r.status === 'paused') {
        setDesktopStep(2);
        setMobileView('progress');
        syncRunIdInUrl(runId);
        if (opts?.fromRestore) {
          setRestoredBanner(
            `Resumed pipeline RUN-${runId.slice(0, 8).toUpperCase()} — status: ${r.status}`,
          );
        }
        persistSnapshot({
          automationRunId: runId,
          desktopStep: 2,
          mobileView: 'progress',
        });
        return;
      }

      if (r.status === 'completed') {
        const terminalKey = `${runId}:completed`;
        if (terminalHandledRef.current === terminalKey) return;
        terminalHandledRef.current = terminalKey;

        setDesktopStep(2);
        const awaitingUser = r.checkpoint?.awaitingUserActions;
        if (awaitingUser) {
          setMobileView('progress');
          syncRunIdInUrl(runId);
          persistSnapshot({
            automationRunId: runId,
            desktopStep: 2,
            mobileView: 'progress',
          });
          return;
        }

        if (alias) {
          try {
            const creds = await api<ScratchCredentials>(
              `/environment/scratch-orgs/${encodeURIComponent(alias)}/credentials`,
            );
            if (isMountedRef.current) {
              setCredentials(creds);
              setMobileView('success');
            }
          } catch {
            /* credentials may not be ready yet */
          }
        }

        if (isMountedRef.current) {
          clearWorkspaceSnapshot();
          syncRunIdInUrl(null);
        }
        return;
      }

      if (r.status === 'cancelled') {
        const terminalKey = `${runId}:cancelled`;
        if (terminalHandledRef.current === terminalKey) return;
        terminalHandledRef.current = terminalKey;

        if (isMountedRef.current) {
          clearWorkspaceSnapshot();
          syncRunIdInUrl(null);
        }
      }
    },
    [persistSnapshot, syncRunIdInUrl],
  );

  const restoreRun = useCallback(
    async (runId: string, snapshot?: ScratchOrgWorkspaceSnapshot | null) => {
      if (snapshot) {
        setForm(snapshot.form);
        setInstallPackage(snapshot.installPackage);
        setDesktopStep(snapshot.desktopStep);
        setWizardStep(snapshot.wizardStep);
        setMobileView(snapshot.mobileView);
        setStartedAt(new Date(snapshot.startedAt).getTime());
      }

      setAutomationRunId(runId);
      syncRunIdInUrl(runId);

      try {
        const r = await refreshRunWithRetry(runId);
        if (!snapshot) {
          setForm((f) => formFromRunConfig(r, f));
        }
        await hydrateRunState(r, { fromRestore: true, alias: formRef.current.alias });
      } catch (err) {
        if (isNotFoundError(err)) {
          if (isMountedRef.current) {
            clearWorkspaceSnapshot();
            setAutomationRunId(null);
            setRun(null);
            syncRunIdInUrl(null);
          }
        }
      }
    },
    [hydrateRunState, refreshRunWithRetry, syncRunIdInUrl],
  );

  const loadInitial = useCallback(async () => {
    const [hubList, azure, defaults, templateList, allOrgs] = await Promise.all([
      api<ConnectedOrgRow[]>('/environment/connected-orgs/refresh', { method: 'POST' }).catch(
        () => api<ConnectedOrgRow[]>('/environment/connected-orgs'),
      ),
      api<AzureStatus>('/environment/azure-connection').catch(() => ({ connected: false })),
      api<AzureDefaults>('/environment/azure-defaults'),
      api<Array<{ id: string; name: string; isSystem: boolean }>>('/environment/scratch-templates').catch(() => []),
      fetchOrgsList().catch(() => []),
    ]);
    if (!isMountedRef.current) return;

    setOrgs(hubList);
    setTemplates(templateList);
    setSourceOrgs(allOrgs);
    setAzureStatus(azure);
    const hubs = hubList.filter((o) => o.isDevHub || o.orgType === 'Dev Hub');
    const azureProject = ('project' in azure ? azure.project : null) ?? defaults.project ?? '';
    setForm((f) => ({
      ...f,
      devHubAlias: hubs.find((h) => h.isDefaultDevHub)?.alias ?? hubs[0]?.alias ?? f.devHubAlias,
      azureProject,
      templateId:
        urlTemplateId ??
        templateList.find((t) => t.isSystem)?.id ??
        f.templateId,
    }));

    if (azure.connected) {
      const repoList = await api<AzureRepo[]>('/environment/azure-repos').catch(() => []);
      if (!isMountedRef.current) return;
      setRepos(repoList);
      const preferred =
        repoList.find((r) => r.name === defaults.repo) ??
        repoList.find((r) => defaults.repo && r.id === defaults.repo) ??
        repoList[0];
      if (preferred) {
        const branchList = await loadRepoBranches(repoList, preferred.name, preferred.project);
        if (!isMountedRef.current) return;
        setBranches(branchList);
        setForm((f) => ({
          ...f,
          azureProject: preferred.project || azureProject,
          azureRepo: preferred.name,
          azureBranch:
            branchList.find((b) => b === defaults.branch) ?? branchList[0] ?? defaults.branch ?? '',
          azureManifestPath: defaults.manifestPath ?? f.azureManifestPath,
        }));
      }
    }

    const snapshot = loadWorkspaceSnapshot();
    const resolvedRunId = urlRunId ?? snapshot?.automationRunId ?? null;

    if (resolvedRunId) {
      await restoreRun(resolvedRunId, snapshot?.automationRunId === resolvedRunId ? snapshot : null);
    } else {
      try {
        const active = await api<{ automationRunId: string | null }>(
          '/environment/automation-runs/active?intent=scratch_org_pipeline',
        );
        if (!isMountedRef.current) return;
        if (active.automationRunId) {
          await restoreRun(active.automationRunId);
        }
      } catch {
        /* no active run */
      }
    }

    if (isMountedRef.current) setInitialLoading(false);
  }, [restoreRun, urlRunId, urlTemplateId]);

  useEffect(() => {
    isMountedRef.current = true;
    loadInitial().catch(() => {
      if (isMountedRef.current) setInitialLoading(false);
    });
    return () => {
      isMountedRef.current = false;
    };
  }, [loadInitial]);

  useEffect(() => {
    if (!form.templateId) {
      setTemplateMeta(null);
      return;
    }
    let cancelled = false;
    api<{ name: string; config: Record<string, unknown> }>(
      `/environment/scratch-templates/${form.templateId}`,
    )
      .then((t) => {
        if (cancelled) return;
        setTemplateMeta({ name: t.name, config: t.config });
        const cfg = t.config;
        const azureCfg = cfg.azureDeploy as { manifestPath?: string } | undefined;
        setForm((f) => ({
          ...f,
          duration: (cfg.duration as number | undefined) ?? f.duration,
          template: (cfg.template as string | undefined) ?? f.template,
          sourceOrgId: (cfg.sourceOrgId as string | undefined) || f.sourceOrgId,
          azureManifestPath: azureCfg?.manifestPath ?? f.azureManifestPath,
        }));
        if (typeof cfg.installPackage === 'boolean') setInstallPackage(cfg.installPackage);
      })
      .catch(() => {
        if (!cancelled) setTemplateMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.templateId]);

  useEffect(() => {
    if (!automationRunId) return;
    if (!['running', 'paused'].includes(run?.status ?? '')) return;
    persistSnapshot();
  }, [automationRunId, desktopStep, mobileView, run?.status, persistSnapshot]);

  useEffect(() => {
    if (!isRunning || !startedAt) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning, startedAt]);

  const elapsedMs = isRunning && startedAt ? Date.now() - startedAt : null;

  const progressPercent = useMemo(() => {
    const completed = run?.checkpoint?.completedSteps?.length ?? 0;
    if (run?.status === 'completed') return 100;
    if (isRunning) {
      const base = Math.round((completed / AUTO_PIPELINE_STEPS) * 100);
      return Math.min(95, base + (scratchJob?.status === 'running' ? 5 : 0));
    }
    return completed > 0 ? Math.round((completed / AUTO_PIPELINE_STEPS) * 100) : 0;
  }, [run, isRunning, scratchJob?.status]);

  useEffect(() => {
    if (!automationRunId) return;
    if (run?.status && ['completed', 'cancelled'].includes(run.status)) {
      void hydrateRunState(run, { alias: formRef.current.alias });
      return;
    }

    const poll = setInterval(async () => {
      try {
        const r = await refreshRun(automationRunId);
        if (!isMountedRef.current) return;
        if (['completed', 'cancelled', 'paused'].includes(r.status)) {
          await hydrateRunState(r, { alias: formRef.current.alias });
        }
      } catch {
        /* transient poll failure */
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [automationRunId, hydrateRunState, refreshRun, run?.status]);

  const streamEnabled = !!automationRunId && run?.status === 'running';

  const { connectionState: streamState } = useJobEventStream({
    enabled: streamEnabled,
    jobIds,
    automationRunId,
    onLog: (line) => {
      if (!isMountedRef.current) return;
      setLogs((prev) => [...prev.slice(-499), line]);
    },
    onRunStatus: (payload) => {
      if (
        payload.status === 'paused' ||
        payload.status === 'cancelled' ||
        payload.status === 'completed'
      ) {
        if (automationRunId && isMountedRef.current) {
          void refreshRun(automationRunId).then((r) =>
            hydrateRunState(r, { alias: formRef.current.alias }),
          );
        }
      }
    },
  });

  void jobIdsKey;

  const canLaunch =
    !!form.alias &&
    !!form.devHubAlias &&
    azureStatus.connected &&
    !!form.azureRepo &&
    !!form.azureBranch;

  const launchPipeline = async () => {
    setSubmitting(true);
    setLogs([]);
    setCredentials(null);
    setRestoredBanner(null);
    const now = Date.now();
    setStartedAt(now);
    try {
      let payload: Record<string, unknown> = {
        alias: form.alias,
        duration: form.duration,
        devHubAlias: form.devHubAlias,
        template: form.template,
        definitionFile: form.template,
        description: form.description || undefined,
        sourceOrgId: form.sourceOrgId || undefined,
        templateId: form.templateId || undefined,
        azureDeploy: {
          project: form.azureProject || undefined,
          repo: form.azureRepo,
          branch: form.azureBranch,
          manifestPath: form.azureManifestPath || undefined,
        },
        skipSteps: buildSkipSteps({ installPackage }),
      };

      if (form.templateId) {
        const tmpl = await api<{ config: Record<string, unknown> }>(
          `/environment/scratch-templates/${form.templateId}`,
        );
        const cfg = tmpl.config;
        const tmplAzure = cfg.azureDeploy as { manifestPath?: string } | undefined;
        payload = {
          ...cfg,
          alias: form.alias,
          duration: form.duration,
          devHubAlias: form.devHubAlias,
          description: form.description || undefined,
          template: (cfg.template as string) ?? form.template,
          definitionFile: (cfg.template as string) ?? form.template,
          sourceOrgId: form.sourceOrgId || (cfg.sourceOrgId as string) || undefined,
          templateId: form.templateId,
          azureDeploy: {
            project: form.azureProject || undefined,
            repo: form.azureRepo,
            branch: form.azureBranch,
            manifestPath:
              form.azureManifestPath || tmplAzure?.manifestPath || undefined,
          },
          skipSteps: buildSkipSteps({
            installPackage: (cfg.installPackage as boolean | undefined) ?? installPackage,
          }),
        };
      }

      const res = await api<{ automationRunId: string }>('/environment/scratch-org/pipeline', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAutomationRunId(res.automationRunId);
      setRun({ id: res.automationRunId, status: 'running', jobs: [] });
      setMobileView('progress');
      setDesktopStep(2);
      syncRunIdInUrl(res.automationRunId);
      saveWorkspaceSnapshot({
        automationRunId: res.automationRunId,
        form,
        installPackage,
        desktopStep: 2,
        wizardStep,
        mobileView: 'progress',
        startedAt: new Date(now).toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRun = async () => {
    if (!automationRunId) return;
    setStopping(true);
    try {
      await api(`/environment/automation-runs/${automationRunId}/cancel`, { method: 'POST' });
      const r = await refreshRun(automationRunId);
      await hydrateRunState(r, { alias: formRef.current.alias });
    } finally {
      setStopping(false);
    }
  };

  const resumeRun = async () => {
    if (!automationRunId || !canResume) return;
    setResuming(true);
    setRestoredBanner(null);
    const now = Date.now();
    setStartedAt(now);
    try {
      await api(`/environment/automation-runs/${automationRunId}/resume`, {
        method: 'POST',
        body: JSON.stringify({
          azureDeploy: {
            repo: form.azureRepo || undefined,
            branch: form.azureBranch || undefined,
            project: form.azureProject || undefined,
          },
        }),
      });
      await refreshRun(automationRunId);
      persistSnapshot({ startedAt: now });
    } finally {
      setResuming(false);
    }
  };

  const resetForm = () => {
    clearWorkspaceSnapshot();
    syncRunIdInUrl(null);
    setForm((f) => ({
      ...DEFAULT_FORM,
      devHubAlias: f.devHubAlias,
      azureProject: f.azureProject,
      azureRepo: f.azureRepo,
      azureBranch: f.azureBranch,
    }));
    setInstallPackage(true);
    setWizardStep(0);
    setDesktopStep(0);
    setAutomationRunId(null);
    setRun(null);
    setLogs([]);
    setCredentials(null);
    setMobileView('wizard');
    setStartedAt(null);
    setRestoredBanner(null);
    terminalHandledRef.current = null;
  };

  const selectDevHub = (alias: string) => {
    setForm((f) => ({ ...f, devHubAlias: alias }));
  };

  const onRepoChange = async (repoName: string) => {
    const selected = repos.find((r) => r.name === repoName);
    const project = selected?.project ?? form.azureProject;
    setForm({ ...form, azureRepo: repoName, azureProject: project, azureBranch: '' });
    const b = await loadRepoBranches(repos, repoName, project);
    setBranches(b);
    if (b[0]) setForm((f) => ({ ...f, azureBranch: b[0] }));
  };

  const activeSubtext = useMemo(() => {
    const step = scratchJob?.currentStep ?? '';
    if (step.includes('Install')) return 'Installing Error Logger Package…';
    if (step.includes('Create')) return 'Creating scratch org via Dev Hub…';
    if (step.includes('Password')) return 'Generating login password…';
    if (step.includes('Retrieve')) return 'Retrieving org details…';
    const meta = run?.jobs?.find((j) => j.type === 'pipeline_metadata_deploy');
    const metaText = mapMetaSubtext(meta?.currentStep);
    if (metaText) return metaText;
    return undefined;
  }, [scratchJob?.currentStep, run?.jobs]);

  const getState = (label: PipelineStepLabel) =>
    getStepStates(label, {
      run,
      scratchJobStep: scratchJob?.currentStep,
      skippedSteps,
      azureConnected: azureStatus.connected,
    });

  void tick;

  return {
    router,
    initialLoading,
    orgs,
    devHubs,
    templates,
    templateMeta,
    sourceOrgs,
    azureStatus,
    repos,
    branches,
    form,
    setForm,
    installPackage,
    setInstallPackage,
    desktopStep,
    setDesktopStep,
    wizardStep,
    setWizardStep,
    mobileView,
    setMobileView,
    submitting,
    stopping,
    resuming,
    automationRunId,
    run,
    logs,
    setLogs,
    credentials,
    logsExpanded,
    setLogsExpanded,
    isRunning,
    isPaused,
    isCancelled,
    canResume,
    canLaunch,
    launchPipeline,
    cancelRun,
    resumeRun,
    resetForm,
    loadDefaults,
    selectDevHub,
    onRepoChange,
    activeSubtext,
    getState,
    refreshRun,
    elapsedMs,
    progressPercent,
    streamState,
    restoredBanner,
  };
}
