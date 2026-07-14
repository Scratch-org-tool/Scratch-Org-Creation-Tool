import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  QUERY_TEMPLATES,
  compileQuerySetFromTemplates,
  mergeQuerySets,
  normalizeQuerySet,
  querySetSchema,
  type QuerySetJson,
} from '@sfcc/shared';
import type { QuerySetCompileInput } from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { RecordTypeMapperService } from './record-type-mapper.service';

@Injectable()
export class QuerySetService {
  private readonly sfCli = createSfCliClient();

  constructor(private readonly recordTypeMapper: RecordTypeMapperService) {}

  getTemplates() {
    return QUERY_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      object: t.object,
      requiredVariables: t.requiredVariables ?? [],
    }));
  }

  async listBottlers(sourceOrgId: string): Promise<string[]> {
    const org = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
    if (!org) throw new Error('Source org not found');

    const soql =
      "SELECT cfs_ob__Bottler__c FROM cfs_ob__Onboarding_Config__c WHERE cfs_ob__Record_Category__c = 'Primary Group' AND cfs_ob__Bottler__c != null GROUP BY cfs_ob__Bottler__c LIMIT 200";
    const result = await this.sfCli.query(org.username ?? org.alias, soql);
    const records = (result.data?.result?.records ?? []) as Array<{ cfs_ob__Bottler__c?: string }>;
    return [...new Set(records.map((r) => r.cfs_ob__Bottler__c).filter(Boolean) as string[])].sort();
  }

  validateQuerySet(body: unknown): QuerySetJson {
    return normalizeQuerySet(body);
  }

  compileFromBuilder(input: QuerySetCompileInput): QuerySetJson {
    return compileQuerySetFromTemplates(
      QUERY_TEMPLATES as unknown as Parameters<typeof compileQuerySetFromTemplates>[0],
      input.enabledTemplateIds,
      { bottler: input.bottler },
      input.defaultLimit,
      'builder',
    );
  }

  mergeSets(base: QuerySetJson, upload: QuerySetJson): QuerySetJson {
    return mergeQuerySets(base, upload);
  }

  async previewQuerySet(sourceOrgId: string, querySet: QuerySetJson) {
    const org = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
    if (!org) throw new Error('Source org not found');
    const normalized = normalizeQuerySet(querySet);

    const results = [];
    for (const q of normalized.queries) {
      const result = await this.sfCli.query(org.username ?? org.alias, q.soql);
      const records = result.data?.result?.records ?? [];
      results.push({
        id: q.id,
        label: q.label,
        object: q.object,
        totalSize: result.data?.result?.totalSize ?? records.length,
        sample: records.slice(0, 5),
      });
    }

    return { querySet: normalized, results };
  }

  async previewRecordTypeMappings(
    sourceOrgId: string,
    targetOrgId: string,
    querySet?: QuerySetJson,
    objectName = 'cfs_ob__Onboarding_Config__c',
    manualMappings?: Record<string, string>,
  ) {
    const analyzed = querySet
      ? await this.recordTypeMapper.analyzeQuerySetRecordTypes(sourceOrgId, querySet)
      : [];

    const mappings = await this.recordTypeMapper.buildMappings(
      sourceOrgId,
      targetOrgId,
      objectName,
      manualMappings,
    );

    return { analyzed, mappings };
  }

  parseUploadJson(raw: unknown): QuerySetJson {
    return querySetSchema.parse(raw);
  }
}
