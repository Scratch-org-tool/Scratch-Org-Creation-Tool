import { Injectable } from '@nestjs/common';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  ACCOUNT_EXPORT_FIELDS,
  buildCountSoql,
  compileAccountOfficeQueries,
  escapeSoqlValue,
  normalizeQuerySet,
  ONBOARDING_OBJECT,
  type BottlerSalesOfficeConfig,
  type ConaManualAccountQuery,
  type ConaManualSeedQuery,
  type DataSeedQuerySet,
} from '@sfcc/shared';
import type { AccountSeedRow, ResolvedManualAccountQuery } from './account-seed-query.builder';
import {
  buildAccountCountSoql,
  buildAccountSeedSoql,
  resolveManualAccountSeedQuery,
} from './account-seed-query.builder';
import type {
  PreparedManualOnboardingQuery,
  ResolvedManualOnboardingQuery,
} from './onboarding-seed-query.builder';
import {
  buildManualOnboardingRecordTypeSoql,
  prepareManualOnboardingQueryForBulk,
  resolveManualOnboardingSeedQuery,
} from './onboarding-seed-query.builder';
import { RecordTypeMapperService } from './record-type-mapper.service';

type SeedDataset = 'OnboardingConfig' | 'Products' | 'VisitPlans' | 'Accounts';
type DataSeedMode = 'automatic' | 'query_json' | 'hybrid';

const ONBOARDING_SOQL = (rawBottler: string) => {
  const bottler = escapeSoqlValue(rawBottler);
  return `SELECT Id, RecordType.DeveloperName, RecordTypeId, cfs_ob__Bottler__c, cfs_ob__Business_Unit__c, ` +
  `cfs_ob__Sales_Office__c, cfs_ob__Primary_Group_Number__c, cfs_ob__Primary_Group__c, cfs_ob__Payer__c, ` +
  `cfs_ob__Trade_Channel__c, cfs_ob__Subtrade_Channel__c, cfs_ob__Secondary_Group__c, ` +
  `cfs_ob__Secondary_Group_Number__c, cfs_ob__Secondary_Group_Description__c, ` +
  `cfs_ob__Store_Number_Requirements__c, cfs_ob__Terms_of_Payment__c, cfs_ob__TermsofPayment__c, ` +
  `cfs_ob__AML__c, cfs_ob__Is_Tax_Form_Required__c, cfs_ob__Global_Customer__c, ` +
  `cfs_ob__Primary_Franchise_Group_Description__c, cfs_ob__ZN_Partner__c, cfs_ob__Tax_Certificate__c, ` +
  `cfs_ob__Secondary_Franchise_Group_Number__c, cfs_ob__Secondary_Franchise_Group_Description__c ` +
  `FROM ${ONBOARDING_OBJECT} WHERE cfs_ob__Record_Category__c = 'Primary Group' AND cfs_ob__Bottler__c = '${bottler}'`;
};

const PRODUCTS_SOQL = (bottler: string) =>
  `SELECT Id, cfs_ob__External_Id__c, Name, cfs_ob__Bottler__c FROM cfs_ob__u_Product__c WHERE cfs_ob__Bottler__c = '${escapeSoqlValue(bottler)}'`;

const VISIT_PLANS_SOQL = (bottler: string) =>
  `SELECT Id, cfs_ob__External_Id__c, Name, cfs_ob__Bottler__c FROM cfs_ob__u_VisitPlan__c WHERE cfs_ob__Bottler__c = '${escapeSoqlValue(bottler)}'`;

@Injectable()
export class ConaSeedService {
  private readonly sfCli = createSfCliClient();

  constructor(private readonly recordTypeMapper: RecordTypeMapperService) {}

  validateManualAccountQueries(queries: ConaManualAccountQuery[]) {
    return queries.map(resolveManualAccountSeedQuery);
  }

  validateManualOnboardingQueries(queries: ConaManualSeedQuery[]) {
    return queries.map(resolveManualOnboardingSeedQuery);
  }

  async previewAccountSeed(sourceOrgId: string, rows: AccountSeedRow[]) {
    const org = await this.resolveOrg(sourceOrgId);
    const results = [];
    for (const row of rows) {
      const soql = buildAccountCountSoql(row);
      const result = await this.sfCli.query(org.alias, soql);
      const count = (result.data?.result as { totalSize?: number })?.totalSize ?? 0;
      results.push({ ...row, availableCount: count, soql: buildAccountSeedSoql(row) });
    }
    return { rows: results };
  }

  async validate(
    sourceOrgId: string,
    datasets: SeedDataset[],
    accountSeedRows?: AccountSeedRow[],
    accountQueryMode: 'guided' | 'manual' = 'guided',
    manualAccountQueries?: ConaManualAccountQuery[],
    onboardingQueryMode: 'automatic' | 'manual' = 'automatic',
    manualOnboardingQueries?: ConaManualSeedQuery[],
    targetOrgId?: string,
  ) {
    const org = await this.resolveOrg(sourceOrgId);
    const bottlers = [...new Set((accountSeedRows ?? []).map((r) => r.bottler))];
    const defaultBottler = bottlers[0] ?? '5000';
    const checks: Array<{
      dataset: string;
      count: number;
      ok: boolean;
      availableCount?: number;
      requestedMaximum?: number;
    }> = [];
    if (
      datasets.includes('Accounts')
      && accountQueryMode === 'manual'
      && !manualAccountQueries?.length
    ) {
      throw new Error('Add at least one manual Account query');
    }
    if (
      datasets.includes('OnboardingConfig')
      && onboardingQueryMode === 'manual'
      && !manualOnboardingQueries?.length
    ) {
      throw new Error('Add at least one manual OnboardingConfig query');
    }

    const safeBottler = escapeSoqlValue(defaultBottler);
    const manualQueryPreviews: Array<ResolvedManualAccountQuery & {
      availableCount: number;
      selectedCount: number;
    }> = [];
    const manualOnboardingPreviews: Array<PreparedManualOnboardingQuery & {
      availableCount: number;
      selectedCount: number;
      recordTypeMappings: Record<string, string>;
    }> = [];
    if (datasets.includes('OnboardingConfig') && onboardingQueryMode === 'automatic') {
      const r = await this.sfCli.query(org.alias, `SELECT COUNT() FROM ${ONBOARDING_OBJECT} WHERE cfs_ob__Bottler__c = '${safeBottler}'`);
      const count = (r.data?.result as { totalSize?: number })?.totalSize ?? 0;
      checks.push({ dataset: 'OnboardingConfig', count, ok: count > 0 });
    }
    if (
      datasets.includes('OnboardingConfig')
      && onboardingQueryMode === 'manual'
      && manualOnboardingQueries?.length
    ) {
      if (!targetOrgId) {
        throw new Error('Target org is required to validate manual OnboardingConfig fields');
      }
      const target = await this.resolveOrg(targetOrgId);
      for (const query of manualOnboardingQueries) {
        const resolved = resolveManualOnboardingSeedQuery(query);
        const prepared = await this.prepareManualOnboardingBulkQuery(
          resolved,
          org.alias,
          target.alias,
        );
        const [result, recordTypesResult] = await Promise.all([
          this.sfCli.query(org.alias, buildCountSoql(prepared.soql)),
          this.sfCli.query(
            org.alias,
            buildManualOnboardingRecordTypeSoql(prepared),
          ),
        ]);
        if (!result.success) {
          throw new Error(
            `Manual query "${prepared.label}" preview failed: ${result.error ?? 'unknown Salesforce query error'}`,
          );
        }
        if (!recordTypesResult.success) {
          throw new Error(
            `Manual query "${prepared.label}" RecordType preview failed: `
            + (recordTypesResult.error ?? 'unknown Salesforce query error'),
          );
        }
        const requiredRecordTypeIds = [
          ...new Set(
            (
              (recordTypesResult.data?.result as {
                records?: Array<{ RecordTypeId?: string }>;
              })?.records ?? []
            )
              .map((record) => record.RecordTypeId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const recordTypeMappings = await this.recordTypeMapper.buildMappings(
          sourceOrgId,
          targetOrgId,
          ONBOARDING_OBJECT,
          undefined,
          requiredRecordTypeIds,
        );
        const availableCount = (result.data?.result as { totalSize?: number })?.totalSize ?? 0;
        const selectedCount = Math.min(availableCount, prepared.limit);
        checks.push({
          dataset: `OnboardingConfig:${prepared.label}`,
          count: selectedCount,
          ok: selectedCount > 0,
          availableCount,
          requestedMaximum: prepared.limit,
        });
        manualOnboardingPreviews.push({
          ...prepared,
          availableCount,
          selectedCount,
          recordTypeMappings,
        });
      }
    }
    if (datasets.includes('Products')) {
      const r = await this.sfCli.query(org.alias, `SELECT COUNT() FROM cfs_ob__u_Product__c WHERE cfs_ob__Bottler__c = '${safeBottler}'`);
      const count = (r.data?.result as { totalSize?: number })?.totalSize ?? 0;
      checks.push({ dataset: 'Products', count, ok: count > 0 });
    }
    if (datasets.includes('VisitPlans')) {
      const r = await this.sfCli.query(org.alias, `SELECT COUNT() FROM cfs_ob__u_VisitPlan__c WHERE cfs_ob__Bottler__c = '${safeBottler}'`);
      const count = (r.data?.result as { totalSize?: number })?.totalSize ?? 0;
      checks.push({ dataset: 'VisitPlans', count, ok: count > 0 });
    }
    if (
      datasets.includes('Accounts')
      && accountQueryMode === 'guided'
      && accountSeedRows?.length
    ) {
      for (const row of accountSeedRows) {
        const soql = buildAccountCountSoql(row);
        const r = await this.sfCli.query(org.alias, soql);
        const count = (r.data?.result as { totalSize?: number })?.totalSize ?? 0;
        checks.push({
          dataset: `Accounts:${row.accountGroup}/${row.bottler}/${row.distributionChannel}`,
          count,
          ok: count >= row.limit,
        });
      }
    }
    if (
      datasets.includes('Accounts')
      && accountQueryMode === 'manual'
      && manualAccountQueries?.length
    ) {
      for (const query of manualAccountQueries) {
        const resolved = resolveManualAccountSeedQuery(query);
        const result = await this.sfCli.query(org.alias, buildCountSoql(resolved.soql));
        if (!result.success) {
          throw new Error(
            `Manual query "${resolved.label}" preview failed: ${result.error ?? 'unknown Salesforce query error'}`,
          );
        }
        const availableCount = (result.data?.result as { totalSize?: number })?.totalSize ?? 0;
        const selectedCount = Math.min(availableCount, resolved.limit);
        checks.push({
          dataset: `Accounts:${resolved.label}`,
          count: selectedCount,
          ok: selectedCount > 0,
          availableCount,
          requestedMaximum: resolved.limit,
        });
        manualQueryPreviews.push({ ...resolved, availableCount, selectedCount });
      }
    }

    const ok = checks.every((c) => c.ok);
    return {
      ok,
      checks,
      manualQueries: manualQueryPreviews,
      manualOnboardingQueries: manualOnboardingPreviews,
    };
  }

  async runSeed(options: {
    sourceOrgId: string;
    targetOrgId: string;
    datasets?: SeedDataset[];
    accountSeedRows?: AccountSeedRow[];
    accountQueryMode?: 'guided' | 'manual';
    manualAccountQueries?: ConaManualAccountQuery[];
    onboardingQueryMode?: 'automatic' | 'manual';
    manualOnboardingQueries?: ConaManualSeedQuery[];
    dataSeedMode?: DataSeedMode;
    querySet?: DataSeedQuerySet;
    salesOfficeConfig?: BottlerSalesOfficeConfig;
    onLog?: (line: string) => Promise<void>;
  }) {
    const source = await this.resolveOrg(options.sourceOrgId);
    const target = await this.resolveOrg(options.targetOrgId);
    const workDir = await mkdtemp(join(tmpdir(), 'cona-seed-'));
    await mkdir(workDir, { recursive: true });

    const log = async (line: string) => options.onLog?.(line);
    const mode = options.dataSeedMode ?? 'hybrid';
    const datasets = options.datasets ?? ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'];
    const accountQueryMode = options.accountQueryMode ?? 'guided';
    const onboardingQueryMode = options.onboardingQueryMode ?? 'automatic';
    const bottler = options.accountSeedRows?.[0]?.bottler ?? options.salesOfficeConfig?.bottler ?? '5000';

    try {
    if (mode === 'automatic' || mode === 'hybrid') {
    const validation = await this.validate(
      options.sourceOrgId,
      datasets,
      options.accountSeedRows,
      accountQueryMode,
      options.manualAccountQueries,
      onboardingQueryMode,
      options.manualOnboardingQueries,
      options.targetOrgId,
    );
    if (!validation.ok) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.checks.filter((c) => !c.ok))}`);
    }
    await log('Validation passed');

    if (datasets.includes('OnboardingConfig') && onboardingQueryMode === 'automatic') {
      const csv = join(workDir, 'onboarding-config.csv');
      await log('Exporting OnboardingConfig...');
      const exp = await this.sfCli.exportBulk(ONBOARDING_SOQL(bottler), source.alias, csv, 10, { cwd: workDir });
      if (!exp.success) throw new Error(exp.error ?? 'Onboarding export failed');

      const mappings = await this.recordTypeMapper.buildMappings(
        options.sourceOrgId,
        options.targetOrgId,
        ONBOARDING_OBJECT,
      );
      await this.applyRecordTypeMappings(csv, mappings);
      await log('Importing OnboardingConfig...');
      const imp = await this.sfCli.importBulk(ONBOARDING_OBJECT, csv, target.alias, 10, { cwd: workDir });
      if (!imp.success) throw new Error(imp.error ?? 'Onboarding import failed');
    }
    if (
      datasets.includes('OnboardingConfig')
      && onboardingQueryMode === 'manual'
      && options.manualOnboardingQueries?.length
    ) {
      for (const [i] of options.manualOnboardingQueries.entries()) {
        const resolved = validation.manualOnboardingQueries[i];
        if (!resolved) {
          throw new Error(`Validated OnboardingConfig query is missing at index ${i}`);
        }
        const mappings = resolved.recordTypeMappings;
        const csv = join(workDir, `manual-onboarding-${i}.csv`);
        for (const compound of resolved.expandedCompoundFields) {
          await log(
            `Expanded compound field ${compound.field} into `
            + `${compound.components.join(', ')} for Bulk Query.`,
          );
        }
        if (resolved.excludedFields.length > 0) {
          await log(
            `Excluded ${resolved.excludedFields.length} non-writable field(s): `
            + resolved.excludedFields
              .map((field) => `${field.field} (${field.reason})`)
              .join(', '),
          );
        }
        await log(
          `Exporting manual OnboardingConfig query "${resolved.label}" `
          + `(up to ${resolved.limit.toLocaleString()} records)...`,
        );
        const exp = await this.sfCli.exportBulk(
          resolved.soql,
          source.alias,
          csv,
          10,
          { cwd: workDir },
        );
        if (!exp.success) {
          throw new Error(exp.error ?? `OnboardingConfig export failed for "${resolved.label}"`);
        }
        await this.applyRecordTypeMappings(csv, mappings);
        await log(`Importing manual OnboardingConfig query "${resolved.label}"...`);
        const imp = await this.sfCli.importBulk(
          resolved.objectName,
          csv,
          target.alias,
          10,
          { cwd: workDir },
        );
        if (!imp.success) {
          throw new Error(imp.error ?? `OnboardingConfig import failed for "${resolved.label}"`);
        }
      }
    }

    if (datasets.includes('Products')) {
      const csv = join(workDir, 'products.csv');
      await log('Exporting Products...');
      const exp = await this.sfCli.exportBulk(PRODUCTS_SOQL(bottler), source.alias, csv, 10, { cwd: workDir });
      if (!exp.success) throw new Error(exp.error ?? 'Products export failed');
      await log('Upserting Products...');
      const imp = await this.sfCli.upsertBulk('cfs_ob__u_Product__c', csv, 'cfs_ob__External_Id__c', target.alias, 15, { cwd: workDir });
      if (!imp.success) throw new Error(imp.error ?? 'Products upsert failed');
    }

    if (datasets.includes('VisitPlans')) {
      const csv = join(workDir, 'visit-plans.csv');
      await log('Exporting VisitPlans...');
      const exp = await this.sfCli.exportBulk(VISIT_PLANS_SOQL(bottler), source.alias, csv, 10, { cwd: workDir });
      if (!exp.success) throw new Error(exp.error ?? 'VisitPlans export failed');
      await log('Upserting VisitPlans...');
      const imp = await this.sfCli.upsertBulk('cfs_ob__u_VisitPlan__c', csv, 'cfs_ob__External_Id__c', target.alias, 15, { cwd: workDir });
      if (!imp.success) throw new Error(imp.error ?? 'VisitPlans upsert failed');
    }

    if (
      datasets.includes('Accounts')
      && accountQueryMode === 'guided'
      && options.accountSeedRows?.length
    ) {
      for (const [i, row] of options.accountSeedRows.entries()) {
        const csv = join(workDir, `accounts-${i}.csv`);
        const soql = buildAccountSeedSoql(row);
        await log(`Exporting accounts ${row.accountGroup}/${row.bottler}...`);
        const exp = await this.sfCli.exportBulk(soql, source.alias, csv, 10, { cwd: workDir });
        if (!exp.success) throw new Error(exp.error ?? `Account export failed for row ${i}`);
        await log(`Upserting accounts ${row.accountGroup}/${row.bottler}...`);
        const imp = await this.sfCli.upsertBulk('Account', csv, 'cfs_ob__u_CustomerNumber__c', target.alias, 15, { cwd: workDir });
        if (!imp.success) throw new Error(imp.error ?? `Account upsert failed for row ${i}`);
      }
    }
    if (
      datasets.includes('Accounts')
      && accountQueryMode === 'manual'
      && options.manualAccountQueries?.length
    ) {
      for (const [i, query] of options.manualAccountQueries.entries()) {
        const resolved = resolveManualAccountSeedQuery(query);
        const csv = join(workDir, `manual-accounts-${i}.csv`);
        await log(
          `Exporting manual Account query "${resolved.label}" (up to ${resolved.limit.toLocaleString()} records)...`,
        );
        const exp = await this.sfCli.exportBulk(
          resolved.soql,
          source.alias,
          csv,
          10,
          { cwd: workDir },
        );
        if (!exp.success) {
          throw new Error(exp.error ?? `Account export failed for "${resolved.label}"`);
        }
        await log(`Upserting manual Account query "${resolved.label}"...`);
        const imp = await this.sfCli.upsertBulk(
          resolved.objectName,
          csv,
          resolved.externalIdField,
          target.alias,
          15,
          { cwd: workDir },
        );
        if (!imp.success) {
          throw new Error(imp.error ?? `Account upsert failed for "${resolved.label}"`);
        }
      }
    }
    }

    if ((mode === 'query_json' || mode === 'hybrid') && options.querySet) {
      await this.runQuerySetSeed({
        source,
        target,
        workDir,
        querySet: options.querySet,
        salesOfficeConfig: options.salesOfficeConfig,
        log,
      });
    }

    await log('Seed complete');
    return { success: true };
    } finally {
      try {
        await rm(workDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  private async prepareManualOnboardingBulkQuery(
    query: ResolvedManualOnboardingQuery,
    sourceAlias: string,
    targetAlias: string,
  ): Promise<PreparedManualOnboardingQuery> {
    const [sourceDescribe, targetDescribe] = await Promise.all([
      this.sfCli.describeSObject(sourceAlias, ONBOARDING_OBJECT),
      this.sfCli.describeSObject(targetAlias, ONBOARDING_OBJECT),
    ]);
    const sourceFields = sourceDescribe.data?.result?.fields;
    const targetFields = targetDescribe.data?.result?.fields;
    if (!sourceDescribe.success || !sourceFields) {
      throw new Error(
        sourceDescribe.error
        ?? `Could not describe ${ONBOARDING_OBJECT} in the source org`,
      );
    }
    if (!targetDescribe.success || !targetFields) {
      throw new Error(
        targetDescribe.error
        ?? `Could not describe ${ONBOARDING_OBJECT} in the target org`,
      );
    }
    return prepareManualOnboardingQueryForBulk(query, sourceFields, targetFields);
  }

  private async runQuerySetSeed(options: {
    source: { alias: string };
    target: { alias: string };
    workDir: string;
    querySet: DataSeedQuerySet;
    salesOfficeConfig?: BottlerSalesOfficeConfig;
    log: (line: string) => Promise<void>;
  }) {
    const normalized = normalizeQuerySet(options.querySet);
    for (const [i, q] of normalized.queries.entries()) {
      const csv = join(options.workDir, `query-${q.id || i}.csv`);
      await options.log(`Exporting ${q.label}...`);
      const exp = await this.sfCli.exportBulk(q.soql, options.source.alias, csv, 10, { cwd: options.workDir });
      if (!exp.success) throw new Error(exp.error ?? `Export failed for ${q.label}`);
      const objectName = q.object;
      const extId = objectName === 'Account' ? 'cfs_ob__u_CustomerNumber__c' : 'Name';
      await options.log(`Upserting ${q.label}...`);
      const imp = await this.sfCli.upsertBulk(objectName, csv, extId, options.target.alias, 15, { cwd: options.workDir });
      if (!imp.success) throw new Error(imp.error ?? `Upsert failed for ${q.label}`);
    }

    const offices = options.salesOfficeConfig?.offices ?? [];
    if (options.querySet.accountRules?.length && offices.length) {
      for (const rule of options.querySet.accountRules) {
        const compiled = compileAccountOfficeQueries(rule, offices, ACCOUNT_EXPORT_FIELDS);
        for (const [j, cq] of compiled.entries()) {
          const csv = join(options.workDir, `account-${rule.id}-${cq.office}-${j}.csv`);
          await options.log(`Exporting accounts ${rule.id} office ${cq.office}...`);
          const exp = await this.sfCli.exportBulk(cq.soql, options.source.alias, csv, 10, { cwd: options.workDir });
          if (!exp.success) throw new Error(exp.error ?? `Account export failed for ${cq.office}`);
          const imp = await this.sfCli.upsertBulk('Account', csv, 'cfs_ob__u_CustomerNumber__c', options.target.alias, 15, { cwd: options.workDir });
          if (!imp.success) throw new Error(imp.error ?? `Account upsert failed for ${cq.office}`);
        }
      }
    }
  }

  private async resolveOrg(orgId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    if (!org) throw new Error('Org not found');
    return { ...org, alias: org.username ?? org.alias };
  }

  private async applyRecordTypeMappings(csvPath: string, mappings: Record<string, string>) {
    const { readFile } = await import('fs/promises');
    const content = await readFile(csvPath, 'utf-8');
    // Salesforce bulk export can emit CRLF even on Linux. Normalize before
    // rewriting RecordTypeIds so the import's detected line-ending setting and
    // the actual CSV bytes cannot diverge.
    const records = splitCsvRecords(content.replace(/\r\n?/g, '\n'));
    if (records.length < 2) return;
    const headers = splitCsvLine(records[0]);
    const rtIdx = headers.findIndex((h) => h.trim().replace(/^"|"$/g, '') === 'RecordTypeId');
    if (rtIdx < 0) return;

    const mapped = records.map((line, i) => {
      if (i === 0 || !line.trim()) return line;
      const cols = splitCsvLine(line);
      const srcId = cols[rtIdx]?.trim().replace(/^"|"$/g, '');
      if (srcId && mappings[srcId]) cols[rtIdx] = mappings[srcId];
      return cols.join(',');
    });
    await writeFile(csvPath, mapped.join('\n'), 'utf-8');
  }
}

/** Split a CSV line respecting double-quoted fields (which may contain commas). */
function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

/** Split normalized CSV into logical records while preserving quoted newlines. */
function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '"') {
      current += ch;
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      records.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  records.push(current);
  return records;
}
