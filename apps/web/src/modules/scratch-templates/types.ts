import {
  SYSTEM_SCRATCH_TEMPLATE_KEYS,
  type ScratchPipelineTemplateConfig,
  type SystemScratchTemplateKey,
} from '@sfcc/shared';

export type TemplateConfigState = ScratchPipelineTemplateConfig & {
  permissionSetsText?: string;
};

export type TemplateStepId =
  | 'general'
  | 'scratch'
  | 'source-orgs'
  | 'custom-settings'
  | 'permissions'
  | 'data-seed'
  | 'query-section'
  | 'partners-users'
  | 'review';

export interface TemplateWizardStep {
  id: TemplateStepId;
  label: string;
}

export const TEMPLATE_WIZARD_STEPS: readonly TemplateWizardStep[] = [
  { id: 'general', label: 'General' },
  { id: 'scratch', label: 'Scratch org' },
  { id: 'source-orgs', label: 'Source orgs' },
  { id: 'custom-settings', label: 'Custom settings' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'data-seed', label: 'Data seed' },
  { id: 'query-section', label: 'Query section' },
  { id: 'partners-users', label: 'Partners & users' },
  { id: 'review', label: 'Review' },
] as const;

const SYSTEM_TEMPLATE_STEP_IDS: Record<SystemScratchTemplateKey, readonly TemplateStepId[]> = {
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT]: [
    'general',
    'scratch',
    'permissions',
    'review',
  ],
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE]: [
    'general',
    'source-orgs',
    'custom-settings',
    'permissions',
    'review',
  ],
};

const SYSTEM_TEMPLATE_STEP_LABELS: Partial<
  Record<SystemScratchTemplateKey, Partial<Record<TemplateStepId, string>>>
> = {
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT]: {
    scratch: 'Scratch & source',
  },
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE]: {
    'source-orgs': 'Data source',
    'custom-settings': 'Master SFDMU export',
    permissions: 'Org configuration',
  },
};

export function getTemplateWizardSteps(
  systemKey?: string | null,
): readonly TemplateWizardStep[] {
  if (!systemKey || !(systemKey in SYSTEM_TEMPLATE_STEP_IDS)) {
    return TEMPLATE_WIZARD_STEPS;
  }
  const key = systemKey as SystemScratchTemplateKey;
  const ids = new Set(SYSTEM_TEMPLATE_STEP_IDS[key]);
  const labels = SYSTEM_TEMPLATE_STEP_LABELS[key];
  return TEMPLATE_WIZARD_STEPS
    .filter((step) => ids.has(step.id))
    .map((step) => ({ ...step, label: labels?.[step.id] ?? step.label }));
}

export type AccountSeedRow = NonNullable<ScratchPipelineTemplateConfig['accountSeedRows']>[number];

export type ConaUserRow = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  bottler: string;
  modules: string[];
  locations: string[];
  templateId?: string;
};

export interface SystemTemplatePresentation {
  number: number;
  stage: string;
  summary: string;
}

const SYSTEM_TEMPLATE_PRESENTATION: Record<SystemScratchTemplateKey, SystemTemplatePresentation> = {
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT]: {
    number: 1,
    stage: 'Scratch & source',
    summary: 'Scratch org creation and source-control metadata deployment',
  },
  [SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE]: {
    number: 2,
    stage: 'Master load',
    summary: 'One-shot SFDMU load of config, partners, accounts, products, and visit plans',
  },
};

export function getSystemTemplatePresentation(
  systemKey?: string | null,
): SystemTemplatePresentation | undefined {
  if (!systemKey) return undefined;
  return SYSTEM_TEMPLATE_PRESENTATION[systemKey as SystemScratchTemplateKey];
}

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfigState = {
  version: 2,
  template: 'config/project-scratch-def.json',
  duration: 7,
  installPackage: true,
  gitSource: {
    provider: 'azure_devops',
    manifestPath: 'CoreFlex Onboarding/manifest/package.xml',
  },
  permissionSets: [],
  permissionSetsText: '',
  orgConfig: {
    upsertQueueIds: true,
    upsertDomainFields: true,
    upsertRequestId: true,
  },
  customSettings: { enabled: true, mode: 'bundled' },
  dataSeed: {
    datasets: ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'],
    mode: 'hybrid',
  },
  accountSeedRows: [
    { accountGroup: 'Z001', bottler: '5000', distributionChannel: 'Z1', limit: 500 },
  ],
  partnerImport: {
    enabled: false,
    mode: 'org_to_org_matched',
    bottler: '5000',
    perOffice: 20,
    matchOrgDistribution: true,
  },
  pipelineSteps: {
    autoRunDataSeed: true,
    autoRunPartners: false,
    autoRunUsers: false,
  },
  userProvisioning: {
    discoveryPolicy: 'best_effort',
    emailPolicy: { strategy: 'provided', seed: 'automation_run' },
    usernamePolicy: { strategy: 'email_style', seed: 'automation_run' },
    roleBottlerMappings: [],
    userGenerators: [],
    teams: [],
    users: [],
    templates: [],
    slots: [],
    execution: {
      mode: 'sequential',
      concurrency: 1,
      failurePolicy: 'fail_fast',
      discoveryFailurePolicy: 'fail',
    },
  },
};

export function configToSummaryChips(config: ScratchPipelineTemplateConfig): string[] {
  const chips: string[] = [];
  if (config.gitSource?.provider === 'azure_devops' || config.azureDeploy) {
    chips.push('Azure DevOps deploy');
  } else if (config.gitSource?.provider) {
    chips.push('Source deploy');
  }
  if (config.customSettings?.enabled !== false) {
    const mode = config.customSettings?.mode;
    if (mode === 'custom') chips.push('Custom SFDMU');
    else if (mode === 'master') chips.push('Master SFDMU');
    else chips.push('Bundled SFDMU');
  }
  const ds = config.dataSeed?.datasets?.length ?? 0;
  if (ds > 0) chips.push(`${ds} dataset${ds === 1 ? '' : 's'}`);
  if (config.dataSeed?.querySet) chips.push('Query JSON');
  const queries = config.dataSeed?.querySection?.queries.filter((query) => query.enabled).length ?? 0;
  if (queries) chips.push(`${queries} V2 quer${queries === 1 ? 'y' : 'ies'}`);
  const generated = config.userProvisioning?.userGenerators?.reduce(
    (sum, generator) => sum + generator.count,
    0,
  ) ?? 0;
  const users = generated
    ? generated + (config.userProvisioning?.users?.length ?? 0)
    : (config.userProvisioning?.slots?.length || config.userProvisioning?.users?.length || 0);
  if (users > 0) chips.push(`${users} user${users === 1 ? '' : 's'}`);
  if (config.pipelineSteps?.autoRunDataSeed && config.dataSeed) chips.push('Auto seed');
  if (config.pipelineSteps?.autoRunPartners && config.partnerImport?.enabled) chips.push('Auto partners');
  if (config.pipelineSteps?.autoRunUsers && users > 0) chips.push('Auto users');
  if (config.installPackage) chips.push('Error logger pkg');
  return chips;
}
