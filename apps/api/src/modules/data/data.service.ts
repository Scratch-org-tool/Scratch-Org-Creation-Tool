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
  type OrgToOrgDeployResult,
  type OrgToOrgDeployBatchResult,
  type OrgToOrgObjectDeployConfig,
  validateSfdmuExportSummary,
  normalizeQuerySet,
  extractLimitFromSoql,
  buildGenericDeployQuery,
  DATA_PREVIEW_MAX_ROWS,
  replaceOrApplyLimit,
  buildCountSoql,
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

@Injectable()
export class DataService {
  private readonly sfCli = createSfCliClient();

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly recordTypeMapper: RecordTypeMapperService,
    private readonly orgToOrgBrowse: OrgToOrgBrowseService,
    private readonly dataDeployOrchestrator: DataDeployOrchestratorService,
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

    const recordLimit = this.dataDeployOrchestrator.resolveRecordLimit(input.soql, input.recordLimit);

    if (this.dataDeployOrchestrator.shouldChunk(recordLimit)) {
      const baseSoql = this.dataDeployOrchestrator.resolveBaseSoql(input.soql, input.objectName);
      const batch = await this.dataDeployOrchestrator.createBatch({
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        objectName: input.objectName,
        baseSoql,
        recordLimit,
        strategy: movementType === 'org_to_org' ? 'insert' : 'generic',
        movementType,
        userId,
        groupId,
        matchField: input.externalIdField,
      });
      const first = batch.deployments[0];
      return {
        batchId: batch.batchId,
        movementId: first.movementId,
        jobId: first.jobId,
        totalChunks: batch.totalChunks,
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
      message: 'Data deployment job queued',
    };
  }

  async deployOrgToOrg(body: unknown, userId: string): Promise<OrgToOrgDeployResult> {
    const input = orgToOrgDeploySchema.parse(body);

    if (input.sourceOrgId === input.targetOrgId) {
      throw new BadRequestException('Source and target org must be different');
    }

    await this.requireOwnedOrg(input.sourceOrgId, userId);
    await this.requireOwnedOrg(input.targetOrgId, userId);

    const soql = resolveSoql({
      soql: input.soql,
      objectName: input.objectName,
      displayFields: input.displayFields,
      selectedRecordIds: input.selectedRecordIds,
    });

    // Explicit record selections must never be truncated by the default limit.
    const selectionCount = input.selectedRecordIds?.length;

    if (input.strategy === 'insert') {
      const recordLimit = extractLimitFromSoql(soql) ?? selectionCount ?? undefined;
      const result = await this.deployData(
        {
          sourceOrgId: input.sourceOrgId,
          targetOrgId: input.targetOrgId,
          objectName: input.objectName,
          soql,
          recordLimit,
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
        movementType: 'org_to_org',
        userId,
        matchField: input.matchField ?? 'Name',
        recordTypeMappings,
        externalId: input.matchField ?? 'Name',
      });
      const first = batch.deployments[0];
      return {
        movementId: first.movementId,
        jobId: first.jobId,
        batchId: batch.batchId,
        totalChunks: batch.totalChunks,
        status: batch.status,
        strategy: 'upsert',
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
      externalId: input.matchField ?? 'Name',
      recordTypeMappings,
    });

    await prisma.dataMovement.update({
      where: { id: movement.id },
      data: {
        sfdmuConfig: {
          configPath: generated.configPath,
          strategy: 'upsert',
          matchField: input.matchField ?? 'Name',
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

    for (const obj of input.objects) {
      const result = await this.deployOrgToOrgForObject(
        input.sourceOrgId,
        input.targetOrgId,
        input.strategy,
        obj,
        userId,
        batchId,
      );
      deployments.push(result);
    }

    return { batchId, deployments };
  }

  private async deployOrgToOrgForObject(
    sourceOrgId: string,
    targetOrgId: string,
    strategy: 'insert' | 'upsert',
    obj: OrgToOrgObjectDeployConfig,
    userId: string,
    batchId?: string,
  ): Promise<{
    objectName: string;
    movementId: string;
    jobId: string;
    status: string;
    batchId?: string;
    totalChunks?: number;
  }> {
    const meta = await this.orgToOrgBrowse.getObjectMeta(sourceOrgId, obj.objectName, userId);

    // Explicit record selections must never be truncated by the default limit.
    const effectiveRecordLimit = obj.selectedRecordIds?.length
      ? Math.max(obj.recordLimit, obj.selectedRecordIds.length)
      : obj.recordLimit;

    let soql: string;
    if (obj.soql?.trim()) {
      try {
        validateSoqlForObject(obj.soql, meta.objectName);
      } catch (err) {
        if (err instanceof OrgToOrgSoqlParseError) {
          throw new BadRequestException(err.message);
        }
        throw err;
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

    if (strategy === 'insert') {
      const result = await this.deployData(
        {
          sourceOrgId,
          targetOrgId,
          objectName: meta.objectName,
          soql,
          recordLimit: effectiveRecordLimit,
        },
        userId,
        'org_to_org',
        batchId,
      );
      return {
        objectName: meta.objectName,
        movementId: result.movementId,
        jobId: result.jobId,
        batchId: 'batchId' in result ? result.batchId : undefined,
        totalChunks: 'totalChunks' in result ? result.totalChunks : undefined,
        status: result.status,
      };
    }

    await this.requireSfdmuPlugin();

    const recordLimit = this.dataDeployOrchestrator.resolveRecordLimit(soql, effectiveRecordLimit);
    if (this.dataDeployOrchestrator.shouldChunk(recordLimit)) {
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

      const batch = await this.dataDeployOrchestrator.createBatch({
        sourceOrgId,
        targetOrgId,
        objectName: meta.objectName,
        baseSoql: this.dataDeployOrchestrator.resolveBaseSoql(soql, meta.objectName),
        recordLimit,
        strategy: 'upsert',
        movementType: 'org_to_org',
        userId,
        matchField: obj.matchField ?? meta.matchField,
        recordTypeMappings,
        externalId: obj.matchField ?? meta.matchField,
        groupId: batchId,
      });
      const first = batch.deployments[0];
      return {
        objectName: meta.objectName,
        movementId: first.movementId,
        jobId: first.jobId,
        batchId: batch.batchId,
        totalChunks: batch.totalChunks,
        status: batch.status,
      };
    }

    const source = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
    const target = await prisma.orgConnection.findUnique({ where: { id: targetOrgId } });
    if (!source || !target) throw new NotFoundException('Source or target org not found');

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

    const movement = await prisma.dataMovement.create({
      data: {
        sourceOrgId,
        targetOrgId,
        objectName: meta.objectName,
        soql,
        movementType: 'org_to_org',
        status: 'queued',
        recordTypeMappings: recordTypeMappings as Prisma.InputJsonValue | undefined,
        createdBy: userId,
      },
    });

    const generated = generateSfdmuConfigFromSoql({
      runId: movement.id,
      sourceOrgAlias: source.username ?? source.alias,
      targetOrgAlias: target.username ?? target.alias,
      objectName: meta.objectName,
      soql,
      externalId: obj.matchField ?? meta.matchField,
      recordTypeMappings,
    });

    await prisma.dataMovement.update({
      where: { id: movement.id },
      data: {
        sfdmuConfig: {
          configPath: generated.configPath,
          strategy: 'upsert',
          matchField: obj.matchField ?? meta.matchField,
          batchId,
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
      objectName: meta.objectName,
      movementId: movement.id,
      jobId: job.id,
      status: 'queued',
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
      ? normalizeQuerySet(input.querySet, input.recordLimit ?? 200)
      : input.soql
        ? normalizeQuerySet({
            version: 1,
            defaultLimit: input.recordLimit ?? 200,
            source: 'upload',
            queries: [{
              id: 'single',
              label: 'Replication query',
              object: 'cfs_ob__Onboarding_Config__c',
              soql: input.soql,
            }],
          }, input.recordLimit ?? 200)
        : null;

    if (!querySet) throw new Error('querySet or soql is required');

    await this.requireSfdmuPlugin();

    const source = await prisma.orgConnection.findUnique({ where: { id: input.sourceOrgId } });
    const target = await prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } });
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    const recordTypeMappings =
      input.recordTypeMappings ??
      await this.recordTypeMapper.buildMappings(
        input.sourceOrgId,
        input.targetOrgId,
        'cfs_ob__Onboarding_Config__c',
      );

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
        movementType: 'replication',
        userId,
        recordTypeMappings,
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
        objectName: 'cfs_ob__Onboarding_Config__c',
        movementType: 'replication',
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

    return { movementId: movement.id, jobId: job.id, preview, configPath: generated.configPath };
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
