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
  skippedNoDistributionMatch: number;
  skippedPerOfficeLimit: number;
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
    salesOffice: string;
    targetAccountId: string;
    targetEmployeeId: string;
  }>;
  stats: AccountPartnerMigrationStats;
  /** All ready external IDs (even in preview mode when rows are empty). */
  readyExternalIds: string[];
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

export function normalizeAccountPartnerEmployeeKey(value: unknown): string {
  return normalizeAccountPartnerAccountKey(value);
}

export function resolveAccountPartnerSourceAccountKeys(
  record: Record<string, unknown>,
): string[] {
  const keys = new Set<string>();
  for (const field of ACCOUNT_PARTNER_ACCOUNT_KEY_FIELDS) {
    const normalized = normalizeAccountPartnerAccountKey(
      accountPartnerValueAt(record, field),
    );
    if (normalized) keys.add(normalized);
  }
  return [...keys];
}

export function resolveAccountPartnerSourceAccountKey(
  record: Record<string, unknown>,
): string {
  return resolveAccountPartnerSourceAccountKeys(record)[0] ?? '';
}

/**
 * Early per-office sampling: keep the first `perOffice` unique role+employee
 * pairs per sales office before any Salesforce matching.
 */
export function sampleAccountPartnerExcelRecordsByOffice(
  records: Array<Record<string, unknown>>,
  perOffice: number,
): {
  records: Array<Record<string, unknown>>;
  skippedPerOfficeLimit: number;
  totalBeforeSample: number;
} {
  if (!Number.isFinite(perOffice) || perOffice <= 0) {
    return {
      records,
      skippedPerOfficeLimit: 0,
      totalBeforeSample: records.length,
    };
  }

  const officeBuckets = new Map<string, Map<string, Record<string, unknown>>>();
  let skippedNoOffice = 0;

  for (const record of records) {
    const office = accountPartnerValueAt(record, ACCOUNT_PARTNER_OFFICE_FIELD);
    if (!office) {
      skippedNoOffice += 1;
      continue;
    }
    const employee = normalizeAccountPartnerEmployeeKey(
      accountPartnerValueAt(record, ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD),
    );
    const role =
      accountPartnerValueAt(record, ACCOUNT_PARTNER_ROLE_FIELD)
      || accountPartnerValueAt(record, ACCOUNT_PARTNER_FUNCTION_FIELD);
    if (!employee || !role) continue;

    const dedupeKey = `${role}|${employee}`;
    if (!officeBuckets.has(office)) officeBuckets.set(office, new Map());
    const bucket = officeBuckets.get(office)!;
    if (!bucket.has(dedupeKey) && bucket.size < perOffice) {
      bucket.set(dedupeKey, record);
    }
  }

  const sampled: Array<Record<string, unknown>> = [];
  for (const office of [...officeBuckets.keys()].sort()) {
    sampled.push(...officeBuckets.get(office)!.values());
  }

  const considered = records.length - skippedNoOffice;
  const skippedPerOfficeLimit = Math.max(0, considered - sampled.length);
  return {
    records: sampled,
    skippedPerOfficeLimit,
    totalBeforeSample: records.length,
  };
}

export function collectAccountPartnerExcelLookupKeys(
  records: Array<Record<string, unknown>>,
): { accountKeys: string[]; employeeKeys: string[] } {
  const accountKeys = new Set<string>();
  const employeeKeys = new Set<string>();
  for (const record of records) {
    for (const key of resolveAccountPartnerSourceAccountKeys(record)) {
      accountKeys.add(key);
    }
    const employee = normalizeAccountPartnerEmployeeKey(
      accountPartnerValueAt(record, ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD),
    );
    if (employee) employeeKeys.add(employee);
  }
  return {
    accountKeys: [...accountKeys],
    employeeKeys: [...employeeKeys],
  };
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

export function indexAccountPartnerTargetEmployees(
  records: Array<Record<string, unknown>>,
): Map<string, AccountPartnerTargetReference> {
  const targetEmployees = new Map<string, AccountPartnerTargetReference>();
  const ambiguousEmployeeKeys = new Set<string>();

  for (const record of records) {
    const rawKey = accountPartnerValueAt(record, 'cfs_ob__EmployeeNo__c');
    const normalizedKey = normalizeAccountPartnerEmployeeKey(rawKey);
    const id = accountPartnerValueAt(record, 'Id');
    const name = accountPartnerValueAt(record, 'Name');
    if (!normalizedKey || !id || ambiguousEmployeeKeys.has(normalizedKey)) continue;
    const existing = targetEmployees.get(normalizedKey);
    if (existing && existing.id !== id) {
      targetEmployees.delete(normalizedKey);
      ambiguousEmployeeKeys.add(normalizedKey);
    } else {
      targetEmployees.set(normalizedKey, { id, key: rawKey || normalizedKey, name });
    }
  }

  return targetEmployees;
}

function resolveTargetAccountMatch(
  accountKeys: string[],
  targetAccounts: ReadonlyMap<string, AccountPartnerTargetReference>,
): { account: string; targetAccount: AccountPartnerTargetReference } | null {
  for (const key of accountKeys) {
    const targetAccount = targetAccounts.get(key);
    if (targetAccount) return { account: key, targetAccount };
  }
  return null;
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

const ACCOUNT_PARTNER_PREVIEW_SAMPLE_LIMIT = 50;

export function buildAccountPartnerMigrationRows(input: {
  records: Array<Record<string, unknown>>;
  bottler: AccountPartnerMigrationInput['bottler'];
  targetAccounts: ReadonlyMap<string, AccountPartnerTargetReference>;
  targetEmployees: ReadonlyMap<string, AccountPartnerTargetReference>;
  existingExternalIds?: ReadonlySet<string>;
  externalIdMaxLength?: number;
  nameWriteConfig?: AccountPartnerNameWriteConfig;
  /** preview skips materializing full upsert rows; migrate builds them. */
  mode?: 'preview' | 'migrate';
  previewSampleLimit?: number;
  /**
   * After a row matches target Account + Employee, keep at most this many
   * unique role+employee pairs per sales office (full-sheet match, then cap).
   */
  perOffice?: number;
}): AccountPartnerMigrationResult {
  const mode = input.mode ?? 'migrate';
  const previewSampleLimit = input.previewSampleLimit ?? ACCOUNT_PARTNER_PREVIEW_SAMPLE_LIMIT;
  const perOffice =
    Number.isFinite(input.perOffice) && (input.perOffice ?? 0) > 0
      ? input.perOffice!
      : 0;
  const rows: Array<Record<string, string>> = [];
  const previewRows: AccountPartnerMigrationResult['previewRows'] = [];
  const readyExternalIds: string[] = [];
  const seen = new Set<string>();
  const seenExternalIds = new Map<string, string>();
  const officeCounts = new Map<string, number>();
  const officeSeen = new Map<string, Set<string>>();
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
    skippedNoDistributionMatch: 0,
    skippedPerOfficeLimit: 0,
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
    const accountKeys = resolveAccountPartnerSourceAccountKeys(record);
    if (accountKeys.length === 0) {
      stats.skippedMissingAccountKey += 1;
      continue;
    }
    const accountMatch = resolveTargetAccountMatch(accountKeys, input.targetAccounts);
    if (!accountMatch) {
      stats.skippedTargetAccount += 1;
      continue;
    }
    const { account, targetAccount } = accountMatch;
    const employee = normalizeAccountPartnerEmployeeKey(
      accountPartnerValueAt(record, ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD),
    );
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

    if (perOffice > 0) {
      const officeDedupeKey = `${role}\u0000${employee}`;
      const officePairSeen = officeSeen.get(office) ?? new Set<string>();
      if (officePairSeen.has(officeDedupeKey)) {
        // Same role+employee already kept for this office — treat as duplicate.
        stats.duplicates += 1;
        continue;
      }
      const officeCount = officeCounts.get(office) ?? 0;
      if (officeCount >= perOffice) {
        stats.skippedPerOfficeLimit += 1;
        continue;
      }
      officePairSeen.add(officeDedupeKey);
      officeSeen.set(office, officePairSeen);
      officeCounts.set(office, officeCount + 1);
    }

    seen.add(dedupeKey);
    seenExternalIds.set(externalId, dedupeKey);
    if (mode === 'migrate') {
      readyExternalIds.push(externalId);
    }
    const partnerName = targetEmployee.name
      || [targetAccount.name, role].filter(Boolean).join(' — ')
      || 'Account Partner';
    const action = mode === 'preview'
      ? 'create'
      : (input.existingExternalIds?.has(externalId) ? 'update' : 'create');
    if (action === 'update') {
      stats.toUpdate += 1;
    } else {
      stats.toCreate += 1;
    }
    stats.ready += 1;

    if (mode === 'migrate') {
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
    }

    if (previewRows.length < previewSampleLimit) {
      previewRows.push({
        externalId,
        accountKey: targetAccount.key,
        accountName: targetAccount.name,
        employeeKey: targetEmployee.key,
        employeeName: targetEmployee.name,
        partnerName,
        action,
        role,
        salesOffice: office,
        targetAccountId: targetAccount.id,
        targetEmployeeId: targetEmployee.id,
      });
    }
  }
  return { rows, previewRows, stats, readyExternalIds };
}

export function applyAccountPartnerPerOfficeLimit(
  mapping: AccountPartnerMigrationResult,
  perOffice: number,
): AccountPartnerMigrationResult {
  if (!Number.isFinite(perOffice) || perOffice <= 0) return mapping;

  const officeCounts = new Map<string, number>();
  const officeSeen = new Map<string, Set<string>>();
  const keptIndices: number[] = [];

  for (let index = 0; index < mapping.previewRows.length; index += 1) {
    const preview = mapping.previewRows[index];
    const office = preview.salesOffice;
    if (!office) {
      keptIndices.push(index);
      continue;
    }
    const dedupeKey = `${preview.role}\u0000${preview.employeeKey}`;
    const seen = officeSeen.get(office) ?? new Set<string>();
    if (seen.has(dedupeKey)) continue;

    const count = officeCounts.get(office) ?? 0;
    if (count >= perOffice) continue;

    seen.add(dedupeKey);
    officeSeen.set(office, seen);
    officeCounts.set(office, count + 1);
    keptIndices.push(index);
  }

  const skippedPerOfficeLimit = mapping.previewRows.length - keptIndices.length;
  if (skippedPerOfficeLimit === 0) return mapping;

  const previewRows = keptIndices.map((index) => mapping.previewRows[index]);
  const rows = keptIndices.map((index) => mapping.rows[index]);
  const toCreate = previewRows.filter((row) => row.action === 'create').length;
  const toUpdate = previewRows.filter((row) => row.action === 'update').length;

  return {
    rows,
    previewRows,
    readyExternalIds: keptIndices.map((index) => mapping.readyExternalIds[index]),
    stats: {
      ...mapping.stats,
      ready: previewRows.length,
      toCreate,
      toUpdate,
      skippedPerOfficeLimit,
    },
  };
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

export const ACCOUNT_PARTNER_EXCEL_REQUIRED_HEADERS = [
  ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  ACCOUNT_PARTNER_BOTTLER_FIELD,
  ACCOUNT_PARTNER_OFFICE_FIELD,
] as const;

export const ACCOUNT_PARTNER_EXCEL_OPTIONAL_HEADERS = [
  ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
  ACCOUNT_PARTNER_ROLE_FIELD,
  ACCOUNT_PARTNER_FUNCTION_FIELD,
  ...ACCOUNT_PARTNER_ACCOUNT_KEY_FIELDS,
] as const;

export function validateAccountPartnerExcelHeaders(headers: string[]): {
  ok: boolean;
  missing: string[];
  detected: string[];
} {
  const normalized = new Set(headers.map((header) => header.trim()).filter(Boolean));
  const hasAccountKey = ACCOUNT_PARTNER_ACCOUNT_KEY_FIELDS.some((field) => normalized.has(field));
  const hasRole =
    normalized.has(ACCOUNT_PARTNER_ROLE_FIELD)
    || normalized.has(ACCOUNT_PARTNER_FUNCTION_FIELD);
  const missing: string[] = [];
  for (const field of ACCOUNT_PARTNER_EXCEL_REQUIRED_HEADERS) {
    if (!normalized.has(field)) missing.push(field);
  }
  if (!hasAccountKey) {
    missing.push(
      `${ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD} or ${ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD}`,
    );
  }
  if (!hasRole) {
    missing.push(
      `${ACCOUNT_PARTNER_ROLE_FIELD} or ${ACCOUNT_PARTNER_FUNCTION_FIELD}`,
    );
  }
  const detected = [
    ...ACCOUNT_PARTNER_EXCEL_REQUIRED_HEADERS,
    ...ACCOUNT_PARTNER_EXCEL_OPTIONAL_HEADERS,
  ].filter((field) => normalized.has(field));
  return { ok: missing.length === 0, missing, detected };
}
