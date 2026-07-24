import { z } from 'zod';
import type { ScratchPipelineTemplateConfig } from './sfdmu-export.js';
import { SYSTEM_SCRATCH_TEMPLATE_KEYS } from './scratch-template-presets.js';

/** Legacy system keys removed from the product UI and bootstrap. */
export const REMOVED_SYSTEM_SCRATCH_TEMPLATE_KEYS = [
  'data-deployment-queries',
  'config-seed-account-partners',
] as const;

export type RemovedSystemScratchTemplateKey =
  (typeof REMOVED_SYSTEM_SCRATCH_TEMPLATE_KEYS)[number];

export const pipelineScopeSchema = z.object({
  sourceDeployment: z.boolean().default(true),
  dataDeployment: z.boolean().default(true),
}).refine((scope) => scope.sourceDeployment || scope.dataDeployment, {
  message: 'Select at least one deployment scope',
});

export type PipelineScope = z.infer<typeof pipelineScopeSchema>;

export const DEFAULT_CREATE_PIPELINE_SCOPE: PipelineScope = {
  sourceDeployment: true,
  dataDeployment: true,
};

export const DEFAULT_CONFIGURE_EXISTING_PIPELINE_SCOPE: PipelineScope = {
  sourceDeployment: true,
  dataDeployment: false,
};

export function isRemovedSystemTemplateKey(systemKey: string | null | undefined): boolean {
  return REMOVED_SYSTEM_SCRATCH_TEMPLATE_KEYS.includes(
    systemKey as RemovedSystemScratchTemplateKey,
  );
}

export function resolvePipelineScope(
  value: PipelineScope | null | undefined,
  mode: 'create_new' | 'configure_existing' = 'create_new',
): PipelineScope {
  if (value) return pipelineScopeSchema.parse(value);
  return mode === 'configure_existing'
    ? { ...DEFAULT_CONFIGURE_EXISTING_PIPELINE_SCOPE }
    : { ...DEFAULT_CREATE_PIPELINE_SCOPE };
}

export function resolveSystemTemplateIds(
  templates: Array<{ id: string; systemKey?: string | null }>,
): { foundationId?: string; masterId?: string } {
  return {
    foundationId: templates.find(
      (template) => template.systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT,
    )?.id,
    masterId: templates.find(
      (template) => template.systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE,
    )?.id,
  };
}

type ScratchOrgSkipStepKey = 'installPackages' | 'deployMetadata' | 'assignPermissions';

function buildScopeSkipSteps(
  scope: PipelineScope,
  installPackage?: boolean,
): ScratchOrgSkipStepKey[] {
  const skip: ScratchOrgSkipStepKey[] = [];
  if (installPackage === false) skip.push('installPackages');
  if (!scope.sourceDeployment) skip.push('deployMetadata', 'assignPermissions');
  return skip;
}

const DISABLED_DATA_PIPELINE_STEPS = {
  autoRunDataSeed: false,
  autoRunPartners: false,
  autoRunUsers: false,
} as const;

const DISABLED_CUSTOM_SETTINGS = { enabled: false, mode: 'bundled' as const };

/**
 * Merge foundation (scratch + metadata) with master (SFDMU data) and apply scope.
 */
export function composePipelineConfig(input: {
  foundation: ScratchPipelineTemplateConfig;
  master?: ScratchPipelineTemplateConfig;
  scope: PipelineScope;
}): ScratchPipelineTemplateConfig & {
  pipelineScope: PipelineScope;
  skipSteps?: ScratchOrgSkipStepKey[];
} {
  const scope = pipelineScopeSchema.parse(input.scope);
  const { foundation, master } = input;

  let composed: ScratchPipelineTemplateConfig = { ...foundation };

  if (scope.sourceDeployment && scope.dataDeployment && master) {
    composed = {
      ...foundation,
      orgConfig: master.orgConfig,
      customSettings: master.customSettings,
      pipelineSteps: master.pipelineSteps,
      permissionSets: master.permissionSets ?? foundation.permissionSets,
      userProvisioning: master.userProvisioning ?? foundation.userProvisioning,
      dataSeed: undefined,
      partnerImport: undefined,
      accountSeedRows: undefined,
    };
  } else if (scope.sourceDeployment) {
    composed = {
      ...foundation,
      orgConfig: foundation.orgConfig ?? {
        upsertQueueIds: false,
        upsertDomainFields: false,
        upsertRequestId: false,
      },
      customSettings: DISABLED_CUSTOM_SETTINGS,
      pipelineSteps: { ...DISABLED_DATA_PIPELINE_STEPS },
      dataSeed: undefined,
      partnerImport: undefined,
      accountSeedRows: undefined,
    };
  } else if (scope.dataDeployment && master) {
    composed = {
      ...foundation,
      orgConfig: master.orgConfig,
      customSettings: master.customSettings,
      pipelineSteps: master.pipelineSteps,
      permissionSets: master.permissionSets ?? foundation.permissionSets,
      userProvisioning: master.userProvisioning ?? foundation.userProvisioning,
      dataSeed: undefined,
      partnerImport: undefined,
      accountSeedRows: undefined,
    };
  }

  if (!scope.dataDeployment) {
    composed = {
      ...composed,
      customSettings: DISABLED_CUSTOM_SETTINGS,
      pipelineSteps: { ...DISABLED_DATA_PIPELINE_STEPS },
      dataSeed: undefined,
      partnerImport: undefined,
      accountSeedRows: undefined,
    };
  }

  const skipSteps = buildScopeSkipSteps(scope, composed.installPackage);
  return {
    ...composed,
    pipelineScope: scope,
    ...(skipSteps.length ? { skipSteps } : {}),
  };
}

export function pipelineScopeRequiresGitSource(scope: PipelineScope | null | undefined): boolean {
  return resolvePipelineScope(scope).sourceDeployment;
}

export function pipelineScopeRequiresDataSource(scope: PipelineScope | null | undefined): boolean {
  const resolved = resolvePipelineScope(scope);
  return resolved.dataDeployment;
}
