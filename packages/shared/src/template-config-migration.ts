import { hasInsertOperation, type ScratchPipelineTemplateConfig } from './sfdmu-export.js';
import { buildAccountRuleBaseSoql } from './data-seed-query-set.js';
import {
  DEFAULT_EXTERNAL_ID_FIELDS,
  defaultExternalIdField,
  type QueryCategory,
  type QuerySection,
  type QuerySectionQuery,
} from './query-section.js';
import {
  resolveUserProvisionSlots,
  type RoleBottlerMapping,
} from './user-provision-template.js';

type OrgIdConfig = Pick<ScratchPipelineTemplateConfig, 'dataDeploymentOrgId' | 'customSettingsOrgId' | 'sourceOrgId'>;

/** Normalize legacy single sourceOrgId into dual org fields. */
export function migrateTemplateConfig(
  config: ScratchPipelineTemplateConfig,
): ScratchPipelineTemplateConfig {
  const legacy = config.sourceOrgId;
  const hasDualOrgFields = Boolean(config.dataDeploymentOrgId || config.customSettingsOrgId);
  const dataDeploymentOrgId = config.dataDeploymentOrgId ?? (hasDualOrgFields ? undefined : legacy);
  const customSettingsOrgId = config.customSettingsOrgId ?? (hasDualOrgFields ? undefined : legacy);

  const migrated: ScratchPipelineTemplateConfig = {
    ...config,
    dataDeploymentOrgId,
    customSettingsOrgId,
  };

  if (migrated.partnerImport && migrated.partnerImport.perOffice == null) {
    migrated.partnerImport = {
      ...migrated.partnerImport,
      perOffice: 20,
    };
  }

  if (migrated.dataSeed && !migrated.dataSeed.mode) {
    migrated.dataSeed = { ...migrated.dataSeed, mode: 'hybrid' };
  }

  return migrated;
}

export function getDataDeploymentOrgId(config: OrgIdConfig): string | undefined {
  return config.dataDeploymentOrgId
    ?? (!config.dataDeploymentOrgId && !config.customSettingsOrgId ? config.sourceOrgId : undefined);
}

export function getCustomSettingsOrgId(config: OrgIdConfig): string | undefined {
  return config.customSettingsOrgId
    ?? (!config.dataDeploymentOrgId && !config.customSettingsOrgId ? config.sourceOrgId : undefined);
}

function inferLegacyCategory(objectName: string): QueryCategory {
  const normalized = objectName.toLowerCase();
  if (normalized === 'account') return 'account';
  if (normalized.includes('employeemaster')) return 'employee_master';
  if (normalized.includes('accountpartner')) return 'account_partner';
  if (normalized.includes('onboarding_config')) return 'onboarding_config';
  if (normalized.includes('product')) return 'product';
  if (normalized.includes('visit') && normalized.includes('plan')) return 'visit_plan';
  return 'arbitrary';
}

function legacyQueryToSectionQuery(
  query: NonNullable<NonNullable<ScratchPipelineTemplateConfig['dataSeed']>['querySet']>['queries'][number],
  index: number,
): QuerySectionQuery {
  const category = inferLegacyCategory(query.object);
  const operation = query.operation ?? (query.externalIdField ? 'upsert' : undefined);
  if (!operation) {
    throw new Error(
      `Cannot safely migrate legacy query ${query.id}: operation is missing and no externalIdField was provided`,
    );
  }
  if (operation === 'upsert' && !query.externalIdField) {
    throw new Error(
      `Cannot safely migrate legacy upsert query ${query.id} without an explicit externalIdField`,
    );
  }
  return {
    id: query.id,
    name: query.label,
    enabled: true,
    order: query.order ?? index,
    stage: query.order ?? index,
    category,
    object: query.object,
    soql: query.soql,
    limit: query.limit ?? 200,
    operation,
    externalIdField: query.externalIdField,
    variables: query.variables ?? {},
    dependsOn: query.dependsOn ?? [],
  };
}

function accountRowsToQueries(
  rows: NonNullable<ScratchPipelineTemplateConfig['accountSeedRows']>,
  startOrder: number,
): QuerySectionQuery[] {
  return rows.map((row, index) => {
    const id = [
      'account',
      row.accountGroup.toLowerCase(),
      row.bottler,
      row.distributionChannel.toLowerCase(),
    ].join('-');
    return {
      id,
      name: `${row.accountGroup} ${row.bottler} ${row.distributionChannel} accounts`,
      enabled: true,
      order: startOrder + index,
      stage: startOrder + index,
      category: 'account',
      object: 'Account',
      soql:
        'SELECT Name, AccountNumber FROM Account '
        + `WHERE cfs_ob__Bottler__c = '${row.bottler}'`,
      limit: row.limit,
      bottler: row.bottler,
      operation: 'upsert',
      externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.account,
      variables: {},
      dependsOn: [],
    };
  });
}

function addLegacySalesOfficeVariable(soql: string): string {
  if (soql.includes('{{salesOffice}}')) return soql;
  const condition = "cfs_ob__u_SalesOffice__c = '{{salesOffice}}'";
  const trailingClause = soql.search(/\s+(?:ORDER\s+BY|LIMIT)\b/i);
  const body = trailingClause >= 0 ? soql.slice(0, trailingClause) : soql;
  const suffix = trailingClause >= 0 ? soql.slice(trailingClause) : '';
  return `${body} ${/\bWHERE\b/i.test(body) ? 'AND' : 'WHERE'} ${condition}${suffix}`;
}

function buildMigratedQuerySection(
  config: ScratchPipelineTemplateConfig,
): QuerySection | undefined {
  if (config.dataSeed?.querySection) return config.dataSeed.querySection;
  const queries: QuerySectionQuery[] = [];
  for (const query of config.dataSeed?.querySet?.queries ?? []) {
    queries.push(legacyQueryToSectionQuery(query, queries.length));
  }

  for (const rule of config.dataSeed?.querySet?.accountRules ?? []) {
    if (queries.some((query) => query.id === rule.id)) continue;
    queries.push({
      id: rule.id,
      name: rule.label ?? rule.id,
      enabled: true,
      order: queries.length,
      stage: queries.length,
      category: 'account',
      object: 'Account',
      soql: addLegacySalesOfficeVariable(
        rule.soql
          ?? buildAccountRuleBaseSoql(
            rule,
            `Name, ${DEFAULT_EXTERNAL_ID_FIELDS.account}`,
          ),
      ),
      limit: rule.perOfficeLimit,
      bottler: rule.bottler,
      operation: 'upsert',
      externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.account,
      variables: {},
      salesOfficeExpansion: {
        enabled: true,
        variable: 'salesOffice',
      },
      dependsOn: [],
    });
  }

  for (const query of accountRowsToQueries(config.accountSeedRows ?? [], queries.length)) {
    if (!queries.some((existing) => existing.id === query.id)) queries.push(query);
  }
  if (queries.length === 0) return undefined;

  const categoryId = (category: QueryCategory) =>
    queries.find((query) => query.category === category)?.id;
  const accountQueryId = categoryId('account');
  const employeeMasterQueryId = categoryId('employee_master');
  const accountPartnerQueryId = categoryId('account_partner');
  const accountPartnerPlan =
    accountQueryId && employeeMasterQueryId && accountPartnerQueryId
      ? {
          accountQueryId,
          employeeMasterQueryId,
          accountPartnerQueryId,
          accountKeyField: DEFAULT_EXTERNAL_ID_FIELDS.account,
          employeeKeyField: DEFAULT_EXTERNAL_ID_FIELDS.employee,
          mappingAccountKeyField: 'cfs_ob__Account__r.AccountNumber',
          mappingEmployeeKeyField: 'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c',
          mappingRoleField: 'cfs_ob__PartnerRole__c',
          externalIdField: DEFAULT_EXTERNAL_ID_FIELDS.partner,
          externalIdPattern: '{{account}}-{{employee}}-{{role}}',
        }
      : undefined;
  return {
    name: 'Migrated legacy data seed',
    queries,
    accountPartnerPlan,
  };
}

function mappingsFromLegacyTemplates(
  config: ScratchPipelineTemplateConfig,
): RoleBottlerMapping[] | undefined {
  const existing = config.userProvisioning?.roleBottlerMappings;
  if (existing?.length) return existing;
  const mappings = (config.userProvisioning?.templates ?? []).map((template) => ({
    role: template.role,
    bottler: template.bottler,
    permissionSets: [],
    modules: template.modules,
    locations: template.locations,
  }));
  const unique = mappings.filter(
    (mapping, index) =>
      mappings.findIndex(
        (candidate) =>
          candidate.role.trim().toLowerCase() === mapping.role.trim().toLowerCase()
          && candidate.bottler === mapping.bottler,
      ) === index,
  );
  return unique.length ? unique : undefined;
}

/**
 * Add the V2 contracts while retaining every legacy source field. Callers can
 * persist the result only after reviewing it; the migration never deletes
 * querySet, accountSeedRows, accountRules, templates, slots, or users.
 */
export function migrateTemplateConfigToV2(
  input: ScratchPipelineTemplateConfig,
): ScratchPipelineTemplateConfig {
  const config = migrateTemplateConfig(input);
  if (config.customSettings?.mode === 'custom' && !config.customSettings.exportConfig) {
    throw new Error('Cannot migrate custom settings mode to V2 without exportConfig');
  }
  if (hasInsertOperation(config.customSettings?.exportConfig)) {
    throw new Error('Cannot migrate Insert custom settings to resumable V2; use Upsert');
  }
  const unsafeCustomUpsert = config.customSettings?.exportConfig?.objects.find(
    (object) => object.operation.toLowerCase() === 'upsert' && !object.externalId?.trim(),
  );
  if (unsafeCustomUpsert) {
    throw new Error(
      `Cannot safely migrate custom settings upsert ${unsafeCustomUpsert.name ?? unsafeCustomUpsert.query} `
      + 'without an explicit externalId',
    );
  }
  const querySection = buildMigratedQuerySection(config);
  const templates = config.userProvisioning?.templates ?? [];
  const slots = config.userProvisioning?.slots ?? [];
  const resolvedSlots = slots.length ? resolveUserProvisionSlots(slots, templates) : undefined;
  const existingUsers = config.userProvisioning?.users;
  const migratedUsers = existingUsers?.length
    ? existingUsers
    : (resolvedSlots ?? existingUsers);

  return {
    ...config,
    version: 2,
    dataSeed: config.dataSeed
      ? {
          ...config.dataSeed,
          mode: querySection ? 'query_section' : config.dataSeed.mode,
          querySection,
        }
      : undefined,
    userProvisioning: config.userProvisioning
      ? {
          ...config.userProvisioning,
          users: migratedUsers,
          roleBottlerMappings: mappingsFromLegacyTemplates(config),
          defaultProfile: config.userProvisioning.defaultProfile ?? 'Standard User',
          discoveryPolicy: config.userProvisioning.discoveryPolicy ?? 'best_effort',
          usernamePolicy: config.userProvisioning.usernamePolicy ?? {
            strategy: 'email_style',
            seed: 'automation_run',
          },
          emailPolicy: config.userProvisioning.emailPolicy ?? {
            strategy: 'provided',
            seed: 'automation_run',
          },
          execution: config.userProvisioning.execution ?? {
            mode: 'sequential',
            concurrency: 1,
            failurePolicy: 'fail_fast',
            discoveryFailurePolicy: 'fail',
          },
        }
      : undefined,
  };
}
