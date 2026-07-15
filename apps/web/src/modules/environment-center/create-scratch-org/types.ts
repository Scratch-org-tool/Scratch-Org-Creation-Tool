import type {
  ExistingOrgOptions,
  ScratchOrgLaunchMode,
} from '@/components/scratch-org/types';

export {
  buildSkipSteps,
  formatPipelineStepId,
  getStepStates,
  isPipelineResumable,
  PIPELINE_STEPS_UI,
  type AutomationRunView,
  type ConnectedOrgRow,
  type PipelineStepLabel,
  type ScratchOrgFormState,
  type ScratchOrgLaunchMode,
  type ExistingOrgOptions,
  type SkipStepKey,
  type StepState,
} from '@/components/scratch-org/types';

export const DEFAULT_FORM = {
  devHubAlias: '',
  alias: '',
  duration: 30,
  template: 'config/project-scratch-def.json',
  description: '',
  azureProject: '',
  azureRepo: '',
  azureBranch: '',
  azureManifestPath: 'CoreFlex Onboarding/manifest/package.xml',
  gitProvider: '',
  gitConnectionId: '',
  gitNamespace: '',
  gitRepositoryId: '',
  templateId: '',
  sourceOrgId: '',
  dataDeploymentOrgId: '',
  customSettingsOrgId: '',
  runtimeEmailPool: '',
} as const;

export interface AzureStatus {
  connected: boolean;
  orgSlug?: string | null;
  project?: string | null;
}

export interface AzureDefaults {
  project: string;
  repo: string;
  branch: string;
  manifestPath: string;
}

export interface AzureRepo {
  id: string;
  name: string;
  project: string;
}

export interface ScratchCredentials {
  alias: string;
  username?: string;
  password?: string | null;
  instanceUrl?: string | null;
  expirationDate?: string | null;
}

export interface ExistingScratchOrgCandidate {
  id: string;
  orgConnectionId: string;
  alias: string;
  username?: string | null;
  orgId?: string | null;
  status: string;
  expirationDate?: string | null;
  devHubAlias?: string | null;
  authenticated: boolean;
  latestRun?: RecentScratchOrgRun;
}

export interface RecentScratchOrgRun {
  id: string;
  status: string;
  launchMode?: ScratchOrgLaunchMode;
  targetOrgConnectionId?: string | null;
  createdAt?: string;
  targetOrgConnection?: {
    id: string;
    alias: string;
    username?: string | null;
    orgId?: string | null;
  } | null;
  config?: { alias?: string; mode?: ScratchOrgLaunchMode } | null;
}

export type EligibilityStepName =
  | 'template'
  | 'target'
  | 'authentication'
  | 'required_package'
  | 'provider'
  | 'sources'
  | 'active_run';

export interface ExistingOrgEligibilityStep {
  step: EligibilityStepName;
  status: 'required' | 'skipped' | 'warning' | 'error';
  messages: string[];
  required: boolean;
  skipped: boolean;
  warnings: string[];
  errors: string[];
}

export interface ExistingOrgEligibility {
  eligible: boolean;
  target: {
    id: string;
    alias: string;
    username?: string | null;
    orgId?: string | null;
    instanceUrl?: string | null;
    status: string;
    expiresAt?: string | null;
  } | null;
  steps: ExistingOrgEligibilityStep[];
  warnings: string[];
  errors: string[];
  conflictRunId: string | null;
}

export const DEFAULT_EXISTING_ORG_OPTIONS: ExistingOrgOptions = {
  verifyAuthentication: true,
  ensureRequiredPackage: true,
};

export type MobileView = 'wizard' | 'progress' | 'logs' | 'success';
export type DesktopStep = 0 | 1 | 2;
