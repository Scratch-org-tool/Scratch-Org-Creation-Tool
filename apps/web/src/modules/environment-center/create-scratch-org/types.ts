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

export type MobileView = 'wizard' | 'progress' | 'logs' | 'success';
export type DesktopStep = 0 | 1 | 2;
