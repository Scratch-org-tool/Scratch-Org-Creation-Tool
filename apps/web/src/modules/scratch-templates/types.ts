import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';

export type TemplateConfigState = ScratchPipelineTemplateConfig & {
  permissionSetsText?: string;
};

export const TEMPLATE_WIZARD_STEPS = [
  'General',
  'Scratch org',
  'Source orgs',
  'Custom settings',
  'Permissions',
  'Data seed',
  'Query section',
  'Partners & users',
  'Review',
] as const;

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
    autoRunUsers: true,
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
  if (config.customSettings?.enabled !== false) {
    chips.push(config.customSettings?.mode === 'custom' ? 'Custom SFDMU' : 'Bundled SFDMU');
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
  if (config.pipelineSteps?.autoRunDataSeed) chips.push('Auto seed');
  if (config.pipelineSteps?.autoRunPartners) chips.push('Auto partners');
  if (config.pipelineSteps?.autoRunUsers) chips.push('Auto users');
  if (config.installPackage) chips.push('Error logger pkg');
  return chips;
}
