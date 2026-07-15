import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prisma, Prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  buildAccountPartnerRows,
  compileQuerySectionPlan,
  createQueryRuntimeCheckpoint,
  extractFieldsFromSoql,
  pendingQueryIds,
  querySectionSchema,
  replaceOrApplyLimit,
  stripIdFromSelect,
  type CompiledQuerySectionPlan,
  type QueryRuntimeCheckpoint,
} from '@sfcc/shared';
import { assertOrgOwned, assertResourceOwner } from '../../common/user-tenancy.util';
import { JobsService } from '../jobs/jobs.service';
import { StreamService } from '../stream/stream.service';

const PREVIEW_LIMIT = 5;
const BULK_CHUNK_SIZE = 25_000;

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows.filter((values) => values.some(Boolean)).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function writeRows(rows: Array<Record<string, unknown>>): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
}

@Injectable()
export class QuerySectionRuntimeService {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  compile(section: unknown, options: Parameters<typeof compileQuerySectionPlan>[1] = {}) {
    return compileQuerySectionPlan(section, options);
  }

  validate(section: unknown) {
    const normalized = querySectionSchema.parse(section);
    return { valid: true, normalized, plan: compileQuerySectionPlan(normalized) };
  }

  async preview(input: {
    sourceOrgId: string;
    targetOrgId?: string;
    section: unknown;
    variables?: Record<string, string>;
    salesOffices?: string[];
  }, userId: string) {
    const source = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
    assertResourceOwner(source, userId, 'Source org');
    if (input.targetOrgId) await assertOrgOwned(input.targetOrgId, userId, prisma);
    const plan = this.compile(input.section, {
      variables: input.variables,
      salesOffices: input.salesOffices,
    });
    const alias = source.username ?? source.alias;
    const queries = [];
    for (const query of plan.queries) {
      const previewSoql = replaceOrApplyLimit(query.soql, Math.min(query.limit, PREVIEW_LIMIT));
      const result = await this.sfCli.query(alias, previewSoql);
      if (!result.success) throw new BadRequestException(result.error ?? `Preview failed for ${query.id}`);
      queries.push({
        ...query,
        previewSoql,
        totalSize: result.data?.result?.totalSize ?? 0,
        records: result.data?.result?.records ?? [],
      });
    }
    const preflight = input.targetOrgId
      ? await this.preflightPlan(plan, input.sourceOrgId, input.targetOrgId, userId)
      : undefined;
    return { plan, queries, preflight };
  }

  async preflightPlan(
    plan: CompiledQuerySectionPlan,
    sourceOrgId: string,
    targetOrgId: string,
    userId: string,
  ) {
    const [source, target] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: targetOrgId } }),
    ]);
    assertResourceOwner(source, userId, 'Source org');
    assertResourceOwner(target, userId, 'Target org');
    const sourceAlias = source.username ?? source.alias;
    const targetAlias = target.username ?? target.alias;
    const errors: string[] = [];
    const checks = [];
    for (const query of plan.queries) {
      const [sourceDescribe, targetDescribe] = await Promise.all([
        this.sfCli.describeSObject(sourceAlias, query.object),
        this.sfCli.describeSObject(targetAlias, query.object),
      ]);
      const sourceFields = new Map(
        (sourceDescribe.data?.result?.fields ?? []).map((field) => [field.name.toLowerCase(), field]),
      );
      const targetFields = new Map(
        (targetDescribe.data?.result?.fields ?? []).map((field) => [field.name.toLowerCase(), field]),
      );
      for (const field of extractFieldsFromSoql(query.soql).filter((name) => !name.includes('.'))) {
        if (field.toLowerCase() === 'id') continue;
        if (!sourceFields.has(field.toLowerCase())) errors.push(`${query.id}: source field ${field} is missing`);
        const targetField = targetFields.get(field.toLowerCase());
        if (!targetField) errors.push(`${query.id}: target field ${field} is missing`);
        else if (query.operation !== 'delete') {
          if (['insert', 'upsert'].includes(query.operation) && targetField.createable === false) {
            errors.push(`${query.id}: target field ${field} is not createable`);
          }
          if (['update', 'upsert'].includes(query.operation) && targetField.updateable === false) {
            errors.push(`${query.id}: target field ${field} is not updateable`);
          }
        }
      }
      if (['upsert', 'update', 'delete'].includes(query.operation)) {
        const sourceExternalId = sourceFields.get(query.externalIdField!.toLowerCase());
        const externalId = targetFields.get(query.externalIdField!.toLowerCase());
        if (!sourceExternalId) errors.push(`${query.id}: source external ID ${query.externalIdField} is missing`);
        if (
          !extractFieldsFromSoql(query.soql)
            .some((field) => field.toLowerCase() === query.externalIdField!.toLowerCase())
        ) {
          errors.push(`${query.id}: query must select external ID ${query.externalIdField}`);
        }
        if (!externalId) errors.push(`${query.id}: target external ID ${query.externalIdField} is missing`);
        else if (!externalId.externalId && !['name', 'developername'].includes(query.externalIdField!.toLowerCase())) {
          errors.push(`${query.id}: ${query.externalIdField} is not marked as an external ID`);
        } else if (
          query.operation === 'upsert'
          && (externalId.createable === false || externalId.updateable === false)
        ) {
          errors.push(`${query.id}: target external ID ${query.externalIdField} is not writable`);
        }
      }
      checks.push({ id: query.id, object: query.object, fields: extractFieldsFromSoql(query.soql) });
    }
    return { ok: errors.length === 0, checks, errors };
  }

  async execute(input: {
    automationRunId: string;
    sourceOrgId: string;
    targetOrgId: string;
    section: unknown;
    salesOffices?: string[];
    salesOfficesByBottler?: Record<string, string[]>;
    dbJobId: string;
  }) {
    const [source, target, run] = await Promise.all([
      prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } }),
      prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } }),
      prisma.automationRun.findUnique({ where: { id: input.automationRunId } }),
    ]);
    if (!source || !target || !run) throw new Error('Query runtime source, target, or run not found');
    if (source.createdBy !== run.createdBy || target.createdBy !== run.createdBy) {
      throw new Error('Query runtime org ownership validation failed');
    }
    const plan = this.compile(input.section, {
      salesOffices: input.salesOffices,
      salesOfficesByBottler: input.salesOfficesByBottler,
    });
    const preflight = await this.preflightPlan(
      plan,
      input.sourceOrgId,
      input.targetOrgId,
      run.createdBy,
    );
    if (!preflight.ok) {
      throw new Error(`Query-section preflight failed: ${preflight.errors.join('; ')}`);
    }
    const existingCheckpoint = ((run.checkpoint ?? {}) as Record<string, unknown>)
      .querySection as QueryRuntimeCheckpoint | undefined;
    const checkpoint = createQueryRuntimeCheckpoint(plan.queries, existingCheckpoint);
    const workDir = await mkdtemp(join(tmpdir(), `template-v2-query-${input.automationRunId}-`));
    const sourceAlias = source.username ?? source.alias;
    const targetAlias = target.username ?? target.alias;
    const sourceRows = new Map<string, Array<Record<string, string>>>();

    try {
      for (const query of plan.queries) {
        if (!pendingQueryIds(plan.queries, checkpoint).includes(query.id)) {
          await this.progress(input, query.id, 'completed', { skipped: true });
          continue;
        }
        const previous = checkpoint.queries[query.id];
        if (query.operation === 'insert' && previous && ['running', 'failed'].includes(previous.status)) {
          throw new Error(`Unsafe insert retry for ${query.id}; reconcile target records before resuming`);
        }
        checkpoint.currentQueryId = query.id;
        checkpoint.queries[query.id] = { ...previous, id: query.id, status: 'running' };
        await this.saveCheckpoint(input.automationRunId, checkpoint);
        await this.progress(input, query.id, 'running', { object: query.object, limit: query.limit });

        try {
          const sourceQuery = stripIdFromSelect(query.soql);
          const exportPath = join(workDir, `${query.id.replace(/[^A-Za-z0-9_.-]/g, '_')}.csv`);
          const exported = await this.sfCli.exportBulk(sourceQuery, sourceAlias, exportPath, 30, { cwd: workDir });
          if (!exported.success) throw new Error(exported.error ?? `Bulk export failed for ${query.id}`);
          let rows = parseCsv(await readFile(exportPath, 'utf8'));
          sourceRows.set(query.sourceQueryId, rows);

          const partner = plan.accountPartnerPlan;
          if (partner && query.sourceQueryId === partner.accountPartnerQueryId) {
            const accountRows = sourceRows.get(partner.accountQueryId)
              ?? await this.exportSupportRows(plan, partner.accountQueryId, sourceAlias, workDir);
            const employeeRows = sourceRows.get(partner.employeeMasterQueryId)
              ?? await this.exportSupportRows(plan, partner.employeeMasterQueryId, sourceAlias, workDir);
            const accountQuery = plan.queries.find(
              (candidate) => candidate.sourceQueryId === partner.accountQueryId,
            );
            const employeeQuery = plan.queries.find(
              (candidate) => candidate.sourceQueryId === partner.employeeMasterQueryId,
            );
            if (!accountQuery || !employeeQuery) throw new Error('Partner support plan is incomplete');
            const [targetAccountKeys, targetEmployeeKeys] = await Promise.all([
              this.targetKeys(targetAlias, accountQuery.object, partner.accountKeyField),
              this.targetKeys(targetAlias, employeeQuery.object, partner.employeeKeyField),
            ]);
            const joined = buildAccountPartnerRows({
              plan: partner,
              accounts: accountRows,
              employees: employeeRows,
              mappings: rows,
              targetAccountKeys,
              targetEmployeeKeys,
            });
            rows = joined.rows;
            await this.progress(input, query.id, 'running', { partnerJoin: joined });
          }
          checkpoint.queries[query.id] = {
            ...checkpoint.queries[query.id],
            exported: rows.length,
          };
          await this.saveCheckpoint(input.automationRunId, checkpoint);
          const loaded = await this.loadChunks(
            query.object,
            rows,
            query.operation,
            query.externalIdField,
            targetAlias,
            workDir,
            query.id,
          );
          checkpoint.queries[query.id] = {
            id: query.id,
            status: 'completed',
            exported: rows.length,
            loaded,
            failed: 0,
          };
          checkpoint.completedQueryIds = [...new Set([...checkpoint.completedQueryIds, query.id])];
          checkpoint.currentQueryId = undefined;
          await this.saveCheckpoint(input.automationRunId, checkpoint);
          await this.progress(input, query.id, 'completed', { exported: rows.length, loaded });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          checkpoint.queries[query.id] = {
            ...checkpoint.queries[query.id],
            status: 'failed',
            failed: checkpoint.queries[query.id].exported || 1,
            error: message,
          };
          await this.saveCheckpoint(input.automationRunId, checkpoint);
          await this.progress(input, query.id, 'failed', { error: message });
          throw error;
        }
      }
      return { plan: plan.name, checkpoint };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async exportSupportRows(
    plan: CompiledQuerySectionPlan,
    sourceQueryId: string,
    alias: string,
    workDir: string,
  ) {
    const query = plan.queries.find((candidate) => candidate.sourceQueryId === sourceQueryId);
    if (!query) throw new Error(`Partner support query ${sourceQueryId} is missing`);
    const path = join(workDir, `support-${sourceQueryId}.csv`);
    const result = await this.sfCli.exportBulk(stripIdFromSelect(query.soql), alias, path, 30, { cwd: workDir });
    if (!result.success) throw new Error(result.error ?? `Partner support export failed: ${sourceQueryId}`);
    return parseCsv(await readFile(path, 'utf8'));
  }

  private async targetKeys(alias: string, objectName: string, fieldName: string) {
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!identifier.test(objectName) || !identifier.test(fieldName)) {
      throw new Error(`Invalid target distribution key ${objectName}.${fieldName}`);
    }
    const result = await this.sfCli.query(
      alias,
      `SELECT ${fieldName} FROM ${objectName} WHERE ${fieldName} != null LIMIT 100000`,
    );
    if (!result.success) {
      throw new Error(result.error ?? `Target distribution check failed for ${objectName}.${fieldName}`);
    }
    return new Set(
      ((result.data?.result?.records ?? []) as Array<Record<string, unknown>>)
        .map((record) => String(record[fieldName] ?? '').trim())
        .filter(Boolean),
    );
  }

  private async loadChunks(
    objectName: string,
    rows: Array<Record<string, unknown>>,
    operation: string,
    externalIdField: string | undefined,
    targetAlias: string,
    workDir: string,
    queryId: string,
  ) {
    if (!['upsert', 'insert', 'update', 'delete'].includes(operation)) {
      throw new Error(`Query ${queryId} operation ${operation} is not supported by Template V2`);
    }
    let loadRows = rows;
    if (operation === 'update' || operation === 'delete') {
      if (!externalIdField) throw new Error(`${operation} query ${queryId} requires externalIdField`);
      const targetIds = await this.targetRecordIds(targetAlias, objectName, externalIdField);
      loadRows = rows.map(({ Id: _sourceId, id: _lowerSourceId, ...row }) => {
        const externalId = String(row[externalIdField] ?? '').trim();
        const targetId = targetIds.get(externalId);
        if (!externalId || !targetId) {
          throw new Error(
            `${operation} query ${queryId} cannot reconcile target ${externalIdField}=${externalId || '<empty>'}`,
          );
        }
        return operation === 'delete' ? { Id: targetId } : { ...row, Id: targetId };
      });
    }
    let loaded = 0;
    for (let offset = 0; offset < loadRows.length; offset += BULK_CHUNK_SIZE) {
      const chunk = loadRows.slice(offset, offset + BULK_CHUNK_SIZE)
        .map(({ Id: _id, id: _lowerId, ...row }) => row);
      const records = operation === 'update' || operation === 'delete'
        ? loadRows.slice(offset, offset + BULK_CHUNK_SIZE)
        : chunk;
      if (records.length === 0) continue;
      const path = join(workDir, `${queryId.replace(/[^A-Za-z0-9_.-]/g, '_')}-${offset}.csv`);
      await writeFile(path, writeRows(records), 'utf8');
      const result = operation === 'upsert'
        ? await this.sfCli.upsertBulk(objectName, path, externalIdField!, targetAlias, 30, { cwd: workDir })
        : operation === 'insert'
          ? await this.sfCli.importBulk(objectName, path, targetAlias, 30, { cwd: workDir })
          : operation === 'update'
            ? await this.sfCli.updateBulk(objectName, path, targetAlias, 30, { cwd: workDir })
            : await this.sfCli.deleteBulk(objectName, path, targetAlias, 30, { cwd: workDir });
      if (!result.success) throw new Error(result.error ?? `${operation} failed for ${queryId}`);
      loaded += records.length;
    }
    return loaded;
  }

  private async targetRecordIds(alias: string, objectName: string, externalIdField: string) {
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!identifier.test(objectName) || !identifier.test(externalIdField)) {
      throw new Error(`Invalid target reconciliation key ${objectName}.${externalIdField}`);
    }
    const result = await this.sfCli.query(
      alias,
      `SELECT Id, ${externalIdField} FROM ${objectName} WHERE ${externalIdField} != null LIMIT 100000`,
    );
    if (!result.success) {
      throw new Error(result.error ?? `Target reconciliation failed for ${objectName}`);
    }
    const ids = new Map<string, string>();
    for (const record of (result.data?.result?.records ?? []) as Array<Record<string, unknown>>) {
      const key = String(record[externalIdField] ?? '').trim();
      const id = String(record.Id ?? '').trim();
      if (!key || !id) continue;
      if (ids.has(key)) throw new Error(`Duplicate target ${externalIdField}: ${key}`);
      ids.set(key, id);
    }
    return ids;
  }

  private async saveCheckpoint(automationRunId: string, querySection: QueryRuntimeCheckpoint) {
    const run = await prisma.automationRun.findUnique({ where: { id: automationRunId }, select: { checkpoint: true } });
    await prisma.automationRun.update({
      where: { id: automationRunId },
      data: {
        checkpoint: {
          ...((run?.checkpoint as Record<string, unknown> | null) ?? {}),
          querySection,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async progress(
    input: { automationRunId: string; dbJobId: string },
    queryId: string,
    status: string,
    details: Record<string, unknown>,
  ) {
    const event = {
      type: 'template_v2_query',
      automationRunId: input.automationRunId,
      jobId: input.dbJobId,
      queryId,
      status,
      ...details,
    };
    await this.jobsService.addLog(input.dbJobId, status === 'failed' ? 'stderr' : 'stdout', JSON.stringify(event));
    await this.streamService.publish('job_status', {
      ...event,
      eventType: 'query_progress',
    });
  }
}
