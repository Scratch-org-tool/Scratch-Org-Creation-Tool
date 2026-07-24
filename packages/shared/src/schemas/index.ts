import { z } from 'zod';
import { normalizeAzureOrgSlug, normalizeAzureProject } from '../azure-utils.js';
import { querySetSchema } from '../query-set.js';
import { ORG_TO_ORG_RECORD_LIMIT_MAX } from '../org-to-org-data.js';
import { resolveDataWriteOperation } from '../data-runtime.js';
import { gitSourceConfigSchema, normalizeGitSourceConfig } from '../integrations.js';

const dataRecordLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(ORG_TO_ORG_RECORD_LIMIT_MAX)
  .default(200);
import {
  customSettingsConfigSchema,
  dataSeedConfigSchema,
  hasInsertOperation,
  partnerImportConfigSchema,
  pipelineStepsConfigSchema,
  sfdmuExportSchema,
  scratchPipelineTemplateConfigSchema,
} from '../sfdmu-export.js';
import {
  unresolvedV2Profiles,
  userProvisioningConfigSchema,
} from '../user-provision-template.js';

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

export const scratchOrgLaunchModeSchema = z.enum(['create_new', 'configure_existing']);

export const existingOrgOptionsSchema = z.object({
  verifyAuthentication: z.boolean().default(true),
  ensureRequiredPackage: z.boolean().default(true),
});

export const scratchOrgSkipStepSchema = z.object({
  step: z.enum(['installPackages', 'deployMetadata', 'assignPermissions']),
});

export const scratchOrgWizardSchema = scratchOrgCreateSchema;

const dataRuntimeOptionsSchema = z.object({
  operation: z.enum(['insert', 'upsert']).optional(),
  externalIdField: z.string().trim().min(1).optional(),
  dryRun: z.boolean().default(false),
  unknownQuotaPolicy: z.enum(['block', 'warn']).default('block'),
  maxParallelChunks: z.number().int().min(1).max(32).optional(),
  rollback: z.object({
    enabled: z.boolean().default(false),
    maxBytes: z.number().int().positive().max(100 * 1024 * 1024).optional(),
  }).optional(),
});

function addDataOperationIssue(
  data: { operation?: 'insert' | 'upsert'; externalIdField?: string },
  context: z.RefinementCtx,
): void {
  try {
    resolveDataWriteOperation(data.operation, data.externalIdField);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : String(error),
      path: ['externalIdField'],
    });
  }
}

export const dataDeploySchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  soql: z.string().optional(),
  recordLimit: dataRecordLimitSchema.optional(),
  ...dataRuntimeOptionsSchema.shape,
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
}).superRefine(addDataOperationIssue).transform((data) => ({
  ...data,
  ...resolveDataWriteOperation(data.operation, data.externalIdField),
}));

export const dataDeployPreflightSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  objectName: z.string().min(1),
  soql: z.string().optional(),
  recordLimit: dataRecordLimitSchema.optional(),
  ...dataRuntimeOptionsSchema.pick({
    operation: true,
    externalIdField: true,
    dryRun: true,
    unknownQuotaPolicy: true,
  }).shape,
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
}).superRefine(addDataOperationIssue).transform((data) => ({
  ...data,
  ...resolveDataWriteOperation(data.operation, data.externalIdField),
}));

export const dataReplicationSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  soql: z.string().min(1).optional(),
  querySet: querySetSchema.optional(),
  recordTypeMappings: z.record(z.string(), z.string()).optional(),
  recordLimit: dataRecordLimitSchema.optional(),
  ...dataRuntimeOptionsSchema.pick({
    operation: true,
    externalIdField: true,
    dryRun: true,
    unknownQuotaPolicy: true,
    maxParallelChunks: true,
  }).shape,
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
}).superRefine((data, context) => {
  if (!data.querySet && !data.soql) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'querySet or soql is required',
      path: ['querySet'],
    });
  }
  // A replication-level operation is an override, not a default manufactured
  // by parsing. When omitted, each query resolves its own operation (including
  // inferring upsert from that query's explicit external ID).
  if (data.operation !== undefined || data.externalIdField !== undefined) {
    addDataOperationIssue(data, context);
  }
});

const salesforceIdentifierSchema = z.string().trim().min(1).max(255).regex(
  /^[A-Za-z_][A-Za-z0-9_]*$/,
  'Enter a valid Salesforce API name',
);

export const bulkDataUpdateMappingSchema = z.object({
  sourceColumn: z.string().trim().min(1).max(255),
  targetField: salesforceIdentifierSchema,
});

export const bulkDataUpdateConfigSchema = z.object({
  targetOrgId: z.string().uuid(),
  objectName: salesforceIdentifierSchema,
  sheetName: z.string().trim().min(1).max(255).optional(),
  matchColumn: z.string().trim().min(1).max(255),
  matchField: salesforceIdentifierSchema,
  secondaryMatchColumn: z.string().trim().min(1).max(255).optional(),
  secondaryMatchField: salesforceIdentifierSchema.optional(),
  columnMappings: z.array(bulkDataUpdateMappingSchema).min(1).max(50),
  onlyEmptyFields: z.boolean().default(false),
}).superRefine((value, context) => {
  const hasSecondaryColumn = Boolean(value.secondaryMatchColumn?.trim());
  const hasSecondaryField = Boolean(value.secondaryMatchField?.trim());
  if (hasSecondaryColumn !== hasSecondaryField) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secondaryMatchColumn'],
      message: 'Secondary spreadsheet column and Salesforce field must both be set',
    });
  }
  if (
    value.secondaryMatchField
    && value.secondaryMatchField.toLocaleLowerCase() === value.matchField.toLocaleLowerCase()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secondaryMatchField'],
      message: 'Secondary matching field must be different from the primary matching field',
    });
  }
  const sourceColumns = new Set<string>();
  const targetFields = new Set<string>();
  value.columnMappings.forEach((mapping, index) => {
    const sourceKey = mapping.sourceColumn.toLocaleLowerCase();
    const targetKey = mapping.targetField.toLocaleLowerCase();
    if (sourceColumns.has(sourceKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['columnMappings', index, 'sourceColumn'],
        message: `Spreadsheet column is mapped more than once: ${mapping.sourceColumn}`,
      });
    }
    if (targetFields.has(targetKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['columnMappings', index, 'targetField'],
        message: `Salesforce field is mapped more than once: ${mapping.targetField}`,
      });
    }
    if (targetKey === value.matchField.toLocaleLowerCase()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['columnMappings', index, 'targetField'],
        message: 'The matching field cannot also be updated',
      });
    }
    if (
      value.secondaryMatchField
      && targetKey === value.secondaryMatchField.toLocaleLowerCase()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['columnMappings', index, 'targetField'],
        message: 'A secondary matching field cannot also be updated',
      });
    }
    sourceColumns.add(sourceKey);
    targetFields.add(targetKey);
  });
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

const scratchOrgPipelineCommonSchema = scratchOrgCreateSchema.omit({
  alias: true,
  devHubAlias: true,
}).extend({
  version: z.union([z.literal(1), z.literal(2)]).optional(),
  /**
   * Retained in the immutable run snapshot for UI/audit fidelity. Execution
   * uses skipSteps, which the template resolver derives from this flag.
   */
  installPackage: z.boolean().optional(),
  azureDeploy: azureDeployConfigSchema.optional(),
  gitSource: gitSourceConfigSchema.optional(),
  automationRunId: z.string().uuid().optional(),
  sourceOrgId: z.string().uuid().optional(),
  dataDeploymentOrgId: z.string().uuid().optional(),
  customSettingsOrgId: z.string().uuid().optional(),
  orgConfig: z.object({
    upsertQueueIds: z.boolean().default(true),
    upsertDomainFields: z.boolean().default(true),
    upsertRequestId: z.boolean().default(true),
    bottler: z.string().min(1).optional(),
    configKey: z.string().min(1).optional(),
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
  userProvisioning: userProvisioningConfigSchema.optional(),
  dataSeed: dataSeedConfigSchema.optional(),
  partnerImport: partnerImportConfigSchema.extend({
    excelPath: z.string().optional(),
  }).optional(),
  customSettings: customSettingsConfigSchema.optional(),
  pipelineSteps: pipelineStepsConfigSchema.optional(),
  permissionSets: z.array(z.string().trim().min(1)).max(100).optional(),
  templateId: z.string().uuid().optional(),
  foundationTemplateId: z.string().uuid().optional(),
  dataTemplateId: z.string().uuid().optional(),
  pipelineScope: z.object({
    sourceDeployment: z.boolean().default(true),
    dataDeployment: z.boolean().default(true),
  }).optional(),
});

const scratchOrgPipelineModeSchema = z.discriminatedUnion('mode', [
  scratchOrgPipelineCommonSchema.extend({
    mode: z.literal('create_new'),
    alias: scratchOrgCreateSchema.shape.alias,
    devHubAlias: scratchOrgCreateSchema.shape.devHubAlias,
    existingOrgConnectionId: z.undefined().optional(),
    existingOrgOptions: existingOrgOptionsSchema.optional(),
  }),
  scratchOrgPipelineCommonSchema.extend({
    mode: z.literal('configure_existing'),
    existingOrgConnectionId: z.string().uuid(),
    existingOrgOptions: existingOrgOptionsSchema.default({
      verifyAuthentication: true,
      ensureRequiredPackage: true,
    }),
    // These are populated from the authoritative target, never trusted from
    // the launch payload.
    alias: scratchOrgCreateSchema.shape.alias.optional(),
    devHubAlias: scratchOrgCreateSchema.shape.devHubAlias.optional(),
  }),
]);

export const scratchOrgPipelineSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
    const value = input as Record<string, unknown>;
    return { ...value, mode: value.mode ?? 'create_new' };
  },
  scratchOrgPipelineModeSchema,
).superRefine((value, context) => {
  const scope = value.pipelineScope ?? { sourceDeployment: true, dataDeployment: true };
  if (scope.sourceDeployment && !value.gitSource && !value.azureDeploy) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'gitSource or azureDeploy is required',
      path: ['gitSource'],
    });
  }
  if (
    value.version === 2
    && value.customSettings?.mode === 'custom'
    && !value.customSettings.exportConfig
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'V2 custom settings mode requires exportConfig',
      path: ['customSettings', 'exportConfig'],
    });
  }
  if (value.version === 2 && hasInsertOperation(value.customSettings?.exportConfig)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'V2 resumable custom settings do not support Insert; use Upsert',
      path: ['customSettings', 'exportConfig'],
    });
  }
  if (value.version === 2 && value.userProvisioning) {
    const unresolved = unresolvedV2Profiles(value.userProvisioning);
    if (unresolved.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `V2 provisioning requires a resolvable profile for: ${unresolved.join(', ')}`,
        path: ['userProvisioning', 'defaultProfile'],
      });
    }
  }
}).transform(normalizeGitSourceConfig);

export const scratchOrgPipelineEligibilityRequestSchema = z.record(z.unknown());

/** Canonical aliases used by launch and pre-launch preview API clients. */
export const scratchOrgPipelineLaunchSchema = scratchOrgPipelineSchema;
export const scratchOrgPipelinePreviewSchema = scratchOrgPipelineSchema;

export const scratchOrgAdoptSchema = z.object({
  alias: z.string().min(1).max(255),
});

export const automationRunRecentQuerySchema = z.object({
  target: z.string().trim().min(1).max(255).optional(),
  targetOrgConnectionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const customSettingsLoadSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  exportConfig: sfdmuExportSchema.optional(),
  mode: z.enum(['bundled', 'master', 'custom']).default('bundled'),
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
});

export const scratchTemplateCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  config: scratchPipelineTemplateConfigSchema,
});

export const scratchTemplateUpdateSchema = scratchTemplateCreateSchema.partial();

export const pipelineRunActionsSchema = z.object({
  actions: z
    .array(z.enum(['provision_users', 'load_data_seed', 'load_account_partners']))
    .length(1, 'Queue one post-deploy action at a time'),
  datasets: z.array(
    z.enum(['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts']),
  ).min(1).max(4).optional(),
  partnerMode: z.enum(['excel', 'org_to_org', 'org_to_org_matched']).optional(),
  partnerBottler: z.enum(['5000', '4900', '4600', 'all']).optional(),
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

export const conaManualSeedQuerySchema = z.object({
  id: z.string().trim().min(1).max(80).regex(
    /^[A-Za-z0-9_-]+$/,
    'Query id may contain only letters, numbers, underscores, and hyphens',
  ),
  label: z.string().trim().min(1).max(120),
  soql: z.string().trim().min(1).max(100_000),
  limit: z.number().int().min(1).max(100_000).default(500),
});

export const conaManualAccountQuerySchema = conaManualSeedQuerySchema;

export const conaSeedRunSchema = z.object({
  automationRunId: z.string().uuid().optional(),
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  datasets: z.array(z.enum(['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'])),
  accountSeedRows: accountSeedPreviewSchema.shape.rows.optional(),
  accountQueryMode: z.enum(['guided', 'manual']).default('guided'),
  manualAccountQueries: z.array(conaManualAccountQuerySchema).max(20).optional(),
  onboardingQueryMode: z.enum(['automatic', 'manual']).default('automatic'),
  manualOnboardingQueries: z.array(conaManualSeedQuerySchema).max(20).optional(),
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
}).superRefine((data, context) => {
  for (const [field, queries] of [
    ['manualAccountQueries', data.manualAccountQueries],
    ['manualOnboardingQueries', data.manualOnboardingQueries],
  ] as const) {
    const seen = new Set<string>();
    queries?.forEach((query, index) => {
      if (seen.has(query.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field, index, 'id'],
          message: `Duplicate manual query id: ${query.id}`,
        });
      }
      seen.add(query.id);
    });
  }
  if (
    data.datasets.includes('Accounts')
    && data.accountQueryMode === 'manual'
    && !data.manualAccountQueries?.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['manualAccountQueries'],
      message: 'Add at least one manual Account query',
    });
  }
  if (
    data.datasets.includes('OnboardingConfig')
    && data.onboardingQueryMode === 'manual'
    && !data.manualOnboardingQueries?.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['manualOnboardingQueries'],
      message: 'Add at least one manual OnboardingConfig query',
    });
  }
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
}).refine((data) => data.sourceOrgId !== data.targetOrgId, {
  message: 'Source and target org must differ',
  path: ['targetOrgId'],
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
  gitSource: gitSourceConfigSchema.partial().optional(),
});

export const deploymentSchema = z.object({
  targetOrgId: z.string().uuid(),
  repo: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  project: z.string().optional(),
  manifestPath: z.string().optional(),
  strategy: z.enum(['azure', 'jenkins']).optional(),
  gitSource: gitSourceConfigSchema.optional(),
  azureDeploy: azureDeployConfigSchema.optional(),
  sourceOrgId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (!value.gitSource && !value.azureDeploy && (!value.repo || !value.branch)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'gitSource, azureDeploy, or repo and branch are required',
      path: ['gitSource'],
    });
  }
}).transform((value) => {
  const legacyAzure = value.azureDeploy ?? (
    value.repo && value.branch && value.strategy !== 'jenkins'
      ? {
          project: value.project,
          repo: value.repo,
          branch: value.branch,
          manifestPath: value.manifestPath,
        }
      : undefined
  );
  const normalized = normalizeGitSourceConfig({ ...value, azureDeploy: legacyAzure });
  return {
    ...normalized,
    repo: normalized.gitSource?.repo ?? value.repo!,
    branch: normalized.gitSource?.branch ?? value.branch!,
    strategy: value.strategy ?? 'azure',
  };
});

export const deployNowSchema = z.object({
  targetOrgId: z.string().uuid(),
  sourceOrgId: z.string().uuid().optional(),
  repo: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  project: z.string().optional(),
  manifestPath: z.string().optional(),
  strategy: z.literal('azure').optional(),
  gitSource: gitSourceConfigSchema.optional(),
  azureDeploy: azureDeployConfigSchema.optional(),
  testLevel: z.enum(['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg']).optional(),
}).superRefine((value, context) => {
  if (!value.gitSource && !value.azureDeploy && (!value.repo || !value.branch)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'gitSource, azureDeploy, or repo and branch are required',
      path: ['gitSource'],
    });
  }
}).transform((value) => {
  const azureDeploy = value.azureDeploy ?? (
    value.repo && value.branch
      ? {
          project: value.project,
          repo: value.repo,
          branch: value.branch,
          manifestPath: value.manifestPath,
        }
      : undefined
  );
  const normalized = normalizeGitSourceConfig({ ...value, azureDeploy });
  return {
    ...normalized,
    repo: normalized.gitSource!.repo,
    branch: normalized.gitSource!.branch,
    project: normalized.gitSource!.project,
    manifestPath: normalized.gitSource!.manifestPath,
    strategy: 'azure' as const,
  };
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
export type BulkDataUpdateConfig = z.infer<typeof bulkDataUpdateConfigSchema>;
export type BulkDataUpdateMapping = z.infer<typeof bulkDataUpdateMappingSchema>;
export type QuerySetCompileInput = z.infer<typeof querySetCompileSchema>;
export type ScratchOrgPipelineInput = z.infer<typeof scratchOrgPipelineSchema>;
export type ScratchOrgPipelineLaunchInput = z.infer<typeof scratchOrgPipelineLaunchSchema>;
export type ScratchOrgPipelinePreviewInput = z.infer<typeof scratchOrgPipelinePreviewSchema>;
export type ScratchOrgLaunchMode = z.infer<typeof scratchOrgLaunchModeSchema>;
export type ExistingOrgOptions = z.infer<typeof existingOrgOptionsSchema>;
export type ScratchOrgPipelineEligibilityRequest = z.infer<
  typeof scratchOrgPipelineEligibilityRequestSchema
>;
export type ScratchOrgAdoptInput = z.infer<typeof scratchOrgAdoptSchema>;
export type AutomationRunRecentQuery = z.infer<typeof automationRunRecentQuerySchema>;
export type AzureConnectInput = z.infer<typeof azureConnectSchema>;
export type AzureDeployConfig = z.infer<typeof azureDeployConfigSchema>;
export type PipelineResumeInput = z.infer<typeof pipelineResumeSchema>;
export type DeploymentInput = z.infer<typeof deploymentSchema>;
export type DeployNowInput = z.infer<typeof deployNowSchema>;
export type OrgSetupAssignScope = z.infer<typeof orgSetupAssignScopeSchema>;
export type OrgSetupInput = z.infer<typeof orgSetupSchema>;
export type UserProvisionInput = z.infer<typeof userProvisionSchema>;
export type ConaUserProvisionInput = z.infer<typeof conaUserProvisionSchema>;
export type ConaManualSeedQuery = z.infer<typeof conaManualSeedQuerySchema>;
export type ConaManualAccountQuery = z.infer<typeof conaManualAccountQuerySchema>;
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
