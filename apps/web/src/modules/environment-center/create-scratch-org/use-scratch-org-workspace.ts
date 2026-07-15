'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import { useJobEventStream } from '@/hooks/use-job-event-stream';
import { useGitMetadataSource } from '@/modules/source-control/use-git-metadata-source';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';
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
import { sessionRequest } from './session-request';
import {
  DEFAULT_FORM,
  type AzureDefaults,
  type AzureRepo,
  type AzureStatus,
  type DesktopStep,
  type MobileView,
  type ScratchCredentials,
} from './types';
import { resolveTemplateV2Preview } from './template-v2-runtime';

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
  if (step.includes('Connecting')) return 'Connecting to source control…';
  if (step.includes('Fetching')) return 'Fetching metadata repository…';
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
  const git = cfg.gitSource as
    | {
        provider?: ScratchOrgFormState['gitProvider'];
        connectionId?: string;
        namespace?: string;
        project?: string;
        repositoryId?: string;
        repo?: string;
        branch?: string;
        manifestPath?: string;
      }
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
    dataDeploymentOrgId:
      (cfg.dataDeploymentOrgId as string | undefined)
      ?? (cfg.sourceOrgId as string | undefined)
      ?? fallback.dataDeploymentOrgId,
    customSettingsOrgId:
      (cfg.customSettingsOrgId as string | undefined)
      ?? fallback.customSettingsOrgId,
    runtimeEmailPool: fallback.runtimeEmailPool,
    templateId: (cfg.templateId as string | undefined) ?? fallback.templateId,
    gitProvider: git?.provider ?? (azure ? 'azure_devops' : fallback.gitProvider),
    gitConnectionId: git?.connectionId ?? fallback.gitConnectionId,
    gitNamespace: git?.namespace ?? git?.project ?? azure?.project ?? fallback.gitNamespace,
    gitRepositoryId: git?.repositoryId ?? fallback.gitRepositoryId,
    azureProject: git?.project ?? git?.namespace ?? azure?.project ?? fallback.azureProject,
    azureRepo: git?.repo ?? azure?.repo ?? fallback.azureRepo,
    azureBranch: git?.branch ?? azure?.branch ?? fallback.azureBranch,
    azureManifestPath: git?.manifestPath ?? azure?.manifestPath ?? fallback.azureManifestPath,
  };
}

export function useScratchOrgWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTemplateId = searchParams.get('templateId');
  const urlRunId = searchParams.get('runId');

  const eagerSnapshot = useMemo(() => readEagerSnapshot(), []);
  const eagerRunId = getUrlRunId() ?? eagerSnapshot?.automationRunId ?? null;
  const metadataSource = useGitMetadataSource({
    defaultManifestPath: eagerSnapshot?.form.azureManifestPath ?? DEFAULT_FORM.azureManifestPath,
    initial: eagerSnapshot?.form
      ? {
          provider: eagerSnapshot.form.gitProvider || undefined,
          connectionId: eagerSnapshot.form.gitConnectionId || undefined,
          namespace: eagerSnapshot.form.gitNamespace || undefined,
          project: eagerSnapshot.form.azureProject || undefined,
          repositoryId: eagerSnapshot.form.gitRepositoryId || undefined,
          repo: eagerSnapshot.form.azureRepo || undefined,
          branch: eagerSnapshot.form.azureBranch || undefined,
          manifestPath: eagerSnapshot.form.azureManifestPath || undefined,
        }
      : undefined,
  });

  const isMountedRef = useRef(true);
  const bootstrapGenerationRef = useRef(0);
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
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [templateMeta, setTemplateMeta] = useState<{
    name: string;
    config: ScratchPipelineTemplateConfig;
  } | null>(null);

  formRef.current = form;

  useEffect(() => {
    const selected = metadataSource.source;
    setForm((current) => {
      if (
        current.gitProvider === selected.provider &&
        current.gitConnectionId === selected.connectionId &&
        current.gitNamespace === selected.namespace &&
        current.gitRepositoryId === selected.repositoryId &&
        current.azureProject === selected.project &&
        current.azureRepo === selected.repo &&
        current.azureBranch === selected.branch &&
        current.azureManifestPath === selected.manifestPath
      ) return current;
      return {
        ...current,
        gitProvider: selected.provider,
        gitConnectionId: selected.connectionId,
        gitNamespace: selected.namespace,
        gitRepositoryId: selected.repositoryId,
        azureProject: selected.project,
        azureRepo: selected.repo,
        azureBranch: selected.branch,
        azureManifestPath: selected.manifestPath,
      };
    });
  }, [metadataSource.source]);

  useEffect(() => {
    setAzureStatus({ connected: metadataSource.connected });
  }, [metadataSource.connected]);

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
    setForm((current) => ({ ...current, template: 'config/project-scratch-def.json' }));
    await metadataSource.reloadRepositories();
  }, [metadataSource]);

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
        return;
      }

      if (r.status === 'failed') {
        const terminalKey = `${runId}:failed`;
        if (terminalHandledRef.current === terminalKey) return;
        terminalHandledRef.current = terminalKey;
        setDesktopStep(2);
        setMobileView('progress');
        setRestoredBanner(
          `Pipeline failed${r.failedStep ? ` at ${r.failedStep}` : ''}. Review the job error and logs below.`,
        );
        persistSnapshot({
          automationRunId: runId,
          desktopStep: 2,
          mobileView: 'progress',
        });
      }
    },
    [persistSnapshot, syncRunIdInUrl],
  );

  const restoreRun = useCallback(
    async (
      runId: string,
      snapshot?: ScratchOrgWorkspaceSnapshot | null,
      isCurrent: () => boolean = () => isMountedRef.current,
    ) => {
      if (!isCurrent()) return;
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
        if (!isCurrent()) return;
        if (!snapshot) {
          setForm((f) => formFromRunConfig(r, f));
        }
        await hydrateRunState(r, { fromRestore: true, alias: formRef.current.alias });
      } catch (err) {
        if (isCurrent() && isNotFoundError(err)) {
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

  const loadInitial = useCallback(async (generation: number, signal: AbortSignal) => {
    const isCurrent = () =>
      isMountedRef.current &&
      bootstrapGenerationRef.current === generation &&
      !signal.aborted;
    const [hubList, templateList, allOrgs] = await Promise.all([
      sessionRequest('scratch-bootstrap-connected-orgs', () =>
        api<ConnectedOrgRow[]>('/environment/connected-orgs/refresh', {
          method: 'POST',
        }).catch(
          () => api<ConnectedOrgRow[]>('/environment/connected-orgs'),
        ),
      ),
      api<Array<{ id: string; name: string; isSystem: boolean }>>(
        '/environment/scratch-templates',
        { signal },
      ).catch(() => []),
      fetchOrgsList({ signal }).catch(() => []),
    ]);
    if (!isCurrent()) return;

    setOrgs(hubList);
    setTemplates(templateList);
    setSourceOrgs(allOrgs);
    const hubs = hubList.filter((o) => o.isDevHub || o.orgType === 'Dev Hub');
    setForm((f) => ({
      ...f,
      devHubAlias: hubs.find((h) => h.isDefaultDevHub)?.alias ?? hubs[0]?.alias ?? f.devHubAlias,
      templateId:
        urlTemplateId ??
        templateList.find((t) => t.isSystem)?.id ??
        f.templateId,
    }));

    const snapshot = loadWorkspaceSnapshot();
    const resolvedRunId = urlRunId ?? snapshot?.automationRunId ?? null;

    if (resolvedRunId) {
      if (!isCurrent()) return;
      await restoreRun(
        resolvedRunId,
        snapshot?.automationRunId === resolvedRunId ? snapshot : null,
        isCurrent,
      );
    } else {
      try {
        const active = await api<{ automationRunId: string | null }>(
          '/environment/automation-runs/active?intent=scratch_org_pipeline',
          { signal },
        );
        if (!isCurrent()) return;
        if (active.automationRunId) {
          await restoreRun(active.automationRunId, null, isCurrent);
        }
      } catch {
        /* no active run */
      }
    }

    if (isCurrent()) setInitialLoading(false);
  }, [restoreRun, urlRunId, urlTemplateId]);

  useEffect(() => {
    isMountedRef.current = true;
    const generation = ++bootstrapGenerationRef.current;
    const controller = new AbortController();
    loadInitial(generation, controller.signal).catch(() => {
      if (
        isMountedRef.current &&
        bootstrapGenerationRef.current === generation &&
        !controller.signal.aborted
      ) {
        setInitialLoading(false);
      }
    });
    return () => {
      isMountedRef.current = false;
      controller.abort();
      if (bootstrapGenerationRef.current === generation) {
        bootstrapGenerationRef.current += 1;
      }
    };
  }, [loadInitial]);

  useEffect(() => {
    if (!form.templateId) {
      setTemplateMeta(null);
      return;
    }
    let cancelled = false;
    api<{ name: string; config: ScratchPipelineTemplateConfig }>(
      `/environment/scratch-templates/${form.templateId}`,
    )
      .then((t) => {
        if (cancelled) return;
        setTemplateMeta({ name: t.name, config: t.config });
        const cfg = t.config;
        const azureCfg = cfg.azureDeploy as { manifestPath?: string } | undefined;
        const gitCfg = cfg.gitSource as {
          provider?: ScratchOrgFormState['gitProvider'];
          connectionId?: string;
          namespace?: string;
          project?: string;
          manifestPath?: string;
        } | undefined;
        const manifestPath = gitCfg?.manifestPath ?? azureCfg?.manifestPath;
        setForm((f) => ({
          ...f,
          duration: (cfg.duration as number | undefined) ?? f.duration,
          template: (cfg.template as string | undefined) ?? f.template,
          sourceOrgId: (cfg.sourceOrgId as string | undefined) || f.sourceOrgId,
          dataDeploymentOrgId: cfg.dataDeploymentOrgId ?? cfg.sourceOrgId ?? f.dataDeploymentOrgId,
          customSettingsOrgId: cfg.customSettingsOrgId ?? cfg.sourceOrgId ?? f.customSettingsOrgId,
          gitProvider: gitCfg?.provider ?? f.gitProvider,
          gitConnectionId: gitCfg?.connectionId ?? f.gitConnectionId,
          gitNamespace: gitCfg?.namespace ?? gitCfg?.project ?? f.gitNamespace,
          azureProject: gitCfg?.project ?? f.azureProject,
          azureManifestPath: manifestPath ?? f.azureManifestPath,
        }));
        if (gitCfg?.provider || manifestPath) {
          metadataSource.setSource((current) => ({
            ...current,
            provider: gitCfg?.provider ?? current.provider,
            connectionId: gitCfg?.connectionId ?? current.connectionId,
            namespace: gitCfg?.namespace ?? current.namespace,
            project: gitCfg?.project ?? current.project,
            manifestPath: manifestPath ?? current.manifestPath,
          }));
        }
        if (typeof cfg.installPackage === 'boolean') setInstallPackage(cfg.installPackage);
      })
      .catch(() => {
        if (!cancelled) setTemplateMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.templateId, metadataSource.setSource]);

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
    if (run?.status && ['completed', 'cancelled', 'failed'].includes(run.status)) {
      void hydrateRunState(run, { alias: formRef.current.alias });
      return;
    }

    const poll = setInterval(async () => {
      try {
        const r = await refreshRun(automationRunId);
        if (!isMountedRef.current) return;
        if (['completed', 'cancelled', 'failed', 'paused'].includes(r.status)) {
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
        payload.status === 'failed' ||
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

  const templatePreview = useMemo(
    () => templateMeta
      ? resolveTemplateV2Preview(templateMeta.config, {
          seed: `launch-${form.alias || 'preview'}`,
          runtimeEmailPool: form.runtimeEmailPool,
        })
      : null,
    [form.alias, form.runtimeEmailPool, templateMeta],
  );

  const canLaunch =
    !!form.alias &&
    !!form.devHubAlias &&
    !!metadataSource.gitSource &&
    (!templatePreview || templatePreview.errors.length === 0);

  const launchPipeline = async () => {
    setSubmitting(true);
    setLogs([]);
    setCredentials(null);
    setRestoredBanner(null);
    setLaunchError(null);
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
        sourceOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
        dataDeploymentOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
        customSettingsOrgId: form.customSettingsOrgId || undefined,
        templateId: form.templateId || undefined,
        gitSource: metadataSource.gitSource,
        skipSteps: buildSkipSteps({ installPackage }),
      };

      if (form.templateId) {
        const tmpl = await api<{ config: ScratchPipelineTemplateConfig }>(
          `/environment/scratch-templates/${form.templateId}`,
        );
        const runtime = resolveTemplateV2Preview(tmpl.config, {
          seed: `launch-${form.alias}`,
          runtimeEmailPool: form.runtimeEmailPool,
        });
        if (runtime.errors.length) throw new Error(runtime.errors.join(' '));
        const cfg = runtime.config;
        const tmplAzure = cfg.azureDeploy as { manifestPath?: string } | undefined;
        const tmplGit = cfg.gitSource as { manifestPath?: string } | undefined;
        const {
          azureDeploy: _legacyAzureDeploy,
          gitSource: _templateGitSource,
          ...templateConfig
        } = cfg;
        payload = {
          ...templateConfig,
          alias: form.alias,
          duration: form.duration,
          devHubAlias: form.devHubAlias,
          description: form.description || undefined,
          template: (cfg.template as string) ?? form.template,
          definitionFile: (cfg.template as string) ?? form.template,
          sourceOrgId:
            form.dataDeploymentOrgId
            || form.sourceOrgId
            || cfg.dataDeploymentOrgId
            || cfg.sourceOrgId
            || undefined,
          dataDeploymentOrgId:
            form.dataDeploymentOrgId
            || form.sourceOrgId
            || cfg.dataDeploymentOrgId
            || cfg.sourceOrgId
            || undefined,
          customSettingsOrgId:
            form.customSettingsOrgId
            || cfg.customSettingsOrgId
            || cfg.sourceOrgId
            || undefined,
          templateId: form.templateId,
          gitSource: metadataSource.gitSource
            ? {
                ...metadataSource.gitSource,
                manifestPath:
                  form.azureManifestPath ||
                  tmplGit?.manifestPath ||
                  tmplAzure?.manifestPath ||
                  undefined,
              }
            : undefined,
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
    } catch (err) {
      setStartedAt(null);
      setLaunchError(err instanceof Error ? err.message : 'Failed to launch scratch org pipeline');
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
          gitSource: metadataSource.gitSource ?? undefined,
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
      sourceControlConnected: metadataSource.connected,
    });

  void tick;

  return {
    router,
    initialLoading,
    orgs,
    devHubs,
    templates,
    templateMeta,
    templatePreview,
    sourceOrgs,
    azureStatus,
    metadataSource,
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
    launchError,
    setLaunchError,
  };
}
