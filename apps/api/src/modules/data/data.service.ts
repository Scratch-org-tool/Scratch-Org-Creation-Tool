import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  QUEUE_NAMES,
  customSettingsLoadSchema,
  dataDeploySchema,
  dataReplicationSchema,
  orgToOrgDeploySchema,
  orgToOrgDeployBatchSchema,
  resolveSoql,
  buildFilterSoql,
  resolveFieldsForDeploy,
  resolveOrgToOrgDeploySoql,
  validateSoqlForObject,
  OrgToOrgSoqlParseError,
  sfdmuExportSchema,
  type ConaSeedRunInput,
  type OrgToOrgDeployBatchResult,
  type OrgToOrgObjectDeployConfig,
  validateSfdmuExportSummary,
  normalizeQuerySet,
  extractLimitFromSoql,
  buildGenericDeployQuery,
  DATA_PREVIEW_MAX_ROWS,
  replaceOrApplyLimit,
  buildCountSoql,
  extractObjectFromSoql,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { DataDeployOrchestratorService } from './data-deploy-orchestrator.service';
import {
  generateSfdmuConfig,
  generateSfdmuConfigFromSoql,
  loadBundledCustomSettingsExport,
  writeSfdmuExportFromUpload,
} from './sfdmu-config.generator';
import { RecordTypeMapperService } from './record-type-mapper.service';
import { OrgToOrgBrowseService } from './org-to-org-browse.service';
import { assertOrgOwned, assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';
import { randomUUID } from 'crypto';
import { DataPreflightService, type DataDeployPreflightResult } from './data-preflight.service';
import { DataRollbackService } from './data-rollback.service';

@Injectable()
export class DataService {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly recordTypeMapper: RecordTypeMapperService,
    private readonly orgToOrgBrowse: OrgToOrgBrowseService,
    private readonly dataDeployOrchestrator: DataDeployOrchestratorService,
    private readonly dataPreflight: DataPreflightService,
    private readonly dataRollback: DataRollbackService,
  ) {}

  private async requireOwnedOrg(orgId: string, userId: string) {
    return assertOrgOwned(orgId, userId, prisma);
  }

  private async requireSfdmuPlugin(): Promise<void> {
    try {
      await this.sfCli.ensureSfdmuPlugin();
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'SFDMU plugin not installed. Run: sf plugins install sfdmu',
      );
    }
  }

  private assertPreflight(report: DataDeployPreflightResult): void {
    if (report.ok) return;
    const details = [
      ...report.errors,
      ...report.fieldIssues.map((issue) => issue.detail),
    ];
    throw new BadRequestException(`Data preflight blocked deployment: ${details.join('; ')}`);
  }

  async getCustomSettingsPreflight() {
    const sfdmuInstalled = await this.sfCli.isSfdmuPluginInstalled();
    return { sfdmuInstalled };
  }

  async previewData(sourceOrgId: string, soql: string, userId: string, recordLimit?: number) {
    const org = await this.requireOwnedOrg(sourceOrgId, userId);
    const alias = org.username ?? org.alias;
    const effectiveLimit = recordLimit ?? extractLimitFromSoql(soql) ?? DATA_PREVIEW_MAX_ROWS;
    const previewLimit = Math.min(effectiveLimit, DATA_PREVIEW_MAX_ROWS);
    const previewSoql = replaceOrApplyLimit(soql, previewLimit);

    let totalCount: number | undefined;
    if (effectiveLimit > DATA_PREVIEW_MAX_ROWS) {
      const countResult = await this.sfCli.query(alias, buildCountSoql(soql));
      totalCount = countResult.data?.result?.totalSize ?? 0;
    }

    const result = await this.sfCli.query(alias, previewSoql);
    const queryTotal = result.data?.result?.totalSize ?? 0;
    return {
      records: result.data?.result?.records ?? [],
      totalSize: totalCount ?? queryTotal,
      previewCapped: effectiveLimit > DATA_PREVIEW_MAX_ROWS,
      previewLimit: DATA_PREVIEW_MAX_ROWS,
    };
  }

  async getDeployBatch(id: string, userId: string) {
    return this.dataDeployOrchestrator.getBatch(id, userId);
  }

  async retryChunk(batchId: string, chunkId: string, userId: string) {
    return this.dataDeployOrchestrator.retryChunk(batchId, chunkId, userId);
  }

  async retryFailedChunks(batchId: string, userId: string) {
    return this.dataDeployOrchestrator.retryFailedChunks(batchId, userId);
  }

  async getBatchGroup(groupId: string, userId: string) {
    return this.dataDeployOrchestrator.getBatchGroup(groupId, userId);
  }

  getBundledCustomSettingsTemplate() {
    return loadBundledCustomSettingsExport();
  }

  validateCustomSettingsExport(body: unknown) {
    const parsed = sfdmuExportSchema.parse(body);
    return validateSfdmuExportSummary(parsed);
  }

  async runCustomSettingsLoad(body: unknown, userId: string) {
    const input = customSettingsLoadSchema.parse(body);
    await this.requireOwnedOrg(input.sourceOrgId, userId);
    await this.requireOwnedOrg(input.targetOrgId, userId);
    await this.requireSfdmuPlugin();

    const source = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
    const target = await prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } });
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    const exportConfig =
      input.mode === 'bundled'
        ? loadBundledCustomSettingsExport()
        : input.exportConfig ?? loadBundledCustomSettingsExport();

    const movement = await prisma.dataMovement.create({
      data: {
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: 'custom_settings',
        movementType: 'custom_settings',
        status: 'queued',
        createdBy: userId,
      },
    });

    const generated = writeSfdmuExportFromUpload({
      runId: movement.id,
      sourceOrgAlias: source.username ?? source.alias,
      targetOrgAlias: target.username ?? target.alias,
      exportConfig,
    });

    await prisma.dataMovement.update({
      where: { id: movement.id },
      data: {
        sfdmuConfig: { configPath: generated.configPath, mode: input.mode } as Prisma.InputJsonValue,
      },
    });

    const job = await this.orchestrator.enqueueJob(
      QUEUE_NAMES.SFDMU_RUN,
      'custom_settings_load',
      {
        sourceOrgAlias: source.username ?? source.alias,
        targetOrgAlias: target.username ?? target.alias,
        configPath: generated.configPath,
        movementId: movement.id,
      },
      { createdBy: userId },
    );

    return { movementId: movement.id, jobId: job.id, status: 'queued' };
  }

  async deployData(body: unknown, userId: string, movementType = 'deploy', groupId?: string) {
    const input = dataDeploySchema.parse(body);
    await this.requireOwnedOrg(input.sourceOrgId, userId);
    await this.requireOwnedOrg(input.targetOrgId, userId);
    if (input.rollback?.enabled) this.dataRollback.ensureConfigured();
    const preflight = await this.dataPreflight.runPreflight(input, userId);
    if (input.dryRun) return { dryRun: true as const, preflight };
    this.assertPreflight(preflight);

    const recordLimit = this.dataDeployOrchestrator.resolveRecordLimit(input.soql, input.recordLimit);

    if (this.dataDeployOrchestrator.shouldChunk(recordLimit)) {
      const baseSoql = this.dataDeployOrchestrator.resolveBaseSoql(input.soql, input.objectName);
      const batch = await this.dataDeployOrchestrator.createBatch({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: input.objectName,
        baseSoql,
        recordLimit,
        strategy: input.operation === 'upsert' ? 'generic' : 'insert',
        operation: input.operation,
        movementType,
        userId,
        groupId,
        matchField: input.externalIdField,
        quotaRemaining: preflight.bulkApi.dailyBatchesRemaining,
        quotaConfidence: preflight.bulkApi.confidence,
        maxParallelChunks: input.maxParallelChunks,
        rollbackPolicy: input.rollback?.enabled ? 'capture' : 'none',
      });
      const first = batch.deployments[0];
      return {
        batchId: batch.batchId,
        movementId: first.movementId,
        jobId: first.jobId,
        totalChunks: batch.totalChunks,
        operation: input.operation,
        idempotent: input.idempotent,
        status: batch.status,
        message: batch.message,
      };
    }

    const resolvedSoql = buildGenericDeployQuery({
      soql: input.soql,
      objectName: input.objectName,
      recordLimit: input.recordLimit,
    });

    const movement = await prisma.dataMovement.create({
      data: {
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: input.objectName,
        soql: resolvedSoql,
        movementType,
        operation: input.operation,
        externalIdField: input.externalIdField,
        idempotent: input.idempotent,
        status: 'queued',
        createdBy: userId,
      },
    });

    const job = await this.orchestrator.enqueueJob(
      QUEUE_NAMES.DATA_DEPLOY,
      'data_deploy',
      {
        ...input,
        soql: resolvedSoql,
        recordLimit: input.recordLimit ?? extractLimitFromSoql(resolvedSoql) ?? undefined,
        movementId: movement.id,
      },
      { createdBy: userId },
    );

    return {
      movementId: movement.id,
      jobId: job.id,
      status: 'queued',
      operation: input.operation,
      idempotent: input.idempotent,
      message: 'Data deployment job queued',
    };
  }

  async deployOrgToOrg(body: unknown, userId: string) {
    const input = orgToOrgDeploySchema.parse(body);

    if (input.sourceOrgId === input.targetOrgId) {
      throw new BadRequestException('Source and target org must be different');
    }

    await this.requireOwnedOrg(input.sourceOrgId, userId);
    await this.requireOwnedOrg(input.targetOrgId, userId);

    const requestedSoql = resolveSoql({
      soql: input.soql,
      objectName: input.objectName,
      displayFields: input.displayFields,
      selectedRecordIds: input.selectedRecordIds,
    });

    // Explicit record selections must never be truncated by the default limit.
    const selectionCount = input.selectedRecordIds?.length;
    const requestedLimit = extractLimitFromSoql(requestedSoql) ?? selectionCount ?? 200;
    const soql = buildGenericDeployQuery({
      soql: requestedSoql,
      objectName: input.objectName,
      recordLimit: requestedLimit,
    });
    const preflight = await this.dataPreflight.runPreflight({
      sourceOrgId: input.sourceOrgId,
      targetOrgId: input.targetOrgId,
      objectName: input.objectName,
      soql,
      recordLimit: selectionCount,
      operation: input.operation,
      externalIdField: input.matchField,
      dryRun: input.dryRun,
      unknownQuotaPolicy: input.unknownQuotaPolicy,
    }, userId);
    if (input.dryRun) return { dryRun: true as const, preflight };
    this.assertPreflight(preflight);

    if (input.operation === 'insert') {
      const recordLimit = requestedLimit;
      const result = await this.deployData(
        {
          sourceOrgId: input.sourceOrgId,
          targetOrgId: input.targetOrgId,
          objectName: input.objectName,
          soql,
          recordLimit,
          operation: 'insert',
          unknownQuotaPolicy: input.unknownQuotaPolicy,
        },
        userId,
        'org_to_org',
      );
      return {
        movementId: result.movementId,
        jobId: result.jobId,
        batchId: 'batchId' in result ? result.batchId : undefined,
        totalChunks: 'totalChunks' in result ? result.totalChunks : undefined,
        status: result.status,
        strategy: 'insert',
        operation: 'insert',
        idempotent: false,
        message: result.message,
      };
    }

    await this.requireSfdmuPlugin();

    const recordLimit = this.dataDeployOrchestrator.resolveRecordLimit(
      soql,
      undefined,
      selectionCount ?? 200,
    );
    if (this.dataDeployOrchestrator.shouldChunk(recordLimit)) {
      let recordTypeMappings = input.recordTypeMappings;
      if (!recordTypeMappings && soql.includes('RecordTypeId')) {
        try {
          recordTypeMappings = await this.recordTypeMapper.buildMappings(
            input.sourceOrgId,
            input.targetOrgId,
            input.objectName,
          );
        } catch {
          /* optional */
        }
      }

      const batch = await this.dataDeployOrchestrator.createBatch({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: input.objectName,
        baseSoql: this.dataDeployOrchestrator.resolveBaseSoql(soql, input.objectName),
        recordLimit,
        strategy: 'upsert',
        operation: 'upsert',
        movementType: 'org_to_org',
        userId,
        matchField: input.matchField,
        recordTypeMappings,
        externalId: input.matchField,
        quotaRemaining: preflight.bulkApi.dailyBatchesRemaining,
        quotaConfidence: preflight.bulkApi.confidence,
        maxParallelChunks: input.maxParallelChunks,
      });
      const first = batch.deployments[0];
      return {
        movementId: first.movementId,
        jobId: first.jobId,
        batchId: batch.batchId,
        totalChunks: batch.totalChunks,
        status: batch.status,
        strategy: 'upsert',
        operation: 'upsert',
        idempotent: true,
        message: batch.message,
      };
    }

    const source = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
    const target = await prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } });
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    let recordTypeMappings = input.recordTypeMappings;
    if (!recordTypeMappings && soql.includes('RecordTypeId')) {
      try {
        recordTypeMappings = await this.recordTypeMapper.buildMappings(
          input.sourceOrgId,
          input.targetOrgId,
          input.objectName,
        );
      } catch {
        /* optional — SFDMU may still run without mappings */
      }
    }

    const movement = await prisma.dataMovement.create({
      data: {
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: input.objectName,
        soql,
        movementType: 'org_to_org',
        operation: 'upsert',
        externalIdField: input.matchField,
        idempotent: true,
        status: 'queued',
        recordTypeMappings: recordTypeMappings as Prisma.InputJsonValue | undefined,
        createdBy: userId,
      },
    });

    const generated = generateSfdmuConfigFromSoql({
      runId: movement.id,
      sourceOrgAlias: source.username ?? source.alias,
      targetOrgAlias: target.username ?? target.alias,
      objectName: input.objectName,
      soql,
      operation: 'upsert',
      externalId: input.matchField,
      recordTypeMappings,
    });

    await prisma.dataMovement.update({
      where: { id: movement.id },
      data: {
        sfdmuConfig: {
          configPath: generated.configPath,
          strategy: 'upsert',
          matchField: input.matchField,
        } as Prisma.InputJsonValue,
      },
    });

    const job = await this.orchestrator.enqueueJob(
      QUEUE_NAMES.SFDMU_RUN,
      'org_to_org_data_deploy',
      {
        sourceOrgAlias: source.username ?? source.alias,
        targetOrgAlias: target.username ?? target.alias,
        configPath: generated.configPath,
        movementId: movement.id,
      },
      { createdBy: userId },
    );

    return {
      movementId: movement.id,
      jobId: job.id,
      status: 'queued',
      strategy: 'upsert',
      operation: 'upsert',
      idempotent: true,
      message: 'Org-to-org upsert job queued',
    };
  }

  async deployOrgToOrgBatch(body: unknown, userId: string): Promise<OrgToOrgDeployBatchResult> {
    const input = orgToOrgDeployBatchSchema.parse(body);

    if (input.sourceOrgId === input.targetOrgId) {
      throw new BadRequestException('Source and target org must be different');
    }

    await this.requireOwnedOrg(input.sourceOrgId, userId);
    await this.requireOwnedOrg(input.targetOrgId, userId);

    const batchId = randomUUID();
    const deployments: OrgToOrgDeployBatchResult['deployments'] = [];
    const prepared = [];
    for (const obj of input.objects) {
      const resolved = await this.prepareOrgToOrgObject(input.sourceOrgId, obj, userId);
      const externalIdField = input.operation === 'upsert'
        ? obj.matchField ?? (
            resolved.meta.matchField.toLowerCase() === 'name'
              ? undefined
              : resolved.meta.matchField
          )
        : undefined;
      if (input.operation === 'upsert' && !externalIdField) {
        throw new BadRequestException(
          `Upsert for ${obj.objectName} requires matchField; Name is not used as a silent fallback`,
        );
      }
      const preflight = await this.dataPreflight.runPreflight({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: resolved.meta.objectName,
        soql: resolved.soql,
        recordLimit: resolved.effectiveRecordLimit,
        operation: input.operation,
        externalIdField,
        dryRun: input.dryRun,
        unknownQuotaPolicy: input.unknownQuotaPolicy,
      }, userId);
      prepared.push({
        obj,
        ...resolved,
        externalIdField,
        preflight,
        maxParallelChunks: input.maxParallelChunks,
      });
    }
    const estimatedBulkBatches = prepared.reduce(
      (total, item) => total + (item.preflight.estimatedBulkBatches ?? 0),
      0,
    );
    const knownQuotaRemaining = prepared.find(
      (item) => item.preflight.bulkApi.confidence === 'known',
    )?.preflight.bulkApi.dailyBatchesRemaining;
    const aggregateQuotaSufficient =
      knownQuotaRemaining == null || knownQuotaRemaining >= estimatedBulkBatches;
    if (input.dryRun) {
      return {
        batchId,
        deployments: [],
        dryRun: true,
        quotaSummary: {
          estimatedBulkBatches,
          remaining: knownQuotaRemaining ?? null,
          sufficient: aggregateQuotaSufficient,
        },
        preflight: prepared.map(({ obj, preflight }) => ({
          id: obj.id ?? obj.objectName,
          objectName: obj.objectName,
          report: preflight,
        })),
      } as unknown as OrgToOrgDeployBatchResult;
    }
    for (const item of prepared) this.assertPreflight(item.preflight);
    if (!aggregateQuotaSufficient) {
      throw new BadRequestException(
        `Data preflight blocked multi-object deploy: ${estimatedBulkBatches} total Bulk batches estimated, `
        + `${knownQuotaRemaining} remaining`,
      );
    }
    if (input.operation === 'upsert') await this.requireSfdmuPlugin();

    for (const item of prepared) {
      const result = await this.deployOrgToOrgForObject(
        input.sourceOrgId,
        input.targetOrgId,
        input.operation,
        item.obj,
        userId,
        batchId,
        item,
      );
      deployments.push(result);
    }
    await this.dataDeployOrchestrator.releaseReadyObjectBatches(batchId);

    return { batchId, deployments };
  }

  private async prepareOrgToOrgObject(
    sourceOrgId: string,
    obj: OrgToOrgObjectDeployConfig,
    userId: string,
  ) {
    const meta = await this.orgToOrgBrowse.getObjectMeta(sourceOrgId, obj.objectName, userId);
    const effectiveRecordLimit = obj.selectedRecordIds?.length
      ? Math.max(obj.recordLimit, obj.selectedRecordIds.length)
      : obj.recordLimit;
    let soql: string;
    if (obj.soql?.trim()) {
      try {
        validateSoqlForObject(obj.soql, meta.objectName);
      } catch (error) {
        if (error instanceof OrgToOrgSoqlParseError) throw new BadRequestException(error.message);
        throw error;
      }
      soql = resolveOrgToOrgDeploySoql({ soql: obj.soql, recordLimit: effectiveRecordLimit });
    } else {
      const fields = resolveFieldsForDeploy(
        meta.displayFields,
        obj.selectedReferenceFields,
        obj.selectedDeployFields,
        false,
      );
      soql = buildFilterSoql({
        objectName: meta.objectName,
        fields,
        recordLimit: effectiveRecordLimit,
        filters: obj.filters,
        filterableFields: meta.filterableFields,
        selectedRecordIds: obj.selectedRecordIds,
      });
    }
    return { meta, effectiveRecordLimit, soql };
  }

  private async deployOrgToOrgForObject(
    sourceOrgId: string,
    targetOrgId: string,
    strategy: 'insert' | 'upsert',
    obj: OrgToOrgObjectDeployConfig,
    userId: string,
    batchId?: string,
    prepared?: Awaited<ReturnType<DataService['prepareOrgToOrgObject']>> & {
      externalIdField?: string;
      preflight: DataDeployPreflightResult;
      maxParallelChunks?: number;
    },
  ): Promise<{
    objectName: string;
    movementId: string;
    jobId?: string;
    status: string;
    batchId?: string;
    totalChunks?: number;
  }> {
    const resolved = prepared ?? {
      ...(await this.prepareOrgToOrgObject(sourceOrgId, obj, userId)),
      externalIdField: strategy === 'upsert' ? obj.matchField : undefined,
      preflight: await this.dataPreflight.runPreflight({
        sourceOrgId,
        targetOrgId,
        objectName: obj.objectName,
        soql: obj.soql,
        recordLimit: obj.recordLimit,
        operation: strategy,
        externalIdField: strategy === 'upsert' ? obj.matchField : undefined,
      }, userId),
    };
    const { meta, soql, effectiveRecordLimit, preflight } = resolved;
    let recordTypeMappings: Record<string, string> | undefined;
    if (soql.includes('RecordTypeId')) {
      try {
        recordTypeMappings = await this.recordTypeMapper.buildMappings(
          sourceOrgId,
          targetOrgId,
          meta.objectName,
        );
      } catch {
        /* optional */
      }
    }
    const externalIdField = strategy === 'upsert'
      ? resolved.externalIdField
        ?? obj.matchField
        ?? (meta.matchField.toLowerCase() === 'name' ? undefined : meta.matchField)
      : undefined;
    if (strategy === 'upsert' && !externalIdField) {
      throw new BadRequestException(
        `Upsert for ${obj.objectName} requires matchField; Name is not used as a silent fallback`,
      );
    }
    const batch = await this.dataDeployOrchestrator.createBatch({
      sourceOrgId,
      targetOrgId,
      objectName: meta.objectName,
      objectKey: obj.id ?? obj.objectName,
      dependsOn: obj.dependsOn ?? [],
      baseSoql: this.dataDeployOrchestrator.resolveBaseSoql(soql, meta.objectName),
      recordLimit: this.dataDeployOrchestrator.resolveRecordLimit(soql, effectiveRecordLimit),
      strategy,
      operation: strategy,
      movementType: 'org_to_org',
      userId,
      matchField: externalIdField,
      externalId: externalIdField,
      recordTypeMappings,
      groupId: batchId,
      deferStart: Boolean(batchId),
      quotaRemaining: preflight.bulkApi.dailyBatchesRemaining,
      quotaConfidence: preflight.bulkApi.confidence,
      maxParallelChunks: resolved.maxParallelChunks,
    });
    const first = batch.deployments[0]!;
    return {
      objectName: meta.objectName,
      movementId: first.movementId,
      jobId: first.jobId,
      batchId: batch.batchId,
      totalChunks: batch.totalChunks,
      status: batch.status,
    };
  }

  async getMovement(id: string, userId: string) {
    const movement = await prisma.dataMovement.findUnique({
      where: { id },
      include: {
        sourceOrg: { select: { alias: true, username: true } },
        targetOrg: { select: { alias: true, username: true } },
      },
    });
    assertResourceOwner(movement, userId, 'Data movement');
    return movement!;
  }

  async replicateData(body: unknown, userId: string) {
    const input = dataReplicationSchema.parse(body);
    await this.requireOwnedOrg(input.sourceOrgId, userId);
    await this.requireOwnedOrg(input.targetOrgId, userId);

    const querySet = input.querySet
      ? normalizeQuerySet({
          ...input.querySet,
          queries: input.querySet.queries.map((query) => ({
            ...query,
            operation: query.operation ?? input.operation,
            externalIdField: query.externalIdField ?? input.externalIdField,
          })),
        }, input.recordLimit ?? 200)
      : input.soql
        ? normalizeQuerySet({
            version: 1,
            defaultLimit: input.recordLimit ?? 200,
            source: 'upload',
            queries: [{
              id: 'single',
              label: 'Replication query',
              object: extractObjectFromSoql(input.soql) ?? 'Unknown',
              soql: input.soql,
              operation: input.operation,
              externalIdField: input.externalIdField,
            }],
          }, input.recordLimit ?? 200)
        : null;

    if (!querySet) throw new Error('querySet or soql is required');
    const preflight = [];
    for (const query of querySet.queries) {
      const report = await this.dataPreflight.runPreflight({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: query.object,
        soql: query.soql,
        recordLimit: query.limit ?? input.recordLimit,
        operation: query.operation,
        externalIdField: query.externalIdField,
        dryRun: input.dryRun,
        unknownQuotaPolicy: input.unknownQuotaPolicy,
      }, userId);
      preflight.push({ queryId: query.id, objectName: query.object, report });
    }
    const estimatedBulkBatches = preflight.reduce(
      (total, item) => total + (item.report.estimatedBulkBatches ?? 0),
      0,
    );
    const knownRemaining = preflight.find(
      (item) => item.report.bulkApi.confidence === 'known',
    )?.report.bulkApi.dailyBatchesRemaining;
    const aggregateQuotaSufficient = knownRemaining == null || knownRemaining >= estimatedBulkBatches;
    const quotaSummary = { estimatedBulkBatches, remaining: knownRemaining ?? null, sufficient: aggregateQuotaSufficient };
    if (input.dryRun) return { dryRun: true as const, querySet, preflight, quotaSummary };
    for (const item of preflight) this.assertPreflight(item.report);
    if (!aggregateQuotaSufficient) {
      throw new BadRequestException(
        `Data preflight blocked replication: ${estimatedBulkBatches} total Bulk batches estimated, `
        + `${knownRemaining} remaining`,
      );
    }

    await this.requireSfdmuPlugin();

    const source = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
    const target = await prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } });
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    const recordTypeMappings = input.recordTypeMappings ?? {};

    const recordLimit = input.recordLimit ?? querySet.defaultLimit ?? 200;
    const mainQuery = querySet.queries[0];

    if (
      this.dataDeployOrchestrator.shouldChunk(recordLimit)
      && querySet.queries.length === 1
      && mainQuery
    ) {
      const batch = await this.dataDeployOrchestrator.createBatch({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: mainQuery.object,
        baseSoql: this.dataDeployOrchestrator.resolveBaseSoql(mainQuery.soql, mainQuery.object),
        recordLimit,
        strategy: 'replicate',
        operation: mainQuery.operation!,
        movementType: 'replication',
        userId,
        externalId: mainQuery.externalIdField,
        recordTypeMappings,
        quotaRemaining: preflight[0]?.report.bulkApi.dailyBatchesRemaining,
        quotaConfidence: preflight[0]?.report.bulkApi.confidence,
        maxParallelChunks: input.maxParallelChunks,
      });
      const first = batch.deployments[0];
      const preview = await this.previewData(
        input.sourceOrgId,
        mainQuery.soql,
        userId,
        recordLimit,
      );
      return {
        movementId: first.movementId,
        jobId: first.jobId,
        batchId: batch.batchId,
        totalChunks: batch.totalChunks,
        operation: mainQuery.operation,
        idempotent: mainQuery.operation === 'upsert',
        preview,
        configPath: undefined,
        message: batch.message,
      };
    }

    const movement = await prisma.dataMovement.create({
      data: {
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        soql: querySet.queries.map((q) => q.soql).join('\n---\n'),
        recordTypeMappings: recordTypeMappings as Prisma.InputJsonValue,
        objectName: querySet.queries.length === 1 ? querySet.queries[0]?.object : 'multi_object',
        movementType: 'replication',
        operation: querySet.queries.every((query) => query.operation === 'upsert') ? 'upsert' : 'insert',
        externalIdField: querySet.queries.length === 1 ? querySet.queries[0]?.externalIdField : undefined,
        idempotent: querySet.queries.every((query) => query.operation === 'upsert'),
        status: 'queued',
        createdBy: userId,
      },
    });

    const generated = generateSfdmuConfig({
      runId: movement.id,
      sourceOrgAlias: source.username ?? source.alias,
      targetOrgAlias: target.username ?? target.alias,
      querySet,
      recordTypeMappings,
    });

    await prisma.dataMovement.update({
      where: { id: movement.id },
      data: {
        sfdmuConfig: {
          configPath: generated.configPath,
          querySet,
        } as Prisma.InputJsonValue,
      },
    });

    const preview = await this.previewData(input.sourceOrgId, querySet.queries[0].soql, userId);

    const job = await this.orchestrator.enqueueJob(
      QUEUE_NAMES.SFDMU_RUN,
      'data_replication',
      {
        sourceOrgAlias: source.username ?? source.alias,
        targetOrgAlias: target.username ?? target.alias,
        configPath: generated.configPath,
        movementId: movement.id,
      },
      { createdBy: userId },
    );

    return {
      movementId: movement.id,
      jobId: job.id,
      operation: querySet.queries.every((query) => query.operation === 'upsert') ? 'upsert' : 'insert',
      idempotent: querySet.queries.every((query) => query.operation === 'upsert'),
      preview,
      configPath: generated.configPath,
    };
  }

  async listMovements(userId: string, movementType?: string) {
    return prisma.dataMovement.findMany({
      where: {
        ...userOwnedWhere(userId),
        ...(movementType ? { movementType } : {}),
      },
      include: { sourceOrg: true, targetOrg: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async enqueueConaSeed(input: ConaSeedRunInput, userId?: string) {
    const job = await this.orchestrator.enqueueJob(
      QUEUE_NAMES.CONA_SEED,
      'cona_seed',
      {
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        datasets: input.datasets,
        accountSeedRows: input.accountSeedRows,
        automationRunId: input.automationRunId,
      },
      { parentRunId: input.automationRunId, createdBy: userId },
    );
    return { jobId: job.id, status: 'queued' };
  }

  async getQueryTemplates() {
    return [];
  }
}
