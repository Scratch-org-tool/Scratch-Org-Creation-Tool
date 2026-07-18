import { DEFAULT_AZURE_MANIFEST_PATH } from './constants.js';
import type { ScratchPipelineTemplateConfig } from './sfdmu-export.js';

export const SYSTEM_SCRATCH_TEMPLATE_KEYS = {
  SCRATCH_SOURCE_DEPLOYMENT: 'scratch-source-deployment',
  DATA_DEPLOYMENT_QUERIES: 'data-deployment-queries',
  CONFIG_SEED_ACCOUNT_PARTNERS: 'config-seed-account-partners',
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
 * Ordered system presets used by the scratch-org wizard.
 *
 * Each preset contains the scratch-org and source-deployment foundation so it
 * can be launched independently. The post-deployment scope then progresses
 * from metadata only, to query-driven data, to CONA config and partner seed.
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
    key: SYSTEM_SCRATCH_TEMPLATE_KEYS.DATA_DEPLOYMENT_QUERIES,
    name: 'Data Deployment Queries',
    description:
      'Creates the scratch org, deploys source metadata, then runs the ordered Account, Product, and Visit Plan data queries.',
    sortOrder: 2,
    config: {
      ...SCRATCH_AND_SOURCE_DEFAULTS,
      orgConfig: {
        upsertQueueIds: false,
        upsertDomainFields: false,
        upsertRequestId: false,
      },
      customSettings: { enabled: false, mode: 'bundled' },
      dataSeed: {
        datasets: [],
        mode: 'query_section',
        querySection: {
          name: 'Core data deployment',
          queries: [
            {
              id: 'accounts',
              name: 'Accounts',
              enabled: true,
              order: 0,
              stage: 0,
              category: 'account',
              object: 'Account',
              soql:
                'SELECT Name, cfs_ob__u_CustomerNumber__c, cfs_ob__Bottler__c '
                + "FROM Account WHERE cfs_ob__Bottler__c = '{{bottler}}'",
              limit: 500,
              bottler: '5000',
              operation: 'upsert',
              externalIdField: 'cfs_ob__u_CustomerNumber__c',
              variables: { bottler: '5000' },
              dependsOn: [],
            },
            {
              id: 'products',
              name: 'Products',
              enabled: true,
              order: 1,
              stage: 1,
              category: 'product',
              object: 'cfs_ob__u_Product__c',
              soql:
                'SELECT Name, cfs_ob__External_Id__c, cfs_ob__Bottler__c '
                + "FROM cfs_ob__u_Product__c WHERE cfs_ob__Bottler__c = '{{bottler}}'",
              limit: 500,
              bottler: '5000',
              operation: 'upsert',
              externalIdField: 'cfs_ob__External_Id__c',
              variables: { bottler: '5000' },
              dependsOn: [],
            },
            {
              id: 'visit-plans',
              name: 'Visit Plans',
              enabled: true,
              order: 2,
              stage: 2,
              category: 'visit_plan',
              object: 'cfs_ob__u_VisitPlan__c',
              soql:
                'SELECT Name, cfs_ob__External_Id__c, cfs_ob__Bottler__c '
                + "FROM cfs_ob__u_VisitPlan__c WHERE cfs_ob__Bottler__c = '{{bottler}}'",
              limit: 500,
              bottler: '5000',
              operation: 'upsert',
              externalIdField: 'cfs_ob__External_Id__c',
              variables: { bottler: '5000' },
              dependsOn: [],
            },
          ],
        },
      },
      pipelineSteps: {
        autoRunDataSeed: true,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    },
  },
  {
    key: SYSTEM_SCRATCH_TEMPLATE_KEYS.CONFIG_SEED_ACCOUNT_PARTNERS,
    name: 'Config Seed & Account Partners',
    description:
      'Creates the scratch org, deploys source metadata, seeds onboarding configuration, and maps Account Partners from the data source org.',
    sortOrder: 3,
    config: {
      ...SCRATCH_AND_SOURCE_DEFAULTS,
      orgConfig: {
        upsertQueueIds: true,
        upsertDomainFields: true,
        upsertRequestId: true,
      },
      customSettings: { enabled: true, mode: 'bundled' },
      dataSeed: {
        datasets: ['OnboardingConfig'],
        mode: 'automatic',
      },
      partnerImport: {
        enabled: true,
        mode: 'org_to_org_matched',
        bottler: '5000',
        perOffice: 20,
        matchOrgDistribution: true,
        salesOfficeConfig: {
          bottler: '5000',
          label: 'Northeast',
          perOfficePartnerLimit: 20,
          roles: ['ZR'],
          offices: ['S003', 'S008', 'S010'],
        },
      },
      pipelineSteps: {
        autoRunDataSeed: true,
        autoRunPartners: true,
        autoRunUsers: false,
      },
    },
  },
] as const;

