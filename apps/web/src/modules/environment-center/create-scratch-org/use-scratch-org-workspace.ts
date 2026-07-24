'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/services/api';
import { fetchOrgsList, invalidateOrgsCache } from '@/hooks/use-orgs';
import { useJobEventStream } from '@/hooks/use-job-event-stream';
import { useGitMetadataSource } from '@/modules/source-control/use-git-metadata-source';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import {
  SYSTEM_SCRATCH_TEMPLATE_KEYS,
  pipelineScopeRequiresGitSource,
  resolvePipelineScope,
  type ScratchPipelineTemplateConfig,
} from '@sfcc/shared';
import {
  buildSkipSteps,
  getStepStates,
  isPipelineResumable,
  type AutomationRunView,
  type ConnectedOrgRow,
  type PipelineStepLabel,
  type ExistingOrgOptions,
  type ScratchOrgFormState,
  type ScratchOrgLaunchMode,
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
  DEFAULT_EXISTING_ORG_OPTIONS,
  type AzureDefaults,
  type AzureRepo,
  type AzureStatus,
  type DesktopStep,
  type MobileView,
  type ExistingOrgEligibility,
  type RecentScratchOrgRun,
  type ScratchCredentials,
} from './types';
import {
  buildTemplateV2Preview,
  type ProvisioningPlanMetadata,
  type ResolvedTemplateV2Preview,
} from './template-v2-runtime';
import {
  buildTemplateLaunchRequest,
  canRequestServerLaunchPlan,
  completedRunAlias,
  composeClientTemplateMeta,
  defaultPipelineScopeForMode,
  mergeFormIntoTemplatePreviewConfig,
  formFromRunConfig,
  launchTargetFromRun,
  metadataSourceFromForm,
  retrieveCredentialsWithRetry,
} from './template-v2-workspace-utils';
import {
  buildExistingScratchOrgCandidates,
  modeAliasState,
} from './existing-scratch-org-utils';

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

interface ScratchOrgCatalogRow {
  id: string;
  alias: string;
  username?: string | null;
  orgId?: string | null;
  status: string;
  expirationDate?: string | null;
  devHubAlias?: string | null;
}

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

export function useScratchOrgWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTemplateId = searchParams.get('templateId');
  const urlRunId = searchParams.get('runId');
  const urlMode = searchParams.get('mode');
  const urlExistingOrgConnectionId = searchParams.get('orgConnectionId');

  const storedSnapshot = useMemo(() => readEagerSnapshot(), []);
  const explicitExistingTarget =
    urlMode === 'configure' && Boolean(urlExistingOrgConnectionId) && !urlRunId;
  const eagerSnapshot = explicitExistingTarget ? null : storedSnapshot;
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
  const catalogGenerationRef = useRef(0);
  const templatePreviewGenerationRef = useRef(0);
  const eligibilityGenerationRef = useRef(0);
  const formRef = useRef<ScratchOrgFormState>({ ...DEFAULT_FORM });
  const modeRef = useRef<ScratchOrgLaunchMode>('create_new');
  const existingCandidateAliasesRef = useRef<Map<string, string>>(new Map());
  const createDraftAliasRef = useRef(
    urlMode === 'configure' || eagerSnapshot?.mode === 'configure_existing'
      ? ''
      : eagerSnapshot?.form.alias ?? DEFAULT_FORM.alias,
  );
  const existingOrgConnectionIdRef = useRef('');
  const existingOrgOptionsRef = useRef<ExistingOrgOptions>({
    ...DEFAULT_EXISTING_ORG_OPTIONS,
  });
  const terminalHandledRef = useRef<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [orgs, setOrgs] = useState<ConnectedOrgRow[]>([]);
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    isSystem: boolean;
    systemKey?: string | null;
  }>>([]);
  const [sourceOrgs, setSourceOrgs] = useState<Array<{ id: string; alias: string }>>([]);
  const [azureStatus, setAzureStatus] = useState<AzureStatus>({ connected: false });
  const [repos, setRepos] = useState<AzureRepo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [form, setForm] = useState<ScratchOrgFormState>(() =>
    eagerSnapshot?.form ? { ...eagerSnapshot.form } : { ...DEFAULT_FORM },
  );
  const [mode, setMode] = useState<ScratchOrgLaunchMode>(() =>
    urlMode === 'configure' ? 'configure_existing' : eagerSnapshot?.mode ?? 'create_new',
  );
  const [existingOrgConnectionId, setExistingOrgConnectionId] = useState(
    () => urlExistingOrgConnectionId ?? eagerSnapshot?.existingOrgConnectionId ?? '',
  );
  const [existingOrgOptions, setExistingOrgOptions] = useState<ExistingOrgOptions>(
    () => eagerSnapshot?.existingOrgOptions ?? { ...DEFAULT_EXISTING_ORG_OPTIONS },
  );
  const [scratchOrgs, setScratchOrgs] = useState<ScratchOrgCatalogRow[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentScratchOrgRun[]>([]);
  const [eligibility, setEligibility] = useState<ExistingOrgEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [eligibilityRefresh, setEligibilityRefresh] = useState(0);
  const [destructiveConfirmed, setDestructiveConfirmed] = useState(false);
  const [skipCreateConfirmed, setSkipCreateConfirmed] = useState(false);
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
  const [openingRunId, setOpeningRunId] = useState<string | null>(null);
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
  const [templatePreview, setTemplatePreview] = useState<ResolvedTemplateV2Preview | null>(null);
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);

  formRef.current = form;
  modeRef.current = mode;
  existingOrgConnectionIdRef.current = existingOrgConnectionId;
  existingOrgOptionsRef.current = existingOrgOptions;

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
  const existingCandidates = useMemo(
    () => buildExistingScratchOrgCandidates(scratchOrgs, sourceOrgs, recentRuns),
    [recentRuns, scratchOrgs, sourceOrgs],
  );
  existingCandidateAliasesRef.current = new Map(
    existingCandidates.map((candidate) => [candidate.orgConnectionId, candidate.alias]),
  );

  const syncRunIdInUrl = useCallback(
    (runId: string | null) => {
      const params = new URLSearchParams();
      const templateId = urlTemplateId ?? formRef.current.templateId;
      if (templateId) params.set('templateId', templateId);
      if (modeRef.current === 'configure_existing') {
        params.set('mode', 'configure');
        if (existingOrgConnectionIdRef.current) {
          params.set('orgConnectionId', existingOrgConnectionIdRef.current);
        }
      }
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
      mode: ScratchOrgLaunchMode;
      existingOrgConnectionId: string;
      existingOrgOptions: ExistingOrgOptions;
    }>) => {
      const id = overrides?.automationRunId ?? automationRunId;
      if (!id) return;
      saveWorkspaceSnapshot({
        automationRunId: id,
        form: overrides?.form ?? formRef.current,
        installPackage: overrides?.installPackage ?? installPackage,
        mode: overrides?.mode ?? modeRef.current,
        existingOrgConnectionId:
          overrides?.existingOrgConnectionId ?? existingOrgConnectionIdRef.current,
        existingOrgOptions:
          overrides?.existingOrgOptions ?? existingOrgOptionsRef.current,
        desktopStep: overrides?.desktopStep ?? desktopStep,
        wizardStep: overrides?.wizardStep ?? wizardStep,
        mobileView: overrides?.mobileView ?? mobileView,
        startedAt: new Date(overrides?.startedAt ?? startedAt ?? Date.now()).toISOString(),
      });
    },
    [
      automationRunId,
      installPackage,
      desktopStep,
      wizardStep,
      mobileView,
      startedAt,
    ],
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

  const refreshExistingCatalog = useCallback(async (signal?: AbortSignal) => {
    const generation = ++catalogGenerationRef.current;
    invalidateOrgsCache();
    const [allOrgs, scratchOrgList, recentRunList] = await Promise.all([
      fetchOrgsList({ force: true, signal }),
      api<ScratchOrgCatalogRow[]>('/environment/scratch-orgs', { signal }),
      api<RecentScratchOrgRun[]>('/environment/automation-runs/recent?limit=50', {
        signal,
      }),
    ]);
    if (
      !isMountedRef.current
      || generation !== catalogGenerationRef.current
      || signal?.aborted
    ) {
      return { allOrgs, scratchOrgs: scratchOrgList, recentRuns: recentRunList };
    }
    setSourceOrgs(allOrgs);
    setScratchOrgs(scratchOrgList);
    setRecentRuns(recentRunList);
    return { allOrgs, scratchOrgs: scratchOrgList, recentRuns: recentRunList };
  }, []);

  const hydrateRunState = useCallback(
    async (r: AutomationRunView, opts?: { fromRestore?: boolean; alias?: string }) => {
      if (!isMountedRef.current) return;

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

      if (r.status === 'awaiting_input') {
        setDesktopStep(2);
        setMobileView('progress');
        syncRunIdInUrl(runId);
        if (opts?.fromRestore) {
          setRestoredBanner(
            `Restored pipeline RUN-${runId.slice(0, 8).toUpperCase()} — awaiting post-deploy actions`,
          );
        }
        persistSnapshot({
          automationRunId: runId,
          desktopStep: 2,
          mobileView: 'progress',
        });
        return;
      }

      if (r.status === 'completed' || r.status === 'partial') {
        const terminalKey = `${runId}:${r.status}`;
        if (terminalHandledRef.current === terminalKey) return;

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

        const target = launchTargetFromRun(r);
        const alias = completedRunAlias(r)
          ?? (
            target.mode === 'configure_existing'
              ? existingCandidateAliasesRef.current.get(target.existingOrgConnectionId)
              : opts?.alias
          );
        if (!alias) {
          await refreshExistingCatalog().catch(() => undefined);
          setEligibilityRefresh((value) => value + 1);
          setRestoredBanner('Pipeline completed, but its saved run configuration has no scratch org alias.');
          return;
        }
        try {
          const creds = await retrieveCredentialsWithRetry(
            alias,
            (savedAlias) => api<ScratchCredentials>(
              `/environment/scratch-orgs/${encodeURIComponent(savedAlias)}/credentials`,
            ),
          );
          if (!isMountedRef.current) return;
          setCredentials(creds);
          setMobileView('success');
          if (r.status === 'partial') {
            setRestoredBanner(
              'Scratch org creation completed, but one or more post-deploy actions reported partial results. Review the logs before using the org.',
            );
          }
          terminalHandledRef.current = terminalKey;
        } catch {
          if (isMountedRef.current) {
            if (modeRef.current === 'configure_existing') {
              setCredentials({ alias });
              setMobileView('success');
              setRestoredBanner(
                r.status === 'partial'
                  ? `Configuration completed for ${alias} with partial post-deploy results. Review the logs before using the org.`
                  : `Configuration completed for ${alias}. Generate or reset its password if credentials are unavailable.`,
              );
              terminalHandledRef.current = terminalKey;
            } else {
              setRestoredBanner(
                `Pipeline completed. Credentials for ${alias} are not available yet; reload to retry.`,
              );
            }
          }
          if (modeRef.current !== 'configure_existing') {
            await refreshExistingCatalog().catch(() => undefined);
            setEligibilityRefresh((value) => value + 1);
            return;
          }
        }

        if (isMountedRef.current) {
          await refreshExistingCatalog().catch(() => undefined);
          setEligibilityRefresh((value) => value + 1);
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
          await refreshExistingCatalog().catch(() => undefined);
          setEligibilityRefresh((value) => value + 1);
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
    [persistSnapshot, refreshExistingCatalog, syncRunIdInUrl],
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
        const snapshotMode = snapshot.mode ?? 'create_new';
        modeRef.current = snapshotMode;
        setMode(snapshotMode);
        const snapshotTarget = snapshot.existingOrgConnectionId ?? '';
        existingOrgConnectionIdRef.current = snapshotTarget;
        setExistingOrgConnectionId(snapshotTarget);
        const snapshotOptions =
          snapshot.existingOrgOptions ?? { ...DEFAULT_EXISTING_ORG_OPTIONS };
        existingOrgOptionsRef.current = snapshotOptions;
        setExistingOrgOptions(snapshotOptions);
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
        const restoredForm = formFromRunConfig(r, snapshot?.form ?? formRef.current);
        const restoredTarget = launchTargetFromRun(r);
        formRef.current = restoredForm;
        modeRef.current = restoredTarget.mode;
        existingOrgConnectionIdRef.current = restoredTarget.existingOrgConnectionId;
        existingOrgOptionsRef.current = restoredTarget.existingOrgOptions;
        setForm(restoredForm);
        setMode(restoredTarget.mode);
        setExistingOrgConnectionId(restoredTarget.existingOrgConnectionId);
        setExistingOrgOptions(restoredTarget.existingOrgOptions);
        const savedInstallPackage = (r.config as { installPackage?: unknown } | undefined)
          ?.installPackage;
        if (typeof savedInstallPackage === 'boolean') setInstallPackage(savedInstallPackage);
        if (!snapshot && r.createdAt) setStartedAt(new Date(r.createdAt).getTime());
        metadataSource.setSource(metadataSourceFromForm(restoredForm));
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
    [hydrateRunState, metadataSource.setSource, refreshRunWithRetry, syncRunIdInUrl],
  );

  const loadInitial = useCallback(async (generation: number, signal: AbortSignal) => {
    const isCurrent = () =>
      isMountedRef.current &&
      bootstrapGenerationRef.current === generation &&
      !signal.aborted;
    const [hubList, templateList] = await Promise.all([
      sessionRequest('scratch-bootstrap-connected-orgs', () =>
        api<ConnectedOrgRow[]>('/environment/connected-orgs/refresh', {
          method: 'POST',
        }).catch(
          () => api<ConnectedOrgRow[]>('/environment/connected-orgs'),
        ),
      ),
      api<Array<{ id: string; name: string; isSystem: boolean; systemKey?: string | null }>>(
        '/environment/scratch-templates',
        { signal },
      ).catch(() => []),
      refreshExistingCatalog(signal).catch(() => ({
        allOrgs: [],
        scratchOrgs: [],
        recentRuns: [],
      })),
    ]);
    if (!isCurrent()) return;

    setOrgs(hubList);
    setTemplates(templateList);
    const hubs = hubList.filter((o) => o.isDevHub || o.orgType === 'Dev Hub');
    const foundation = templateList.find(
      (template) => template.systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT,
    );
    const master = templateList.find(
      (template) => template.systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE,
    );
    const resolvedMode = urlMode === 'configure' ? 'configure_existing' : modeRef.current;
    const legacyTemplate = urlTemplateId
      ? templateList.find((template) => template.id === urlTemplateId)
      : undefined;
    const dataDeploymentDefault = legacyTemplate?.systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE
      || !legacyTemplate;
    setForm((f) => ({
      ...f,
      devHubAlias: hubs.find((h) => h.isDefaultDevHub)?.alias ?? hubs[0]?.alias ?? f.devHubAlias,
      foundationTemplateId: foundation?.id ?? f.foundationTemplateId,
      dataTemplateId: master?.id ?? f.dataTemplateId,
      templateId: master?.id ?? foundation?.id ?? f.templateId,
      ...(resolvedMode === 'create_new'
        ? {
            pipelineScope: {
              sourceDeployment: true,
              dataDeployment: dataDeploymentDefault,
            },
          }
        : {
            pipelineScope: defaultPipelineScopeForMode('configure_existing'),
          }),
    }));

    const snapshot = explicitExistingTarget ? null : loadWorkspaceSnapshot();
    const resolvedRunId = urlRunId ?? snapshot?.automationRunId ?? null;

    if (resolvedRunId) {
      if (!isCurrent()) return;
      await restoreRun(
        resolvedRunId,
        snapshot?.automationRunId === resolvedRunId ? snapshot : null,
        isCurrent,
      );
    } else if (!(urlMode === 'configure' && urlExistingOrgConnectionId)) {
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
  }, [
    restoreRun,
    refreshExistingCatalog,
    explicitExistingTarget,
    urlExistingOrgConnectionId,
    urlMode,
    urlRunId,
    urlTemplateId,
  ]);

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
    if (!form.foundationTemplateId) {
      setTemplateMeta(null);
      return;
    }
    let cancelled = false;
    const scope = resolvePipelineScope(form.pipelineScope, mode);
    const requests = [
      api<{ name: string; config: ScratchPipelineTemplateConfig }>(
        `/environment/scratch-templates/${form.foundationTemplateId}`,
      ),
      scope.dataDeployment && form.dataTemplateId
        ? api<{ name: string; config: ScratchPipelineTemplateConfig }>(
            `/environment/scratch-templates/${form.dataTemplateId}`,
          )
        : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([foundation, master]) => {
        if (cancelled || !foundation) return;
        setTemplateMeta(composeClientTemplateMeta(
          { id: form.foundationTemplateId, ...foundation },
          master ? { id: form.dataTemplateId, ...master } : null,
          scope,
        ));
        if (initialLoading || automationRunId) return;
        const cfg = foundation.config;
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
  }, [
    automationRunId,
    form.dataTemplateId,
    form.foundationTemplateId,
    form.pipelineScope.dataDeployment,
    form.pipelineScope.sourceDeployment,
    initialLoading,
    metadataSource.setSource,
    mode,
  ]);

  useEffect(() => {
    if (!automationRunId) return;
    if (!['running', 'paused', 'awaiting_input'].includes(run?.status ?? '')) return;
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
    if (
      run?.status === 'completed'
      || run?.status === 'partial'
      || run?.status === 'awaiting_input'
    ) return 100;
    if (isRunning) {
      const base = Math.round((completed / AUTO_PIPELINE_STEPS) * 100);
      return Math.min(95, base + (scratchJob?.status === 'running' ? 5 : 0));
    }
    return completed > 0 ? Math.round((completed / AUTO_PIPELINE_STEPS) * 100) : 0;
  }, [run, isRunning, scratchJob?.status]);

  useEffect(() => {
    if (!automationRunId) return;
    if (
      run?.status
      && ['awaiting_input', 'completed', 'partial', 'cancelled', 'failed'].includes(run.status)
    ) {
      void hydrateRunState(run, { alias: formRef.current.alias });
      return;
    }

    const poll = setInterval(async () => {
      try {
        const r = await refreshRun(automationRunId);
        if (!isMountedRef.current) return;
        if (
          ['awaiting_input', 'completed', 'partial', 'cancelled', 'failed', 'paused']
            .includes(r.status)
        ) {
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
        payload.status === 'awaiting_input' ||
        payload.status === 'cancelled' ||
        payload.status === 'failed' ||
        payload.status === 'completed' ||
        payload.status === 'partial'
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

  const templateLaunchRequest = useMemo(
    () => buildTemplateLaunchRequest(
      form,
      metadataSource.gitSource,
      installPackage,
      {
        mode,
        existingOrgConnectionId: existingOrgConnectionId || undefined,
        existingOrgOptions,
      },
    ),
    [
      existingOrgConnectionId,
      existingOrgOptions,
      form,
      installPackage,
      metadataSource.gitSource,
      mode,
    ],
  );

  useEffect(() => {
    if (!templateMeta || !form.foundationTemplateId) {
      templatePreviewGenerationRef.current += 1;
      setTemplatePreview(null);
      setTemplatePreviewLoading(false);
      return;
    }
    const clientPreviewConfig = mergeFormIntoTemplatePreviewConfig(templateMeta.config, form);
    if (!canRequestServerLaunchPlan(
      form,
      metadataSource.gitSource,
      mode,
      templateMeta.config,
      existingOrgConnectionId || undefined,
    )) {
      templatePreviewGenerationRef.current += 1;
      setTemplatePreview(buildTemplateV2Preview(clientPreviewConfig));
      setTemplatePreviewLoading(false);
      return;
    }
    const generation = ++templatePreviewGenerationRef.current;
    const controller = new AbortController();
    setTemplatePreviewLoading(true);
    const timer = setTimeout(() => {
      void api<{ config: ScratchPipelineTemplateConfig }>(
        `/environment/scratch-templates/${form.foundationTemplateId}/launch-plan`,
        {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify(templateLaunchRequest),
        },
      ).then(async ({ config }) => {
        const provisioning = config.userProvisioning;
        const hasUsers = Boolean(
          provisioning?.users?.length
          || provisioning?.slots?.length
          || provisioning?.userGenerators?.length,
        );
        if (!hasUsers) return buildTemplateV2Preview(config);
        const orgId = config.dataDeploymentOrgId ?? config.sourceOrgId;
        if (!orgId) {
          return {
            ...buildTemplateV2Preview(config),
            errors: ['Select a Data Deployment Org to validate the provisioning plan.'],
          };
        }
        const plan = await api<{
          ok: boolean;
          users: ResolvedTemplateV2Preview['users'];
          metadata: ProvisioningPlanMetadata | null;
          errors: string[];
          warnings: string[];
        }>('/provisioning/plan/preview', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            orgId,
            automationRunId: `launch-${form.alias || 'preview'}`,
            config: provisioning,
          }),
        });
        return buildTemplateV2Preview(config, plan);
      }).then((preview) => {
        if (
          isMountedRef.current
          && generation === templatePreviewGenerationRef.current
          && !controller.signal.aborted
        ) {
          setTemplatePreview(preview);
        }
      }).catch((error) => {
        if (
          !isMountedRef.current
          || generation !== templatePreviewGenerationRef.current
          || controller.signal.aborted
        ) return;
        const fallback = buildTemplateV2Preview(templateMeta.config);
        setTemplatePreview({
          ...fallback,
          errors: [error instanceof Error ? error.message : 'Launch plan preview failed'],
        });
      }).finally(() => {
        if (
          isMountedRef.current
          && generation === templatePreviewGenerationRef.current
          && !controller.signal.aborted
        ) {
          setTemplatePreviewLoading(false);
        }
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (templatePreviewGenerationRef.current === generation) {
        templatePreviewGenerationRef.current += 1;
      }
    };
  }, [
    existingOrgConnectionId,
    form,
    form.alias,
    form.foundationTemplateId,
    form.pipelineScope,
    metadataSource.gitSource,
    mode,
    templateLaunchRequest,
    templateMeta,
  ]);

  useEffect(() => {
    const scope = resolvePipelineScope(form.pipelineScope, mode);
    const requiresGit = pipelineScopeRequiresGitSource(scope);
    if (
      mode !== 'configure_existing'
      || !existingOrgConnectionId
      || (requiresGit && !metadataSource.gitSource)
      || templatePreviewLoading
      || (templateMeta && (!templatePreview || templatePreview.errors.length > 0))
    ) {
      eligibilityGenerationRef.current += 1;
      setEligibility(null);
      setEligibilityLoading(false);
      setEligibilityError(null);
      return;
    }

    const generation = ++eligibilityGenerationRef.current;
    const controller = new AbortController();
    setEligibilityLoading(true);
    setEligibilityError(null);
    const timer = setTimeout(() => {
      void api<ExistingOrgEligibility>('/environment/scratch-org/pipeline/eligibility', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify(templateLaunchRequest),
      }).then((result) => {
        if (
          isMountedRef.current
          && generation === eligibilityGenerationRef.current
          && !controller.signal.aborted
        ) {
          setEligibility(result);
        }
      }).catch((error) => {
        if (
          isMountedRef.current
          && generation === eligibilityGenerationRef.current
          && !controller.signal.aborted
        ) {
          setEligibility(null);
          setEligibilityError(
            error instanceof Error ? error.message : 'Eligibility check failed',
          );
        }
      }).finally(() => {
        if (
          isMountedRef.current
          && generation === eligibilityGenerationRef.current
          && !controller.signal.aborted
        ) {
          setEligibilityLoading(false);
        }
      });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (eligibilityGenerationRef.current === generation) {
        eligibilityGenerationRef.current += 1;
      }
    };
  }, [
    eligibilityRefresh,
    existingOrgConnectionId,
    metadataSource.gitSource,
    mode,
    templateLaunchRequest,
    templateMeta,
    templatePreview,
    templatePreviewLoading,
  ]);

  const canLaunch =
    (mode === 'create_new'
      ? !!form.alias && !!form.devHubAlias
      : !!existingOrgConnectionId
        && !eligibilityLoading
        && eligibility?.eligible === true
        && destructiveConfirmed
        && skipCreateConfirmed) &&
    (!pipelineScopeRequiresGitSource(form.pipelineScope) || !!metadataSource.gitSource) &&
    !templatePreviewLoading &&
    (!templateMeta || Boolean(templatePreview && templatePreview.errors.length === 0));

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
        mode: 'create_new',
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

      if (mode === 'configure_existing') {
        if (!eligibility?.eligible) {
          throw new Error('Resolve eligibility errors before launching.');
        }
        payload = {
          ...templateLaunchRequest,
          skipSteps: buildSkipSteps({ installPackage }),
        };
      }

      if (form.templateId) {
        if (templatePreviewLoading) throw new Error('Wait for the server launch plan preview.');
        if (!templatePreview || templatePreview.errors.length) {
          throw new Error(templatePreview?.errors.join(' ') || 'Launch plan preview is unavailable.');
        }
        payload = {
          ...templateLaunchRequest,
          skipSteps: buildSkipSteps({
            installPackage,
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
        mode,
        existingOrgConnectionId,
        existingOrgOptions,
        desktopStep: 2,
        wizardStep,
        mobileView: 'progress',
        startedAt: new Date(now).toISOString(),
      });
      await refreshExistingCatalog().catch(() => undefined);
      setEligibilityRefresh((value) => value + 1);
    } catch (err) {
      setStartedAt(null);
      if (err instanceof ApiError) {
        const conflictRunId =
          typeof err.details.conflictRunId === 'string'
            ? err.details.conflictRunId
            : undefined;
        if (
          conflictRunId
          && (
            err.code === 'ACTIVE_TARGET_PIPELINE'
            || err.status === 409
          )
        ) {
          await restoreRun(conflictRunId);
          await refreshExistingCatalog().catch(() => undefined);
          setEligibilityRefresh((value) => value + 1);
          setRestoredBanner('An active pipeline already targets this org. Its progress was restored.');
          return;
        }
      }
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
        body: JSON.stringify({}),
      });
      await refreshRun(automationRunId);
      persistSnapshot({ startedAt: now });
    } finally {
      setResuming(false);
    }
  };

  const resetForm = () => {
    clearWorkspaceSnapshot();
    catalogGenerationRef.current += 1;
    templatePreviewGenerationRef.current += 1;
    eligibilityGenerationRef.current += 1;
    modeRef.current = 'create_new';
    existingOrgConnectionIdRef.current = '';
    createDraftAliasRef.current = '';
    syncRunIdInUrl(null);
    setForm((f) => ({
      ...DEFAULT_FORM,
      devHubAlias: f.devHubAlias,
      foundationTemplateId: f.foundationTemplateId,
      dataTemplateId: f.dataTemplateId,
      pipelineScope: defaultPipelineScopeForMode('create_new'),
      azureProject: f.azureProject,
      azureRepo: f.azureRepo,
      azureBranch: f.azureBranch,
    }));
    setInstallPackage(true);
    setMode('create_new');
    setExistingOrgConnectionId('');
    setExistingOrgOptions({ ...DEFAULT_EXISTING_ORG_OPTIONS });
    existingOrgOptionsRef.current = { ...DEFAULT_EXISTING_ORG_OPTIONS };
    setEligibility(null);
    setEligibilityError(null);
    setDestructiveConfirmed(false);
    setSkipCreateConfirmed(false);
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
    void refreshExistingCatalog().catch(() => undefined);
  };

  const selectMode = (nextMode: ScratchOrgLaunchMode) => {
    const currentMode = modeRef.current;
    const aliasState = modeAliasState(
      currentMode,
      nextMode,
      formRef.current.alias,
      createDraftAliasRef.current,
    );
    createDraftAliasRef.current = aliasState.createDraftAlias;
    if (aliasState.alias !== formRef.current.alias) {
      formRef.current = { ...formRef.current, alias: aliasState.alias };
      setForm((current) => ({ ...current, alias: aliasState.alias }));
    }
    catalogGenerationRef.current += 1;
    eligibilityGenerationRef.current += 1;
    modeRef.current = nextMode;
    setMode(nextMode);
    setForm((current) => ({
      ...current,
      pipelineScope: defaultPipelineScopeForMode(nextMode),
    }));
    setDestructiveConfirmed(false);
    setSkipCreateConfirmed(false);
    setEligibility(null);
    if (nextMode === 'create_new') {
      existingOrgConnectionIdRef.current = '';
      setExistingOrgConnectionId('');
      existingOrgOptionsRef.current = { ...DEFAULT_EXISTING_ORG_OPTIONS };
      setExistingOrgOptions({ ...DEFAULT_EXISTING_ORG_OPTIONS });
    }
    syncRunIdInUrl(null);
    void refreshExistingCatalog().catch(() => undefined);
  };

  const selectExistingOrg = (orgConnectionId: string) => {
    existingOrgConnectionIdRef.current = orgConnectionId;
    setExistingOrgConnectionId(orgConnectionId);
    eligibilityGenerationRef.current += 1;
    setDestructiveConfirmed(false);
    setSkipCreateConfirmed(false);
    setEligibility(null);
    syncRunIdInUrl(null);
  };

  const openRun = async (runId: string) => {
    setOpeningRunId(runId);
    try {
      await restoreRun(runId);
    } finally {
      if (isMountedRef.current) setOpeningRunId(null);
    }
  };

  const cancelConflictRun = async (runId: string) => {
    setStopping(true);
    try {
      await api(`/environment/automation-runs/${runId}/cancel`, { method: 'POST' });
      setEligibilityRefresh((value) => value + 1);
      await refreshExistingCatalog().catch(() => undefined);
    } finally {
      setStopping(false);
    }
  };

  const regenerateExistingPassword = async () => {
    const alias = credentials?.alias || formRef.current.alias;
    if (!alias) return;
    setSubmitting(true);
    setLaunchError(null);
    try {
      const result = await api<{ password: string }>(
        `/environment/scratch-orgs/${encodeURIComponent(alias)}/regenerate-password`,
        { method: 'POST' },
      );
      setCredentials((current) => ({ ...(current ?? { alias }), password: result.password }));
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Password reset failed');
    } finally {
      setSubmitting(false);
    }
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
    const preparation = run?.jobs?.findLast((job) => job.type === 'prepare_existing_org');
    if (preparation?.status === 'running') {
      const preparationLogs = preparation.logs?.map((log) => log.line) ?? [];
      if (preparationLogs.some((line) => line.includes('Checking required package'))) {
        return 'Verifying or installing the required package…';
      }
      return 'Verifying existing org authentication…';
    }
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
      launchMode: mode,
    });

  void tick;

  return {
    router,
    initialLoading,
    mode,
    selectMode,
    existingOrgConnectionId,
    selectExistingOrg,
    existingOrgOptions,
    setExistingOrgOptions,
    existingCandidates,
    recentRuns,
    eligibility,
    eligibilityLoading,
    eligibilityError,
    destructiveConfirmed,
    setDestructiveConfirmed,
    skipCreateConfirmed,
    setSkipCreateConfirmed,
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
    openRun,
    openingRunId,
    cancelConflictRun,
    regenerateExistingPassword,
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
