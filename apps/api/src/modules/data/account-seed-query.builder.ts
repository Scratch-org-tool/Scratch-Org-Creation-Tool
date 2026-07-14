import { ACCOUNT_EXPORT_FIELDS } from '@sfcc/shared';

export type AccountGroup = 'Z001' | 'ZFSV' | 'Z003';
export type Bottler = '5000' | '4900' | '4600';
export type DistributionChannel = 'Z1' | 'Z3';

export interface AccountSeedRow {
  accountGroup: AccountGroup;
  bottler: Bottler;
  distributionChannel: DistributionChannel;
  limit: number;
}

const BASE_WHERE = (bottler: string) =>
  `cfs_ob__Bottler__c = '${bottler}' ` +
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
      : `= '${row.distributionChannel}'`;

  return (
    `SELECT ${ACCOUNT_EXPORT_FIELDS} FROM Account WHERE ` +
    `${BASE_WHERE(row.bottler)} ` +
    `AND cfs_ob__u_CustomerAccountGroup__c = '${row.accountGroup}' ` +
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
      : `= '${row.distributionChannel}'`;

  return (
    `SELECT COUNT() FROM Account WHERE ` +
    `${BASE_WHERE(row.bottler)} ` +
    `AND cfs_ob__u_CustomerAccountGroup__c = '${row.accountGroup}' ` +
    `AND cfs_ob__u_DistributionChannel__c ${channel} ` +
    `${activeCustomerClause(row.accountGroup)}`
  );
}
