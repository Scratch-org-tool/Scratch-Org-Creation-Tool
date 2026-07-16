import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  compareMetadataLists,
  isFolderMetadataType,
  orgToOrgMetadataPreviewSchema,
  resolveManifestXml,
  type MetadataCompareResult,
  type MetadataComponentInfo,
  type MetadataSelection,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertOrgOwned } from '../../common/user-tenancy.util';

export interface ObjectFieldRow {
  name: string;
  label: string;
  type: string;
  fullName: string;
}

export interface ListObjectFieldsResult {
  orgId: string;
  objectName: string;
  fields: ObjectFieldRow[];
  source: 'describe' | 'metadata';
  warning?: string;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

@Injectable()
export class MetadataBrowseService {
  private readonly sfCli = createSfCliClient();
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTtlMs = 60_000;

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCached<T>(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private async resolveAlias(orgId: string, userId: string): Promise<string> {
    const org = await assertOrgOwned(orgId, userId, prisma);
    return org.username ?? org.alias;
  }

  private handleCliError(err: string | undefined, alias: string): never {
    if (err?.includes('html content') || err?.includes('420')) {
      throw new BadRequestException(
        `Cannot reach org "${alias}" — session may be expired. Reconnect the org in Environment Center.`,
      );
    }
    throw new BadRequestException(err ?? 'Salesforce CLI command failed');
  }

  async listTypes(orgId: string, userId: string, search?: string, page = 1, pageSize = 100) {
    const types = await this.listTypesRaw(orgId, userId);

    let filtered = types;
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      filtered = types.filter(
        (t) => t.xmlName.toLowerCase().includes(q) || t.directoryName?.toLowerCase().includes(q),
      );
    }
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    return {
      orgId,
      types: slice,
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /** Complete org metadata type catalog for automatic comparison planning. */
  async listTypesRaw(
    orgId: string,
    userId: string,
  ): Promise<Array<{ xmlName: string; directoryName?: string; inFolder?: boolean }>> {
    const alias = await this.resolveAlias(orgId, userId);
    const cacheKey = `types:${orgId}`;
    let types = this.getCached<Array<{ xmlName: string; directoryName?: string; inFolder?: boolean }>>(cacheKey);
    if (!types) {
      const result = await this.sfCli.listMetadataTypes(alias);
      if (!result.success) this.handleCliError(result.error, alias);
      types = result.data?.result?.metadataObjects ?? [];
      this.setCached(cacheKey, types);
    }
    return types;
  }

  async listComponents(
    orgId: string,
    userId: string,
    metadataType: string,
    options?: { search?: string; folder?: string; page?: number; pageSize?: number },
  ) {
    const alias = await this.resolveAlias(orgId, userId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 200;
    const cacheKey = `components:${orgId}:${metadataType}:${options?.folder ?? ''}`;
    let components = this.getCached<MetadataComponentInfo[]>(cacheKey);
    if (!components) {
      const result = await this.sfCli.listMetadata(alias, metadataType, options?.folder);
      if (!result.success) this.handleCliError(result.error, alias);
      components = (result.data?.result ?? [])
        .filter((c) => c.fullName)
        .map((c) => ({
          fullName: c.fullName,
          metadataType,
          lastModifiedDate: c.lastModifiedDate,
          lastModifiedBy: c.lastModifiedByName,
        }));
      this.setCached(cacheKey, components);
    }

    let filtered = components;
    if (options?.search?.trim()) {
      const q = options.search.trim().toLowerCase();
      filtered = components.filter((c) => c.fullName.toLowerCase().includes(q));
    }
    const start = (page - 1) * pageSize;
    return {
      orgId,
      metadataType,
      folder: options?.folder,
      components: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /** Raw, unpaginated component list for compare service — never truncated. */
  async listComponentsRaw(
    orgId: string,
    userId: string,
    metadataType: string,
  ): Promise<MetadataComponentInfo[]> {
    const alias = await this.resolveAlias(orgId, userId);
    const cacheKey = `components:${orgId}:${metadataType}:`;
    const cached = this.getCached<MetadataComponentInfo[]>(cacheKey);
    if (cached) return cached;

    const result = await this.sfCli.listMetadata(alias, metadataType);
    if (!result.success) this.handleCliError(result.error, alias);
    const components = (result.data?.result ?? [])
      .filter((c) => c.fullName)
      .map((c) => ({
        fullName: c.fullName,
        metadataType,
        lastModifiedDate: c.lastModifiedDate,
        lastModifiedBy: c.lastModifiedByName,
      }));
    this.setCached(cacheKey, components);
    return components;
  }

  async listFolders(orgId: string, userId: string, metadataType: string) {
    if (!isFolderMetadataType(metadataType)) {
      return { orgId, metadataType, folders: [] as Array<{ fullName: string }> };
    }
    const alias = await this.resolveAlias(orgId, userId);
    const result = await this.sfCli.listMetadataFolders(alias, metadataType);
    if (!result.success) this.handleCliError(result.error, alias);
    return {
      orgId,
      metadataType,
      folders: result.data?.result ?? [],
    };
  }

  async listObjectFields(orgId: string, userId: string, objectName: string): Promise<ListObjectFieldsResult> {
    const alias = await this.resolveAlias(orgId, userId);
    const decoded = decodeURIComponent(objectName);
    const prefix = `${decoded}.`;

    const describeResult = await this.sfCli.describeSObject(alias, decoded);
    if (describeResult.success) {
      const fields = describeResult.data?.result?.fields ?? [];
      return {
        orgId,
        objectName: decoded,
        source: 'describe',
        fields: fields
          .filter((f) => f.custom === true)
          .map((f) => ({
            name: f.name,
            label: f.label ?? f.name,
            type: f.type ?? 'string',
            fullName: `${decoded}.${f.name}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    }

    const describeErr = describeResult.error ?? '';
    const isSessionError =
      describeErr.includes('html content') ||
      describeErr.includes('420') ||
      describeErr.includes('auth') ||
      describeErr.includes('Authentication');

    if (isSessionError) {
      this.handleCliError(describeErr, alias);
    }

    const metaResult = await this.sfCli.listMetadata(alias, 'CustomField');
    if (!metaResult.success) {
      return {
        orgId,
        objectName: decoded,
        source: 'metadata',
        fields: [],
        warning:
          metaResult.error ??
          describeErr ??
          'Could not load fields via describe or CustomField metadata listing.',
      };
    }

    const fields = (metaResult.data?.result ?? [])
      .filter((c) => c.fullName.startsWith(prefix))
      .map((c) => {
        const fieldName = c.fullName.slice(prefix.length);
        return {
          name: fieldName,
          label: fieldName,
          type: 'custom',
          fullName: c.fullName,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      orgId,
      objectName: decoded,
      source: 'metadata',
      fields,
      warning: fields.length
        ? `Loaded ${fields.length} field(s) from CustomField metadata (describe unavailable for this object).`
        : 'No custom fields found via describe or CustomField metadata.',
    };
  }

  async compareOrgs(
    sourceOrgId: string,
    targetOrgId: string,
    userId: string,
    metadataType: string,
  ): Promise<MetadataCompareResult> {
    const [sourceList, targetList] = await Promise.all([
      this.listComponents(sourceOrgId, userId, metadataType, { pageSize: 10_000 }),
      this.listComponents(targetOrgId, userId, metadataType, { pageSize: 10_000 }),
    ]);
    const diff = compareMetadataLists(
      sourceList.components.map((c) => c.fullName),
      targetList.components.map((c) => c.fullName),
    );
    return { metadataType, ...diff };
  }

  previewManifest(body: unknown) {
    const input = orgToOrgMetadataPreviewSchema.parse(body);
    const packageXml = resolveManifestXml({
      selections: input.selections as MetadataSelection[] | undefined,
      packageXml: input.packageXml,
      apiVersion: input.apiVersion,
    });
    const memberCount = input.selections?.reduce((sum, s) => sum + s.members.length, 0)
      ?? (input.packageXml?.match(/<members>/gi)?.length ?? 0);
    return { packageXml, memberCount };
  }
}
