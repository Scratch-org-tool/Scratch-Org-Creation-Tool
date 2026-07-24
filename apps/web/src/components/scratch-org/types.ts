import type { ScratchOrgSkipStepKey } from '@sfcc/shared';
import type { ScmProvider, PipelineScope } from '@sfcc/shared';

export const PIPELINE_STEPS_UI = [
  'Create Scratch Org',
  'Generate Password',
  'Install Package',
  'Git Metadata Deploy',
  'Assign Permission Set',
  'Load Custom Settings',
  'Load Org Config',
  'Complete',
] as const;

export const EXISTING_PIPELINE_STEPS_UI = [
  'Create Scratch Org',
  'Generate Password',
  'Retrieve Org Details',
  'Prepare Existing Org',
  'Git Metadata Deploy',
  'Assign Permission Set',
  'Load Custom Settings',
  'Load Org Config',
  'Complete',
] as const;

export type PipelineStepLabel =
  | (typeof PIPELINE_STEPS_UI)[number]
  | (typeof EXISTING_PIPELINE_STEPS_UI)[number];

export type StepState = 'done' | 'active' | 'pending' | 'skipped' | 'failed';

export const PIPELINE_STEP_LABEL_BY_ID: Record<string, PipelineStepLabel> = {
  scratch_org_create: 'Create Scratch Org',
  prepare_existing_org: 'Prepare Existing Org',
  git_metadata_deploy: 'Git Metadata Deploy',
  azure_metadata_deploy: 'Git Metadata Deploy',
  assign_permission_set: 'Assign Permission Set',
  load_org_config: 'Load Org Config',
  load_custom_settings: 'Load Custom Settings',
};

export function formatPipelineStepId(stepId?: string | null): string {
  if (!stepId) return 'Unknown step';
  return PIPELINE_STEP_LABEL_BY_ID[stepId] ?? stepId.replace(/_/g, ' ');
}

export function isPipelineResumable(failedStep?: string | null): boolean {
  return (
    failedStep === 'scratch_org_create' ||
    failedStep === 'prepare_existing_org' ||
    failedStep === 'git_metadata_deploy' ||
    failedStep === 'azure_metadata_deploy' ||
    failedStep === 'assign_permission_set' ||
    failedStep === 'load_org_config' ||
    failedStep === 'load_custom_settings' ||
    failedStep === 'load_data_seed' ||
    failedStep === 'load_account_partners' ||
    failedStep === 'provision_users'
  );
}

export type SkipStepKey = ScratchOrgSkipStepKey;

export interface ConnectedOrgRow {
  id?: string;
  alias: string;
  username?: string;
  orgType?: string;
  status?: string;
  isDevHub?: boolean;
  isDefaultDevHub?: boolean;
}

export interface ScratchOrgFormState {
  devHubAlias: string;
  alias: string;
  duration: number;
  template: string;
  description: string;
  azureProject: string;
  azureRepo: string;
  azureBranch: string;
  azureManifestPath: string;
  gitProvider: ScmProvider | '';
  gitConnectionId: string;
  gitNamespace: string;
  gitRepositoryId: string;
  templateId: string;
  foundationTemplateId: string;
  dataTemplateId: string;
  pipelineScope: PipelineScope;
  /** @deprecated Kept for restored V1 runs. */
  sourceOrgId: string;
  dataDeploymentOrgId: string;
  customSettingsOrgId: string;
  runtimeEmailPool: string;
}

export interface AutomationRunView {
  id: string;
  status: string;
  launchMode?: ScratchOrgLaunchMode;
  targetOrgConnectionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  failedStep?: string | null;
  lastError?: string | null;
  config?: {
    mode?: ScratchOrgLaunchMode;
    alias?: string;
    existingOrgConnectionId?: string;
    existingOrgOptions?: ExistingOrgOptions;
    templateId?: string;
    devHubAlias?: string;
    duration?: number;
    template?: string;
    description?: string;
    gitSource?: Record<string, unknown>;
    azureDeploy?: Record<string, unknown>;
    sourceOrgId?: string;
    dataDeploymentOrgId?: string;
    customSettingsOrgId?: string;
    dataSeed?: {
      datasets?: string[];
      mode?: 'automatic' | 'query_json' | 'hybrid' | 'query_section';
      querySection?: {
        queries?: Array<{ id: string; name: string; order: number; stage: number }>;
        accountPartnerPlan?: unknown;
      };
    };
    partnerImport?: {
      enabled?: boolean;
      mode?: 'excel' | 'org_to_org' | 'org_to_org_matched' | 'query_section';
      bottler?: '5000' | '4900' | '4600' | 'all';
      excelPath?: string;
    };
    pipelineSteps?: {
      autoRunDataSeed?: boolean;
      autoRunPartners?: boolean;
      autoRunUsers?: boolean;
    };
    userProvisioning?: {
      users?: unknown[];
      slots?: unknown[];
      userGenerators?: Array<{ id: string; count: number; role: string }>;
    };
  };
  checkpoint?: {
    completedSteps?: string[];
    resumeFrom?: string;
    awaitingUserActions?: boolean;
    targetOrgConnectionId?: string;
    launchMode?: ScratchOrgLaunchMode;
    skippedSteps?: string[];
    userActionsCompleted?: string[];
    requestedUserActions?: string[];
    partialUserActions?: string[];
  };
  jobs?: Array<{
    id: string;
    createdAt?: string;
    status: string;
    currentStep: string;
    type: string;
    logs?: Array<{ line: string }>;
    payload?: Record<string, unknown> | null;
    result?: Record<string, unknown> | null;
  }>;
}

export function mapWorkerStepToIndex(currentStep: string): number {
  const map: Record<string, number> = {
    'Not Started': -1,
    Pending: -1,
    'Create Scratch Org': 0,
    'Generate Password': 1,
    'Retrieve Org Details': 1,
    'Install Packages': 2,
    'Deploy Metadata': 3,
    'Assign Permissions': 4,
    Complete: 5,
  };
  return map[currentStep] ?? -1;
}

export function getStepStates(
  label: PipelineStepLabel,
  opts: {
    run: AutomationRunView | null;
    scratchJobStep?: string;
    skippedSteps: Set<SkipStepKey>;
    sourceControlConnected: boolean;
    launchMode?: ScratchOrgLaunchMode;
  },
): StepState {
  const { run, scratchJobStep, skippedSteps, sourceControlConnected } = opts;
  const launchMode = opts.launchMode ?? 'create_new';
  const stepList: readonly PipelineStepLabel[] = launchMode === 'configure_existing'
    ? EXISTING_PIPELINE_STEPS_UI
    : PIPELINE_STEPS_UI;
  const idx = stepList.indexOf(label);
  const completed = run?.checkpoint?.completedSteps ?? [];
  const scratchDone = completed.includes('scratch_org_create');
  const azureDone =
    completed.includes('git_metadata_deploy') ||
    completed.includes('azure_metadata_deploy');
  const permDone = completed.includes('assign_permission_set');
  const orgConfigDone = completed.includes('load_org_config');
  const customSettingsDone = completed.includes('load_custom_settings');
  const runComplete =
    run?.status === 'completed'
    || run?.status === 'partial'
    || run?.status === 'awaiting_input';
  const runPaused = run?.status === 'paused';
  const failedUiLabel = runPaused && run?.failedStep
    ? PIPELINE_STEP_LABEL_BY_ID[run.failedStep]
    : undefined;

  if (
    launchMode === 'configure_existing'
    && ['Create Scratch Org', 'Generate Password', 'Retrieve Org Details'].includes(label)
  ) return 'skipped';

  if (runPaused && failedUiLabel === label) return 'failed';

  if (label === 'Prepare Existing Org') {
    const preparation = run?.jobs?.findLast((job) => job.type === 'prepare_existing_org');
    if (completed.includes('prepare_existing_org') || preparation?.status === 'completed') return 'done';
    if (preparation?.status === 'failed' || (runPaused && run?.failedStep === 'prepare_existing_org')) {
      return 'failed';
    }
    if (preparation && ['pending', 'queued', 'running'].includes(preparation.status)) return 'active';
    return 'pending';
  }

  if (label === 'Install Package' && skippedSteps.has('installPackages')) return 'skipped';
  if ((label === 'Git Metadata Deploy' || label === 'Assign Permission Set') && !sourceControlConnected) {
    return 'pending';
  }

  if (runComplete) return 'done';

  const scratchJob = run?.jobs?.find((j) => j.type === 'scratch_org_workflow');
  const metaJob = run?.jobs?.find((j) => j.type === 'pipeline_metadata_deploy');
  const scratchRunning = scratchJob?.status === 'running';
  const metaRunning = metaJob?.status === 'running';
  const workerIdx = scratchJobStep ? mapWorkerStepToIndex(scratchJobStep) : mapWorkerStepToIndex(scratchJob?.currentStep ?? '');

  if (idx <= 2) {
    if (scratchDone) return skippedSteps.has('installPackages') && idx === 2 ? 'skipped' : 'done';
    if (scratchRunning) {
      if (workerIdx > idx) return 'done';
      if (workerIdx === idx) return 'active';
    }
    return 'pending';
  }

  if (label === 'Git Metadata Deploy') {
    if (azureDone || permDone) return 'done';
    if (
      metaRunning &&
      (metaJob?.currentStep?.includes('Connecting') || metaJob?.currentStep?.includes('Azure'))
    ) return 'active';
    if (
      (scratchDone || completed.includes('prepare_existing_org'))
      && !azureDone
    ) return metaRunning ? 'active' : 'pending';
    return 'pending';
  }

  if (label === 'Assign Permission Set') {
    if (permDone || customSettingsDone || orgConfigDone) return 'done';
    if (metaRunning && metaJob?.currentStep?.includes('Assign')) return 'active';
    if (azureDone && !permDone) return 'active';
    return 'pending';
  }

  if (label === 'Load Custom Settings') {
    if (customSettingsDone) return 'done';
    if (permDone && !customSettingsDone) return metaRunning ? 'active' : 'pending';
    return 'pending';
  }

  if (label === 'Load Org Config') {
    if (orgConfigDone) return 'done';
    if (customSettingsDone && !orgConfigDone) return metaRunning ? 'active' : 'pending';
    return 'pending';
  }

  if (label === 'Complete') return runComplete ? 'done' : 'pending';
  return 'pending';
}

export function buildSkipSteps(options: {
  installPackage: boolean;
}): SkipStepKey[] {
  const steps: SkipStepKey[] = ['deployMetadata', 'assignPermissions'];
  if (!options.installPackage) steps.unshift('installPackages');
  return steps;
}

export type ScratchOrgLaunchMode = 'create_new' | 'configure_existing';

export interface ExistingOrgOptions {
  verifyAuthentication: boolean;
  ensureRequiredPackage: boolean;
}
