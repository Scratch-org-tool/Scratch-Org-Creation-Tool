import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  buildCountSoql,
  buildFilterSoql,
  buildListSoql,
  DATA_PREVIEW_MAX_ROWS,
  defaultDisplayFields,
  ensureIdInSoqlSelect,
  fieldsForPreviewQuery,
  isDeployableObjectName,
  isFieldRequiredForDeploy,
  normalizeSObjectList,
  ORG_TO_ORG_RECORD_LIMIT_MAX,
  orgToOrgPreviewFilterSchema,
  parseOrgToOrgSoql,
  resolveFieldsForDeploy,
  resolveOrgToOrgPreviewSoql,
  stripLimitOffset,
  validateSoqlForObject,
  OrgToOrgSoqlParseError,
  NON_DEPLOYABLE_REFERENCE_OBJECTS,
  type OrgToOrgDeployableField,
  type OrgToOrgFilterPreviewResult,
  type OrgToOrgObjectInfo,
  type OrgToOrgObjectMeta,
  type OrgToOrgRecordPage,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import { TtlCache } from '../../common/ttl-cache';

/**
 * Schema lookups (sobject list + describe) each spawn a Salesforce CLI
 * process that takes seconds. The deploy wizard requests the same metadata
 * repeatedly (object meta on focus, again per filter preview, again per
 * object on the review step), so a short TTL cache removes most of that
 * latency. Org schemas change rarely; a five-minute staleness window is a
 * safe trade for interactive speed.
 */
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
const OBJECT_LIST_CACHE = new TtlCache<OrgToOrgObjectInfo[]>(SCHEMA_CACHE_TTL_MS, 50);
const OBJECT_META_CACHE = new TtlCache<OrgToOrgObjectMeta>(SCHEMA_CACHE_TTL_MS, 500);

/** Test hook: reset module-level schema caches between cases. */
export function clearOrgToOrgSchemaCache(): void {
  OBJECT_LIST_CACHE.clear();
  OBJECT_META_CACHE.clear();
}

const FILTERABLE_TYPES = new Set([
  'string',
  'textarea',
  'email',
  'phone',
  'url',
  'picklist',
  'multipicklist',
  'boolean',
  'double',
  'int',
  'currency',
  'percent',
  'date',
  'datetime',
  'reference',
  'id',
]);

@Injectable()
export class OrgToOrgBrowseService {
  private readonly sfCli = createSfCliClient();

  async listObjects(orgId: string, userId: string, search?: string): Promise<OrgToOrgObjectInfo[]> {
    const org = await assertOrgOwned(orgId, userId, prisma);
    const alias = org.username ?? org.alias;

    let objects = await OBJECT_LIST_CACHE.getOrCompute(`objects:${alias}`, async () => {
      const result = await this.sfCli.listSObjects(alias);
      const normalized = normalizeSObjectList(result.data?.result ?? []);
      return normalized
        .filter((o) => o.queryable !== false && isDeployableObjectName(o.name))
        .map((o) => ({
          apiName: o.name,
          label: o.label ?? o.name,
          queryable: o.queryable !== false,
          custom: Boolean(o.custom ?? o.name.endsWith('__c')),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      objects = objects.filter(
        (o) => o.apiName.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
      );
    }

    return objects;
  }

  async getObjectMeta(
    orgId: string,
    objectName: string,
    userId: string,
  ): Promise<OrgToOrgObjectMeta> {
    const org = await assertOrgOwned(orgId, userId, prisma);
    const alias = org.username ?? org.alias;

    return OBJECT_META_CACHE.getOrCompute(`meta:${alias}:${objectName}`, () =>
      this.describeObjectMeta(alias, objectName));
  }

  private async describeObjectMeta(
    alias: string,
    objectName: string,
  ): Promise<OrgToOrgObjectMeta> {
    const result = await this.sfCli.describeSObject(alias, objectName);
    const describe = result.data?.result;
    if (!describe) {
      throw new BadRequestException(`Could not describe object ${objectName}`);
    }

    const fields = describe.fields ?? [];
    const nameField = describe.nameField?.name ?? 'Name';
    const externalIdField = fields.find((f) => f.externalId)?.name;
    const hasName = fields.some((f) => f.name === 'Name');
    const matchField = externalIdField ?? (hasName ? 'Name' : nameField);

    const displayFields = defaultDisplayFields(matchField, nameField);
    const allowed = new Set(fields.map((f) => f.name));
    const filteredDisplay = displayFields.filter((f) => allowed.has(f));

    const filterableFields = fields
      .filter((f) => f.filterable !== false && FILTERABLE_TYPES.has(f.type ?? ''))
      .map((f) => ({
        name: f.name,
        label: f.label ?? f.name,
        type: f.type ?? 'string',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const referenceFields = fields
      .filter((f) => f.type === 'reference' && f.referenceTo?.length)
      .map((f) => {
        const referencedTo = f.referenceTo ?? [];
        const deployable = referencedTo.every((ref) => !NON_DEPLOYABLE_REFERENCE_OBJECTS.has(ref));
        return {
          name: f.name,
          label: f.label ?? f.name,
          referencedTo,
          deployable,
          selected: deployable,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const deployableFields: OrgToOrgDeployableField[] = fields
      .filter((f) => f.createable && !f.calculated && f.type !== 'address')
      .map((f) => {
        const reference = f.type === 'reference';
        const referencedTo = f.referenceTo ?? [];
        const refDeployable =
          !reference ||
          referencedTo.every((ref) => !NON_DEPLOYABLE_REFERENCE_OBJECTS.has(ref));
        const required = isFieldRequiredForDeploy(f);
        const selected =
          required ||
          f.name === matchField ||
          (reference && refDeployable);
        return {
          name: f.name,
          label: f.label ?? f.name,
          type: f.type ?? 'string',
          required,
          createable: Boolean(f.createable),
          reference,
          custom: Boolean(f.custom ?? f.name.endsWith('__c')),
          selected,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      objectName: describe.name ?? objectName,
      label: describe.label ?? objectName,
      nameField,
      matchField,
      displayFields: filteredDisplay.length > 0 ? filteredDisplay : ['Id', matchField],
      filterableFields,
      deployableFields,
      referenceFields,
    };
  }

  async previewFilter(body: unknown, userId: string): Promise<OrgToOrgFilterPreviewResult> {
    const input = orgToOrgPreviewFilterSchema.parse(body);
    const org = await assertOrgOwned(input.sourceOrgId, userId, prisma);
    const alias = org.username ?? org.alias;

    const meta = await this.getObjectMeta(input.sourceOrgId, input.objectName, userId);
    const deployLimit = Math.min(
      Math.max(input.soql?.trim() ? input.pageSize : input.recordLimit, 1),
      ORG_TO_ORG_RECORD_LIMIT_MAX,
    );
    const previewRowLimit = Math.min(deployLimit, DATA_PREVIEW_MAX_ROWS);

    let soql: string;
    let countBaseSoql: string;
    let displayFields: string[];

    if (input.soql?.trim()) {
      try {
        validateSoqlForObject(input.soql, meta.objectName);
      } catch (err) {
        if (err instanceof OrgToOrgSoqlParseError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
      const parsed = parseOrgToOrgSoql(input.soql);
      countBaseSoql = stripLimitOffset(input.soql.trim());
      // Force Id into the SELECT list: preview rows without an Id cannot be
      // checked individually or via select-all.
      soql = resolveOrgToOrgPreviewSoql({
        soql: ensureIdInSoqlSelect(input.soql),
        page: input.page,
        pageSize: previewRowLimit,
      });
      displayFields = fieldsForPreviewQuery(parsed.fields);
    } else {
      const fields = resolveFieldsForDeploy(
        meta.displayFields,
        input.selectedReferenceFields,
        input.selectedDeployFields,
        true,
      );
      countBaseSoql = buildFilterSoql({
        objectName: meta.objectName,
        fields,
        recordLimit: deployLimit,
        filters: input.filters,
        filterableFields: meta.filterableFields,
      });
      soql = buildFilterSoql({
        objectName: meta.objectName,
        fields,
        recordLimit: deployLimit,
        filters: input.filters,
        filterableFields: meta.filterableFields,
        page: input.page,
        pageSize: previewRowLimit,
      });
      displayFields = fields;
    }

    const result = await this.sfCli.query(alias, soql);
    if (!result.success) {
      throw new BadRequestException(
        `Source record query failed: ${result.error ?? 'unknown error'}`,
      );
    }
    const records = result.data?.result?.records ?? [];

    let matchCount: number;
    if (deployLimit > DATA_PREVIEW_MAX_ROWS) {
      const countResult = await this.sfCli.query(alias, buildCountSoql(countBaseSoql));
      if (!countResult.success) {
        throw new BadRequestException(
          `Source COUNT() query failed: ${countResult.error ?? 'unknown error'}`,
        );
      }
      const rawCount = countResult.data?.result?.totalSize ?? 0;
      matchCount = Math.min(rawCount, deployLimit);
    } else {
      matchCount = result.data?.result?.totalSize ?? records.length;
    }

    return {
      soql,
      matchCount,
      records,
      displayFields,
      objectName: meta.objectName,
      previewCapped: deployLimit > DATA_PREVIEW_MAX_ROWS,
      deployLimit,
      previewLimit: DATA_PREVIEW_MAX_ROWS,
    };
  }

  async listRecords(
    sourceOrgId: string,
    objectName: string,
    userId: string,
    limit = 50,
    page = 1,
  ): Promise<OrgToOrgRecordPage> {
    const org = await assertOrgOwned(sourceOrgId, userId, prisma);
    const alias = org.username ?? org.alias;

    const meta = await this.getObjectMeta(sourceOrgId, objectName, userId);
    const cappedLimit = Math.min(Math.max(limit, 1), ORG_TO_ORG_RECORD_LIMIT_MAX);
    const cappedPage = Math.max(page, 1);

    const soql = buildListSoql({
      objectName: meta.objectName,
      fields: meta.displayFields,
      limit: cappedLimit,
      page: cappedPage,
    });

    const result = await this.sfCli.query(alias, soql);
    if (!result.success) {
      throw new BadRequestException(
        `Source record query failed: ${result.error ?? 'unknown error'}`,
      );
    }
    const records = result.data?.result?.records ?? [];
    const totalSize = result.data?.result?.totalSize ?? records.length;

    return {
      records,
      totalSize,
      page: cappedPage,
      pageSize: cappedLimit,
      objectName: meta.objectName,
      displayFields: meta.displayFields,
    };
  }
}
