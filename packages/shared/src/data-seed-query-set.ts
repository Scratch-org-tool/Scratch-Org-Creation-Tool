import { z } from 'zod';
import { applyLimit, querySetBaseSchema, querySetEntrySchema } from './query-set.js';
import { escapeSoqlLiteral } from './soql.js';

export const accountSeedRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  accountGroup: z.enum(['Z001', 'ZFSV', 'Z003']),
  bottler: z.enum(['5000', '4900', '4600']),
  distributionChannel: z.enum(['Z1', 'Z3']),
  perOfficeLimit: z.number().int().positive().default(20),
  soql: z.string().optional(),
});

export const dataSeedQuerySetSchema = querySetBaseSchema.extend({
  accountRules: z.array(accountSeedRuleSchema).optional(),
});

export type AccountSeedRule = z.infer<typeof accountSeedRuleSchema>;
export type DataSeedQuerySet = z.infer<typeof dataSeedQuerySetSchema>;

export interface CompiledAccountOfficeQuery {
  ruleId: string;
  office: string;
  soql: string;
  accountGroup: AccountSeedRule['accountGroup'];
  bottler: AccountSeedRule['bottler'];
  distributionChannel: AccountSeedRule['distributionChannel'];
}

const BASE_WHERE = (bottler: string) =>
  `cfs_ob__Bottler__c = '${bottler}' ` +
  `AND cfs_ob__Bottler__c != null ` +
  `AND cfs_ob__u_SalesOffice__c != null ` +
  `AND cfs_ob__u_CustomerNumber__c != null ` +
  `AND (cfs_ob__MarkforDeletion__c = false OR cfs_ob__MarkforDeletion__c = null)`;

function activeCustomerClause(accountGroup: AccountSeedRule['accountGroup']): string {
  if (accountGroup === 'Z003') {
    return 'AND cfs_ob__u_ActiveCustomer__c = true';
  }
  return (
    'AND (cfs_ob__u_ActiveCustomer__c = true ' +
    'OR (cfs_ob__u_ActiveCustomer__c = false AND cfs_ob__SuppressionReason__c != null))'
  );
}

export function buildAccountRuleBaseSoql(
  rule: AccountSeedRule,
  fields: string,
): string {
  const channel =
    rule.accountGroup === 'Z003' && rule.distributionChannel === 'Z1'
      ? "IN ('Z1', 'Z3')"
      : `= '${rule.distributionChannel}'`;

  return (
    `SELECT ${fields} FROM Account WHERE ` +
    `${BASE_WHERE(rule.bottler)} ` +
    `AND cfs_ob__u_CustomerAccountGroup__c = '${rule.accountGroup}' ` +
    `AND cfs_ob__u_DistributionChannel__c ${channel} ` +
    `${activeCustomerClause(rule.accountGroup)} ` +
    `ORDER BY LastModifiedDate DESC`
  );
}

export function compileAccountOfficeQueries(
  rule: AccountSeedRule,
  offices: string[],
  fields: string,
): CompiledAccountOfficeQuery[] {
  const base = rule.soql?.trim() || buildAccountRuleBaseSoql(rule, fields);
  const withoutLimit = base.replace(/\bLIMIT\s+\d+\s*$/i, '').trim();

  return offices.map((office) => ({
    ruleId: rule.id,
    office,
    accountGroup: rule.accountGroup,
    bottler: rule.bottler,
    distributionChannel: rule.distributionChannel,
    soql: applyLimit(
      `${withoutLimit} AND cfs_ob__u_SalesOffice__c = '${escapeSoqlLiteral(office)}'`,
      rule.perOfficeLimit,
    ),
  }));
}

export function normalizeDataSeedQuerySet(input: unknown): DataSeedQuerySet {
  const parsed = dataSeedQuerySetSchema.parse(input);
  return {
    ...parsed,
    queries: parsed.queries.map((q) => querySetEntrySchema.parse(q)),
  };
}

export function validateDataSeedQuerySet(input: unknown) {
  const result = dataSeedQuerySetSchema.safeParse(input);
  if (!result.success) {
    return { valid: false as const, errors: result.error.flatten() };
  }
  return { valid: true as const, normalized: normalizeDataSeedQuerySet(result.data) };
}
