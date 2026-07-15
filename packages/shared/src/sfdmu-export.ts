import { z } from 'zod';
import { gitSourceConfigSchema } from './integrations.js';
import { extractObjectFromSoql } from './query-set.js';
import { bottlerSalesOfficeConfigSchema } from './bottler-sales-office-config.js';
import { dataSeedQuerySetSchema } from './data-seed-query-set.js';
import { querySectionSchema } from './query-section.js';
import {
  unresolvedV2Profiles,
  userProvisioningConfigSchema,
} from './user-provision-template.js';

export const sfdmuExportObjectSchema = z.object({
  query: z.string().min(1),
  operation: z.enum(['Upsert', 'Insert', 'Update', 'Delete', 'upsert', 'insert', 'update', 'delete']),
  name: z.string().optional(),
  externalId: z.string().optional(),
  valueMapping: z.record(z.unknown()).optional(),
});

export const sfdmuExportSchema = z.object({
  objects: z.array(sfdmuExportObjectSchema).min(1),
});

export type SfdmuExportObject = z.infer<typeof sfdmuExportObjectSchema>;
export type SfdmuExportJson = z.infer<typeof sfdmuExportSchema>;

export function hasInsertOperation(exportConfig: SfdmuExportJson | undefined): boolean {
  return exportConfig?.objects.some((object) => object.operation.toLowerCase() === 'insert') ?? false;
}

export const customSettingsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['bundled', 'custom']).default('bundled'),
  exportConfig: sfdmuExportSchema.optional(),
});

export const pipelineStepsConfigSchema = z.object({
  autoRunDataSeed: z.boolean().default(true),
  autoRunPartners: z.boolean().default(false),
  autoRunUsers: z.boolean().default(true),
});

export const scratchPipelineTemplateAzureSchema = z.object({
  manifestPath: z.string().optional(),
}).optional();

export const accountSeedRowSchema = z.object({
  accountGroup: z.enum(['Z001', 'ZFSV', 'Z003']),
  bottler: z.enum(['5000', '4900', '4600']),
  distributionChannel: z.enum(['Z1', 'Z3']),
  limit: z.number().int().positive(),
});

export const dataSeedConfigSchema = z.object({
  datasets: z.array(z.enum(['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'])).optional(),
  mode: z.enum(['automatic', 'query_json', 'hybrid', 'query_section']).default('hybrid'),
  querySet: dataSeedQuerySetSchema.optional(),
  querySection: querySectionSchema.optional(),
});

export const partnerImportConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z
    .enum(['excel', 'org_to_org', 'org_to_org_matched', 'query_section'])
    .default('org_to_org_matched'),
  bottler: z.enum(['5000', '4900', '4600', 'all']).default('5000'),
  perOffice: z.number().int().positive().default(20),
  matchOrgDistribution: z.boolean().default(true),
  salesOfficeConfig: bottlerSalesOfficeConfigSchema.optional(),
  partnerExcelBase64: z.string().optional(),
  sheet: z.string().optional(),
});

const scratchPipelineTemplateConfigBaseSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]).optional(),
  template: z.string().optional().default('config/project-scratch-def.json'),
  duration: z.number().int().positive().optional().default(7),
  installPackage: z.boolean().default(true),
  azureDeploy: scratchPipelineTemplateAzureSchema,
  gitSource: gitSourceConfigSchema.partial().optional(),
  permissionSets: z.array(z.string()).optional(),
  orgConfig: z.object({
    upsertQueueIds: z.boolean().default(true),
    upsertDomainFields: z.boolean().default(true),
    upsertRequestId: z.boolean().default(true),
    bottler: z.string().min(1).optional(),
    configKey: z.string().min(1).optional(),
  }).optional(),
  customSettings: customSettingsConfigSchema.optional(),
  /** @deprecated Use dataDeploymentOrgId / customSettingsOrgId */
  sourceOrgId: z.string().uuid().optional(),
  dataDeploymentOrgId: z.string().uuid().optional(),
  customSettingsOrgId: z.string().uuid().optional(),
  dataSeed: dataSeedConfigSchema.optional(),
  accountSeedRows: z.array(accountSeedRowSchema).optional(),
  partnerImport: partnerImportConfigSchema.optional(),
  userProvisioning: userProvisioningConfigSchema.optional(),
  pipelineSteps: pipelineStepsConfigSchema.optional(),
});

export const scratchPipelineTemplateConfigSchema =
  scratchPipelineTemplateConfigBaseSchema.superRefine((config, context) => {
    if (
      config.version === 2
      && config.customSettings?.mode === 'custom'
      && !config.customSettings.exportConfig
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V2 custom settings mode requires exportConfig',
        path: ['customSettings', 'exportConfig'],
      });
    }
    if (config.version === 2 && hasInsertOperation(config.customSettings?.exportConfig)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V2 resumable custom settings do not support Insert; use Upsert',
        path: ['customSettings', 'exportConfig'],
      });
    }
    if (config.version === 2 && config.dataSeed?.mode === 'query_section' && !config.dataSeed.querySection) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V2 query_section data seed mode requires querySection',
        path: ['dataSeed', 'querySection'],
      });
    }
    if (
      config.version === 2
      && config.partnerImport?.mode === 'query_section'
      && !config.dataSeed?.querySection?.accountPartnerPlan
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'query_section partner mode requires dataSeed.querySection.accountPartnerPlan',
        path: ['dataSeed', 'querySection', 'accountPartnerPlan'],
      });
    }
    if (config.version === 2 && config.userProvisioning) {
      const unresolved = unresolvedV2Profiles(config.userProvisioning);
      if (unresolved.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `V2 provisioning requires a resolvable profile for: ${unresolved.join(', ')}`,
          path: ['userProvisioning', 'defaultProfile'],
        });
      }
    }
  });

export type ScratchPipelineTemplateConfig = z.infer<typeof scratchPipelineTemplateConfigSchema>;

/** Strip per-run repository fields while retaining provider/connection defaults. */
export function sanitizeTemplateConfigForStorage(
  config: ScratchPipelineTemplateConfig,
): ScratchPipelineTemplateConfig {
  const manifestPath = config.azureDeploy?.manifestPath;
  const cleaned = { ...config };
  if (manifestPath) {
    cleaned.azureDeploy = { manifestPath };
  } else {
    delete cleaned.azureDeploy;
  }
  if (config.gitSource) {
    const { repo: _repo, branch: _branch, repositoryId: _repositoryId, ...defaults } =
      config.gitSource;
    cleaned.gitSource = Object.keys(defaults).length ? defaults : undefined;
  }
  return cleaned;
}

function inferExternalId(query: string): string | undefined {
  const selectMatch = query.match(/\bSELECT\s+(.+?)\s+FROM\b/is);
  if (!selectMatch) return undefined;
  const fields = selectMatch[1].split(',').map((f) => f.trim().split(/\s+/).pop()!);
  if (fields.some((f) => /^Name$/i.test(f))) return 'Name';
  if (fields.some((f) => /^SetupOwnerId$/i.test(f))) return 'SetupOwnerId';
  return undefined;
}

export function normalizeSfdmuExport(exportJson: SfdmuExportJson): SfdmuExportJson {
  return {
    objects: exportJson.objects.map((obj) => {
      const name = obj.name ?? extractObjectFromSoql(obj.query) ?? undefined;
      const externalId = obj.externalId ?? inferExternalId(obj.query);
      const operation = obj.operation.charAt(0).toUpperCase() + obj.operation.slice(1).toLowerCase();
      return {
        ...obj,
        name,
        externalId,
        operation: operation as SfdmuExportObject['operation'],
      };
    }),
  };
}

export function validateSfdmuExportSummary(exportJson: SfdmuExportJson) {
  const normalized = normalizeSfdmuExport(exportJson);
  return {
    objectCount: normalized.objects.length,
    objects: normalized.objects.map((o) => ({
      name: o.name ?? 'unknown',
      operation: o.operation,
      hasExternalId: Boolean(o.externalId),
    })),
    warnings: normalized.objects
      .filter((o) => !o.externalId)
      .map((o) => `Object ${o.name ?? 'unknown'} has no inferred externalId`),
    normalized,
  };
}
