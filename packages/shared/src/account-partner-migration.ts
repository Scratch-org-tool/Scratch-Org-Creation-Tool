import { z } from 'zod';
import {
  buildGenericDeployQuery,
  extractFieldsFromSoql,
} from './query-set.js';
import { validateSoqlForObject } from './org-to-org-data.js';

export const ACCOUNT_PARTNER_OBJECT = 'cfs_ob__AccountPartner__c';
export const EMPLOYEE_MASTER_OBJECT = 'cfs_ob__EmployeeMaster__c';
export const ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD =
  'cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c';
export const ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD =
  'cfs_ob__Account__r.AccountNumber';
export const ACCOUNT_PARTNER_ACCOUNT_KEY_FIELDS = [
  ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
  ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD,
] as const;
export const ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD =
  'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c';
export const ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD = 'cfs_ob__Account__c';
export const ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD = 'cfs_ob__EmployeeMaster__c';
export const ACCOUNT_PARTNER_ROLE_FIELD = 'cfs_ob__PartnerRole__c';
export const ACCOUNT_PARTNER_FUNCTION_FIELD = 'cfs_ob__PartnerFunction__c';
export const ACCOUNT_PARTNER_BOTTLER_FIELD = 'cfs_ob__Bottler__c';
export const ACCOUNT_PARTNER_OFFICE_FIELD = 'cfs_ob__Sales_Office__c';
export const ACCOUNT_PARTNER_EXTERNAL_ID_FIELD =
  'cfs_ob__AccountPartnerExternalId__c';

export const DEFAULT_ACCOUNT_PARTNER_SOQL = `SELECT
  ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD},
  ${ACCOUNT_PARTNER_ROLE_FIELD},
  ${ACCOUNT_PARTNER_FUNCTION_FIELD},
  ${ACCOUNT_PARTNER_BOTTLER_FIELD},
  ${ACCOUNT_PARTNER_OFFICE_FIELD},
  ${ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD},
  ${ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD},
  ${ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD}
FROM ${ACCOUNT_PARTNER_OBJECT}
WHERE ${ACCOUNT_PARTNER_BOTTLER_FIELD} = '5000'`;

const migrationBaseSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  bottler: z.enum(['5000', '4900', '4600']),
  partnerSoql: z.string().trim().min(1).max(100_000),
  recordLimit: z.number().int().min(1).max(100_000).default(10_000),
});

export const accountPartnerMigrationSchema = migrationBaseSchema
  .refine((data) => data.sourceOrgId !== data.targetOrgId, {
    message: 'Source and target org must differ',
    path: ['targetOrgId'],
  })
  .superRefine((data, context) => {
    try {
      validateSoqlForObject(data.partnerSoql, ACCOUNT_PARTNER_OBJECT);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['partnerSoql'],
        message: error instanceof Error ? error.message : 'Invalid Account Partner SOQL',
      });
      return;
    }

    const fields = new Set(
      extractFieldsFromSoql(data.partnerSoql).map((field) => field.toLowerCase()),
    );
    const required = [
      ...ACCOUNT_PARTNER_ACCOUNT_KEY_FIELDS,
      ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
      ACCOUNT_PARTNER_BOTTLER_FIELD,
      ACCOUNT_PARTNER_OFFICE_FIELD,
    ];
    for (const field of required) {
      if (!fields.has(field.toLowerCase())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['partnerSoql'],
          message: `Account Partner query must select ${field}`,
        });
      }
    }
    if (
      !fields.has(ACCOUNT_PARTNER_ROLE_FIELD.toLowerCase())
      && !fields.has(ACCOUNT_PARTNER_FUNCTION_FIELD.toLowerCase())
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['partnerSoql'],
        message:
          `Account Partner query must select ${ACCOUNT_PARTNER_ROLE_FIELD} `
          + `or ${ACCOUNT_PARTNER_FUNCTION_FIELD}`,
      });
    }
  });

export type AccountPartnerMigrationInput = z.infer<typeof accountPartnerMigrationSchema>;

export interface AccountPartnerMigrationStats {
  total: number;
  ready: number;
  toCreate: number;
  toUpdate: number;
  duplicates: number;
  externalIdCollisions: number;
  skippedWrongBottler: number;
  skippedMissingOffice: number;
  skippedMissingAccountKey: number;
  skippedMissingEmployeeKey: number;
  skippedMissingRole: number;
  skippedTargetAccount: number;
  skippedTargetEmployee: number;
}

export interface AccountPartnerTargetReference {
  id: string;
  key: string;
  name: string;
}

export interface AccountPartnerNameWriteConfig {
  fieldName: string;
  maxLength: number;
}

export interface AccountPartnerMigrationResult {
  rows: Array<Record<string, string>>;
  previewRows: Array<{
    externalId: string;
    accountKey: string;
    accountName: string;
    employeeKey: string;
    employeeName: string;
    partnerName: string;
    action: 'create' | 'update';
    role: string;
    targetAccountId: string;
    targetEmployeeId: string;
  }>;
  stats: AccountPartnerMigrationStats;
}

export function accountPartnerValueAt(
  record: Record<string, unknown>,
  fieldPath: string,
): string {
  if (record[fieldPath] != null) return String(record[fieldPath]).trim();
  let value: unknown = record;
  for (const segment of fieldPath.split('.')) {
    if (!value || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[segment];
  }
  return value == null ? '' : String(value).trim();
}

export function normalizeAccountPartnerAccountKey(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, '') : text;
}

export function resolveAccountPartnerSourceAccountKey(
  record: Record<string, unknown>,
): string {
  for (const field of ACCOUNT_PARTNER_ACCOUNT_KEY_FIELDS) {
    const normalized = normalizeAccountPartnerAccountKey(
      accountPartnerValueAt(record, field),
    );
    if (normalized) return normalized;
  }
  return '';
}

export function indexAccountPartnerTargetAccounts(
  records: Array<Record<string, unknown>>,
): Map<string, AccountPartnerTargetReference> {
  const targetAccounts = new Map<string, AccountPartnerTargetReference>();
  const ambiguousAccountKeys = new Set<string>();

  for (const record of records) {
    const id = accountPartnerValueAt(record, 'Id');
    const name = accountPartnerValueAt(record, 'Name');
    if (!id) continue;

    const customerNumber = accountPartnerValueAt(record, 'cfs_ob__u_CustomerNumber__c');
    const accountNumber = accountPartnerValueAt(record, 'AccountNumber');
    const displayKey = customerNumber || accountNumber;
    const normalizedKeys = [...new Set(
      [customerNumber, accountNumber]
        .map((value) => normalizeAccountPartnerAccountKey(value))
        .filter(Boolean),
    )];
    if (normalizedKeys.length === 0) continue;

    for (const normalized of normalizedKeys) {
      if (ambiguousAccountKeys.has(normalized)) continue;
      const existing = targetAccounts.get(normalized);
      if (existing && existing.id !== id) {
        targetAccounts.delete(normalized);
        ambiguousAccountKeys.add(normalized);
      } else {
        targetAccounts.set(normalized, { id, key: displayKey, name });
      }
    }
  }

  return targetAccounts;
}

export function resolveAccountPartnerMigrationSoql(
  input: AccountPartnerMigrationInput,
): string {
  return buildGenericDeployQuery({
    soql: input.partnerSoql,
    objectName: ACCOUNT_PARTNER_OBJECT,
    recordLimit: input.recordLimit,
  });
}

export function buildAccountPartnerMigrationRows(input: {
  records: Array<Record<string, unknown>>;
  bottler: AccountPartnerMigrationInput['bottler'];
  targetAccounts: ReadonlyMap<string, AccountPartnerTargetReference>;
  targetEmployees: ReadonlyMap<string, AccountPartnerTargetReference>;
  existingExternalIds?: ReadonlySet<string>;
  externalIdMaxLength?: number;
  nameWriteConfig?: AccountPartnerNameWriteConfig;
}): AccountPartnerMigrationResult {
  const rows: Array<Record<string, string>> = [];
  const previewRows: AccountPartnerMigrationResult['previewRows'] = [];
  const seen = new Set<string>();
  const seenExternalIds = new Map<string, string>();
  const stats: AccountPartnerMigrationStats = {
    total: input.records.length,
    ready: 0,
    toCreate: 0,
    toUpdate: 0,
    duplicates: 0,
    externalIdCollisions: 0,
    skippedWrongBottler: 0,
    skippedMissingOffice: 0,
    skippedMissingAccountKey: 0,
    skippedMissingEmployeeKey: 0,
    skippedMissingRole: 0,
    skippedTargetAccount: 0,
    skippedTargetEmployee: 0,
  };

  for (const record of input.records) {
    const recordBottler = accountPartnerValueAt(record, ACCOUNT_PARTNER_BOTTLER_FIELD);
    if (recordBottler !== input.bottler) {
      stats.skippedWrongBottler += 1;
      continue;
    }
    const office = accountPartnerValueAt(record, ACCOUNT_PARTNER_OFFICE_FIELD);
    if (!office) {
      stats.skippedMissingOffice += 1;
      continue;
    }
    const account = resolveAccountPartnerSourceAccountKey(record);
    if (!account) {
      stats.skippedMissingAccountKey += 1;
      continue;
    }
    const employee = accountPartnerValueAt(record, ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD);
    if (!employee) {
      stats.skippedMissingEmployeeKey += 1;
      continue;
    }
    const role =
      accountPartnerValueAt(record, ACCOUNT_PARTNER_ROLE_FIELD)
      || accountPartnerValueAt(record, ACCOUNT_PARTNER_FUNCTION_FIELD);
    if (!role) {
      stats.skippedMissingRole += 1;
      continue;
    }
    const targetAccount = input.targetAccounts.get(account);
    if (!targetAccount) {
      stats.skippedTargetAccount += 1;
      continue;
    }
    const targetEmployee = input.targetEmployees.get(employee);
    if (!targetEmployee) {
      stats.skippedTargetEmployee += 1;
      continue;
    }
    const dedupeKey = `${account}\u0000${employee}\u0000${role}`;
    if (seen.has(dedupeKey)) {
      stats.duplicates += 1;
      continue;
    }

    const sourceExternalId = accountPartnerValueAt(
      record,
      ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
    );
    const externalId = fitAccountPartnerExternalId(
      sourceExternalId
      || `${input.bottler}-${account}-${employee}-${role}`,
      input.externalIdMaxLength,
    );
    const externalIdOwner = seenExternalIds.get(externalId);
    if (externalIdOwner && externalIdOwner !== dedupeKey) {
      stats.externalIdCollisions += 1;
      continue;
    }
    seen.add(dedupeKey);
    seenExternalIds.set(externalId, dedupeKey);
    const partnerName = targetEmployee.name
      || [targetAccount.name, role].filter(Boolean).join(' — ')
      || 'Account Partner';
    const row: Record<string, string> = {
      [ACCOUNT_PARTNER_EXTERNAL_ID_FIELD]: externalId,
      [ACCOUNT_PARTNER_ROLE_FIELD]: role,
      [ACCOUNT_PARTNER_BOTTLER_FIELD]: input.bottler,
      [ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD]: targetAccount.id,
      [ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD]: targetEmployee.id,
    };
    if (input.nameWriteConfig) {
      row[input.nameWriteConfig.fieldName] = partnerName.slice(
        0,
        input.nameWriteConfig.maxLength,
      );
    }
    rows.push(row);
    const action = input.existingExternalIds?.has(externalId) ? 'update' : 'create';
    if (action === 'update') {
      stats.toUpdate += 1;
    } else {
      stats.toCreate += 1;
    }
    previewRows.push({
      externalId,
      accountKey: targetAccount.key,
      accountName: targetAccount.name,
      employeeKey: targetEmployee.key,
      employeeName: targetEmployee.name,
      partnerName,
      action,
      role,
      targetAccountId: targetAccount.id,
      targetEmployeeId: targetEmployee.id,
    });
  }
  stats.ready = rows.length;
  return { rows, previewRows, stats };
}

function fitAccountPartnerExternalId(value: string, maxLength = 255): string {
  if (value.length <= maxLength) return value;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  const hash =
    (first >>> 0).toString(16).padStart(8, '0')
    + (second >>> 0).toString(16).padStart(8, '0');
  if (maxLength <= hash.length) return hash.slice(0, maxLength);
  return `${value.slice(0, maxLength - hash.length - 1)}-${hash}`;
}
