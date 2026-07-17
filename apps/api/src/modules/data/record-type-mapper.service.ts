import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertSoqlIdentifier } from '@sfcc/shared';
import type { QuerySetJson } from '@sfcc/shared';

export interface RecordTypeInfo {
  id: string;
  developerName: string;
  name: string;
}

@Injectable()
export class RecordTypeMapperService {
  private readonly sfCli = createSfCliClient();

  private resolveTarget(org: { alias: string; username?: string | null }): string {
    return org.username ?? org.alias;
  }

  async discoverRecordTypes(orgId: string, objectApiName: string): Promise<RecordTypeInfo[]> {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    if (!org) throw new Error('Org not found');

    const safeObjectName = assertSoqlIdentifier(objectApiName, 'object name');
    const soql = `SELECT Id, DeveloperName, Name, SobjectType FROM RecordType WHERE SobjectType = '${safeObjectName}'`;
    const result = await this.sfCli.query(this.resolveTarget(org), soql);
    const records = (result.data?.result?.records ?? []) as Array<{
      Id: string;
      DeveloperName: string;
      Name: string;
    }>;

    return records.map((r) => ({
      id: r.Id,
      developerName: r.DeveloperName,
      name: r.Name,
    }));
  }

  async buildMappings(
    sourceOrgId: string,
    targetOrgId: string,
    objectApiName: string,
    manualOverrides?: Record<string, string>,
    requiredSourceRecordTypeIds?: string[],
  ): Promise<Record<string, string>> {
    const [sourceTypes, targetTypes] = await Promise.all([
      this.discoverRecordTypes(sourceOrgId, objectApiName),
      this.discoverRecordTypes(targetOrgId, objectApiName),
    ]);

    const targetByDev = new Map(targetTypes.map((t) => [t.developerName, t.id]));
    const targetByName = new Map(targetTypes.map((t) => [t.name, t.id]));

    const mappings: Record<string, string> = { ...manualOverrides };

    for (const source of sourceTypes) {
      if (mappings[source.id]) continue;
      const targetId =
        targetByDev.get(source.developerName) ??
        targetByName.get(source.name);
      if (targetId) mappings[source.id] = targetId;
    }

    const requiredIds = requiredSourceRecordTypeIds
      ? new Set(requiredSourceRecordTypeIds)
      : undefined;
    const requiredSourceTypes = requiredIds
      ? sourceTypes.filter((source) => requiredIds.has(source.id))
      : sourceTypes;
    const unknownIds = requiredIds
      ? [...requiredIds].filter((id) => !sourceTypes.some((source) => source.id === id))
      : [];
    if (unknownIds.length > 0) {
      throw new Error(
        `RecordType IDs were not found for ${objectApiName}: ${unknownIds.join(', ')}`,
      );
    }
    const unmapped = requiredSourceTypes.filter((s) => !mappings[s.id]);
    if (unmapped.length > 0) {
      const names = unmapped.map((u) => u.developerName).join(', ');
      throw new Error(`RecordType mapping gaps for ${objectApiName}: ${names}`);
    }

    return mappings;
  }

  async analyzeQuerySetRecordTypes(
    sourceOrgId: string,
    querySet: QuerySetJson,
  ): Promise<Array<{ object: string; recordTypeId: string; developerName?: string }>> {
    const org = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
    if (!org) throw new Error('Source org not found');

    const seen = new Map<string, { object: string; recordTypeId: string; developerName?: string }>();

    for (const q of querySet.queries) {
      const previewSoql = q.soql.replace(/\bLIMIT\s+\d+\s*$/i, ' LIMIT 50');
      const result = await this.sfCli.query(this.resolveTarget(org), previewSoql);
      const records = (result.data?.result?.records ?? []) as Array<Record<string, unknown>>;

      for (const rec of records) {
        const rtId = rec.RecordTypeId as string | undefined;
        const devName = (rec.RecordType as { DeveloperName?: string } | undefined)?.DeveloperName;
        if (!rtId) continue;
        const key = `${q.object}:${rtId}`;
        if (!seen.has(key)) {
          seen.set(key, { object: q.object, recordTypeId: rtId, developerName: devName });
        }
      }
    }

    return Array.from(seen.values());
  }
}
