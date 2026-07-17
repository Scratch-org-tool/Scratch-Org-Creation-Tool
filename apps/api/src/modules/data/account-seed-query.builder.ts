import {
  ACCOUNT_EXPORT_FIELDS,
  buildGenericDeployQuery,
  escapeSoqlLiteral,
  parseOrgToOrgSoql,
  validateSoqlForObject,
  type ConaManualAccountQuery,
} from '@sfcc/shared';

export type AccountGroup = 'Z001' | 'ZFSV' | 'Z003';
export type Bottler = '5000' | '4900' | '4600';
export type DistributionChannel = 'Z1' | 'Z3';

export interface AccountSeedRow {
  accountGroup: AccountGroup;
  bottler: Bottler;
  distributionChannel: DistributionChannel;
  limit: number;
}

export const ACCOUNT_SEED_EXTERNAL_ID = 'cfs_ob__u_CustomerNumber__c';

export interface ResolvedManualAccountQuery extends ConaManualAccountQuery {
  objectName: 'Account';
  externalIdField: typeof ACCOUNT_SEED_EXTERNAL_ID;
}

const BASE_WHERE = (bottler: string) =>
  `cfs_ob__Bottler__c = '${escapeSoqlLiteral(bottler)}' ` +
  `AND cfs_ob__Bottler__c != null ` +
  `AND cfs_ob__u_SalesOffice__c != null ` +
  `AND cfs_ob__u_CustomerNumber__c != null ` +
  `AND (cfs_ob__MarkforDeletion__c = false OR cfs_ob__MarkforDeletion__c = null)`;

function activeCustomerClause(accountGroup: AccountGroup): string {
  if (accountGroup === 'Z003') {
    return 'AND cfs_ob__u_ActiveCustomer__c = true';
  }
  return (
    'AND (cfs_ob__u_ActiveCustomer__c = true ' +
    'OR (cfs_ob__u_ActiveCustomer__c = false AND cfs_ob__SuppressionReason__c != null))'
  );
}

export function validateAccountSeedRow(row: AccountSeedRow): void {
  if (row.accountGroup === 'ZFSV' && row.bottler === '5000') {
    throw new Error('ZFSV accounts are not available for bottler 5000');
  }
}

export function buildAccountSeedSoql(row: AccountSeedRow): string {
  validateAccountSeedRow(row);
  const channel =
    row.accountGroup === 'Z003' && row.distributionChannel === 'Z1'
      ? "IN ('Z1', 'Z3')"
      : `= '${escapeSoqlLiteral(row.distributionChannel)}'`;

  return (
    `SELECT ${ACCOUNT_EXPORT_FIELDS} FROM Account WHERE ` +
    `${BASE_WHERE(row.bottler)} ` +
    `AND cfs_ob__u_CustomerAccountGroup__c = '${escapeSoqlLiteral(row.accountGroup)}' ` +
    `AND cfs_ob__u_DistributionChannel__c ${channel} ` +
    `${activeCustomerClause(row.accountGroup)} ` +
    `ORDER BY LastModifiedDate DESC LIMIT ${row.limit}`
  );
}

export function buildAccountCountSoql(row: AccountSeedRow): string {
  validateAccountSeedRow(row);
  const channel =
    row.accountGroup === 'Z003' && row.distributionChannel === 'Z1'
      ? "IN ('Z1', 'Z3')"
      : `= '${escapeSoqlLiteral(row.distributionChannel)}'`;

  return (
    `SELECT COUNT() FROM Account WHERE ` +
    `${BASE_WHERE(row.bottler)} ` +
    `AND cfs_ob__u_CustomerAccountGroup__c = '${escapeSoqlLiteral(row.accountGroup)}' ` +
    `AND cfs_ob__u_DistributionChannel__c ${channel} ` +
    `${activeCustomerClause(row.accountGroup)}`
  );
}

/** Validate and normalize user-entered Account SOQL for a bounded bulk upsert. */
export function resolveManualAccountSeedQuery(
  query: ConaManualAccountQuery,
): ResolvedManualAccountQuery {
  try {
    validateSoqlForObject(query.soql, 'Account');
  } catch (error) {
    throw new Error(
      `Manual query "${query.label}" is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const parsed = parseOrgToOrgSoql(query.soql);
  const scalarFields = parsed.fields.filter((field) => field.toLowerCase() !== 'id');
  const unsupported = scalarFields.find((field) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field));
  if (unsupported) {
    throw new Error(
      `Manual query "${query.label}" contains unsupported field expression "${unsupported}". `
      + 'Select only writable Account fields; relationship subqueries and aggregate expressions are not supported.',
    );
  }
  if (!scalarFields.some((field) => field.toLowerCase() === ACCOUNT_SEED_EXTERNAL_ID.toLowerCase())) {
    throw new Error(
      `Manual query "${query.label}" must select ${ACCOUNT_SEED_EXTERNAL_ID} for safe Account upsert matching`,
    );
  }
  if (scalarFields.length < 2) {
    throw new Error(
      `Manual query "${query.label}" must select at least one Account field in addition to `
      + ACCOUNT_SEED_EXTERNAL_ID,
    );
  }

  return {
    ...query,
    objectName: 'Account',
    externalIdField: ACCOUNT_SEED_EXTERNAL_ID,
    soql: buildGenericDeployQuery({
      soql: query.soql,
      objectName: 'Account',
      recordLimit: query.limit,
    }),
  };
}
