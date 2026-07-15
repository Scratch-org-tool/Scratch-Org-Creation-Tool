import {
  compileQuerySectionPlan,
  expandUserGenerators,
  migrateTemplateConfigToV2,
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

export function applyRuntimeEmailPool(
  input: ScratchPipelineTemplateConfig,
  poolText: string,
): ScratchPipelineTemplateConfig {
  const emails = parseRuntimeEmailPool(poolText);
  if (!emails.length) return input;
  const provisioning = input.userProvisioning;
  if (!provisioning?.teams?.length) throw new Error('This template has no team email pool to replace');
  return {
    ...input,
    userProvisioning: {
      ...provisioning,
      teams: provisioning.teams.map((team) => ({
        ...team,
        emailPool: { ...team.emailPool, emails },
      })),
    },
  };
}

export interface ResolvedTemplateV2Preview {
  config: ScratchPipelineTemplateConfig;
  queries?: CompiledQuerySectionPlan;
  users: ResolvedProvisionUser[];
  userCount: number;
  errors: string[];
}

export function resolveTemplateV2Preview(
  input: ScratchPipelineTemplateConfig,
  options: {
    seed: string;
    runtimeEmailPool?: string;
  },
): ResolvedTemplateV2Preview {
  const errors: string[] = [];
  let config = input;
  try {
    config = migrateTemplateConfigToV2(config);
    if (options.runtimeEmailPool?.trim()) config = applyRuntimeEmailPool(config, options.runtimeEmailPool);
    if (config.userProvisioning?.users?.length && config.userProvisioning.slots?.length) {
      // Migration deliberately retains legacy slots for old edit paths. At
      // runtime their resolved concrete copies are authoritative, so do not
      // enqueue both representations of the same users.
      config = {
        ...config,
        userProvisioning: { ...config.userProvisioning, slots: undefined },
      };
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Template migration failed');
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

  let generated: ResolvedProvisionUser[] = [];
  const provisioning = config.userProvisioning;
  if (provisioning?.userGenerators?.length) {
    try {
      generated = expandUserGenerators(provisioning.userGenerators, {
        automationRunId: options.seed,
        teams: provisioning.teams,
        roleBottlerMappings: provisioning.roleBottlerMappings,
        usernamePolicy: provisioning.usernamePolicy,
        emailPolicy: provisioning.emailPolicy,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'User generation failed');
    }
  }

  const concrete = (provisioning?.users ?? []).map((user) => ({
    ...user,
    modules: user.modules ?? [],
    locations: user.locations ?? [],
  }));
  const users = [...concrete, ...generated];
  const legacyCount = provisioning?.slots?.length
    ? provisioning.slots.length
    : (provisioning?.users?.length ?? 0);

  return {
    config,
    queries,
    users,
    userCount: provisioning?.userGenerators?.length ? users.length : legacyCount,
    errors,
  };
}
