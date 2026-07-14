import { z } from 'zod';
import { extractObjectFromSoql } from './query-set.js';
import { bottlerSalesOfficeConfigSchema } from './bottler-sales-office-config.js';
import { dataSeedQuerySetSchema } from './data-seed-query-set.js';
import {
  userProvisionSlotSchema,
  userProvisionTemplateSchema,
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

export const scratchPipelineTemplateConfigSchema = z.object({
  template: z.string().optional().default('config/project-scratch-def.json'),
  duration: z.number().int().positive().optional().default(7),
  installPackage: z.boolean().default(true),
  azureDeploy: scratchPipelineTemplateAzureSchema,
  permissionSets: z.array(z.string()).optional(),
  orgConfig: z.object({
    upsertQueueIds: z.boolean().default(true),
    upsertDomainFields: z.boolean().default(true),
    upsertRequestId: z.boolean().default(true),
  }).optional(),
  customSettings: customSettingsConfigSchema.optional(),
  /** @deprecated Use dataDeploymentOrgId / customSettingsOrgId */
  sourceOrgId: z.string().uuid().optional(),
  dataDeploymentOrgId: z.string().uuid().optional(),
  customSettingsOrgId: z.string().uuid().optional(),
  dataSeed: z.object({
    datasets: z.array(z.enum(['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'])).optional(),
    mode: z.enum(['automatic', 'query_json', 'hybrid']).default('hybrid'),
    querySet: dataSeedQuerySetSchema.optional(),
  }).optional(),
  accountSeedRows: z.array(z.object({
    accountGroup: z.enum(['Z001', 'ZFSV', 'Z003']),
    bottler: z.enum(['5000', '4900', '4600']),
    distributionChannel: z.enum(['Z1', 'Z3']),
    limit: z.number().int().positive(),
  })).optional(),
  partnerImport: z.object({
    enabled: z.boolean().default(false),
    mode: z.enum(['excel', 'org_to_org', 'org_to_org_matched']).default('org_to_org_matched'),
    bottler: z.enum(['5000', '4900', '4600', 'all']).default('5000'),
    perOffice: z.number().int().positive().default(20),
    matchOrgDistribution: z.boolean().default(true),
    salesOfficeConfig: bottlerSalesOfficeConfigSchema.optional(),
    partnerExcelBase64: z.string().optional(),
    sheet: z.string().optional(),
  }).optional(),
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
    templates: z.array(userProvisionTemplateSchema).optional(),
    slots: z.array(userProvisionSlotSchema).optional(),
  }).optional(),
  pipelineSteps: pipelineStepsConfigSchema.optional(),
});

export type ScratchPipelineTemplateConfig = z.infer<typeof scratchPipelineTemplateConfigSchema>;

/** Strip per-run Azure fields (repo/branch) before persisting a template. */
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
