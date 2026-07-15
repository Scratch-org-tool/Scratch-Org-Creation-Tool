import type { ScratchOrgSkipStepKey } from '@sfcc/shared';
import type { ScmProvider } from '@sfcc/shared';

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

export type PipelineStepLabel = (typeof PIPELINE_STEPS_UI)[number];

export type StepState = 'done' | 'active' | 'pending' | 'skipped' | 'failed';

export const PIPELINE_STEP_LABEL_BY_ID: Record<string, PipelineStepLabel> = {
  scratch_org_create: 'Create Scratch Org',
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
    failedStep === 'git_metadata_deploy' ||
    failedStep === 'azure_metadata_deploy' ||
    failedStep === 'assign_permission_set' ||
    failedStep === 'load_org_config' ||
    failedStep === 'load_custom_settings'
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
  sourceOrgId: string;
}

export interface AutomationRunView {
  id: string;
  status: string;
  failedStep?: string | null;
  lastError?: string | null;
  config?: {
    sourceOrgId?: string;
    dataSeed?: { datasets: string[] };
    userProvisioning?: { users: unknown[] };
  };
  checkpoint?: {
    completedSteps?: string[];
    resumeFrom?: string;
    awaitingUserActions?: boolean;
    targetOrgConnectionId?: string;
    userActionsCompleted?: string[];
  };
  jobs?: Array<{
    id: string;
    status: string;
    currentStep: string;
    type: string;
    logs?: Array<{ line: string }>;
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
  },
): StepState {
  const { run, scratchJobStep, skippedSteps, sourceControlConnected } = opts;
  const idx = PIPELINE_STEPS_UI.indexOf(label);
  const completed = run?.checkpoint?.completedSteps ?? [];
  const scratchDone = completed.includes('scratch_org_create');
  const azureDone =
    completed.includes('git_metadata_deploy') ||
    completed.includes('azure_metadata_deploy');
  const permDone = completed.includes('assign_permission_set');
  const orgConfigDone = completed.includes('load_org_config');
  const customSettingsDone = completed.includes('load_custom_settings');
  const runComplete = run?.status === 'completed';
  const runPaused = run?.status === 'paused';
  const failedUiLabel = runPaused && run?.failedStep
    ? PIPELINE_STEP_LABEL_BY_ID[run.failedStep]
    : undefined;

  if (runPaused && failedUiLabel === label) return 'failed';

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
    if (scratchDone && !azureDone) return metaRunning ? 'active' : 'pending';
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
