import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  orgToOrgCompareSchema,
  applySoqlPagination,
  buildKeySoql,
  computeKeyDiff,
  ORG_TO_ORG_KEY_SCAN_MAX,
  resolveSoql,
  type OrgToOrgCompareResult,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertOrgOwned } from '../../common/user-tenancy.util';

@Injectable()
export class OrgToOrgCompareService {
  private readonly sfCli = createSfCliClient();

  async compare(body: unknown, userId: string): Promise<OrgToOrgCompareResult> {
    const input = orgToOrgCompareSchema.parse(body);

    if (input.sourceOrgId === input.targetOrgId) {
      throw new BadRequestException('Source and target org must be different');
    }

    const source = await assertOrgOwned(input.sourceOrgId, userId, prisma);
    const target = await assertOrgOwned(input.targetOrgId, userId, prisma);

    const sourceAlias = source.username ?? source.alias;
    const targetAlias = target.username ?? target.alias;
    const matchField = input.matchField || 'Name';

    const resolvedSoql = resolveSoql({
      soql: input.soql,
      objectName: input.objectName,
      displayFields: input.displayFields,
      selectedRecordIds: input.selectedRecordIds,
      limit: input.pageSize,
      page: input.page,
    });

    const paginatedSoql = applySoqlPagination(resolvedSoql, input.page, input.pageSize);
    const sourcePageResult = await this.sfCli.query(sourceAlias, paginatedSoql);
    const sourceRecords = sourcePageResult.data?.result?.records ?? [];
    const sourceTotalSize = sourcePageResult.data?.result?.totalSize ?? sourceRecords.length;

    const keySoql = buildKeySoql(resolvedSoql, input.objectName, matchField, ORG_TO_ORG_KEY_SCAN_MAX);
    const [sourceKeyResult, targetKeyResult] = await Promise.all([
      this.sfCli.query(sourceAlias, keySoql),
      this.sfCli.query(targetAlias, keySoql),
    ]);

    const sourceKeyRecords = sourceKeyResult.data?.result?.records ?? [];
    const targetKeyRecords = targetKeyResult.data?.result?.records ?? [];

    const extractKeys = (records: Array<Record<string, unknown>>) =>
      records.map((r) => String(r[matchField] ?? '')).filter(Boolean);

    const sourceKeys = extractKeys(sourceKeyRecords as Array<Record<string, unknown>>);
    const targetKeys = extractKeys(targetKeyRecords as Array<Record<string, unknown>>);

    const truncated =
      sourceKeys.length >= ORG_TO_ORG_KEY_SCAN_MAX || targetKeys.length >= ORG_TO_ORG_KEY_SCAN_MAX;

    const diff = computeKeyDiff(sourceKeys, targetKeys);

    return {
      summary: diff.summary,
      onlyInSourceKeys: diff.onlyInSourceKeys,
      onlyInTargetKeys: diff.onlyInTargetKeys,
      inBothKeys: diff.inBothKeys,
      sourceRecords: {
        records: sourceRecords,
        totalSize: sourceTotalSize,
        page: input.page,
        pageSize: input.pageSize,
      },
      matchField,
      truncated: truncated || undefined,
      warning: truncated
        ? `Key scan capped at ${ORG_TO_ORG_KEY_SCAN_MAX} records per org; counts may be approximate.`
        : undefined,
    };
  }
}
