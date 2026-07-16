import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prisma, Prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  buildAccountPartnerRows,
  compileQuerySectionPlan,
  createQueryRuntimeCheckpoint,
  escapeSoqlLiteral,
  extractFieldsFromSoql,
  pendingQueryIds,
  querySectionSchema,
  replaceOrApplyLimit,
  selectCompiledSupportQueries,
  serializeBulkCsv,
  stripIdFromSelect,
  type CompiledQuerySectionPlan,
  type QueryRuntimeCheckpoint,
} from '@sfcc/shared';
import { assertOrgOwned, assertResourceOwner } from '../../common/user-tenancy.util';
import { JobsService } from '../jobs/jobs.service';
import { StreamService } from '../stream/stream.service';
import { BulkThrottleService } from './bulk-throttle.service';

const PREVIEW_LIMIT = 5;
const BULK_CHUNK_SIZE = 25_000;
const RECONCILIATION_IN_CHUNK_SIZE = 200;

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

@Injectable()
export class QuerySectionRuntimeService {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly bulkThrottle?: BulkThrottleService,
  ) {}

  private async withBulkSlot<T>(alias: string, work: () => Promise<T>): Promise<T> {
    const slot = this.bulkThrottle ? await this.bulkThrottle.acquire(alias) : undefined;
    try {
      return await work();
    } finally {
      await slot?.release();
    }
  }

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
    salesOfficesByBottler?: Record<string, string[]>;
  }, userId: string) {
    const source = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
    assertResourceOwner(source, userId, 'Source org');
    if (input.targetOrgId) await assertOrgOwned(input.targetOrgId, userId, prisma);
    const plan = this.compile(input.section, {
      variables: input.variables,
      salesOffices: input.salesOffices,
      salesOfficesByBottler: input.salesOfficesByBottler,
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
    const describeCache = new Map<string, Awaited<ReturnType<typeof this.sfCli.describeSObject>>>();
    for (const query of plan.queries) {
      const cacheKey = query.object.toLowerCase();
      const cachedSource = describeCache.get(`source:${cacheKey}`);
      const cachedTarget = describeCache.get(`target:${cacheKey}`);
      const [sourceDescribe, targetDescribe] = await Promise.all([
        cachedSource ?? this.sfCli.describeSObject(sourceAlias, query.object),
        cachedTarget ?? this.sfCli.describeSObject(targetAlias, query.object),
      ]);
      describeCache.set(`source:${cacheKey}`, sourceDescribe);
      describeCache.set(`target:${cacheKey}`, targetDescribe);
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
      const selectedFields = extractFieldsFromSoql(query.soql);
      const isRoleLookup = plan.accountPartnerPlan?.roleQueryId === query.sourceQueryId;
      if (isRoleLookup) {
        const roleExternalId = query.externalIdField!;
        if (!sourceFields.has(roleExternalId.toLowerCase())) {
          errors.push(`${query.id}: source role lookup field ${roleExternalId} is missing`);
        }
        if (!selectedFields.some((field) => field.toLowerCase() === roleExternalId.toLowerCase())) {
          errors.push(`${query.id}: role query must select lookup field ${roleExternalId}`);
        }
      }
      if (['upsert', 'update', 'delete'].includes(query.operation)) {
        const generatesPartnerExternalId =
          plan.accountPartnerPlan?.accountPartnerQueryId === query.sourceQueryId;
        const sourceExternalId = sourceFields.get(query.externalIdField!.toLowerCase());
        const externalId = targetFields.get(query.externalIdField!.toLowerCase());
        if (!generatesPartnerExternalId && !sourceExternalId) {
          errors.push(`${query.id}: source external ID ${query.externalIdField} is missing`);
        }
        if (
          !generatesPartnerExternalId
          &&
          !selectedFields
            .some((field) => field.toLowerCase() === query.externalIdField!.toLowerCase())
        ) {
          errors.push(`${query.id}: query must select external ID ${query.externalIdField}`);
        }
        if (!externalId) errors.push(`${query.id}: target external ID ${query.externalIdField} is missing`);
        else if (!externalId.externalId && !externalId.idLookup) {
          errors.push(`${query.id}: ${query.externalIdField} is not marked as an external ID or idLookup`);
        } else if (
          query.operation === 'upsert'
          && (externalId.createable === false || externalId.updateable === false)
        ) {
          errors.push(`${query.id}: target external ID ${query.externalIdField} is not writable`);
        }
      }
      checks.push({ id: query.id, object: query.object, fields: selectedFields });
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
    // Compiled IDs include the sales office. Keying by source ID would overwrite variants.
    const sourceRows = new Map<string, Array<Record<string, string>>>();

    try {
      for (const query of plan.queries) {
        if (!pendingQueryIds(plan.queries, checkpoint).includes(query.id)) {
          await this.progress(input, query.id, 'completed', { skipped: true }, run.createdBy);
          continue;
        }
        const previous = checkpoint.queries[query.id];
        if (query.operation === 'insert' && previous && ['running', 'failed'].includes(previous.status)) {
          throw new Error(`Unsafe insert retry for ${query.id}; reconcile target records before resuming`);
        }
        checkpoint.currentQueryId = query.id;
        checkpoint.queries[query.id] = { ...previous, id: query.id, status: 'running' };
        await this.saveCheckpoint(input.automationRunId, checkpoint);
        await this.progress(
          input,
          query.id,
          'running',
          { object: query.object, limit: query.limit },
          run.createdBy,
        );

        try {
          const sourceQuery = stripIdFromSelect(query.soql);
          const exportPath = join(workDir, `${query.id.replace(/[^A-Za-z0-9_.-]/g, '_')}.csv`);
          const exported = await this.withBulkSlot(
            sourceAlias,
            () => this.sfCli.exportBulk(sourceQuery, sourceAlias, exportPath, 30, { cwd: workDir }),
          );
          if (!exported.success) throw new Error(exported.error ?? `Bulk export failed for ${query.id}`);
          let rows = parseCsv(await readFile(exportPath, 'utf8'));
          sourceRows.set(query.id, rows);

          const partner = plan.accountPartnerPlan;
          if (partner && query.sourceQueryId === partner.accountPartnerQueryId) {
            const accountQueries = selectCompiledSupportQueries(
              plan.queries,
              partner.accountQueryId,
              query.salesOffice,
            );
            const employeeQueries = selectCompiledSupportQueries(
              plan.queries,
              partner.employeeMasterQueryId,
              query.salesOffice,
            );
            const roleQueries = partner.roleQueryId
              ? selectCompiledSupportQueries(plan.queries, partner.roleQueryId, query.salesOffice)
              : [];
            const accountQuery = accountQueries[0];
            const employeeQuery = employeeQueries[0];
            if (!accountQuery || !employeeQuery) throw new Error('Partner support plan is incomplete');
            const accountRows = await this.supportRows(
              accountQueries,
              sourceRows,
              sourceAlias,
              workDir,
            );
            const employeeRows = await this.supportRows(
              employeeQueries,
              sourceRows,
              sourceAlias,
              workDir,
            );
            const roleRows = roleQueries.length
              ? await this.supportRows(roleQueries, sourceRows, sourceAlias, workDir)
              : undefined;
            if (partner.roleQueryId && !roleQueries[0]?.externalIdField) {
              throw new Error(`Role query ${partner.roleQueryId} has no deterministic lookup field`);
            }
            const accountKeys = new Set(
              accountRows.map((row) => this.rowValue(row, partner.accountKeyField)).filter(Boolean),
            );
            const employeeKeys = new Set(
              employeeRows.map((row) => this.rowValue(row, partner.employeeKeyField)).filter(Boolean),
            );
            const [targetAccountKeys, targetEmployeeKeys] = await Promise.all([
              this.targetKeys(targetAlias, accountQuery.object, partner.accountKeyField, accountKeys),
              this.targetKeys(targetAlias, employeeQuery.object, partner.employeeKeyField, employeeKeys),
            ]);
            const joined = buildAccountPartnerRows({
              plan: partner,
              accounts: accountRows,
              employees: employeeRows,
              mappings: rows,
              roles: roleRows,
              roleKeyField: roleQueries[0]?.externalIdField,
              targetAccountKeys,
              targetEmployeeKeys,
            });
            rows = joined.rows;
            await this.progress(input, query.id, 'running', { partnerJoin: joined }, run.createdBy);
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
            checkpoint.queries[query.id],
            async (chunkIndex, running, fingerprint) => {
              const entry = checkpoint.queries[query.id];
              checkpoint.queries[query.id] = running
                ? {
                    ...entry,
                    runningChunkIndex: chunkIndex,
                    runningChunkFingerprint: fingerprint,
                  }
                : {
                    ...entry,
                    runningChunkIndex: undefined,
                    runningChunkFingerprint: undefined,
                    completedChunkIndexes: [
                      ...new Set([...(entry.completedChunkIndexes ?? []), chunkIndex]),
                    ],
                    completedChunkFingerprints: {
                      ...(entry.completedChunkFingerprints ?? {}),
                      [chunkIndex]: fingerprint,
                    },
                  };
              await this.saveCheckpoint(input.automationRunId, checkpoint);
            },
          );
          checkpoint.queries[query.id] = {
            id: query.id,
            status: 'completed',
            exported: rows.length,
            loaded,
            failed: 0,
            completedChunkIndexes: checkpoint.queries[query.id].completedChunkIndexes,
            completedChunkFingerprints: checkpoint.queries[query.id].completedChunkFingerprints,
          };
          checkpoint.completedQueryIds = [...new Set([...checkpoint.completedQueryIds, query.id])];
          checkpoint.currentQueryId = undefined;
          await this.saveCheckpoint(input.automationRunId, checkpoint);
          await this.progress(
            input,
            query.id,
            'completed',
            { exported: rows.length, loaded },
            run.createdBy,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          checkpoint.queries[query.id] = {
            ...checkpoint.queries[query.id],
            status: 'failed',
            failed: checkpoint.queries[query.id].exported || 1,
            error: message,
          };
          await this.saveCheckpoint(input.automationRunId, checkpoint);
          await this.progress(input, query.id, 'failed', { error: message }, run.createdBy);
          throw error;
        }
      }
      return { plan: plan.name, checkpoint };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async supportRows(
    queries: CompiledQuerySectionPlan['queries'],
    cache: Map<string, Array<Record<string, string>>>,
    alias: string,
    workDir: string,
  ) {
    const rows: Array<Record<string, string>> = [];
    for (const query of queries) {
      let variantRows = cache.get(query.id);
      if (!variantRows) {
        const safeId = query.id.replace(/[^A-Za-z0-9_.-]/g, '_');
        const path = join(workDir, `support-${safeId}.csv`);
        const result = await this.withBulkSlot(
          alias,
          () => this.sfCli.exportBulk(
            stripIdFromSelect(query.soql),
            alias,
            path,
            30,
            { cwd: workDir },
          ),
        );
        if (!result.success) throw new Error(result.error ?? `Partner support export failed: ${query.id}`);
        variantRows = parseCsv(await readFile(path, 'utf8'));
        cache.set(query.id, variantRows);
      }
      rows.push(...variantRows);
    }
    return rows;
  }

  private rowValue(record: Record<string, unknown>, path: string): string {
    if (record[path] != null) return String(record[path]).trim();
    let value: unknown = record;
    for (const segment of path.split('.')) {
      if (!value || typeof value !== 'object') return '';
      value = (value as Record<string, unknown>)[segment];
    }
    return value == null ? '' : String(value).trim();
  }

  private async targetKeys(
    alias: string,
    objectName: string,
    fieldName: string,
    requiredKeys: ReadonlySet<string>,
  ) {
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!identifier.test(objectName) || !identifier.test(fieldName)) {
      throw new Error(`Invalid target distribution key ${objectName}.${fieldName}`);
    }
    const records = await this.queryRequiredRecords(alias, objectName, fieldName, requiredKeys);
    return new Set(records.map((record) => String(record[fieldName] ?? '').trim()).filter(Boolean));
  }

  private async loadChunks(
    objectName: string,
    rows: Array<Record<string, unknown>>,
    operation: string,
    externalIdField: string | undefined,
    targetAlias: string,
    workDir: string,
    queryId: string,
    checkpoint: QueryRuntimeCheckpoint['queries'][string],
    checkpointChunk: (
      chunkIndex: number,
      running: boolean,
      fingerprint: string,
    ) => Promise<void>,
  ) {
    if (!['upsert', 'insert', 'update', 'delete'].includes(operation)) {
      throw new Error(`Query ${queryId} operation ${operation} is not supported by Template V2`);
    }
    const completedChunks = new Set(checkpoint.completedChunkIndexes ?? []);
    const previouslyRunningChunk = checkpoint.runningChunkIndex;
    const orderedRows = externalIdField
      ? [...rows].sort((left, right) =>
          String(left[externalIdField] ?? '').localeCompare(String(right[externalIdField] ?? '')))
      : rows;
    let loaded = 0;
    for (let offset = 0; offset < orderedRows.length; offset += BULK_CHUNK_SIZE) {
      const chunkIndex = Math.trunc(offset / BULK_CHUNK_SIZE);
      const sourceChunk = orderedRows.slice(offset, offset + BULK_CHUNK_SIZE);
      const fingerprint = this.chunkFingerprint(sourceChunk, externalIdField);
      if (completedChunks.has(chunkIndex)) {
        if (checkpoint.completedChunkFingerprints?.[chunkIndex] !== fingerprint) {
          throw new Error(
            `Query ${queryId} source rows changed after chunk ${chunkIndex} completed; `
            + 'restart with a reconciled checkpoint',
          );
        }
        loaded += sourceChunk.length;
        continue;
      }
      if (
        previouslyRunningChunk === chunkIndex
        && checkpoint.runningChunkFingerprint !== fingerprint
      ) {
        throw new Error(
          `Query ${queryId} source rows changed while chunk ${chunkIndex} was in progress; `
          + 'manual reconciliation is required',
        );
      }
      const chunk = sourceChunk
        .map(({ Id: _id, id: _lowerId, ...row }) => row);
      let records = chunk;
      if (operation === 'update' || operation === 'delete') {
        if (!externalIdField) throw new Error(`${operation} query ${queryId} requires externalIdField`);
        const requiredKeys = new Set(
          chunk.map((row) => String(row[externalIdField] ?? '').trim()).filter(Boolean),
        );
        if (requiredKeys.size !== chunk.length) {
          throw new Error(`${operation} query ${queryId} contains an empty or duplicate ${externalIdField}`);
        }
        const targetIds = await this.targetRecordIds(
          targetAlias,
          objectName,
          externalIdField,
          requiredKeys,
        );
        records = chunk.flatMap((row) => {
          const externalId = String(row[externalIdField] ?? '').trim();
          const targetId = targetIds.get(externalId);
          if (!targetId) {
            // A delete chunk recorded as running may have committed before the
            // process stopped. Missing rows are then the desired end state.
            if (operation === 'delete' && previouslyRunningChunk === chunkIndex) return [];
            throw new Error(
              `${operation} query ${queryId} cannot reconcile target ${externalIdField}=${externalId}`,
            );
          }
          return [operation === 'delete' ? { Id: targetId } : { ...row, Id: targetId }];
        });
      }
      if (records.length === 0) {
        await checkpointChunk(chunkIndex, false, fingerprint);
        loaded += sourceChunk.length;
        continue;
      }
      const path = join(workDir, `${queryId.replace(/[^A-Za-z0-9_.-]/g, '_')}-${offset}.csv`);
      await writeFile(path, serializeBulkCsv(records), 'utf8');
      await checkpointChunk(chunkIndex, true, fingerprint);
      const result = await this.withBulkSlot(targetAlias, () =>
        operation === 'upsert'
          ? this.sfCli.upsertBulk(objectName, path, externalIdField!, targetAlias, 30, { cwd: workDir })
          : operation === 'insert'
            ? this.sfCli.importBulk(objectName, path, targetAlias, 30, { cwd: workDir })
            : operation === 'update'
              ? this.sfCli.updateBulk(objectName, path, targetAlias, 30, { cwd: workDir })
              : this.sfCli.deleteBulk(objectName, path, targetAlias, 30, { cwd: workDir }));
      if (!result.success) throw new Error(result.error ?? `${operation} failed for ${queryId}`);
      await checkpointChunk(chunkIndex, false, fingerprint);
      loaded += sourceChunk.length;
    }
    return loaded;
  }

  private chunkFingerprint(
    rows: Array<Record<string, unknown>>,
    externalIdField: string | undefined,
  ): string {
    const identities = rows.map((row) =>
      externalIdField
        ? String(row[externalIdField] ?? '')
        : JSON.stringify(row, Object.keys(row).sort()));
    return createHash('sha256').update(identities.join('\u0000')).digest('hex');
  }

  private async targetRecordIds(
    alias: string,
    objectName: string,
    externalIdField: string,
    requiredKeys: ReadonlySet<string>,
  ) {
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!identifier.test(objectName) || !identifier.test(externalIdField)) {
      throw new Error(`Invalid target reconciliation key ${objectName}.${externalIdField}`);
    }
    const records = await this.queryRequiredRecords(
      alias,
      objectName,
      externalIdField,
      requiredKeys,
      'Id',
    );
    const ids = new Map<string, string>();
    for (const record of records) {
      const key = String(record[externalIdField] ?? '').trim();
      const id = String(record.Id ?? '').trim();
      if (!key || !id) continue;
      if (ids.has(key)) throw new Error(`Duplicate target ${externalIdField}: ${key}`);
      ids.set(key, id);
    }
    return ids;
  }

  private async queryRequiredRecords(
    alias: string,
    objectName: string,
    keyField: string,
    requiredKeys: ReadonlySet<string>,
    additionalField?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const keys = [...requiredKeys].filter(Boolean);
    const records: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < keys.length; offset += RECONCILIATION_IN_CHUNK_SIZE) {
      const keyChunk = keys.slice(offset, offset + RECONCILIATION_IN_CHUNK_SIZE);
      const literals = keyChunk.map((key) => `'${escapeSoqlLiteral(key)}'`).join(', ');
      const fields = additionalField ? `${additionalField}, ${keyField}` : keyField;
      const result = await this.sfCli.query(
        alias,
        `SELECT ${fields} FROM ${objectName} WHERE ${keyField} IN (${literals})`,
      );
      if (!result.success) {
        throw new Error(result.error ?? `Target reconciliation failed for ${objectName}.${keyField}`);
      }
      records.push(
        ...((result.data?.result?.records ?? []) as Array<Record<string, unknown>>),
      );
    }
    return records;
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
    ownerId: string,
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
    await this.streamService.publish(
      'job_status',
      {
        ...event,
        eventType: 'query_progress',
      },
      ownerId,
    );
  }
}
