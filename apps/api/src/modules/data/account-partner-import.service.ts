import { Injectable } from '@nestjs/common';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  ACCOUNT_PARTNER_ACCOUNT_KEY_FIELD,
  ACCOUNT_PARTNER_BOTTLER_FIELD,
  ACCOUNT_PARTNER_EMPLOYEE_KEY_FIELD,
  ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
  ACCOUNT_PARTNER_OBJECT,
  ACCOUNT_PARTNER_ROLE_FIELD,
  EMPLOYEE_MASTER_OBJECT,
  accountPartnerMigrationSchema,
  accountPartnerValueAt,
  buildAccountPartnerMigrationRows,
  escapeSoqlLiteral,
  normalizeAccountPartnerAccountKey,
  parseBulkCsv,
  resolveAccountPartnerMigrationSoql,
  serializeBulkCsv,
  toSoqlLiteral,
  type AccountPartnerMigrationInput,
  type AccountPartnerTargetReference,
  type BottlerSalesOfficeConfig,
} from '@sfcc/shared';
import { removeTempDir } from '../../common/temp-cleanup.util';
import { BOTTLER_CONFIG, normalizeAccountKey, resolveSalesOfficeConfig, type BottlerId } from './bottler-config';

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
  'cfs_ob__EmployeeMaster__r.cfs_ob__EmployeeNo__c',
] as const;

const ACCOUNT_TRANSFER_FIELDS = [
  'cfs_ob__u_CustomerNumber__c', 'Name', 'AccountNumber', 'cfs_ob__Bottler__c',
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

      const linkCust = this.orgLinkCustomer(r, orgLookup, options.matchOrgDistribution ?? true);
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
        'cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c': cust,
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
    return {
      ok: prepared.mapping.stats.ready > 0,
      query: prepared.query,
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

      const linkCust = this.orgLinkCustomer(r, orgLookup, options?.matchOrgDistribution ?? true);
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
        'cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c': cust,
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
      `SELECT ${ACCOUNT_TRANSFER_FIELDS.join(', ')} FROM Account WHERE ${filter} AND cfs_ob__u_CustomerNumber__c != null`;
    const employeeSoql =
      `SELECT ${EMPLOYEE_FIELDS.join(', ')} FROM cfs_ob__EmployeeMaster__c WHERE ${filter} AND cfs_ob__EmployeeNo__c != null`;
    const partnerSoql =
      `SELECT ${PARTNER_FIELDS.join(', ')}, cfs_ob__PartnerFunction__c FROM cfs_ob__AccountPartner__c WHERE ${filter} AND cfs_ob__AccountPartnerExternalId__c != null`;

    await this.sfCli.exportBulk(accountSoql, source.alias, accountCsv, 10, { cwd: workDir });
    await this.sfCli.exportBulk(employeeSoql, source.alias, employeeCsv, 10, { cwd: workDir });
    await this.sfCli.exportBulk(partnerSoql, source.alias, partnerCsv, 10, { cwd: workDir });

    await this.sfCli.upsertBulk('Account', accountCsv, 'cfs_ob__u_CustomerNumber__c', target.alias, 15, { cwd: workDir });
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
    const [source, target] = await Promise.all([
      this.resolveOrg(input.sourceOrgId),
      this.resolveOrg(input.targetOrgId),
    ]);
    const targetSchema = await this.assertTargetMappingSchema(target.alias);
    const query = resolveAccountPartnerMigrationSoql(input);
    const sourceWorkDir = await mkdtemp(join(tmpdir(), 'account-partner-source-'));
    try {
      const exportPath = join(sourceWorkDir, 'source-account-partners.csv');
      const targetAccountPath = join(sourceWorkDir, 'target-accounts.csv');
      const targetEmployeePath = join(sourceWorkDir, 'target-employees.csv');
      const targetPartnerPath = join(sourceWorkDir, 'target-account-partners.csv');
      const safeBottler = escapeSoqlLiteral(input.bottler);
      const [
        sourceResult,
        targetAccountResult,
        targetEmployeeResult,
        targetPartnerResult,
      ] = await Promise.all([
        this.sfCli.exportBulk(
          query,
          source.alias,
          exportPath,
          15,
          { cwd: sourceWorkDir },
        ),
        this.sfCli.exportBulk(
          'SELECT Id, Name, cfs_ob__u_CustomerNumber__c FROM Account '
          + `WHERE cfs_ob__Bottler__c = '${safeBottler}' `
          + 'AND cfs_ob__u_CustomerNumber__c != null',
          target.alias,
          targetAccountPath,
          15,
          { cwd: sourceWorkDir },
        ),
        this.sfCli.exportBulk(
          `SELECT Id, Name, cfs_ob__EmployeeNo__c FROM ${EMPLOYEE_MASTER_OBJECT} `
          + `WHERE cfs_ob__Bottler__c = '${safeBottler}' `
          + 'AND cfs_ob__EmployeeNo__c != null',
          target.alias,
          targetEmployeePath,
          15,
          { cwd: sourceWorkDir },
        ),
        this.sfCli.exportBulk(
          `SELECT ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} FROM ${ACCOUNT_PARTNER_OBJECT} `
          + `WHERE ${ACCOUNT_PARTNER_BOTTLER_FIELD} = '${safeBottler}' `
          + `AND ${ACCOUNT_PARTNER_EXTERNAL_ID_FIELD} != null`,
          target.alias,
          targetPartnerPath,
          15,
          { cwd: sourceWorkDir },
        ),
      ]);
      if (!sourceResult.success) {
        throw new Error(sourceResult.error ?? 'Account Partner source query failed');
      }
      if (!targetAccountResult.success) {
        throw new Error(targetAccountResult.error ?? 'Target Account lookup failed');
      }
      if (!targetEmployeeResult.success) {
        throw new Error(targetEmployeeResult.error ?? 'Target Employee Master lookup failed');
      }
      if (!targetPartnerResult.success) {
        throw new Error(targetPartnerResult.error ?? 'Existing Account Partner lookup failed');
      }
      const records = parseBulkCsv(await readFile(exportPath, 'utf8'));
      const targetAccountRecords = parseBulkCsv(
        await readFile(targetAccountPath, 'utf8'),
      );
      const targetEmployeeRecords = parseBulkCsv(
        await readFile(targetEmployeePath, 'utf8'),
      );
      const targetPartnerRecords = parseBulkCsv(
        await readFile(targetPartnerPath, 'utf8'),
      );
      const targetAccounts = new Map<string, AccountPartnerTargetReference>();
      const ambiguousAccountKeys = new Set<string>();
      for (const record of targetAccountRecords) {
        const key = accountPartnerValueAt(record, 'cfs_ob__u_CustomerNumber__c');
        const id = accountPartnerValueAt(record, 'Id');
        const name = accountPartnerValueAt(record, 'Name');
        const normalized = normalizeAccountPartnerAccountKey(key);
        if (!id) continue;
        if (!normalized || ambiguousAccountKeys.has(normalized)) continue;
        const existing = targetAccounts.get(normalized);
        if (existing && existing.id !== id) {
          targetAccounts.delete(normalized);
          ambiguousAccountKeys.add(normalized);
        } else {
          targetAccounts.set(normalized, { id, key, name });
        }
      }
      const targetEmployees = new Map<string, AccountPartnerTargetReference>();
      const ambiguousEmployeeKeys = new Set<string>();
      for (const record of targetEmployeeRecords) {
        const key = accountPartnerValueAt(record, 'cfs_ob__EmployeeNo__c');
        const id = accountPartnerValueAt(record, 'Id');
        const name = accountPartnerValueAt(record, 'Name');
        if (!key || !id || ambiguousEmployeeKeys.has(key)) continue;
        const existing = targetEmployees.get(key);
        if (existing && existing.id !== id) {
          targetEmployees.delete(key);
          ambiguousEmployeeKeys.add(key);
        } else {
          targetEmployees.set(key, { id, key, name });
        }
      }
      const existingExternalIds = new Set(
        targetPartnerRecords
          .map((record) => accountPartnerValueAt(record, ACCOUNT_PARTNER_EXTERNAL_ID_FIELD))
          .filter(Boolean),
      );
      const mapping = buildAccountPartnerMigrationRows({
        records,
        bottler: input.bottler,
        targetAccounts,
        targetEmployees,
        existingExternalIds,
        externalIdMaxLength: targetSchema.externalIdMaxLength,
        nameWriteConfig: targetSchema.nameWriteConfig,
      });
      return {
        target,
        targetSchema,
        query,
        mapping,
        targetAccounts,
        targetEmployees,
      };
    } finally {
      await removeTempDir(sourceWorkDir);
    }
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
    for (const fieldName of [
      ACCOUNT_PARTNER_EXTERNAL_ID_FIELD,
      ACCOUNT_PARTNER_ROLE_FIELD,
      ACCOUNT_PARTNER_BOTTLER_FIELD,
      'cfs_ob__Account__c',
      'cfs_ob__EmployeeMaster__c',
    ]) {
      const field = partnerFields.get(fieldName.toLowerCase());
      if (!field) throw new Error(`Target Account Partner field is missing: ${fieldName}`);
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
  ): string | null {
    if (!matchOrg || Object.keys(lookup).length === 0) {
      const direct = String(r['cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c'] ?? '').trim();
      return direct || null;
    }
    for (const field of ['cfs_ob__Account__r.cfs_ob__u_CustomerNumber__c', 'cfs_ob__Account__r.AccountNumber']) {
      const key = normalizeAccountKey(r[field]);
      if (key && lookup[key]) return lookup[key];
    }
    return null;
  }

  private async queryOrgDistributionAccounts(alias: string, bottler: string) {
    const safeBottler = escapeSoqlLiteral(bottler);
    const soql =
      `SELECT cfs_ob__u_CustomerNumber__c FROM Account ` +
      `WHERE cfs_ob__Bottler__c = '${safeBottler}' ` +
      `AND cfs_ob__u_DistributionChannel__c != null ` +
      `AND cfs_ob__u_CustomerNumber__c != null`;
    const result = await this.sfCli.query(
      alias,
      soql,
    );
    const lookup: Record<string, string> = {};
    const records = (result.data as { result?: { records?: Array<{ cfs_ob__u_CustomerNumber__c: string }> } })?.result?.records ?? [];
    for (const rec of records) {
      const key = normalizeAccountKey(rec.cfs_ob__u_CustomerNumber__c);
      if (key) lookup[key] = key;
    }
    return lookup;
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
