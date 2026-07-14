import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  buildCountSoql,
  buildGenericDeployQuery,
  dataDeployPreflightSchema,
  extractFieldsFromSoql,
  DATA_DEPLOY_CHUNK_SIZE,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertOrgOwned } from '../../common/user-tenancy.util';

export interface PreflightFieldIssue {
  field: string;
  issue: 'missing_on_target' | 'not_createable' | 'not_updateable';
  detail: string;
}

export interface DataDeployPreflightResult {
  ok: boolean;
  sourceCount: number | null;
  estimatedChunks: number | null;
  bulkApi: {
    dailyBatchesRemaining: number | null;
    dailyBatchesMax: number | null;
    sufficient: boolean;
  };
  fieldIssues: PreflightFieldIssue[];
  errors: string[];
  warnings: string[];
}

/** Salesforce audit/system fields that are never writable and always excluded from deploys. */
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

/**
 * Pre-flight validation for org-to-org data deploys: source COUNT(), target
 * Bulk API quota, and field-level compatibility — run before anything is
 * enqueued so operators see problems up front instead of mid-deploy.
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

    const soql = buildGenericDeployQuery({
      soql: input.soql,
      objectName: input.objectName,
      recordLimit: input.recordLimit,
    });

    const [sourceCount, bulkApi] = await Promise.all([
      this.countSourceRecords(sourceAlias, soql, errors),
      this.checkBulkApiQuota(targetAlias, warnings),
    ]);

    const chunkSizeRaw = parseInt(process.env.DATA_DEPLOY_CHUNK_SIZE ?? '', 10);
    const chunkSize = Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0 ? chunkSizeRaw : DATA_DEPLOY_CHUNK_SIZE;
    const effectiveCount =
      sourceCount != null && input.recordLimit != null
        ? Math.min(sourceCount, input.recordLimit)
        : sourceCount;
    const estimatedChunks = effectiveCount != null ? Math.max(1, Math.ceil(effectiveCount / chunkSize)) : null;

    if (sourceCount === 0) {
      warnings.push('The deploy query matches 0 records in the source org');
    }

    await this.checkFieldCompatibility(
      sourceAlias,
      targetAlias,
      input.objectName,
      soql,
      input.externalIdField,
      fieldIssues,
      errors,
      warnings,
    );

    const blockingFieldIssues = fieldIssues.filter((f) => f.issue === 'missing_on_target');
    const ok = errors.length === 0 && blockingFieldIssues.length === 0 && bulkApi.sufficient;

    return {
      ok,
      sourceCount,
      estimatedChunks,
      bulkApi,
      fieldIssues,
      errors,
      warnings,
    };
  }

  private async countSourceRecords(
    sourceAlias: string,
    soql: string,
    errors: string[],
  ): Promise<number | null> {
    try {
      const countResult = await this.sfCli.query(sourceAlias, buildCountSoql(soql));
      if (!countResult.success) {
        errors.push(`Source COUNT() query failed: ${countResult.error ?? 'unknown error'}`);
        return null;
      }
      return countResult.data?.result?.totalSize ?? 0;
    } catch (err) {
      errors.push(`Source COUNT() query failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async checkBulkApiQuota(
    targetAlias: string,
    warnings: string[],
  ): Promise<DataDeployPreflightResult['bulkApi']> {
    try {
      const limits = await this.sfCli.listOrgLimits(targetAlias);
      const entries = limits.data?.result ?? [];
      const daily = entries.find((l) => l.name === 'DailyBulkApiBatches')
        ?? entries.find((l) => l.name === 'DailyBulkV2QueryJobs');
      if (!daily) {
        warnings.push('Could not read Bulk API limits from the target org — quota not verified');
        return { dailyBatchesRemaining: null, dailyBatchesMax: null, sufficient: true };
      }
      const sufficient = daily.remaining > 0;
      if (!sufficient) {
        warnings.push(`Target org has exhausted its daily Bulk API quota (${daily.name}: 0 of ${daily.max} remaining)`);
      } else if (daily.max > 0 && daily.remaining / daily.max < 0.05) {
        warnings.push(
          `Target org Bulk API quota is nearly exhausted (${daily.name}: ${daily.remaining} of ${daily.max} remaining)`,
        );
      }
      return { dailyBatchesRemaining: daily.remaining, dailyBatchesMax: daily.max, sufficient };
    } catch {
      warnings.push('Could not read Bulk API limits from the target org — quota not verified');
      return { dailyBatchesRemaining: null, dailyBatchesMax: null, sufficient: true };
    }
  }

  private async checkFieldCompatibility(
    sourceAlias: string,
    targetAlias: string,
    objectName: string,
    soql: string,
    externalIdField: string | undefined,
    fieldIssues: PreflightFieldIssue[],
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    let targetFields: Map<string, { createable?: boolean; updateable?: boolean; calculated?: boolean }>;
    try {
      const targetDescribe = await this.sfCli.describeSObject(targetAlias, objectName);
      const described = targetDescribe.data?.result?.fields;
      if (!described) {
        errors.push(`Object ${objectName} does not exist (or is not visible) in the target org`);
        return;
      }
      targetFields = new Map(described.map((f) => [f.name.toLowerCase(), f]));
    } catch (err) {
      errors.push(
        `Could not describe ${objectName} on the target org: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    // Relationship fields (e.g. Account.Name) and subqueries can't be checked 1:1.
    const selectedFields = extractFieldsFromSoql(soql)
      .map((f) => f.trim())
      .filter((f) => f && !f.includes('(') && !f.includes('.'));

    for (const field of selectedFields) {
      const lower = field.toLowerCase();
      if (SYSTEM_FIELDS.has(lower)) continue;
      const targetField = targetFields.get(lower);
      if (!targetField) {
        fieldIssues.push({
          field,
          issue: 'missing_on_target',
          detail: `Field ${field} exists in the source query but not on ${objectName} in the target org`,
        });
        continue;
      }
      if (targetField.calculated) {
        warnings.push(`Field ${field} is a formula field on the target and will be ignored on load`);
        continue;
      }
      if (targetField.createable === false) {
        fieldIssues.push({
          field,
          issue: 'not_createable',
          detail: `Field ${field} is not createable on the target org — inserts will drop this value`,
        });
      } else if (externalIdField && targetField.updateable === false) {
        fieldIssues.push({
          field,
          issue: 'not_updateable',
          detail: `Field ${field} is not updateable on the target org — upsert updates will drop this value`,
        });
      }
    }

    if (externalIdField && !targetFields.has(externalIdField.toLowerCase())) {
      errors.push(`Upsert external-Id field ${externalIdField} does not exist on ${objectName} in the target org`);
    }

    // The source describe is best-effort: a missing source field will fail the COUNT anyway.
    try {
      const sourceDescribe = await this.sfCli.describeSObject(sourceAlias, objectName);
      if (!sourceDescribe.data?.result?.fields) {
        warnings.push(`Could not describe ${objectName} on the source org — source field check skipped`);
      }
    } catch {
      warnings.push(`Could not describe ${objectName} on the source org — source field check skipped`);
    }
  }
}
