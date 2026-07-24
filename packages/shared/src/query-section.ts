import { z } from 'zod';
import { ORG_TO_ORG_RECORD_LIMIT_MAX } from './org-to-org-data.js';
import { replaceOrApplyLimit, substituteVariables } from './query-set.js';

export const queryCategorySchema = z.enum([
  'account',
  'employee_master',
  'account_partner',
  'onboarding_config',
  'product',
  'visit_plan',
  'arbitrary',
]);

export const queryOperationSchema = z
  .enum(['insert', 'upsert', 'update', 'delete', 'Insert', 'Upsert', 'Update', 'Delete'])
  .transform((operation) => operation.toLowerCase() as 'insert' | 'upsert' | 'update' | 'delete');

export const DEFAULT_EXTERNAL_ID_FIELDS = Object.freeze({
  role: 'DeveloperName',
  account: 'AccountNumber',
  employee: 'cfs_ob__EmployeeNo__c',
  partner: 'cfs_ob__AccountPartnerExternalId__c',
});

export const salesOfficeExpansionSchema = z
  .union([
    z.boolean(),
    z.object({
      enabled: z.boolean().default(true),
      variable: z.string().min(1).default('salesOffice'),
      offices: z.array(z.string().min(1)).optional(),
    }),
  ])
  .transform((expansion) =>
    typeof expansion === 'boolean'
      ? { enabled: expansion, variable: 'salesOffice' }
      : expansion);

export const querySectionQuerySchema = z.object({
  id: z.string().min(1).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Query id must be stable and URL-safe'),
  name: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int().nonnegative(),
  stage: z.number().int().nonnegative(),
  category: queryCategorySchema,
  object: z.string().min(1).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Invalid Salesforce object API name'),
  soql: z.string().min(1),
  limit: z.number().int().positive(),
  bottler: z.string().min(1).optional(),
  operation: queryOperationSchema,
  externalIdField: z.string().min(1).optional(),
  variables: z.record(z.string()).default({}),
  salesOfficeExpansion: salesOfficeExpansionSchema.optional(),
  dependsOn: z.array(z.string().min(1)).default([]),
});

export const accountPartnerPlanSchema = z.object({
  accountQueryId: z.string().min(1),
  employeeMasterQueryId: z.string().min(1),
  accountPartnerQueryId: z.string().min(1),
  roleQueryId: z.string().min(1).optional(),
  accountKeyField: z.string().min(1).default('AccountNumber'),
  employeeKeyField: z.string().min(1).default('cfs_ob__EmployeeNo__c'),
  mappingAccountKeyField: z.string().min(1)
    .default('cfs_ob__Account__r.AccountNumber'),
  mappingEmployeeKeyField: z.string().min(1)
    .default('cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c'),
  mappingRoleField: z.string().min(1).default('cfs_ob__PartnerRole__c'),
  externalIdField: z.string().min(1).default('cfs_ob__AccountPartnerExternalId__c'),
  externalIdPattern: z.string().min(1).default('{{account}}-{{employee}}-{{role}}'),
  targetDistributionField: z.string().min(1).optional(),
});

const querySectionBaseSchema = z.object({
  name: z.string().min(1),
  queries: z.array(querySectionQuerySchema).min(1),
  accountPartnerPlan: accountPartnerPlanSchema.optional(),
});

export const querySectionSchema = querySectionBaseSchema.superRefine((section, context) => {
  const byId = new Map<string, (typeof section.queries)[number]>();
  for (let index = 0; index < section.queries.length; index += 1) {
    const query = section.queries[index];
    if (byId.has(query.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate query id: ${query.id}`,
        path: ['queries', index, 'id'],
      });
    }
    byId.set(query.id, query);
  }

  for (let index = 0; index < section.queries.length; index += 1) {
    const query = section.queries[index];
    const seen = new Set<string>();
    for (const dependencyId of query.dependsOn) {
      if (seen.has(dependencyId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate dependency: ${dependencyId}`,
          path: ['queries', index, 'dependsOn'],
        });
      }
      seen.add(dependencyId);
      if (dependencyId === query.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Query ${query.id} cannot depend on itself`,
          path: ['queries', index, 'dependsOn'],
        });
      } else if (!byId.has(dependencyId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing dependency ${dependencyId} for query ${query.id}`,
          path: ['queries', index, 'dependsOn'],
        });
      }
    }
  }

  if (!section.accountPartnerPlan) return;
  const references: Array<[keyof typeof section.accountPartnerPlan, string, string | undefined]> = [
    ['accountQueryId', 'account', section.accountPartnerPlan.accountQueryId],
    ['employeeMasterQueryId', 'employee_master', section.accountPartnerPlan.employeeMasterQueryId],
    ['accountPartnerQueryId', 'account_partner', section.accountPartnerPlan.accountPartnerQueryId],
    ['roleQueryId', 'arbitrary', section.accountPartnerPlan.roleQueryId],
  ];
  for (const [field, expectedCategory, id] of references) {
    if (!id) continue;
    const query = byId.get(id);
    if (!query) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Account partner plan references missing query: ${id}`,
        path: ['accountPartnerPlan', field],
      });
    } else if (!query.enabled) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Account partner plan query must be enabled: ${id}`,
        path: ['accountPartnerPlan', field],
      });
    } else if (query.category !== expectedCategory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Query ${id} must have category ${expectedCategory}`,
        path: ['accountPartnerPlan', field],
      });
    }
  }
  const mappingQuery = byId.get(section.accountPartnerPlan.accountPartnerQueryId);
  const mappingExternalId = mappingQuery?.externalIdField
    ?? (mappingQuery ? defaultExternalIdField(mappingQuery.category, mappingQuery.object) : undefined);
  if (mappingExternalId && mappingExternalId !== section.accountPartnerPlan.externalIdField) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        `Account partner mapping query external ID ${mappingExternalId} must match `
        + `accountPartnerPlan.externalIdField ${section.accountPartnerPlan.externalIdField}`,
      path: ['accountPartnerPlan', 'externalIdField'],
    });
  }
  if (section.accountPartnerPlan.roleQueryId) {
    const roleQuery = byId.get(section.accountPartnerPlan.roleQueryId);
    const roleExternalId = roleQuery?.externalIdField
      ?? (roleQuery ? defaultExternalIdField(roleQuery.category, roleQuery.object) : undefined);
    if (roleQuery && !roleExternalId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Role query ${roleQuery.id} requires externalIdField for deterministic lookup`,
        path: ['accountPartnerPlan', 'roleQueryId'],
      });
    }
  }
});

export type QueryCategory = z.infer<typeof queryCategorySchema>;
export type QuerySectionQuery = z.infer<typeof querySectionQuerySchema>;
export type QuerySection = z.infer<typeof querySectionSchema>;
export type AccountPartnerPlan = z.infer<typeof accountPartnerPlanSchema>;

export function defaultExternalIdField(
  category: QueryCategory,
  objectName?: string,
): string | undefined {
  if (objectName?.toLowerCase() === 'userrole') return DEFAULT_EXTERNAL_ID_FIELDS.role;
  if (category === 'account') return DEFAULT_EXTERNAL_ID_FIELDS.account;
  if (category === 'employee_master') return DEFAULT_EXTERNAL_ID_FIELDS.employee;
  if (category === 'account_partner') return DEFAULT_EXTERNAL_ID_FIELDS.partner;
  return undefined;
}

export interface CompileQuerySectionOptions {
  variables?: Record<string, string>;
  salesOffices?: string[];
  salesOfficesByBottler?: Record<string, string[]>;
  maxLimit?: number;
}

export interface CompiledQuerySectionQuery extends QuerySectionQuery {
  sourceQueryId: string;
  salesOffice?: string;
}

export interface CompiledQuerySectionPlan {
  name: string;
  queries: CompiledQuerySectionQuery[];
  accountPartnerPlan?: AccountPartnerPlan;
}

function rootObjectFromSelect(soql: string): string | null {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < soql.length; index += 1) {
    const char = soql[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (
      depth === 0
      && soql.slice(index, index + 4).toUpperCase() === 'FROM'
      && !/[A-Za-z0-9_]/.test(soql[index - 1] ?? '')
      && !/[A-Za-z0-9_]/.test(soql[index + 4] ?? '')
    ) {
      return soql.slice(index + 4).trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1] ?? null;
    }
  }
  return null;
}

function assertSelectOnly(query: QuerySectionQuery): void {
  const soql = query.soql.trim();
  if (!/^SELECT\b/i.test(soql)) {
    throw new Error(`Query ${query.id} must contain SELECT-only SOQL`);
  }
  const withoutTrailingSemicolon = soql.replace(/;+\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error(`Query ${query.id} must contain one SELECT statement`);
  }
  const actualObject = rootObjectFromSelect(withoutTrailingSemicolon);
  if (!actualObject) {
    throw new Error(`Query ${query.id} has no root FROM object`);
  }
  if (actualObject.toLowerCase() !== query.object.toLowerCase()) {
    throw new Error(
      `Query ${query.id} declares object ${query.object} but SOQL selects from ${actualObject}`,
    );
  }
}

function compareQueries(
  left: QuerySectionQuery,
  right: QuerySectionQuery,
  originalIndex: Map<string, number>,
): number {
  return (
    left.stage - right.stage
    || left.order - right.order
    || (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0)
    || left.id.localeCompare(right.id)
  );
}

function topologicallySort(queries: QuerySectionQuery[]): QuerySectionQuery[] {
  const byId = new Map(queries.map((query) => [query.id, query]));
  const originalIndex = new Map(queries.map((query, index) => [query.id, index]));
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const query of queries) {
    indegree.set(query.id, query.dependsOn.length);
    for (const dependencyId of query.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(`Missing or disabled dependency ${dependencyId} for query ${query.id}`);
      }
      dependents.set(dependencyId, [...(dependents.get(dependencyId) ?? []), query.id]);
    }
  }

  const ready = queries
    .filter((query) => indegree.get(query.id) === 0)
    .sort((left, right) => compareQueries(left, right, originalIndex));
  const result: QuerySectionQuery[] = [];
  while (ready.length > 0) {
    const next = ready.shift()!;
    result.push(next);
    for (const dependentId of dependents.get(next.id) ?? []) {
      const remaining = (indegree.get(dependentId) ?? 1) - 1;
      indegree.set(dependentId, remaining);
      if (remaining === 0) {
        ready.push(byId.get(dependentId)!);
        ready.sort((left, right) => compareQueries(left, right, originalIndex));
      }
    }
  }
  if (result.length !== queries.length) {
    const cyclicIds = queries.filter((query) => !result.includes(query)).map((query) => query.id);
    throw new Error(`Query dependency cycle detected: ${cyclicIds.join(', ')}`);
  }
  return result;
}

function expansionOffices(
  query: QuerySectionQuery,
  options: CompileQuerySectionOptions,
): string[] | undefined {
  if (!query.salesOfficeExpansion?.enabled) return undefined;
  const offices =
    query.salesOfficeExpansion.offices
    ?? (query.bottler ? options.salesOfficesByBottler?.[query.bottler] : undefined)
    ?? options.salesOffices;
  if (!offices?.length) {
    throw new Error(`Query ${query.id} requires at least one sales office for expansion`);
  }
  return [...new Set(offices)];
}

export function compileQuerySectionPlan(
  input: unknown,
  options: CompileQuerySectionOptions = {},
): CompiledQuerySectionPlan {
  const section = querySectionSchema.parse(input);
  let enabled = section.queries.filter((query) => query.enabled);
  if (enabled.length === 0) throw new Error('Query section must contain at least one enabled query');

  if (section.accountPartnerPlan) {
    const partner = section.accountPartnerPlan;
    const requiredDependencies = [
      partner.accountQueryId,
      partner.employeeMasterQueryId,
      partner.roleQueryId,
    ].filter((id): id is string => Boolean(id));
    enabled = enabled.map((query) =>
      query.id === partner.accountPartnerQueryId
        ? { ...query, dependsOn: [...new Set([...query.dependsOn, ...requiredDependencies])] }
        : query);
  }

  for (const query of enabled) {
    assertSelectOnly(query);
  }
  const ordered = topologicallySort(enabled);
  const configuredMaximum = options.maxLimit ?? ORG_TO_ORG_RECORD_LIMIT_MAX;
  if (!Number.isFinite(configuredMaximum)) {
    throw new Error('Query section maximum limit must be a finite number');
  }
  const safeMaximum = Math.min(
    Math.max(Math.trunc(configuredMaximum), 1),
    ORG_TO_ORG_RECORD_LIMIT_MAX,
  );
  const compiled: CompiledQuerySectionQuery[] = [];

  for (const query of ordered) {
    const externalIdField =
      query.externalIdField ?? defaultExternalIdField(query.category, query.object);
    if (['upsert', 'update', 'delete'].includes(query.operation) && !externalIdField) {
      throw new Error(`${query.operation} query ${query.id} requires externalIdField`);
    }
    const offices = expansionOffices(query, options);
    const variants = offices ?? [undefined];
    for (const office of variants) {
      const variables = {
        ...query.variables,
        ...options.variables,
        ...(office && query.salesOfficeExpansion
          ? { [query.salesOfficeExpansion.variable]: office }
          : {}),
      };
      const substituted = substituteVariables(query.soql, variables);
      if (/\{\{[^}]+\}\}/.test(substituted)) {
        throw new Error(`Query ${query.id} contains unresolved variables`);
      }
      const limit = Math.min(query.limit, safeMaximum);
      compiled.push({
        ...query,
        id: office ? `${query.id}:${office}` : query.id,
        name: office ? `${query.name} (${office})` : query.name,
        sourceQueryId: query.id,
        externalIdField,
        variables,
        salesOffice: office,
        limit,
        soql: replaceOrApplyLimit(substituted, limit),
      });
    }
  }

  return {
    name: section.name,
    queries: compiled,
    accountPartnerPlan: section.accountPartnerPlan,
  };
}
