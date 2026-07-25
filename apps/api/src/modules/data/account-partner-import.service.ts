import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '@sfcc/db';
import { createSfCliClient, isBulkCompoundQueryError } from '@sfcc/sf-cli';
import {
  ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
  ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD,
  ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD,
  ACCOUNT_PARTNER_BOTTLER_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD,
  ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
  ACCOUNT_PARTNER_OBJECT,
  ACCOUNT_PARTNER_ROLE_FIELD,
  EMPLOYEE_MASTER_OBJECT,
  accountPartnerExcelMigrationSchema,
  accountPartnerExcelMigrationFormSchema,
  accountPartnerMigrationSchema,
  accountPartnerValueAt,
  buildAccountPartnerMigrationRows,
  collectAccountPartnerExcelLookupKeys,
  escapeSoqlLiteral,
  indexAccountPartnerTargetAccounts,
  indexAccountPartnerTargetEmployees,
  parseBulkCsv,
  resolveAccountPartnerMigrationSoql,
  resolveAccountPartnerSourceAccountKey,
  serializeBulkCsv,
  toSoqlLiteral,
  validateAccountPartnerExcelHeaders,
  type AccountPartnerExcelMigrationInput,
  type AccountPartnerExcelMigrationFormInput,
  type AccountPartnerMigrationInput,
  type AccountPartnerMigrationResult,
  type AccountPartnerTargetReference,
  type BottlerSalesOfficeConfig,
} from '@sfcc/shared';
import { removeTempDir } from '../../common/temp-cleanup.util';
import { TtlCache } from '../../common/ttl-cache';
import { BOTTLER_CONFIG, normalizeAccountKey, resolveSalesOfficeConfig, type BottlerId } from './bottler-config';

const KEYED_LOOKUP_CHUNK = 200;
const KEYED_LOOKUP_CONCURRENCY = 5;
const TARGET_ACCOUNT_BULK_FIELDS =
  'Id, Name, cfs_ob__u_CustomerNumber__c, AccountNumber, cfs_ob__u_DistributionChannel__c';
const PREPARE_CACHE_TTL_MS = 15 * 60 * 1000;
const PREPARE_CACHE_MAX = 20;

type PreparedExcelMapping = {
  target: { alias: string };
  targetSchema: {
    externalIdMaxLength: number;
    nameFieldName: string;
    nameWriteConfig?: { fieldName: string; maxLength: number };
  };
  targetAccounts: Map<string, AccountPartnerTargetReference>;
  targetEmployees: Map<string, AccountPartnerTargetReference>;
  existingExternalIds: Set<string>;
  sheetName: string;
  headers: string[];
  mapping: AccountPartnerMigrationResult;
  matchOrgDistribution: boolean;
  distributionAccountsIndexed: number;
  skippedNoDistributionMatch: number;
  perOffice?: number;
  matchedBeforePerOfficeLimit: number;
};

const EMPLOYEE_FIELDS = [
  'cfs_ob__EmployeeNo__c',
  'cfs_ob__External_Id__c',
  'Name',
  'cfs_ob__Bottler__c',
  'cfs_ob__u_Sales_Office__c',
  'cfs_ob__EmailID__c',
] as const;

const PARTNER_FIELDS = [
  'cfs_ob__AccountPartnerExternalId__c',
  'cfs_ob__PartnerRole__c',
  'cfs_ob__Bottler__c',
  'cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c',
  'cfs_ob__Account__r.AccountNumber',
  'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c',
] as const;

const ACCOUNT_TRANSFER_FIELDS = [
  'AccountNumber', 'Name', 'AccountNumber', 'cfs_ob__Bottler__c',
  'cfs_ob__u_SalesOffice__c', 'cfs_ob__u_CustomerAccountGroup__c', 'cfs_ob__u_DistributionChannel__c',
  'cfs_ob__u_ActiveCustomer__c', 'cfs_ob__MarkforDeletion__c', 'cfs_ob__SuppressionReason__c',
  'cfs_ob__Business_Type__c', 'cfs_ob__BusinessTypeExtension__c', 'cfs_ob__u_SalesGroup__c', 'cfs_ob__Classic_Foods__c',
];

interface ProcessOptions {
  bottler: BottlerId;
  targetOrgId: string;
  perOffice?: number;
  matchOrgDistribution?: boolean;
  sheet?: string;
  excelBase64?: string;
  excelPath?: string;
}

@Injectable()
export class AccountPartnerImportService {
  private readonly sfCli = createSfCliClient();
  private readonly artifactDirs = new Map<string, { dir: string; timer: NodeJS.Timeout }>();
  private readonly prepareCache = new TtlCache<PreparedExcelMapping>(
    PREPARE_CACHE_TTL_MS,
    PREPARE_CACHE_MAX,
  );

  async processExcel(options: ProcessOptions) {
    const cfg = BOTTLER_CONFIG[options.bottler];
    const workDir = await mkdtemp(join(tmpdir(), `partner-${options.bottler}-`));
    await mkdir(workDir, { recursive: true });
    await this.retainArtifacts(`${options.bottler}:${options.targetOrgId}`, workDir);

    let buffer: Buffer;
    if (options.excelBase64) {
      buffer = Buffer.from(options.excelBase64, 'base64');
    } else if (options.excelPath) {
      buffer = await readFile(options.excelPath);
    } else {
      throw new Error('excelBase64 or excelPath required');
    }

    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = options.sheet ?? cfg.defaultSheet;
    const ws = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    const target = await this.resolveOrg(options.targetOrgId);
    const orgLookup = options.matchOrgDistribution
      ? await this.queryOrgDistributionAccounts(target.alias, options.bottler)
      : {};
    const orgLookupPopulated = Object.keys(orgLookup).length > 0;

    const offices = new Set<string>(cfg.offices);
    const allowedRoles = new Set(cfg.roles);
    const perOffice = options.perOffice ?? 30;
    const officeBuckets = new Map<string, Map<string, Record<string, unknown>>>();

    const stats = {
      total: rows.length,
      skipped_no_office: 0,
      skipped_office: 0,
      skipped_role: 0,
      skipped_no_emp: 0,
      skipped_no_acct: 0,
      skipped_no_org_match: 0,
    };

    for (const r of rows) {
      const office = String(r.cfs_ob__Sales_Office__c ?? '').trim();
      if (!office) { stats.skipped_no_office++; continue; }
      if (!offices.has(office)) { stats.skipped_office++; continue; }

      const role = String(r.cfs_ob__PartnerRole__c ?? r.cfs_ob__PartnerFunction__c ?? '').trim();
      if (role && !allowedRoles.has(role as typeof cfg.roles[number])) { stats.skipped_role++; continue; }

      const empNo = String(r['cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c'] ?? '').trim();
      const empId = String(r.cfs_ob__EmployeeMaster__c ?? '').trim();
      if (!empNo && !empId) { stats.skipped_no_emp++; continue; }

      const linkCust = this.orgLinkCustomer(
        r,
        orgLookup,
        options.matchOrgDistribution ?? true,
        orgLookupPopulated,
      );
      if (!linkCust) {
        if (options.matchOrgDistribution) stats.skipped_no_org_match++;
        else stats.skipped_no_acct++;
        continue;
      }

      const dedupeKey = `${role}|${empId || empNo}`;
      if (!officeBuckets.has(office)) officeBuckets.set(office, new Map());
      const bucket = officeBuckets.get(office)!;
      if (!bucket.has(dedupeKey)) {
        bucket.set(dedupeKey, { ...r, _link_customer: linkCust });
      }
    }

    const sampled: Record<string, unknown>[] = [];
    for (const office of [...officeBuckets.keys()].sort()) {
      sampled.push(...[...officeBuckets.get(office)!.values()].slice(0, perOffice));
    }

    const employees = new Map<string, Record<string, string>>();
    const partners: Record<string, string>[] = [];

    for (const r of sampled) {
      const office = String(r.cfs_ob__Sales_Office__c ?? '').trim();
      const empNo = String(r['cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c'] ?? '').trim();
      const extId = String(r['cfs_ob__EmployeeMaster__r.cfs_ob__External_Id__c'] ?? '').trim() || empNo;
      const empName = String(
        r['cfs_ob__EmployeeMaster__r.Name'] ?? r.cfs_ob__Name__c ?? `Employee ${empNo}`,
      ).slice(0, 80);
      const email = String(r['cfs_ob__EmployeeMaster__r.cfs_ob__EmailID__c'] ?? '').trim();
      const empOffice = String(r['cfs_ob__EmployeeMaster__r.cfs_ob__u_Sales_Office__c'] ?? office).trim();

      if (empNo) {
        employees.set(empNo, {
          'cfs_ob__EmployeeNo__c': empNo,
          'cfs_ob__External_Id__c': extId || empNo,
          Name: empName || empNo,
          'cfs_ob__Bottler__c': options.bottler,
          'cfs_ob__u_Sales_Office__c': empOffice,
          'cfs_ob__EmailID__c': email,
        });
      }

      const cust = String(r._link_customer ?? '').trim();
      const partnerRole = String(r.cfs_ob__PartnerRole__c ?? r.cfs_ob__PartnerFunction__c ?? cfg.roles[0]).trim();
      let apExt = String(r.cfs_ob__AccountPartnerExternalId__c ?? '').trim();
      if (!apExt) apExt = `${options.bottler}-${office}-${empNo}-${partnerRole}-${cust}`;

      partners.push({
        'cfs_ob__AccountPartnerExternalId__c': apExt.slice(0, 255),
        'cfs_ob__PartnerRole__c': partnerRole,
        'cfs_ob__Bottler__c': options.bottler,
        'cfs_ob__Account__r.AccountNumber': cust,
        'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c': empNo,
      });
    }

    await this.writeCsv(join(workDir, 'employee_master.csv'), [...EMPLOYEE_FIELDS], [...employees.values()]);
    await this.writeCsv(join(workDir, 'account_partners.csv'), [...PARTNER_FIELDS], partners);

    const summary = {
      bottler: options.bottler,
      partners: partners.length,
      employees: employees.size,
      offices: officeBuckets.size,
      stats,
      outDir: workDir,
    };
    await writeFile(join(workDir, 'summary.json'), JSON.stringify(summary, null, 2));
    return summary;
  }

  async loadFromArtifacts(bottler: BottlerId, targetOrgId: string, dryRun = false) {
    const artifactKey = `${bottler}:${targetOrgId}`;
    const retained = this.artifactDirs.get(artifactKey);
    if (!retained) throw new Error('No processed artifacts — run process first');
    const workDir = retained.dir;

    const target = await this.resolveOrg(targetOrgId);
    if (dryRun) return { dryRun: true, workDir };

    try {
      const empCsv = join(workDir, 'employee_master.csv');
      const partnerCsv = join(workDir, 'account_partners.csv');

      const emp = await this.sfCli.upsertBulk('cfs_ob__EmployeeMaster__c', empCsv, 'cfs_ob__EmployeeNo__c', target.alias, 15, { cwd: workDir });
      if (!emp.success) throw new Error(emp.error ?? 'Employee upsert failed');

      const partners = await this.sfCli.upsertBulk(
        'cfs_ob__AccountPartner__c',
        partnerCsv,
        'cfs_ob__AccountPartnerExternalId__c',
        target.alias,
        15,
        { cwd: workDir },
      );
      if (!partners.success) throw new Error(partners.error ?? 'Partner upsert failed');

      return { success: true, workDir };
    } finally {
      await this.releaseArtifacts(artifactKey, workDir);
    }
  }

  async previewSoqlMapping(input: AccountPartnerMigrationInput) {
    const prepared = await this.prepareSoqlMapping(input);
    return this.toMappingPreview(prepared);
  }

  parsePartnerExcelRows(
    buffer: Buffer,
    sheet?: string,
    workbook?: XLSX.WorkBook,
  ): Array<Record<string, unknown>> {
    const wb = workbook ?? XLSX.read(buffer, { type: 'buffer' });
    const sheetName = sheet ?? wb.SheetNames[0];
    if (!sheetName) throw new Error('Workbook has no sheets');
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (rows.length === 0) throw new Error('Spreadsheet sheet is empty');
    const headers = Object.keys(rows[0] ?? {});
    const validation = validateAccountPartnerExcelHeaders(headers);
    if (!validation.ok) {
      throw new Error(
        `Spreadsheet is missing required columns: ${validation.missing.join(', ')}`,
      );
    }
    return rows;
  }

  async previewExcelMapping(rawInput: AccountPartnerExcelMigrationInput) {
    const input = accountPartnerExcelMigrationSchema.parse(rawInput);
    const buffer = await this.resolveExcelBuffer(input);
    return this.previewExcelMappingFromWorkbook(buffer, input);
  }

  async previewExcelMappingFromWorkbook(
    buffer: Buffer,
    rawInput: AccountPartnerExcelMigrationFormInput,
    onProgress?: (percent: number, step: string) => Promise<void>,
  ) {
    const input = accountPartnerExcelMigrationFormSchema.parse(rawInput);
    const prepared = await this.prepareExcelMappingFromWorkbook(buffer, input, 'preview', onProgress);
    const prepareCacheKey = this.storePreparedMapping(buffer, input, prepared);
    return {
      ...this.toMappingPreview(prepared),
      sheet: prepared.sheetName,
      headers: prepared.headers,
      matchOrgDistribution: prepared.matchOrgDistribution,
      distributionAccountsIndexed: prepared.distributionAccountsIndexed,
      skippedNoDistributionMatch: prepared.skippedNoDistributionMatch,
      perOffice: prepared.perOffice,
      matchedBeforePerOfficeLimit: prepared.matchedBeforePerOfficeLimit,
      prepareCacheKey,
    };
  }

  async migrateExcelMapping(
    input: AccountPartnerExcelMigrationInput,
    onLog?: (line: string) => Promise<void>,
  ) {
    const log = async (line: string) => onLog?.(line);
    await log('Validating spreadsheet and target mappings...');
    const parsed = accountPartnerExcelMigrationSchema.parse(input);
    let prepared = parsed.prepareCacheKey
      ? this.prepareCache.get(parsed.prepareCacheKey)
      : undefined;
    if (prepared) {
      await log('Reusing migration plan cached from preview.');
      // Rebuild upsert rows if cache held preview-only materialization.
      if (prepared.mapping.rows.length === 0 && prepared.mapping.stats.ready > 0) {
        prepared = await this.prepareExcelMappingFromWorkbook(
          await this.resolveExcelBuffer(parsed),
          parsed,
          'migrate',
        );
      }
    } else {
      prepared = await this.prepareExcelMappingFromWorkbook(
        await this.resolveExcelBuffer(parsed),
        parsed,
        'migrate',
      );
    }
    const { stats } = prepared.mapping;
    if (prepared.matchOrgDistribution) {
      await log(
        `Indexed ${prepared.distributionAccountsIndexed.toLocaleString()} target distribution accounts `
        + `for cross-org remapping.`,
      );
      if (prepared.skippedNoDistributionMatch > 0) {
        await log(
          `${prepared.skippedNoDistributionMatch.toLocaleString()} spreadsheet rows had no `
          + 'distribution account match in the target org.',
        );
      }
    }
    if (prepared.perOffice) {
      await log(
        `Full-sheet match found ${prepared.matchedBeforePerOfficeLimit.toLocaleString()} `
        + `Account/Employee pairs; per-sales-office limit of ${prepared.perOffice} keeps `
        + `${stats.ready.toLocaleString()} ready to migrate `
        + `(${(prepared.mapping.stats.skippedPerOfficeLimit ?? 0).toLocaleString()} over the cap).`,
      );
    }
    await log(
      `Spreadsheet contained ${stats.total.toLocaleString()} rows; `
      + `${stats.ready.toLocaleString()} mappings are ready.`,
    );
    await log(
      `${stats.toCreate.toLocaleString()} Account Partners will be created; `
      + `${stats.toUpdate.toLocaleString()} existing Account Partners will be updated.`,
    );
    await log(
      prepared.targetSchema.nameWriteConfig
        ? 'Account Partner Name will be set from the matched target Employee Master name.'
        : 'Account Partner Name is Salesforce-managed in the target org; '
          + 'matched Employee Master names remain available in the migration preview.',
    );
    await log(
      `Skipped: ${stats.skippedTargetAccount.toLocaleString()} missing target Accounts, `
      + `${stats.skippedTargetEmployee.toLocaleString()} missing target Employee Masters, `
      + `${stats.duplicates.toLocaleString()} duplicates, `
      + `${stats.externalIdCollisions.toLocaleString()} external ID collisions.`,
    );
    if (stats.ready === 0) {
      throw new Error(
        'No Account Partner mappings are ready to migrate. '
        + `Missing target Accounts: ${stats.skippedTargetAccount}; `
        + `missing target Employee Masters: ${stats.skippedTargetEmployee}.`,
      );
    }

    const workDir = await mkdtemp(join(tmpdir(), `account-partner-excel-${parsed.bottler}-`));
    try {
      const csv = join(workDir, 'account-partners.csv');
      await writeFile(csv, serializeBulkCsv(prepared.mapping.rows), 'utf8');
      await log(`Upserting ${stats.ready.toLocaleString()} Account Partner records...`);
      const result = await this.sfCli.upsertBulk(
        ACCOUNT_PARTNER_OBJECT,
        csv,
        ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
        prepared.target.alias,
        15,
        { cwd: workDir },
      );
      if (!result.success) {
        throw new Error(result.error ?? 'Account Partner migration failed');
      }
      await log('Account Partner migration completed');
      if (parsed.prepareCacheKey) this.prepareCache.delete(parsed.prepareCacheKey);
      return {
        success: true,
        sheet: prepared.sheetName,
        stats,
        targetAccounts: prepared.targetAccounts.size,
        targetEmployees: prepared.targetEmployees.size,
        nameField: {
          fieldName: prepared.targetSchema.nameFieldName,
          mode: prepared.targetSchema.nameWriteConfig
            ? 'employee-master-name' as const
            : 'salesforce-managed' as const,
        },
      };
    } finally {
      await removeTempDir(workDir);
    }
  }

  private toMappingPreview(prepared: {
    query?: string;
    sheetName?: string;
    mapping: AccountPartnerMigrationResult;
    targetAccounts: Map<string, AccountPartnerTargetReference>;
    targetEmployees: Map<string, AccountPartnerTargetReference>;
    targetSchema: Awaited<ReturnType<AccountPartnerImportService['assertTargetMappingSchema']>>;
  }) {
    return {
      ok: prepared.mapping.stats.ready > 0,
      query: prepared.query ?? `Excel sheet: ${prepared.sheetName ?? 'unknown'}`,
      stats: prepared.mapping.stats,
      targetAccounts: prepared.targetAccounts.size,
      targetEmployees: prepared.targetEmployees.size,
      nameField: {
        fieldName: prepared.targetSchema.nameFieldName,
        mode: prepared.targetSchema.nameWriteConfig
          ? 'employee-master-name' as const
          : 'salesforce-managed' as const,
      },
      sample: prepared.mapping.previewRows.slice(0, 50),
    };
  }

  private async prepareExcelMappingFromWorkbook(
    buffer: Buffer,
    rawInput: AccountPartnerExcelMigrationFormInput,
    buildMode: 'preview' | 'migrate' = 'migrate',
    onProgress?: (percent: number, step: string) => Promise<void>,
  ) {
    const progress = async (pct: number, step: string) => onProgress?.(pct, step);
    const input = accountPartnerExcelMigrationFormSchema.parse(rawInput);

    await progress(5, 'Parsing workbook');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = input.sheet ?? wb.SheetNames[0];
    if (!sheetName) throw new Error('Workbook has no sheets');
    let records = this.parsePartnerExcelRows(buffer, sheetName, wb);
    const headers = Object.keys(records[0] ?? {});
    const spreadsheetTotal = records.length;

    const target = await this.resolveOrg(input.targetOrgId);
    const targetSchema = await this.assertTargetMappingSchema(target.alias);

    await progress(15, 'Collecting lookup keys');
    let distributionAccountsIndexed = 0;
    let skippedNoDistributionMatch = 0;

    await progress(25, 'Exporting target accounts');
    const preloadedAccountRecords = await this.exportTargetAccountRecords(
      target.alias,
      input.bottler,
    );

    if (input.matchOrgDistribution) {
      const orgLookup = this.buildDistributionLookup(preloadedAccountRecords);
      distributionAccountsIndexed = Object.keys(orgLookup).length;
      await progress(40, 'Remapping distribution accounts');
      const remapped = this.remapExcelRecordsForDistribution(records, orgLookup);
      records = remapped.records;
      skippedNoDistributionMatch = remapped.skippedNoDistributionMatch;
    }

    await progress(55, 'Loading target Employees');
    const lookupKeys = collectAccountPartnerExcelLookupKeys(records);
    const targetContext = await this.prepareBatchedTargetMappingContext(
      target,
      targetSchema,
      input.bottler,
      lookupKeys.accountKeys,
      lookupKeys.employeeKeys,
      {
        preloadedAccountRecords,
        includeExistingPartners: buildMode === 'migrate',
      },
    );

    await progress(75, 'Matching spreadsheet rows');
    const rowMode = buildMode === 'preview' ? 'preview' : 'migrate';
    let mapping = buildAccountPartnerMigrationRows({
      records,
      bottler: input.bottler,
      targetAccounts: targetContext.targetAccounts,
      targetEmployees: targetContext.targetEmployees,
      existingExternalIds: targetContext.existingExternalIds,
      externalIdMaxLength: targetContext.targetSchema.externalIdMaxLength,
      nameWriteConfig: targetContext.targetSchema.nameWriteConfig,
      mode: rowMode,
      perOffice: input.perOffice,
    });

    // Refine create/update using keyed existing external ID lookup when full export was skipped.
    if (
      rowMode === 'migrate'
      && mapping.readyExternalIds.length > 0
      && targetContext.existingExternalIds.size === 0
    ) {
      const existing = await this.queryExistingPartnerExternalIds(
        target.alias,
        input.bottler,
        mapping.readyExternalIds,
      );
      if (existing.size > 0) {
        mapping = this.reclassifyCreateUpdate(mapping, existing);
      }
    }

    await progress(90, 'Finalizing migration plan');
    mapping.stats.total = spreadsheetTotal;
    mapping.stats.skippedNoDistributionMatch = skippedNoDistributionMatch;
    const matchedBeforePerOfficeLimit = input.perOffice
      ? mapping.stats.ready + (mapping.stats.skippedPerOfficeLimit ?? 0)
      : mapping.stats.ready;

    return {
      target,
      targetSchema,
      targetAccounts: targetContext.targetAccounts,
      targetEmployees: targetContext.targetEmployees,
      existingExternalIds: targetContext.existingExternalIds,
      sheetName,
      headers,
      mapping,
      matchOrgDistribution: input.matchOrgDistribution,
      distributionAccountsIndexed,
      skippedNoDistributionMatch,
      perOffice: input.perOffice,
      matchedBeforePerOfficeLimit,
    };
  }

  private reclassifyCreateUpdate(
    mapping: AccountPartnerMigrationResult,
    existingExternalIds: ReadonlySet<string>,
  ): AccountPartnerMigrationResult {
    let toCreate = 0;
    let toUpdate = 0;
    for (const externalId of mapping.readyExternalIds) {
      if (existingExternalIds.has(externalId)) toUpdate += 1;
      else toCreate += 1;
    }
    return {
      ...mapping,
      previewRows: mapping.previewRows.map((row) => ({
        ...row,
        action: existingExternalIds.has(row.externalId) ? 'update' : 'create',
      })),
      stats: {
        ...mapping.stats,
        toCreate,
        toUpdate,
      },
    };
  }

  private storePreparedMapping(
    buffer: Buffer,
    input: AccountPartnerExcelMigrationFormInput,
    prepared: PreparedExcelMapping,
  ): string {
    const fileHash = createHash('sha256').update(buffer).digest('hex').slice(0, 24);
    const key = [
      'ap-excel',
      input.targetOrgId,
      input.bottler,
      input.sheet ?? '',
      String(input.matchOrgDistribution),
      String(input.perOffice ?? ''),
      fileHash,
      randomUUID().slice(0, 8),
    ].join(':');
    this.prepareCache.set(key, prepared);
    return key;
  }

  private async resolveExcelBuffer(
    input: AccountPartnerExcelMigrationInput,
  ): Promise<Buffer> {
    if (input.excelPath) return readFile(input.excelPath);
    if (input.excelBase64) return Buffer.from(input.excelBase64, 'base64');
    throw new Error('excelBase64 or excelPath required');
  }

  private remapExcelRecordsForDistribution(
    records: Array<Record<string, unknown>>,
    orgLookup: Record<string, string>,
  ) {
    let skippedNoDistributionMatch = 0;
    const lookupPopulated = Object.keys(orgLookup).length > 0;
    const remapped = records.map((record) => {
      const hadSourceKey = Boolean(resolveAccountPartnerSourceAccountKey(record));
      const linkCust = this.orgLinkCustomer(record, orgLookup, true, lookupPopulated);
      if (!linkCust) {
        if (hadSourceKey) skippedNoDistributionMatch += 1;
        return record;
      }
      return {
        ...record,
        [ACCOUNT_PARTNER_ACCOUNT_ALT_KEY_FIELD]: linkCust,
        [ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD]: linkCust,
      };
    });
    return { records: remapped, skippedNoDistributionMatch };
  }

  private async prepareExcelMapping(rawInput: AccountPartnerExcelMigrationInput) {
    const input = accountPartnerExcelMigrationSchema.parse(rawInput);
    return this.prepareExcelMappingFromWorkbook(
      await this.resolveExcelBuffer(input),
      input,
      'migrate',
    );
  }

  async migrateSoqlMapping(
    input: AccountPartnerMigrationInput,
    onLog?: (line: string) => Promise<void>,
  ) {
    const log = async (line: string) => onLog?.(line);
    await log('Validating Account Partner query and target mappings...');
    const prepared = await this.prepareSoqlMapping(input);
    const { stats } = prepared.mapping;
    await log(
      `Source query returned ${stats.total.toLocaleString()} rows; `
      + `${stats.ready.toLocaleString()} mappings are ready.`,
    );
    await log(
      `${stats.toCreate.toLocaleString()} Account Partners will be created; `
      + `${stats.toUpdate.toLocaleString()} existing Account Partners will be updated.`,
    );
    await log(
      prepared.targetSchema.nameWriteConfig
        ? 'Account Partner Name will be set from the matched target Employee Master name.'
        : 'Account Partner Name is Salesforce-managed in the target org; '
          + 'matched Employee Master names remain available in the migration preview.',
    );
    await log(
      `Skipped: ${stats.skippedTargetAccount.toLocaleString()} missing target Accounts, `
      + `${stats.skippedTargetEmployee.toLocaleString()} missing target Employee Masters, `
      + `${stats.duplicates.toLocaleString()} duplicates, `
      + `${stats.externalIdCollisions.toLocaleString()} external ID collisions.`,
    );
    if (stats.ready === 0) {
      throw new Error(
        'No Account Partner mappings are ready to migrate. '
        + `Missing target Accounts: ${stats.skippedTargetAccount}; `
        + `missing target Employee Masters: ${stats.skippedTargetEmployee}.`,
      );
    }

    const workDir = await mkdtemp(join(tmpdir(), `account-partner-mapping-${input.bottler}-`));
    try {
      const csv = join(workDir, 'account-partners.csv');
      await writeFile(csv, serializeBulkCsv(prepared.mapping.rows), 'utf8');
      await log(`Upserting ${stats.ready.toLocaleString()} Account Partner records...`);
      const result = await this.sfCli.upsertBulk(
        ACCOUNT_PARTNER_OBJECT,
        csv,
        ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
        prepared.target.alias,
        15,
        { cwd: workDir },
      );
      if (!result.success) {
        throw new Error(result.error ?? 'Account Partner migration failed');
      }
      await log('Account Partner migration completed');
      return {
        success: true,
        query: prepared.query,
        stats,
        targetAccounts: prepared.targetAccounts.size,
        targetEmployees: prepared.targetEmployees.size,
        nameField: {
          fieldName: prepared.targetSchema.nameFieldName,
          mode: prepared.targetSchema.nameWriteConfig
            ? 'employee-master-name' as const
            : 'salesforce-managed' as const,
        },
      };
    } finally {
      await removeTempDir(workDir);
    }
  }

  async transferOrgToOrgMatched(
    sourceOrgId: string,
    targetOrgId: string,
    bottler: BottlerId,
    options?: {
      perOffice?: number;
      matchOrgDistribution?: boolean;
      salesOfficeConfig?: BottlerSalesOfficeConfig;
    },
  ) {
    const cfg = resolveSalesOfficeConfig(bottler, options?.salesOfficeConfig);
    const perOffice = options?.perOffice ?? cfg.perOfficePartnerLimit ?? 20;
    const source = await this.resolveOrg(sourceOrgId);
    const target = await this.resolveOrg(targetOrgId);
    const workDir = await mkdtemp(join(tmpdir(), `partner-matched-${bottler}-`));
    await mkdir(workDir, { recursive: true });
    await this.retainArtifacts(`${bottler}:${targetOrgId}`, workDir);

    const orgLookup = options?.matchOrgDistribution !== false
      ? await this.queryOrgDistributionAccounts(target.alias, bottler)
      : {};
    const orgLookupPopulated = Object.keys(orgLookup).length > 0;

    const officeFilter = cfg.offices.map(toSoqlLiteral).join(', ');
    const safeBottler = escapeSoqlLiteral(bottler);
    const partnerSoql =
      `SELECT ${PARTNER_FIELDS.join(', ')}, cfs_ob__PartnerFunction__c, cfs_ob__Sales_Office__c, ` +
      `cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c, cfs_ob__EmployeeMaster__r.cfs_ob__External_Id__c, ` +
      `cfs_ob__EmployeeMaster__r.Name, cfs_ob__EmployeeMaster__r.cfs_ob__EmailID__c, ` +
      `cfs_ob__EmployeeMaster__r.cfs_ob__u_Sales_Office__c ` +
      `FROM cfs_ob__AccountPartner__c WHERE cfs_ob__Bottler__c = '${safeBottler}' ` +
      `AND cfs_ob__Sales_Office__c IN (${officeFilter})`;

    const result = await this.sfCli.query(source.alias, partnerSoql);
    const records = (result.data as { result?: { records?: Array<Record<string, unknown>> } })?.result?.records ?? [];

    const offices = new Set(cfg.offices);
    const allowedRoles = new Set(cfg.roles);
    const officeBuckets = new Map<string, Map<string, Record<string, unknown>>>();
    const stats = {
      total: records.length,
      skipped_no_office: 0,
      skipped_office: 0,
      skipped_role: 0,
      skipped_no_emp: 0,
      skipped_no_org_match: 0,
    };

    for (const r of records) {
      const office = String(r.cfs_ob__Sales_Office__c ?? '').trim();
      if (!office) { stats.skipped_no_office++; continue; }
      if (!offices.has(office)) { stats.skipped_office++; continue; }

      const role = String(r.cfs_ob__PartnerRole__c ?? r.cfs_ob__PartnerFunction__c ?? '').trim();
      if (role && !allowedRoles.has(role)) { stats.skipped_role++; continue; }

      const empNo = String((r.cfs_ob__EmployeeMaster__r as { cfs_ob__EmployeeNo__c?: string } | undefined)?.cfs_ob__EmployeeNo__c ?? r['cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c'] ?? '').trim();
      if (!empNo) { stats.skipped_no_emp++; continue; }

      const linkCust = this.orgLinkCustomer(
        r,
        orgLookup,
        options?.matchOrgDistribution ?? true,
        orgLookupPopulated,
      );
      if (!linkCust) { stats.skipped_no_org_match++; continue; }

      const dedupeKey = `${role}|${empNo}`;
      if (!officeBuckets.has(office)) officeBuckets.set(office, new Map());
      const bucket = officeBuckets.get(office)!;
      if (!bucket.has(dedupeKey)) {
        bucket.set(dedupeKey, { ...r, _link_customer: linkCust });
      }
    }

    const sampled: Record<string, unknown>[] = [];
    for (const office of [...officeBuckets.keys()].sort()) {
      sampled.push(...[...officeBuckets.get(office)!.values()].slice(0, perOffice));
    }

    const employees = new Map<string, Record<string, string>>();
    const partners: Record<string, string>[] = [];

    for (const r of sampled) {
      const office = String(r.cfs_ob__Sales_Office__c ?? '').trim();
      const empNo = String((r.cfs_ob__EmployeeMaster__r as { cfs_ob__EmployeeNo__c?: string } | undefined)?.cfs_ob__EmployeeNo__c ?? r['cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c'] ?? '').trim();
      const extId = String((r.cfs_ob__EmployeeMaster__r as { cfs_ob__External_Id__c?: string } | undefined)?.cfs_ob__External_Id__c ?? r['cfs_ob__EmployeeMaster__r.cfs_ob__External_Id__c'] ?? '').trim() || empNo;
      const empName = String((r.cfs_ob__EmployeeMaster__r as { Name?: string } | undefined)?.Name ?? r['cfs_ob__EmployeeMaster__r.Name'] ?? `Employee ${empNo}`).slice(0, 80);
      const email = String((r.cfs_ob__EmployeeMaster__r as { cfs_ob__EmailID__c?: string } | undefined)?.cfs_ob__EmailID__c ?? r['cfs_ob__EmployeeMaster__r.cfs_ob__EmailID__c'] ?? '').trim();
      const empOffice = String((r.cfs_ob__EmployeeMaster__r as { cfs_ob__u_Sales_Office__c?: string } | undefined)?.cfs_ob__u_Sales_Office__c ?? r['cfs_ob__EmployeeMaster__r.cfs_ob__u_Sales_Office__c'] ?? office).trim();

      employees.set(empNo, {
        'cfs_ob__EmployeeNo__c': empNo,
        'cfs_ob__External_Id__c': extId || empNo,
        Name: empName || empNo,
        'cfs_ob__Bottler__c': bottler,
        'cfs_ob__u_Sales_Office__c': empOffice,
        'cfs_ob__EmailID__c': email,
      });

      const cust = String(r._link_customer ?? '').trim();
      const partnerRole = String(r.cfs_ob__PartnerRole__c ?? r.cfs_ob__PartnerFunction__c ?? cfg.roles[0]).trim();
      let apExt = String(r.cfs_ob__AccountPartnerExternalId__c ?? '').trim();
      if (!apExt) apExt = `${bottler}-${office}-${empNo}-${partnerRole}-${cust}`;

      partners.push({
        'cfs_ob__AccountPartnerExternalId__c': apExt.slice(0, 255),
        'cfs_ob__PartnerRole__c': partnerRole,
        'cfs_ob__Bottler__c': bottler,
        'cfs_ob__Account__r.AccountNumber': cust,
        'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c': empNo,
      });
    }

    await this.writeCsv(join(workDir, 'employee_master.csv'), [...EMPLOYEE_FIELDS], [...employees.values()]);
    await this.writeCsv(join(workDir, 'account_partners.csv'), [...PARTNER_FIELDS], partners);

    const summary = {
      bottler,
      partners: partners.length,
      employees: employees.size,
      offices: officeBuckets.size,
      stats,
      outDir: workDir,
    };
    await writeFile(join(workDir, 'summary.json'), JSON.stringify(summary, null, 2));

    const load = await this.loadFromArtifacts(bottler, targetOrgId, false);
    return { ...summary, ...load };
  }

  async transferOrgToOrg(sourceOrgId: string, targetOrgId: string, bottler: BottlerId | 'all' = 'all') {
    const source = await this.resolveOrg(sourceOrgId);
    const target = await this.resolveOrg(targetOrgId);
    const workDir = await mkdtemp(join(tmpdir(), 'org-transfer-'));
    try {
    const bottlers = bottler === 'all' ? ['5000', '4900', '4600'] : [bottler];
    const filter = `cfs_ob__Bottler__c IN (${bottlers.map(toSoqlLiteral).join(', ')})`;

    const accountCsv = join(workDir, 'accounts.csv');
    const employeeCsv = join(workDir, 'employees.csv');
    const partnerCsv = join(workDir, 'partners.csv');

    const accountSoql =
      `SELECT ${ACCOUNT_TRANSFER_FIELDS.join(', ')} FROM Account WHERE ${filter} AND AccountNumber != null`;
    const employeeSoql =
      `SELECT ${EMPLOYEE_FIELDS.join(', ')} FROM cfs_ob__EmployeeMaster__c WHERE ${filter} AND cfs_ob__EmployeeNo__c != null`;
    const partnerSoql =
      `SELECT ${PARTNER_FIELDS.join(', ')}, cfs_ob__PartnerFunction__c FROM cfs_ob__AccountPartner__c WHERE ${filter} AND cfs_ob__AccountPartnerExternalId__c != null`;

    await this.sfCli.exportBulk(accountSoql, source.alias, accountCsv, 10, { cwd: workDir });
    await this.sfCli.exportBulk(employeeSoql, source.alias, employeeCsv, 10, { cwd: workDir });
    await this.sfCli.exportBulk(partnerSoql, source.alias, partnerCsv, 10, { cwd: workDir });

    await this.sfCli.upsertBulk('Account', accountCsv, 'AccountNumber', target.alias, 15, { cwd: workDir });
    await this.sfCli.upsertBulk('cfs_ob__EmployeeMaster__c', employeeCsv, 'cfs_ob__EmployeeNo__c', target.alias, 15, { cwd: workDir });
    await this.sfCli.upsertBulk('cfs_ob__AccountPartner__c', partnerCsv, 'cfs_ob__AccountPartnerExternalId__c', target.alias, 15, { cwd: workDir });

    return { success: true, bottlers };
    } finally {
      try {
        await rm(workDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  async preview(options: ProcessOptions) {
    const summary = await this.processExcel(options);
    return { preview: true, ...summary };
  }

  private async prepareSoqlMapping(rawInput: AccountPartnerMigrationInput) {
    const input = accountPartnerMigrationSchema.parse(rawInput);
    const [source, targetContext] = await Promise.all([
      this.resolveOrg(input.sourceOrgId),
      this.prepareTargetMappingContext(input.targetOrgId, input.bottler),
    ]);
    const query = resolveAccountPartnerMigrationSoql(input);
    const sourceWorkDir = await mkdtemp(join(tmpdir(), 'account-partner-source-'));
    try {
      const exportPath = join(sourceWorkDir, 'source-account-partners.csv');
      const records = await this.fetchSourcePartnerRecords(
        source.alias,
        query,
        exportPath,
        sourceWorkDir,
      );
      const mapping = buildAccountPartnerMigrationRows({
        records,
        bottler: input.bottler,
        targetAccounts: targetContext.targetAccounts,
        targetEmployees: targetContext.targetEmployees,
        existingExternalIds: targetContext.existingExternalIds,
        externalIdMaxLength: targetContext.targetSchema.externalIdMaxLength,
        nameWriteConfig: targetContext.targetSchema.nameWriteConfig,
      });
      return {
        target: targetContext.target,
        targetSchema: targetContext.targetSchema,
        query,
        mapping,
        targetAccounts: targetContext.targetAccounts,
        targetEmployees: targetContext.targetEmployees,
      };
    } finally {
      await removeTempDir(sourceWorkDir);
    }
  }

  private async prepareBatchedTargetMappingContext(
    target: { alias: string; id?: string },
    targetSchema: Awaited<ReturnType<AccountPartnerImportService['assertTargetMappingSchema']>>,
    bottler: BottlerId,
    accountKeys: string[],
    employeeKeys: string[],
    options?: {
      preloadedAccountRecords?: Array<Record<string, unknown>>;
      includeExistingPartners?: boolean;
    },
  ) {
    if (
      accountKeys.length === 0
      && employeeKeys.length === 0
      && !options?.preloadedAccountRecords?.length
    ) {
      return {
        targetSchema,
        targetAccounts: new Map<string, AccountPartnerTargetReference>(),
        targetEmployees: new Map<string, AccountPartnerTargetReference>(),
        existingExternalIds: new Set<string>(),
      };
    }

    if (options?.preloadedAccountRecords?.length) {
      const targetAccounts = indexAccountPartnerTargetAccounts(options.preloadedAccountRecords);
      const KEYED_UNIQUE_MAX = 2_000;
      const useEmployeeBulk = employeeKeys.length > KEYED_UNIQUE_MAX;

      if (employeeKeys.length === 0) {
        return {
          targetSchema,
          targetAccounts,
          targetEmployees: new Map<string, AccountPartnerTargetReference>(),
          existingExternalIds: new Set<string>(),
        };
      }

      if (!useEmployeeBulk) {
        const employeeRecords = await this.queryKeyedEmployees(target.alias, bottler, employeeKeys);
        if (employeeRecords.length > 0) {
          return {
            targetSchema,
            targetAccounts,
            targetEmployees: indexAccountPartnerTargetEmployees(employeeRecords),
            existingExternalIds: new Set<string>(),
          };
        }
      }

      if (!target.id) {
        throw new Error('Target org id is required for Account Partner target lookup');
      }
      const supplemental = await this.prepareTargetMappingContext(target.id, bottler, {
        preloadedAccountRecords: options.preloadedAccountRecords,
        includeExistingPartners: options.includeExistingPartners ?? true,
        employeesOnly: true,
      });
      return {
        targetSchema: supplemental.targetSchema,
        targetAccounts,
        targetEmployees: supplemental.targetEmployees,
        existingExternalIds: supplemental.existingExternalIds,
      };
    }

    const KEYED_UNIQUE_MAX = 2_000;
    const useFullExport =
      accountKeys.length > KEYED_UNIQUE_MAX
      || employeeKeys.length > KEYED_UNIQUE_MAX;

    if (!useFullExport) {
      const [accountRecords, employeeRecords] = await Promise.all([
        this.queryKeyedAccounts(target.alias, bottler, accountKeys),
        this.queryKeyedEmployees(target.alias, bottler, employeeKeys),
      ]);
      const keyedOk =
        (accountKeys.length === 0 || accountRecords.length > 0)
        && (employeeKeys.length === 0 || employeeRecords.length > 0);
      if (keyedOk) {
        return {
          targetSchema,
          targetAccounts: indexAccountPartnerTargetAccounts(accountRecords),
          targetEmployees: indexAccountPartnerTargetEmployees(employeeRecords),
          existingExternalIds: new Set<string>(),
        };
      }
    }

    if (!target.id) {
      throw new Error('Target org id is required for Account Partner target lookup');
    }
    const full = await this.prepareTargetMappingContext(target.id, bottler, {
      includeExistingPartners: options?.includeExistingPartners ?? true,
    });
    return {
      targetSchema: full.targetSchema,
      targetAccounts: full.targetAccounts,
      targetEmployees: full.targetEmployees,
      existingExternalIds: full.existingExternalIds,
    };
  }

  private async prepareKeyedTargetMappingContext(
    target: { alias: string; id?: string },
    targetSchema: Awaited<ReturnType<AccountPartnerImportService['assertTargetMappingSchema']>>,
    bottler: BottlerId,
    accountKeys: string[],
    employeeKeys: string[],
  ) {
    return this.prepareBatchedTargetMappingContext(
      target,
      targetSchema,
      bottler,
      accountKeys,
      employeeKeys,
    );
  }

  private chunkValues(values: string[], size = KEYED_LOOKUP_CHUNK): string[][] {
    const chunks: string[][] = [];
    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }
    return chunks;
  }

  private async runChunkedQueries<T>(
    chunks: string[][],
    queryFn: (chunk: string[]) => Promise<T[]>,
    concurrency = KEYED_LOOKUP_CONCURRENCY,
  ): Promise<T[]> {
    if (chunks.length === 0) return [];
    const results: T[] = [];
    for (let index = 0; index < chunks.length; index += concurrency) {
      const batch = chunks.slice(index, index + concurrency);
      const batchResults = await Promise.all(batch.map((chunk) => queryFn(chunk)));
      for (const part of batchResults) results.push(...part);
    }
    return results;
  }

  /**
   * Expand numeric business keys for SOQL IN clauses (trimmed, normalized, one pad variant).
   */
  private soqlKeyVariants(keys: string[]): string[] {
    const variants = new Set<string>();
    for (const key of keys) {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) continue;
      variants.add(trimmed);
      if (/^\d+$/.test(trimmed)) {
        const normalized = String(parseInt(trimmed, 10));
        variants.add(normalized);
        const padWidths = new Set<number>();
        if (trimmed.length > normalized.length) padWidths.add(trimmed.length);
        for (const width of [6, 8, 10, 12, 15, 18]) {
          if (width > normalized.length) padWidths.add(width);
        }
        for (const width of padWidths) {
          variants.add(normalized.padStart(width, '0'));
        }
      }
    }
    return [...variants];
  }

  private async queryKeyedAccounts(
    alias: string,
    bottler: string,
    keys: string[],
  ): Promise<Array<Record<string, unknown>>> {
    if (keys.length === 0) return [];
    const safeBottler = escapeSoqlLiteral(bottler);
    const chunks = this.chunkValues(this.soqlKeyVariants(keys));
    return this.runChunkedQueries(chunks, async (chunk) => {
      const literals = chunk.map((key) => toSoqlLiteral(key)).join(', ');
      const soql =
        'SELECT Id, Name, cfs_ob__u_CustomerNumber__c, AccountNumber FROM Account '
        + `WHERE cfs_ob__Bottler__c = '${safeBottler}' `
        + `AND (AccountNumber IN (${literals}) OR cfs_ob__u_CustomerNumber__c IN (${literals}))`;
      const result = await this.sfCli.queryAll(alias, soql);
      if (!result.success) {
        throw new Error(result.error ?? 'Target Account keyed lookup failed');
      }
      return (result.data?.records ?? []) as Array<Record<string, unknown>>;
    });
  }

  private async queryKeyedEmployees(
    alias: string,
    bottler: string,
    keys: string[],
  ): Promise<Array<Record<string, unknown>>> {
    if (keys.length === 0) return [];
    const safeBottler = escapeSoqlLiteral(bottler);
    const chunks = this.chunkValues(this.soqlKeyVariants(keys));
    return this.runChunkedQueries(chunks, async (chunk) => {
      const literals = chunk.map((key) => toSoqlLiteral(key)).join(', ');
      const soql =
        `SELECT Id, Name, cfs_ob__EmployeeNo__c FROM ${EMPLOYEE_MASTER_OBJECT} `
        + `WHERE cfs_ob__Bottler__c = '${safeBottler}' `
        + `AND cfs_ob__EmployeeNo__c IN (${literals})`;
      const result = await this.sfCli.queryAll(alias, soql);
      if (!result.success) {
        throw new Error(result.error ?? 'Target Employee Master keyed lookup failed');
      }
      return (result.data?.records ?? []) as Array<Record<string, unknown>>;
    });
  }

  private async queryExistingPartnerExternalIds(
    alias: string,
    bottler: string,
    externalIds: string[],
  ): Promise<Set<string>> {
    const found = new Set<string>();
    if (externalIds.length === 0) return found;
    const safeBottler = escapeSoqlLiteral(bottler);
    for (const chunk of this.chunkValues(externalIds)) {
      const literals = chunk.map((id) => toSoqlLiteral(id)).join(', ');
      const soql =
        `SELECT ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} FROM ${ACCOUNT_PARTNER_OBJECT} `
        + `WHERE ${ACCOUNT_PARTNER_BOTTLER_FIELD} = '${safeBottler}' `
        + `AND ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} IN (${literals})`;
      const result = await this.sfCli.queryAll(alias, soql);
      if (!result.success) {
        throw new Error(result.error ?? 'Existing Account Partner keyed lookup failed');
      }
      for (const record of result.data?.records ?? []) {
        const id = accountPartnerValueAt(record, ACCOUNT_PARTNER_EXTERNAL_ID_FIELD);
        if (id) found.add(id);
      }
    }
    return found;
  }

  private async prepareTargetMappingContext(
    targetOrgId: string,
    bottler: BottlerId,
    options?: {
      preloadedAccountRecords?: Array<Record<string, unknown>>;
      includeExistingPartners?: boolean;
      employeesOnly?: boolean;
    },
  ) {
    const target = await this.resolveOrg(targetOrgId);
    const targetSchema = await this.assertTargetMappingSchema(target.alias);
    const workDir = await mkdtemp(join(tmpdir(), 'account-partner-target-'));
    const includeExistingPartners = options?.includeExistingPartners ?? true;
    try {
      const targetAccountPath = join(workDir, 'target-accounts.csv');
      const targetEmployeePath = join(workDir, 'target-employees.csv');
      const targetPartnerPath = join(workDir, 'target-account-partners.csv');
      const safeBottler = escapeSoqlLiteral(bottler);

      let targetAccountRecords = options?.preloadedAccountRecords;
      if (!targetAccountRecords?.length && !options?.employeesOnly) {
        const targetAccountResult = await this.sfCli.exportBulk(
          this.targetAccountBulkSoql(bottler),
          target.alias,
          targetAccountPath,
          15,
          { cwd: workDir },
        );
        if (!targetAccountResult.success) {
          throw new Error(targetAccountResult.error ?? 'Target Account lookup failed');
        }
        targetAccountRecords = parseBulkCsv(await readFile(targetAccountPath, 'utf8'));
      }

      const exportJobs: Array<Promise<{ success: boolean; error?: string }>> = [
        this.sfCli.exportBulk(
          `SELECT Id, Name, cfs_ob__EmployeeNo__c FROM ${EMPLOYEE_MASTER_OBJECT} `
          + `WHERE cfs_ob__Bottler__c = '${safeBottler}' `
          + 'AND cfs_ob__EmployeeNo__c != null',
          target.alias,
          targetEmployeePath,
          15,
          { cwd: workDir },
        ),
      ];
      if (includeExistingPartners) {
        exportJobs.push(
          this.sfCli.exportBulk(
            `SELECT ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} FROM ${ACCOUNT_PARTNER_OBJECT} `
            + `WHERE ${ACCOUNT_PARTNER_BOTTLER_FIELD} = '${safeBottler}' `
            + `AND ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} != null`,
            target.alias,
            targetPartnerPath,
            15,
            { cwd: workDir },
          ),
        );
      }

      const exportResults = await Promise.all(exportJobs);
      const [targetEmployeeResult, targetPartnerResult] = includeExistingPartners
        ? exportResults
        : [exportResults[0], { success: true }];
      if (!targetEmployeeResult.success) {
        throw new Error(targetEmployeeResult.error ?? 'Target Employee Master lookup failed');
      }
      if (!targetPartnerResult.success) {
        throw new Error(targetPartnerResult.error ?? 'Existing Account Partner lookup failed');
      }

      const targetEmployeeRecords = parseBulkCsv(
        await readFile(targetEmployeePath, 'utf8'),
      );
      const targetPartnerRecords = includeExistingPartners
        ? parseBulkCsv(await readFile(targetPartnerPath, 'utf8'))
        : [];
      const targetAccounts = targetAccountRecords?.length
        ? indexAccountPartnerTargetAccounts(targetAccountRecords)
        : new Map<string, AccountPartnerTargetReference>();
      const targetEmployees = indexAccountPartnerTargetEmployees(targetEmployeeRecords);
      const existingExternalIds = new Set(
        targetPartnerRecords
          .map((record) => accountPartnerValueAt(record, ACCOUNT_PARTNER_EXTERNAL_ID_FIELD))
          .filter(Boolean),
      );
      return {
        target,
        targetSchema,
        targetAccounts,
        targetEmployees,
        existingExternalIds,
      };
    } finally {
      await removeTempDir(workDir);
    }
  }

  private async fetchSourcePartnerRecords(
    alias: string,
    query: string,
    exportPath: string,
    workDir: string,
  ): Promise<Array<Record<string, unknown>>> {
    const bulkResult = await this.sfCli.exportBulk(query, alias, exportPath, 15, { cwd: workDir });
    if (bulkResult.success) {
      return parseBulkCsv(await readFile(exportPath, 'utf8'));
    }
    if (isBulkCompoundQueryError(bulkResult.error)) {
      const restResult = await this.sfCli.queryAll(alias, query);
      if (!restResult.success) {
        throw new Error(restResult.error ?? 'Account Partner source REST query failed');
      }
      return restResult.data?.records ?? [];
    }
    throw new Error(bulkResult.error ?? 'Account Partner source query failed');
  }

  private async assertTargetMappingSchema(alias: string) {
    const [partnerResult, accountResult, employeeResult] = await Promise.all([
      this.sfCli.describeSObject(alias, ACCOUNT_PARTNER_OBJECT),
      this.sfCli.describeSObject(alias, 'Account'),
      this.sfCli.describeSObject(alias, EMPLOYEE_MASTER_OBJECT),
    ]);
    if (!partnerResult.success) {
      throw new Error(partnerResult.error ?? 'Target Account Partner schema lookup failed');
    }
    if (!accountResult.success) {
      throw new Error(accountResult.error ?? 'Target Account schema lookup failed');
    }
    if (!employeeResult.success) {
      throw new Error(employeeResult.error ?? 'Target Employee Master schema lookup failed');
    }
    type DescribedField = {
      name: string;
      externalId?: boolean;
      idLookup?: boolean;
      createable?: boolean;
      updateable?: boolean;
      filterable?: boolean;
      length?: number;
      type?: string;
      calculated?: boolean;
    };
    const fields = (result: unknown) =>
      new Map<string, DescribedField>(
        ((result as { data?: { result?: { fields?: DescribedField[] } } })
          ?.data?.result?.fields ?? [])
          .map((field): [string, DescribedField] => [field.name.toLowerCase(), field]),
      );
    const partnerFields = fields(partnerResult);
    const lookupFields = new Set([
      ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD,
      ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD,
    ].map((name) => name.toLowerCase()));
    for (const fieldName of [
      ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
      ACCOUNT_PARTNER_ROLE_FIELD,
      ACCOUNT_PARTNER_BOTTLER_FIELD,
      ACCOUNT_PARTNER_ACCOUNT_LOOKUP_FIELD,
      ACCOUNT_PARTNER_EMPLOYEE_LOOKUP_FIELD,
    ]) {
      const field = partnerFields.get(fieldName.toLowerCase());
      if (!field) throw new Error(`Target Account Partner field is missing: ${fieldName}`);
      if (lookupFields.has(fieldName.toLowerCase())) {
        if (!field.createable) {
          throw new Error(
            `Target Account Partner lookup must be createable on insert: ${fieldName}`,
          );
        }
        continue;
      }
      if (!field.createable || !field.updateable) {
        throw new Error(
          `Target Account Partner field must be createable and updateable: ${fieldName}`,
        );
      }
    }
    const partnerExternalId = partnerFields.get(
      ACCOUNT_PARTNER_EXTERNAL_ID_FIELD.toLowerCase(),
    );
    if (!partnerExternalId?.externalId && !partnerExternalId?.idLookup) {
      throw new Error(
        `Target ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} is not configured as an external ID`,
      );
    }
    const assertQueryKey = (
      describedFields: Map<string, DescribedField>,
      objectName: string,
      fieldName: string,
    ) => {
      const field = describedFields.get(fieldName.toLowerCase());
      if (!field) throw new Error(`Target ${objectName} field is missing: ${fieldName}`);
      if (field.filterable === false) {
        throw new Error(`Target ${objectName}.${fieldName} is not filterable`);
      }
    };
    assertQueryKey(
      fields(accountResult),
      'Account',
      'cfs_ob__u_CustomerNumber__c',
    );
    assertQueryKey(
      fields(accountResult),
      'Account',
      'AccountNumber',
    );
    assertQueryKey(
      fields(employeeResult),
      EMPLOYEE_MASTER_OBJECT,
      'cfs_ob__EmployeeNo__c',
    );
    const externalIdMaxLength = partnerExternalId.length ?? 255;
    if (externalIdMaxLength < 1) {
      throw new Error(`Target ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} has an invalid length`);
    }
    const nameField = partnerFields.get('name');
    const nameFieldName = nameField?.name ?? 'Name';
    const nameIsWritable = Boolean(
      nameField?.createable
      && nameField.updateable
      && !nameField.calculated
      && nameField.type?.toLowerCase() !== 'autonumber',
    );
    const nameMaxLength = nameField?.length ?? 80;
    if (nameIsWritable && nameMaxLength < 1) {
      throw new Error(`Target ${ACCOUNT_PARTNER_OBJECT}.${nameFieldName} has an invalid length`);
    }
    return {
      externalIdMaxLength,
      nameFieldName,
      nameWriteConfig: nameIsWritable
        ? { fieldName: nameFieldName, maxLength: nameMaxLength }
        : undefined,
    };
  }

  private orgLinkCustomer(
    r: Record<string, unknown>,
    lookup: Record<string, string>,
    matchOrg: boolean,
    lookupPopulated?: boolean,
  ): string | null {
    const hasLookup = lookupPopulated ?? Object.keys(lookup).length > 0;
    if (!matchOrg || !hasLookup) {
      const direct = String(r['cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c'] ?? '').trim();
      return direct || null;
    }
    for (const field of [
      'cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c',
      'cfs_ob__Account__r.AccountNumber',
    ]) {
      const key = normalizeAccountKey(r[field]);
      if (key && lookup[key]) return lookup[key];
    }
    return null;
  }

  private targetAccountBulkSoql(bottler: BottlerId): string {
    const safeBottler = escapeSoqlLiteral(bottler);
    return (
      `SELECT ${TARGET_ACCOUNT_BULK_FIELDS} FROM Account `
      + `WHERE cfs_ob__Bottler__c = '${safeBottler}' `
      + 'AND (cfs_ob__u_CustomerNumber__c != null OR AccountNumber != null)'
    );
  }

  private buildDistributionLookup(
    records: Array<Record<string, unknown>>,
  ): Record<string, string> {
    const lookup: Record<string, string> = {};
    for (const rec of records) {
      const channel = rec.cfs_ob__u_DistributionChannel__c;
      if (channel === null || channel === undefined || channel === '') continue;
      const key = normalizeAccountKey(rec.AccountNumber);
      if (key) lookup[key] = key;
    }
    return lookup;
  }

  private async exportTargetAccountRecords(alias: string, bottler: BottlerId) {
    const workDir = await mkdtemp(join(tmpdir(), 'account-partner-accounts-'));
    try {
      const outputPath = join(workDir, 'target-accounts.csv');
      const result = await this.sfCli.exportBulk(
        this.targetAccountBulkSoql(bottler),
        alias,
        outputPath,
        15,
        { cwd: workDir },
      );
      if (!result.success) {
        throw new Error(result.error ?? 'Target Account bulk export failed');
      }
      return parseBulkCsv(await readFile(outputPath, 'utf8'));
    } finally {
      await removeTempDir(workDir);
    }
  }

  private async queryOrgDistributionAccounts(alias: string, bottler: BottlerId) {
    const records = await this.exportTargetAccountRecords(alias, bottler);
    return this.buildDistributionLookup(records);
  }

  private async resolveOrg(orgId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    if (!org) throw new Error('Org not found');
    return { ...org, alias: org.username ?? org.alias };
  }

  private async retainArtifacts(key: string, dir: string): Promise<void> {
    const existing = this.artifactDirs.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      await removeTempDir(existing.dir);
    }
    const configuredTtl = Number(process.env.PARTNER_ARTIFACT_TTL_MS ?? 60 * 60 * 1000);
    const ttlMs = Number.isFinite(configuredTtl) && configuredTtl > 0
      ? configuredTtl
      : 60 * 60 * 1000;
    const timer = setTimeout(() => {
      void this.releaseArtifacts(key, dir);
    }, ttlMs);
    timer.unref();
    this.artifactDirs.set(key, { dir, timer });
  }

  private async releaseArtifacts(key: string, dir: string): Promise<void> {
    const retained = this.artifactDirs.get(key);
    if (retained?.dir === dir) {
      clearTimeout(retained.timer);
      this.artifactDirs.delete(key);
    }
    await removeTempDir(dir);
  }

  private async writeCsv(path: string, headers: string[], rows: Record<string, string>[]) {
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => this.csvEscape(row[h] ?? '')).join(','));
    }
    await writeFile(path, lines.join('\n'), 'utf-8');
  }

  private csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}
