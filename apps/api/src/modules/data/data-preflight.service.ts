import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  buildCountSoql,
  buildGenericDeployQuery,
  dataDeployPreflightSchema,
  extractFieldsFromSoql,
  replaceOrApplyLimit,
  DATA_DEPLOY_CHUNK_SIZE,
  type DataWriteOperation,
  type UnknownQuotaPolicy,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertOrgOwned } from '../../common/user-tenancy.util';

export interface PreflightFieldIssue {
  field: string;
  issue:
    | 'missing_on_source'
    | 'missing_on_target'
    | 'not_createable'
    | 'not_updateable'
    | 'not_external_id'
    | 'not_selected';
  detail: string;
}

export interface DataDeployPreflightResult {
  ok: boolean;
  dryRun: boolean;
  operation: DataWriteOperation;
  externalIdField?: string;
  idempotent: boolean;
  sourceCount: number | null;
  estimatedChunks: number | null;
  estimatedBulkBatches: number | null;
  sample: unknown[];
  mappings: Array<{
    sourceField: string;
    targetField: string;
    createable: boolean;
    updateable: boolean;
  }>;
  bulkApi: {
    dailyBatchesRemaining: number | null;
    dailyBatchesMax: number | null;
    sufficient: boolean;
    confidence: 'known' | 'unknown';
    unknownPolicy: UnknownQuotaPolicy;
  };
  fieldIssues: PreflightFieldIssue[];
  errors: string[];
  warnings: string[];
}

const SYSTEM_FIELDS = new Set([
  'id',
  'createddate',
  'createdbyid',
  'lastmodifieddate',
  'lastmodifiedbyid',
  'systemmodstamp',
  'lastactivitydate',
  'lastvieweddate',
  'lastreferenceddate',
  'isdeleted',
]);

type DescribedField = {
  name: string;
  createable?: boolean;
  updateable?: boolean;
  calculated?: boolean;
  externalId?: boolean;
  idLookup?: boolean;
};

/**
 * Authoritative gate for every top-level data write. It checks the real source
 * count, target quota, source/target fields, write permissions and the exact
 * upsert key before callers are allowed to create movements or queue jobs.
 */
@Injectable()
export class DataPreflightService {
  private readonly sfCli = createSfCliClient();

  async runPreflight(body: unknown, userId: string): Promise<DataDeployPreflightResult> {
    const input = dataDeployPreflightSchema.parse(body);
    const [source, target] = await Promise.all([
      assertOrgOwned(input.sourceOrgId, userId, prisma),
      assertOrgOwned(input.targetOrgId, userId, prisma),
    ]);
    if (!source || !target) throw new NotFoundException('Source or target org not found');

    const sourceAlias = source.username ?? source.alias;
    const targetAlias = target.username ?? target.alias;
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: PreflightFieldIssue[] = [];
    const mappings: DataDeployPreflightResult['mappings'] = [];
    const soql = buildGenericDeployQuery({
      soql: input.soql,
      objectName: input.objectName,
      recordLimit: input.recordLimit,
    });

    const [sourceCount, sample] = await Promise.all([
      this.countSourceRecords(sourceAlias, soql, errors),
      this.sampleSourceRecords(sourceAlias, soql, warnings),
    ]);
    const chunkSizeRaw = Number.parseInt(process.env.DATA_DEPLOY_CHUNK_SIZE ?? '', 10);
    const chunkSize = Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0
      ? chunkSizeRaw
      : DATA_DEPLOY_CHUNK_SIZE;
    const effectiveCount = sourceCount != null && input.recordLimit != null
      ? Math.min(sourceCount, input.recordLimit)
      : sourceCount;
    const estimatedChunks = effectiveCount == null
      ? null
      : effectiveCount === 0 ? 0 : Math.ceil(effectiveCount / chunkSize);
    const estimatedBulkBatches = estimatedChunks;
    const bulkApi = await this.checkBulkApiQuota(
      targetAlias,
      estimatedBulkBatches,
      input.unknownQuotaPolicy,
      errors,
      warnings,
    );

    if (sourceCount === 0) warnings.push('The deploy query matches 0 records in the source org');

    await this.checkFieldCompatibility({
      sourceAlias,
      targetAlias,
      objectName: input.objectName,
      soql,
      operation: input.operation,
      externalIdField: input.externalIdField,
      fieldIssues,
      mappings,
      errors,
      warnings,
    });

    return {
      ok: errors.length === 0 && fieldIssues.length === 0 && bulkApi.sufficient,
      dryRun: input.dryRun,
      operation: input.operation,
      externalIdField: input.externalIdField,
      idempotent: input.idempotent,
      sourceCount,
      estimatedChunks,
      estimatedBulkBatches,
      sample,
      mappings,
      bulkApi,
      fieldIssues,
      errors,
      warnings,
    };
  }

  private async countSourceRecords(alias: string, soql: string, errors: string[]): Promise<number | null> {
    try {
      const result = await this.sfCli.query(alias, buildCountSoql(soql));
      if (!result.success) {
        errors.push(`Source COUNT() query failed: ${result.error ?? 'unknown error'}`);
        return null;
      }
      return result.data?.result?.totalSize ?? 0;
    } catch (error) {
      errors.push(`Source COUNT() query failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async sampleSourceRecords(alias: string, soql: string, warnings: string[]): Promise<unknown[]> {
    try {
      const result = await this.sfCli.query(alias, replaceOrApplyLimit(soql, 5));
      if (!result.success) {
        warnings.push(`Source sample query failed: ${result.error ?? 'unknown error'}`);
        return [];
      }
      return result.data?.result?.records ?? [];
    } catch (error) {
      warnings.push(`Source sample query failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async checkBulkApiQuota(
    targetAlias: string,
    estimatedBatches: number | null,
    unknownPolicy: UnknownQuotaPolicy,
    errors: string[],
    warnings: string[],
  ): Promise<DataDeployPreflightResult['bulkApi']> {
    const unknown = (reason: string): DataDeployPreflightResult['bulkApi'] => {
      const message = `${reason} — quota confidence is unknown`;
      if (unknownPolicy === 'block') errors.push(`${message}; deployment blocked by strict quota policy`);
      else warnings.push(`${message}; proceeding because unknownQuotaPolicy=warn`);
      return {
        dailyBatchesRemaining: null,
        dailyBatchesMax: null,
        sufficient: unknownPolicy === 'warn',
        confidence: 'unknown',
        unknownPolicy,
      };
    };
    try {
      const limits = await this.sfCli.listOrgLimits(targetAlias);
      if (!limits.success) return unknown(limits.error ?? 'Could not read target Bulk API limits');
      const entries = limits.data?.result ?? [];
      const daily = entries.find((limit) => limit.name === 'DailyBulkApiBatches');
      if (!daily) return unknown('Target org did not return a recognized Bulk API limit');
      const required = estimatedBatches ?? 1;
      const sufficient = daily.remaining >= required;
      if (!sufficient) {
        errors.push(
          `Target Bulk API quota is insufficient: ${daily.remaining} remaining, ${required} estimated batch(es) required`,
        );
      } else if (daily.max > 0 && daily.remaining / daily.max < 0.05) {
        warnings.push(`Target Bulk API quota is nearly exhausted (${daily.remaining} of ${daily.max} remaining)`);
      }
      return {
        dailyBatchesRemaining: daily.remaining,
        dailyBatchesMax: daily.max,
        sufficient,
        confidence: 'known',
        unknownPolicy,
      };
    } catch (error) {
      return unknown(`Could not read target Bulk API limits: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async checkFieldCompatibility(input: {
    sourceAlias: string;
    targetAlias: string;
    objectName: string;
    soql: string;
    operation: DataWriteOperation;
    externalIdField?: string;
    fieldIssues: PreflightFieldIssue[];
    mappings: DataDeployPreflightResult['mappings'];
    errors: string[];
    warnings: string[];
  }): Promise<void> {
    let sourceFields: Map<string, DescribedField>;
    let targetFields: Map<string, DescribedField>;
    try {
      const [sourceDescribe, targetDescribe] = await Promise.all([
        this.sfCli.describeSObject(input.sourceAlias, input.objectName),
        this.sfCli.describeSObject(input.targetAlias, input.objectName),
      ]);
      const source = sourceDescribe.data?.result?.fields;
      const target = targetDescribe.data?.result?.fields;
      if (!source) input.errors.push(`Object ${input.objectName} does not exist in the source org`);
      if (!target) input.errors.push(`Object ${input.objectName} does not exist in the target org`);
      if (!source || !target) return;
      sourceFields = new Map(source.map((field) => [field.name.toLowerCase(), field]));
      targetFields = new Map(target.map((field) => [field.name.toLowerCase(), field]));
    } catch (error) {
      input.errors.push(
        `Could not describe ${input.objectName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    const selected = extractFieldsFromSoql(input.soql)
      .map((field) => field.trim())
      .filter((field) => field && !field.includes('(') && !field.includes('.'));
    for (const field of selected) {
      const key = field.toLowerCase();
      if (SYSTEM_FIELDS.has(key)) continue;
      if (!sourceFields.has(key)) {
        input.fieldIssues.push({
          field,
          issue: 'missing_on_source',
          detail: `Field ${field} is selected but missing on the source object`,
        });
        continue;
      }
      const target = targetFields.get(key);
      if (!target) {
        input.fieldIssues.push({
          field,
          issue: 'missing_on_target',
          detail: `Field ${field} is selected but missing on the target object`,
        });
        continue;
      }
      if (target.calculated) {
        input.fieldIssues.push({
          field,
          issue: 'not_createable',
          detail: `Field ${field} is calculated and cannot be written`,
        });
        continue;
      }
      input.mappings.push({
        sourceField: field,
        targetField: target.name,
        createable: target.createable !== false,
        updateable: target.updateable !== false,
      });
      if (target.createable === false) {
        input.fieldIssues.push({
          field,
          issue: 'not_createable',
          detail: `Field ${field} is not createable on the target org`,
        });
      }
      if (input.operation === 'upsert' && target.updateable === false) {
        input.fieldIssues.push({
          field,
          issue: 'not_updateable',
          detail: `Field ${field} is not updateable on the target org`,
        });
      }
    }

    if (input.operation !== 'upsert') return;
    const externalId = input.externalIdField!;
    const externalKey = externalId.toLowerCase();
    if (!selected.some((field) => field.toLowerCase() === externalKey)) {
      input.fieldIssues.push({
        field: externalId,
        issue: 'not_selected',
        detail: `Upsert query must select external ID field ${externalId}`,
      });
    }
    if (!sourceFields.has(externalKey)) {
      input.fieldIssues.push({
        field: externalId,
        issue: 'missing_on_source',
        detail: `External ID ${externalId} does not exist on the source object`,
      });
    }
    const targetExternal = targetFields.get(externalKey);
    if (!targetExternal) {
      input.fieldIssues.push({
        field: externalId,
        issue: 'missing_on_target',
        detail: `External ID ${externalId} does not exist on the target object`,
      });
    } else if (
      !targetExternal.externalId
      && !targetExternal.idLookup
      && !['id', 'name', 'developername'].includes(externalKey)
    ) {
      input.fieldIssues.push({
        field: externalId,
        issue: 'not_external_id',
        detail: `Target field ${externalId} is not marked as an external ID or idLookup`,
      });
    }
  }
}
