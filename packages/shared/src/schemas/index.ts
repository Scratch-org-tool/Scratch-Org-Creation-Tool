import { z } from 'zod';
import { normalizeAzureOrgSlug, normalizeAzureProject } from '../azure-utils.js';
import { querySetSchema } from '../query-set.js';
import { ORG_TO_ORG_RECORD_LIMIT_MAX } from '../org-to-org-data.js';

const dataRecordLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(ORG_TO_ORG_RECORD_LIMIT_MAX)
  .default(200);
import {
  customSettingsConfigSchema,
  pipelineStepsConfigSchema,
  sfdmuExportSchema,
  scratchPipelineTemplateConfigSchema,
} from '../sfdmu-export.js';

export * from './auth.js';

export const authorizeOrgSchema = z.object({
  alias: z.string().min(1).max(40),
  instanceUrl: z.string().url().optional().default('https://login.salesforce.com'),
  isDevHub: z.boolean().optional().default(false),
});

export const scratchOrgCreateSchema = z.object({
  alias: z.string().min(1).max(40),
  duration: z.number().min(1).max(30).default(30),
  devHubAlias: z.string().min(1),
  definitionFile: z.string().optional().default('config/project-scratch-def.json'),
  template: z.string().optional().default('config/project-scratch-def.json'),
  description: z.string().max(255).optional(),
  skipSteps: z
    .array(z.enum(['installPackages', 'deployMetadata', 'assignPermissions']))
    .optional()
    .default([]),
});

export const scratchOrgSkipStepSchema = z.object({
  step: z.enum(['installPackages', 'deployMetadata', 'assignPermissions']),
});

export const scratchOrgWizardSchema = scratchOrgCreateSchema;

export const dataDeploySchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  soql: z.string().optional(),
  recordLimit: dataRecordLimitSchema.optional(),
  /** When set, records are upserted by this external-Id field so re-runs are idempotent. */
  externalIdField: z.string().optional(),
});

export const dataDeployPreflightSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  soql: z.string().optional(),
  recordLimit: dataRecordLimitSchema.optional(),
  externalIdField: z.string().optional(),
});

export const dataReplicationSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  soql: z.string().min(1).optional(),
  querySet: querySetSchema.optional(),
  recordTypeMappings: z.record(z.string(), z.string()).optional(),
  recordLimit: dataRecordLimitSchema.optional(),
});

export const querySetCompileSchema = z.object({
  enabledTemplateIds: z.array(z.string()).min(1),
  bottler: z.string().min(1),
  defaultLimit: z.number().int().positive().default(200),
});

export const querySetValidateSchema = z.object({
  querySet: querySetSchema,
});

export const querySetPreviewSchema = z.object({
  sourceOrgId: z.string().uuid(),
  querySet: querySetSchema,
});

export const recordTypeMappingsSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  querySet: querySetSchema.optional(),
  objectName: z.string().default('cfs_ob__Onboarding_Config__c'),
  manualMappings: z.record(z.string(), z.string()).optional(),
});

export const azureDeployConfigSchema = z.object({
  project: z.string().optional(),
  repo: z.string().min(1),
  branch: z.string().min(1),
  manifestPath: z.string().optional(),
});

export const azureConnectSchema = z.object({
  orgSlug: z
    .string()
    .min(1)
    .max(200)
    .transform(normalizeAzureOrgSlug)
    .refine((s) => s.length > 0 && !/[:\/\\]/.test(s), {
      message: 'Enter only the organization slug (e.g. my-org), not the full dev.azure.com URL',
    }),
  pat: z.string().min(1).transform((s) => s.trim()),
  project: z
    .string()
    .optional()
    .transform((v) => normalizeAzureProject(v)),
});

export const dataDeployConfigSchema = z.object({
  enabled: z.boolean().default(true),
  inputMode: z.enum(['builder', 'upload', 'merged']).default('builder'),
  defaultLimit: z.number().int().positive().default(200),
  bottler: z.string().optional(),
  enabledTemplateIds: z.array(z.string()).optional(),
  querySetUpload: querySetSchema.optional(),
  querySet: querySetSchema,
});

export const scratchOrgPipelineSchema = scratchOrgCreateSchema.extend({
  azureDeploy: azureDeployConfigSchema,
  automationRunId: z.string().uuid().optional(),
  sourceOrgId: z.string().uuid().optional(),
  dataDeploymentOrgId: z.string().uuid().optional(),
  customSettingsOrgId: z.string().uuid().optional(),
  orgConfig: z.object({
    upsertQueueIds: z.boolean().default(true),
    upsertDomainFields: z.boolean().default(true),
    upsertRequestId: z.boolean().default(true),
  }).optional(),
  accountSeedRows: z.array(z.object({
    accountGroup: z.enum(['Z001', 'ZFSV', 'Z003']),
    bottler: z.enum(['5000', '4900', '4600']),
    distributionChannel: z.enum(['Z1', 'Z3']),
    limit: z.number().int().positive(),
  })).refine(
    (rows) => !rows.some((r) => r.accountGroup === 'ZFSV' && r.bottler === '5000'),
    { message: 'ZFSV accounts are not available for bottler 5000' },
  ).optional(),
  userProvisioning: z.object({
    users: z.array(z.object({
      role: z.string(),
      bottler: z.string(),
      modules: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string(),
    })).optional(),
    templates: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      bottler: z.enum(['5000', '4900', '4600']),
      role: z.string().min(1),
      modules: z.array(z.string()).default([]),
      locations: z.array(z.string()).default([]),
    })).optional(),
    slots: z.array(z.object({
      templateId: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      role: z.string().optional(),
      bottler: z.enum(['5000', '4900', '4600']).optional(),
      modules: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
  dataSeed: z.object({
    datasets: z.array(z.enum(['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'])).optional(),
    mode: z.enum(['automatic', 'query_json', 'hybrid']).default('hybrid'),
    querySet: z.record(z.unknown()).optional(),
  }).optional(),
  partnerImport: z.object({
    mode: z.enum(['excel', 'org_to_org', 'org_to_org_matched']),
    bottler: z.enum(['5000', '4900', '4600', 'all']),
    perOffice: z.number().int().positive().default(20),
    matchOrgDistribution: z.boolean().default(true),
    salesOfficeConfig: z.record(z.unknown()).optional(),
    excelPath: z.string().optional(),
    sheet: z.string().optional(),
    partnerExcelBase64: z.string().optional(),
  }).optional(),
  customSettings: customSettingsConfigSchema.optional(),
  pipelineSteps: pipelineStepsConfigSchema.optional(),
  permissionSets: z.array(z.string()).optional(),
  templateId: z.string().uuid().optional(),
});

export const customSettingsLoadSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  exportConfig: sfdmuExportSchema.optional(),
  mode: z.enum(['bundled', 'custom']).default('bundled'),
});

export const scratchTemplateCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  config: scratchPipelineTemplateConfigSchema,
});

export const scratchTemplateUpdateSchema = scratchTemplateCreateSchema.partial();

export const pipelineRunActionsSchema = z.object({
  actions: z.array(z.enum(['provision_users', 'load_data_seed', 'load_account_partners'])).min(1),
  partnerExcelBase64: z.string().optional(),
  partnerSheet: z.string().optional(),
});

export const accountSeedPreviewSchema = z.object({
  sourceOrgId: z.string().uuid(),
  rows: z.array(z.object({
    accountGroup: z.enum(['Z001', 'ZFSV', 'Z003']),
    bottler: z.enum(['5000', '4900', '4600']),
    distributionChannel: z.enum(['Z1', 'Z3']),
    limit: z.number().int().positive(),
  })),
});

export const conaSeedRunSchema = z.object({
  automationRunId: z.string().uuid().optional(),
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  datasets: z.array(z.enum(['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'])),
  accountSeedRows: accountSeedPreviewSchema.shape.rows.optional(),
});

export const partnerImportProcessSchema = z.object({
  bottler: z.enum(['5000', '4900', '4600']),
  targetOrgId: z.string().uuid(),
  perOffice: z.number().int().positive().default(30),
  matchOrgDistribution: z.boolean().default(true),
  sheet: z.string().optional(),
  excelBase64: z.string().optional(),
  excelPath: z.string().optional(),
});

export const partnerImportLoadSchema = z.object({
  bottler: z.enum(['5000', '4900', '4600']),
  targetOrgId: z.string().uuid(),
  dryRun: z.boolean().default(false),
});

export const partnerTransferSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  bottler: z.enum(['5000', '4900', '4600', 'all']).default('all'),
});

export const conaUserProvisionSchema = z.object({
  orgId: z.string().uuid(),
  users: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    role: z.string(),
    bottler: z.string(),
    modules: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
  })),
});

export const pipelineResumeSchema = z.object({
  azureDeploy: z.object({
    branch: z.string().optional(),
    repo: z.string().optional(),
    project: z.string().optional(),
  }).optional(),
});

export const deploymentSchema = z.object({
  targetOrgId: z.string().uuid(),
  repo: z.string().min(1),
  branch: z.string().min(1),
  strategy: z.enum(['azure', 'jenkins']),
  sourceOrgId: z.string().uuid().optional(),
});

export const deployNowSchema = deploymentSchema.extend({
  strategy: z.literal('azure'),
  project: z.string().optional(),
  manifestPath: z.string().optional(),
  testLevel: z.enum(['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg']).optional(),
});

export const orgSetupAssignScopeSchema = z.enum(['default_user', 'all_active_users']);

export const orgSetupSchema = z.object({
  orgId: z.string().uuid(),
  namedCredentials: z.array(z.record(z.unknown())).optional(),
  customSettings: z.array(z.record(z.unknown())).optional(),
  customMetadata: z.array(z.record(z.unknown())).optional(),
  permissionSets: z.array(z.string()).optional(),
  assignScope: orgSetupAssignScopeSchema.optional().default('all_active_users'),
  queues: z.array(z.record(z.unknown())).optional(),
  theme: z.string().optional(),
});

export const userProvisionSchema = z.object({
  orgId: z.string().uuid(),
  users: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    username: z.string(),
    profile: z.string().optional(),
    role: z.string().optional(),
    permissionSets: z.array(z.string()).optional(),
  })),
});

export const copilotMessageSchema = z.object({
  message: z.string().min(1).max(8_000),
  sessionId: z.string().max(200).optional(),
  agentType: z.enum(['scratch_org', 'data_deployment', 'defect_investigation', 'release']).optional(),
  context: z
    .record(z.unknown())
    .optional()
    .refine(
      (ctx) => ctx === undefined || JSON.stringify(ctx).length <= 8_000,
      { message: 'context too large (max 8000 characters serialized)' },
    ),
});

export type AuthorizeOrgInput = z.infer<typeof authorizeOrgSchema>;
export type ScratchOrgCreateInput = z.infer<typeof scratchOrgCreateSchema>;
export type ScratchOrgWizardInput = ScratchOrgCreateInput;
export type DataDeployInput = z.infer<typeof dataDeploySchema>;
export type DataDeployPreflightInput = z.infer<typeof dataDeployPreflightSchema>;
export type DataReplicationInput = z.infer<typeof dataReplicationSchema>;
export type QuerySetCompileInput = z.infer<typeof querySetCompileSchema>;
export type ScratchOrgPipelineInput = z.infer<typeof scratchOrgPipelineSchema>;
export type AzureConnectInput = z.infer<typeof azureConnectSchema>;
export type AzureDeployConfig = z.infer<typeof azureDeployConfigSchema>;
export type PipelineResumeInput = z.infer<typeof pipelineResumeSchema>;
export type DeploymentInput = z.infer<typeof deploymentSchema>;
export type DeployNowInput = z.infer<typeof deployNowSchema>;
export type OrgSetupAssignScope = z.infer<typeof orgSetupAssignScopeSchema>;
export type OrgSetupInput = z.infer<typeof orgSetupSchema>;
export type UserProvisionInput = z.infer<typeof userProvisionSchema>;
export type ConaUserProvisionInput = z.infer<typeof conaUserProvisionSchema>;
export type ConaSeedRunInput = z.infer<typeof conaSeedRunSchema>;
export type PartnerImportProcessInput = z.infer<typeof partnerImportProcessSchema>;
export type PipelineRunActionsInput = z.infer<typeof pipelineRunActionsSchema>;
export type CopilotMessageInput = z.infer<typeof copilotMessageSchema>;
export type CustomSettingsLoadInput = z.infer<typeof customSettingsLoadSchema>;
export type ScratchTemplateCreateInput = z.infer<typeof scratchTemplateCreateSchema>;
export type ScratchTemplateUpdateInput = z.infer<typeof scratchTemplateUpdateSchema>;

export {
  orgToOrgCompareSchema,
  orgToOrgDeploySchema,
  type OrgToOrgCompareInput,
  type OrgToOrgDeployInput,
  type OrgToOrgDeployStrategy,
  type OrgToOrgCompareSummary,
  type OrgToOrgCompareResult,
  type OrgToOrgDeployResult,
} from '../org-to-org-data.js';

export {
  defectsWorkItemsQuerySchema,
  updateWorkItemStateSchema,
  defectsProjectQuerySchema,
  AZURE_DEFECT_WORK_ITEM_TYPES,
  type AzureWorkItemSummary,
  type AzureWorkItemDetail,
  type AzureWorkItemComment,
  type AzureWorkItemStateOption,
  type DefectsOverview,
  type DefectsWorkItemsResponse,
  type DefectsWorkItemsQuery,
  type DefectsProjectQuery,
  type AzureDevOpsProjectOption,
  type DefectsProjectsResponse,
  type UpdateWorkItemStateInput,
} from '../azure-work-items.js';

export {
  orgToOrgMetadataDeploySchema,
  orgToOrgMetadataPreviewSchema,
  orgToOrgMetadataPipelineSchema,
  type OrgToOrgMetadataDeployInput,
  type OrgToOrgMetadataPreviewInput,
  type MetadataSelection,
  type MetadataCompareResult,
  FOLDER_METADATA_TYPES,
  buildPackageXml,
  buildDestructiveChangesXml,
  parsePackageXml,
  compareMetadataLists,
  resolveManifestXml,
  CURATED_COMPARE_TYPES,
  buildComparisonItems,
  summarizeComparisonItems,
  classifyMetadataPair,
  metadataCompareStartSchema,
  metadataCompareAnalyzeSchema,
} from '../org-to-org-metadata.js';
