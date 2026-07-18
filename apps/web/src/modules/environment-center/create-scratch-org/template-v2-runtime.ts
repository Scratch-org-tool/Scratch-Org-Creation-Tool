import {
  compileQuerySectionPlan,
  resolveUserProvisioningPlan,
  type CompiledQuerySectionPlan,
  type ResolvedProvisionUser,
  type ScratchPipelineTemplateConfig,
} from '@sfcc/shared';

export function parseRuntimeEmailPool(value: string): string[] {
  const emails = value
    .split(/[\n,;]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (new Set(emails).size !== emails.length) throw new Error('Runtime email pool contains duplicates');
  for (const email of emails) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Invalid email address: ${email}`);
  }
  return emails;
}

export interface ProvisioningPlanMetadata {
  alias: string;
  profiles: Array<{ Id: string; Name: string }>;
  permissionSets: Array<{ Id: string; Name: string; Label: string }>;
  missingFields: string[];
}

export interface ResolvedTemplateV2Preview {
  config: ScratchPipelineTemplateConfig;
  queries?: CompiledQuerySectionPlan;
  users: ResolvedProvisionUser[];
  userCount: number;
  errors: string[];
  warnings: string[];
  metadata: ProvisioningPlanMetadata | null;
}

export function buildTemplateV2Preview(
  config: ScratchPipelineTemplateConfig,
  provisioningPlan?: {
    users: ResolvedProvisionUser[];
    errors: string[];
    warnings: string[];
    metadata: ProvisioningPlanMetadata | null;
  },
): ResolvedTemplateV2Preview {
  const errors: string[] = [];
  const dataSourceOrgId = config.dataDeploymentOrgId ?? config.sourceOrgId;
  const customSettingsOrgId = config.customSettingsOrgId ?? config.sourceOrgId;
  const hasConfiguredUsers = Boolean(
    config.userProvisioning?.users?.length
    || config.userProvisioning?.slots?.length
    || config.userProvisioning?.userGenerators?.length,
  );

  if (config.customSettings?.enabled === true && !customSettingsOrgId) {
    errors.push('Select a Custom Settings Org for this template.');
  }
  if (
    config.pipelineSteps?.autoRunDataSeed
    && config.dataSeed
    && !dataSourceOrgId
  ) {
    errors.push('Select a Data Deployment Org for the automatic data deployment.');
  }
  if (
    config.pipelineSteps?.autoRunPartners
    && config.partnerImport?.enabled
    && config.partnerImport.mode !== 'excel'
    && !dataSourceOrgId
  ) {
    errors.push('Select a Data Deployment Org for Account Partner mapping.');
  }
  if (config.pipelineSteps?.autoRunUsers && hasConfiguredUsers && !dataSourceOrgId) {
    errors.push('Select a Data Deployment Org for automatic user provisioning.');
  }

  let queries: CompiledQuerySectionPlan | undefined;
  if (config.dataSeed?.querySection) {
    try {
      const officeConfig = config.partnerImport?.salesOfficeConfig;
      queries = compileQuerySectionPlan(config.dataSeed.querySection, {
        salesOffices: officeConfig?.offices,
        salesOfficesByBottler: officeConfig
          ? { [officeConfig.bottler]: officeConfig.offices }
          : undefined,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Query compilation failed');
    }
  }

  let users = provisioningPlan?.users ?? [];
  if (!provisioningPlan && config.userProvisioning) {
    try {
      users = resolveUserProvisioningPlan(config.userProvisioning, 'server-plan-preview');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'User plan resolution failed');
    }
  }

  return {
    config,
    queries,
    users,
    userCount: users.length,
    errors: [
      ...errors,
      ...(provisioningPlan?.errors ?? []),
    ],
    warnings: provisioningPlan?.warnings ?? [],
    metadata: provisioningPlan?.metadata ?? null,
  };
}
