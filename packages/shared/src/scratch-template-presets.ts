import { DEFAULT_AZURE_MANIFEST_PATH } from './constants.js';
import type { ScratchPipelineTemplateConfig } from './sfdmu-export.js';

export const SYSTEM_SCRATCH_TEMPLATE_KEYS = {
  SCRATCH_SOURCE_DEPLOYMENT: 'scratch-source-deployment',
  MASTER_TEMPLATE: 'master-template',
} as const;

export type SystemScratchTemplateKey =
  (typeof SYSTEM_SCRATCH_TEMPLATE_KEYS)[keyof typeof SYSTEM_SCRATCH_TEMPLATE_KEYS];

export interface SystemScratchTemplatePreset {
  key: SystemScratchTemplateKey;
  name: string;
  description: string;
  sortOrder: number;
  config: ScratchPipelineTemplateConfig;
}

const SCRATCH_AND_SOURCE_DEFAULTS = {
  version: 2 as const,
  template: 'config/project-scratch-def.json',
  duration: 7,
  installPackage: true,
  azureDeploy: { manifestPath: DEFAULT_AZURE_MANIFEST_PATH },
  gitSource: {
    provider: 'azure_devops' as const,
    manifestPath: DEFAULT_AZURE_MANIFEST_PATH,
  },
  permissionSets: [],
};

/**
 * System presets for scratch-org launch: foundation metadata deploy and master data load.
 */
export const SYSTEM_SCRATCH_TEMPLATE_PRESETS: readonly SystemScratchTemplatePreset[] = [
  {
    key: SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT,
    name: 'Scratch Org & Source Deployment',
    description:
      'Creates the scratch org, installs the Error Logger package, and deploys metadata from the selected source-control repository.',
    sortOrder: 1,
    config: {
      ...SCRATCH_AND_SOURCE_DEFAULTS,
      orgConfig: {
        upsertQueueIds: false,
        upsertDomainFields: false,
        upsertRequestId: false,
      },
      customSettings: { enabled: false, mode: 'bundled' },
      pipelineSteps: {
        autoRunDataSeed: false,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    },
  },
  {
    key: SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE,
    name: 'Master Template',
    description:
      'Loads all config, partners, accounts, products, and visit plans in one SFDMU run.',
    sortOrder: 2,
    config: {
      ...SCRATCH_AND_SOURCE_DEFAULTS,
      orgConfig: {
        upsertQueueIds: true,
        upsertDomainFields: true,
        upsertRequestId: true,
      },
      customSettings: { enabled: true, mode: 'master' },
      pipelineSteps: {
        autoRunDataSeed: false,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    },
  },
] as const;
