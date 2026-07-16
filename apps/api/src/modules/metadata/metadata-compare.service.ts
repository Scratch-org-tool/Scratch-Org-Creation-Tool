import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  buildComparisonItems,
  buildPackageXml,
  CURATED_COMPARE_TYPES,
  metadataCompareAnalyzeSchema,
  metadataCompareStartSchema,
  summarizeComparisonItems,
  type MetadataCompareItem,
  type MetadataComparisonSummary,
  type MetadataDiffType,
} from '@sfcc/shared';
import { createSfCliClient } from '@sfcc/sf-cli';
import { diffLines } from 'diff';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import { bootstrapOrgToOrgWorkspace } from '../../integrations/azure/org-to-org-workspace.util';
import { MetadataBrowseService } from './metadata-browse.service';

interface DiffCacheEntry {
  sourceXml: string;
  targetXml: string;
  diffLines: Array<{ value: string; added?: boolean; removed?: boolean }>;
  contentDiffers: boolean;
  loadStatus: 'ok' | 'partial' | 'failed';
  retrieveWarnings?: { source?: string; target?: string };
  truncated?: boolean;
}

const MAX_DIFF_CACHE_ENTRIES = 40;
const MAX_DIFF_XML_CHARS = 200_000;
const MAX_DIFF_PARTS = 5_000;

interface ProblemFix {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  suggestedAction: string;
  affectedItems: Array<{ fullName: string; metadataType: string }>;
  autoExclude?: boolean;
}

export interface MetadataProblemAnalysisResult {
  comparisonId: string;
  summary: {
    totalSelected: number;
    deployable: number;
    excluded: number;
    errors: number;
    warnings: number;
  };
  suggestedFixes: ProblemFix[];
  warnings: ProblemFix[];
  deployableItems: Array<{ fullName: string; metadataType: string; diffType?: MetadataDiffType }>;
}

@Injectable()
export class MetadataCompareService {
  private readonly sfCli = createSfCliClient();

  constructor(private readonly browseService: MetadataBrowseService) {}

  async startComparison(body: unknown, userId: string) {
    const input = metadataCompareStartSchema.parse(body);
    if (input.sourceOrgId === input.targetOrgId) {
      throw new BadRequestException('Source and target org must differ');
    }
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);

    const types = input.types?.length ? input.types : [...CURATED_COMPARE_TYPES];
    const session = await prisma.metadataComparison.create({
      data: {
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        status: 'running',
        createdBy: userId,
      },
    });

    void this.runComparison(session.id, input.sourceOrgId, input.targetOrgId, userId, types).catch(
      async (err) => {
        await prisma.metadataComparison.update({
          where: { id: session.id },
          data: {
            status: 'failed',
            summary: { error: err instanceof Error ? err.message : String(err) },
          },
        });
      },
    );

    return {
      comparisonId: session.id,
      status: 'running' as const,
      types,
    };
  }

  private async runComparison(
    comparisonId: string,
    sourceOrgId: string,
    targetOrgId: string,
    userId: string,
    types: string[],
  ) {
    const allItems: MetadataCompareItem[] = [];
    // Per-type list failures are surfaced in the summary instead of being
    // silently treated as "type has zero components" (which produced bogus
    // new/deleted results).
    const typeErrors: Array<{ metadataType: string; org: 'source' | 'target'; error: string }> = [];

    for (const metadataType of types) {
      const [sourceResult, targetResult] = await Promise.all([
        this.browseService.listComponentsRaw(sourceOrgId, userId, metadataType)
          .then((list) => ({ list, error: null as string | null }))
          .catch((err: unknown) => ({ list: null, error: err instanceof Error ? err.message : String(err) })),
        this.browseService.listComponentsRaw(targetOrgId, userId, metadataType)
          .then((list) => ({ list, error: null as string | null }))
          .catch((err: unknown) => ({ list: null, error: err instanceof Error ? err.message : String(err) })),
      ]);
      if (sourceResult.error) {
        typeErrors.push({ metadataType, org: 'source', error: sourceResult.error });
      }
      if (targetResult.error) {
        typeErrors.push({ metadataType, org: 'target', error: targetResult.error });
      }
      // Only compare types where both sides listed successfully; comparing a
      // real list against a failed (empty) one would fabricate diffs.
      if (sourceResult.list && targetResult.list) {
        allItems.push(...buildComparisonItems(metadataType, sourceResult.list, targetResult.list));
      }
    }

    const summary = {
      ...summarizeComparisonItems(allItems),
      ...(typeErrors.length ? { typeErrors } : {}),
    };
    const unknownItems = allItems.filter((item) => item.diffType === 'unknown');
    await prisma.metadataComparison.update({
      where: { id: comparisonId },
      data: {
        status: typeErrors.length > 0 && allItems.length === 0
          ? 'failed'
          : unknownItems.length
            ? 'running'
            : 'completed',
        items: allItems as unknown as object,
        summary: summary as unknown as object,
      },
    });
    if (unknownItems.length) {
      await this.runBulkResolution(comparisonId, userId, unknownItems);
    }
  }

  async getSession(
    comparisonId: string,
    userId: string,
    query: {
      type?: string;
      diffType?: MetadataDiffType;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const session = await this.getOwnedSession(comparisonId, userId);
    const items = (session.items as MetadataCompareItem[] | null) ?? [];
    let filtered = items;
    if (query.type) filtered = filtered.filter((i) => i.metadataType === query.type);
    if (query.diffType) filtered = filtered.filter((i) => i.diffType === query.diffType);
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      filtered = filtered.filter((i) => i.fullName.toLowerCase().includes(q));
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const start = (page - 1) * pageSize;
    return {
      id: session.id,
      sourceOrgId: session.sourceOrgId,
      targetOrgId: session.targetOrgId,
      status: session.status,
      summary: session.summary as MetadataComparisonSummary | null,
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async getItemDiff(
    comparisonId: string,
    userId: string,
    metadataType: string,
    fullName: string,
  ) {
    const session = await this.getOwnedSession(comparisonId, userId);
    const cache = (session.diffCache as Record<string, DiffCacheEntry> | null) ?? {};
    const cacheKey = `${metadataType}:${fullName}`;
    if (cache[cacheKey]) return { ...this.boundDiffEntry(cache[cacheKey]), cached: true };

    const [sourceOrg, targetOrg] = await Promise.all([
      assertOrgOwned(session.sourceOrgId, userId, prisma),
      assertOrgOwned(session.targetOrgId, userId, prisma),
    ]);
    const sourceAlias = sourceOrg.username ?? sourceOrg.alias;
    const targetAlias = targetOrg.username ?? targetOrg.alias;

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-diff-'));
    try {
    const sourceDir = path.join(baseDir, 'source');
    const targetDir = path.join(baseDir, 'target');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    bootstrapOrgToOrgWorkspace(sourceDir, buildPackageXml([{ metadataType, members: [fullName] }]));
    bootstrapOrgToOrgWorkspace(targetDir, buildPackageXml([{ metadataType, members: [fullName] }]));

    const item = ((session.items as MetadataCompareItem[] | null) ?? []).find(
      (i) => i.metadataType === metadataType && i.fullName === fullName,
    );

    const [sourceRetrieve, targetRetrieve] = await Promise.all([
      item?.diffType !== 'deleted'
        ? this.sfCli.retrieveMetadataMember(sourceAlias, metadataType, fullName, sourceDir)
        : Promise.resolve({ success: true as const }),
      item?.diffType !== 'new'
        ? this.sfCli.retrieveMetadataMember(targetAlias, metadataType, fullName, targetDir)
        : Promise.resolve({ success: true as const }),
    ]);

    const sourceXml = item?.diffType === 'deleted' ? '' : this.readMemberXml(sourceDir, metadataType, fullName);
    const targetXml = item?.diffType === 'new' ? '' : this.readMemberXml(targetDir, metadataType, fullName);
    const sourceWarn = sourceRetrieve.success ? undefined : ('error' in sourceRetrieve ? sourceRetrieve.error : undefined);
    const targetWarn = targetRetrieve.success ? undefined : ('error' in targetRetrieve ? targetRetrieve.error : undefined);
    const retrieveWarnings = { source: sourceWarn, target: targetWarn };

    let loadStatus: 'ok' | 'partial' | 'failed' = 'ok';
    if (sourceWarn || targetWarn) loadStatus = sourceXml || targetXml ? 'partial' : 'failed';
    else if (!sourceXml && !targetXml && item?.diffType !== 'new' && item?.diffType !== 'deleted') {
      loadStatus = 'failed';
    }

    const contentDiffers = sourceXml !== targetXml;
    const boundedSourceXml = sourceXml.slice(0, MAX_DIFF_XML_CHARS);
    const boundedTargetXml = targetXml.slice(0, MAX_DIFF_XML_CHARS);
    const fullLineDiff = diffLines(boundedTargetXml, boundedSourceXml);
    const lineDiff = fullLineDiff.slice(0, MAX_DIFF_PARTS);
    const diffPayload = lineDiff.map((part) => ({
      value: part.value,
      added: part.added || undefined,
      removed: part.removed || undefined,
    }));

    const entry: DiffCacheEntry = {
      sourceXml: boundedSourceXml,
      targetXml: boundedTargetXml,
      diffLines: diffPayload,
      contentDiffers,
      loadStatus,
      retrieveWarnings,
      truncated:
        sourceXml.length > MAX_DIFF_XML_CHARS ||
        targetXml.length > MAX_DIFF_XML_CHARS ||
        fullLineDiff.length > MAX_DIFF_PARTS,
    };

    if (loadStatus !== 'failed') {
      const boundedCache = Object.fromEntries(
        Object.entries(cache)
          .filter(([key]) => key !== cacheKey)
          .slice(-(MAX_DIFF_CACHE_ENTRIES - 1))
          .map(([key, value]) => [key, this.boundDiffEntry(value)]),
      );
      boundedCache[cacheKey] = entry;
      await prisma.metadataComparison.update({
        where: { id: comparisonId },
        data: { diffCache: boundedCache as object },
      });
    }

    if (
      loadStatus !== 'failed'
      && contentDiffers
      && item
      && (item.diffType === 'same' || item.diffType === 'unknown')
    ) {
      await this.upgradeItemDiffType(comparisonId, metadataType, fullName, 'changed');
    } else if (
      loadStatus !== 'failed'
      && !contentDiffers
      && item
      && (item.diffType === 'changed' || item.diffType === 'unknown')
    ) {
      await this.upgradeItemDiffType(comparisonId, metadataType, fullName, 'same');
    }

    return { ...entry, cached: false };
    } finally {
      try {
        fs.rmSync(baseDir, { recursive: true, force: true });
      } catch { /* best-effort cleanup */ }
    }
  }

  /**
   * Resolve every unknown comparison item as one background operation. This
   * removes the old requirement that a user open each row to classify it.
   */
  async resolveUnknowns(
    comparisonId: string,
    userId: string,
    body?: { items?: Array<{ metadataType: string; fullName: string }> },
  ) {
    const session = await this.getOwnedSession(comparisonId, userId);
    if (session.status === 'running') {
      return { comparisonId, status: 'running' as const };
    }
    const allItems = (session.items as MetadataCompareItem[] | null) ?? [];
    const requested = body?.items?.length
      ? new Set(body.items.map((item) => `${item.metadataType}:${item.fullName}`))
      : null;
    const unknown = allItems.filter(
      (item) => item.diffType === 'unknown'
        && (!requested || requested.has(`${item.metadataType}:${item.fullName}`)),
    );
    await prisma.metadataComparison.update({
      where: { id: comparisonId },
      data: {
        status: 'running',
        summary: {
          ...((session.summary as Record<string, unknown> | null) ?? {}),
          bulkResolution: { total: unknown.length, completed: 0, failed: 0 },
        },
      },
    });
    void this.runBulkResolution(comparisonId, userId, unknown).catch(async (error) => {
      await prisma.metadataComparison.update({
        where: { id: comparisonId },
        data: {
          status: 'failed',
          summary: {
            ...((session.summary as Record<string, unknown> | null) ?? {}),
            bulkResolution: {
              total: unknown.length,
              error: error instanceof Error ? error.message : String(error),
            },
          },
        },
      });
    });
    return { comparisonId, status: 'running' as const, queued: unknown.length };
  }

  private async runBulkResolution(
    comparisonId: string,
    userId: string,
    items: MetadataCompareItem[],
  ) {
    let completed = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const diff = await this.getItemDiff(
          comparisonId,
          userId,
          item.metadataType,
          item.fullName,
        );
        if (diff.loadStatus === 'failed') failed += 1;
      } catch {
        failed += 1;
      }
      completed += 1;
      if (completed % 10 === 0 || completed === items.length) {
        const current = await prisma.metadataComparison.findUnique({
          where: { id: comparisonId },
          select: { summary: true },
        });
        await prisma.metadataComparison.update({
          where: { id: comparisonId },
          data: {
            summary: {
              ...((current?.summary as Record<string, unknown> | null) ?? {}),
              bulkResolution: { total: items.length, completed, failed },
            },
          },
        });
      }
    }
    const refreshed = await prisma.metadataComparison.findUnique({
      where: { id: comparisonId },
      select: { items: true, summary: true },
    });
    const resolvedItems = (refreshed?.items as MetadataCompareItem[] | null) ?? [];
    await prisma.metadataComparison.update({
      where: { id: comparisonId },
      data: {
        status: failed === items.length && items.length > 0 ? 'failed' : 'completed',
        summary: {
          ...summarizeComparisonItems(resolvedItems),
          bulkResolution: { total: items.length, completed, failed },
        },
      },
    });
  }

  private boundDiffEntry(entry: DiffCacheEntry): DiffCacheEntry {
    const originalSourceXml = String(entry.sourceXml ?? '');
    const originalTargetXml = String(entry.targetXml ?? '');
    const sourceXml = originalSourceXml.slice(0, MAX_DIFF_XML_CHARS);
    const targetXml = originalTargetXml.slice(0, MAX_DIFF_XML_CHARS);
    const fullDiff = diffLines(targetXml, sourceXml);
    const boundedDiff = fullDiff.slice(0, MAX_DIFF_PARTS);
    return {
      ...entry,
      sourceXml,
      targetXml,
      diffLines: boundedDiff.map((part) => ({
        value: part.value,
        added: part.added || undefined,
        removed: part.removed || undefined,
      })),
      truncated:
        entry.truncated ||
        originalSourceXml.length > MAX_DIFF_XML_CHARS ||
        originalTargetXml.length > MAX_DIFF_XML_CHARS ||
        fullDiff.length > MAX_DIFF_PARTS,
    };
  }

  private async upgradeItemDiffType(
    comparisonId: string,
    metadataType: string,
    fullName: string,
    diffType: MetadataDiffType,
  ) {
    const session = await prisma.metadataComparison.findUnique({ where: { id: comparisonId } });
    if (!session?.items) return;
    const items = (session.items as unknown as MetadataCompareItem[]) ?? [];
    const idx = items.findIndex((i) => i.metadataType === metadataType && i.fullName === fullName);
    if (idx < 0) return;
    items[idx] = { ...items[idx], diffType };
    const summary = summarizeComparisonItems(items);
    await prisma.metadataComparison.update({
      where: { id: comparisonId },
      data: { items: items as unknown as object, summary: summary as unknown as object },
    });
  }

  async getObjectChildren(comparisonId: string, userId: string, objectName: string) {
    const session = await this.getOwnedSession(comparisonId, userId);
    const decoded = decodeURIComponent(objectName);
    const prefix = `${decoded}.`;

    const countByType = (type: string, predicate: (name: string) => boolean) => {
      const items = ((session.items as MetadataCompareItem[] | null) ?? []).filter(
        (i) => i.metadataType === type && predicate(i.fullName),
      );
      return items.length;
    };

    const childTypes = [
      { type: 'CustomField', count: countByType('CustomField', (n) => n.startsWith(prefix)) },
      { type: 'Layout', count: countByType('Layout', (n) => n.includes(decoded)) },
      { type: 'ValidationRule', count: countByType('ValidationRule', (n) => n.startsWith(prefix)) },
      { type: 'ListView', count: countByType('ListView', (n) => n.startsWith(prefix)) },
    ].filter((c) => c.count > 0);

    return { objectName: decoded, childTypes };
  }

  async analyzeProblems(comparisonId: string, userId: string, body: unknown): Promise<MetadataProblemAnalysisResult> {
    const session = await this.getOwnedSession(comparisonId, userId);
    const input = metadataCompareAnalyzeSchema.parse(body);
    const allItems = (session.items as MetadataCompareItem[] | null) ?? [];
    const selected = input.selectedItems.length
      ? input.selectedItems
      : allItems.filter((i) => i.diffType !== 'same' && i.diffType !== 'unknown');

    const fixes: ProblemFix[] = [];
    const warnings: ProblemFix[] = [];
    const excluded = new Set(input.excludeFullNames ?? []);

    const standardObjectPattern = /^(Account|Contact|Opportunity|Lead|Case|User|Campaign)$/i;
    const profiles = selected.filter((s) => s.metadataType === 'Profile');
    if (profiles.length > 0) {
      warnings.push({
        id: 'profile-size',
        severity: 'warning',
        title: 'Profile deployments can be large',
        description: `${profiles.length} profile(s) selected. Profile deploys may fail or overwrite permissions.`,
        suggestedAction: 'Consider Permission Sets instead, or deploy profiles in smaller batches.',
        affectedItems: profiles.map((p) => ({ fullName: p.fullName, metadataType: p.metadataType })),
      });
    }

    const standardObjects = selected.filter(
      (s) => s.metadataType === 'CustomObject' && standardObjectPattern.test(s.fullName),
    );
    if (standardObjects.length) {
      fixes.push({
        id: 'exclude-standard-objects',
        severity: 'error',
        title: 'Standard objects cannot be deployed as CustomObject',
        description: 'Standard objects should be excluded from the deployment package.',
        suggestedAction: 'Exclude these items from deployment.',
        affectedItems: standardObjects.map((o) => ({ fullName: o.fullName, metadataType: o.metadataType })),
        autoExclude: true,
      });
    }

    const deployable = selected.filter(
      (s) => {
        const k = `${s.metadataType}::${s.fullName}`;
        return !excluded.has(k)
          && !excluded.has(s.fullName)
          && s.diffType !== 'deleted'
          && s.diffType !== 'same'
          && s.diffType !== 'unknown';
      },
    );

    return {
      comparisonId,
      summary: {
        totalSelected: selected.length,
        deployable: deployable.length,
        excluded: excluded.size,
        errors: fixes.filter((f) => f.severity === 'error').length,
        warnings: warnings.length,
      },
      suggestedFixes: fixes,
      warnings,
      deployableItems: deployable,
    };
  }

  async getOrgCounts(sourceOrgId: string, targetOrgId: string, userId: string) {
    await assertOrgOwned(sourceOrgId, userId, prisma);
    await assertOrgOwned(targetOrgId, userId, prisma);
    const types = [...CURATED_COMPARE_TYPES].slice(0, 8);
    const [sourceCounts, targetCounts] = await Promise.all([
      this.countOrgMetadata(sourceOrgId, userId, types),
      this.countOrgMetadata(targetOrgId, userId, types),
    ]);
    return {
      sourceOrgId,
      targetOrgId,
      sourceCount: sourceCounts,
      targetCount: targetCounts,
    };
  }

  private async countOrgMetadata(orgId: string, userId: string, types: string[]) {
    let total = 0;
    for (const t of types) {
      const list = await this.browseService.listComponentsRaw(orgId, userId, t).catch(() => []);
      total += list.length;
    }
    return total;
  }

  private readMemberXml(root: string, metadataType: string, fullName: string): string {
    const bases = [
      path.join(root, 'force-app', 'main', 'default'),
      path.join(root, 'force-app'),
    ];

    const relCandidates: string[] = [];
    const lastSegment = fullName.split('/').pop() ?? fullName;

    if (metadataType === 'CustomField' && fullName.includes('.')) {
      const dot = fullName.indexOf('.');
      const obj = fullName.slice(0, dot);
      const field = fullName.slice(dot + 1);
      relCandidates.push(`objects/${obj}/fields/${field}.field-meta.xml`);
    } else if (metadataType === 'CustomObject') {
      relCandidates.push(`objects/${fullName}/${fullName}.object-meta.xml`);
    } else if (metadataType === 'ValidationRule' && fullName.includes('.')) {
      const dot = fullName.indexOf('.');
      relCandidates.push(`objects/${fullName.slice(0, dot)}/validationRules/${fullName.slice(dot + 1)}.validationRule-meta.xml`);
    } else if (metadataType === 'ListView' && fullName.includes('.')) {
      const dot = fullName.indexOf('.');
      relCandidates.push(`objects/${fullName.slice(0, dot)}/listViews/${fullName.slice(dot + 1)}.listView-meta.xml`);
    } else if (metadataType === 'Layout') {
      relCandidates.push(`layouts/${fullName}.layout-meta.xml`);
    } else if (metadataType === 'ApexClass') {
      relCandidates.push(`classes/${fullName}.cls`, `classes/${fullName}.cls-meta.xml`);
    } else if (metadataType === 'ApexTrigger') {
      relCandidates.push(`triggers/${fullName}.trigger`, `triggers/${fullName}.trigger-meta.xml`);
    } else if (metadataType === 'Flow') {
      relCandidates.push(`flows/${fullName}.flow-meta.xml`);
    } else if (metadataType === 'PermissionSet') {
      relCandidates.push(`permissionsets/${fullName}.permissionset-meta.xml`);
    } else if (metadataType === 'Profile') {
      relCandidates.push(`profiles/${fullName}.profile-meta.xml`);
    }

    for (const base of bases) {
      if (!fs.existsSync(base)) continue;
      for (const rel of relCandidates) {
        const abs = path.join(base, rel);
        if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8');
      }
    }

    const files: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else files.push(p);
      }
    };
    for (const base of bases) walk(base);

    const needle = fullName.replace(/\//g, path.sep);
    const fieldTail = fullName.includes('.') ? fullName.split('.').pop()! : lastSegment;
    const matches = files.filter((f) => {
      const rel = path.relative(bases.find((b) => f.startsWith(b)) ?? bases[0], f);
      return (
        rel.includes(needle) ||
        path.basename(f, path.extname(f)).includes(fieldTail) ||
        path.basename(f).includes(lastSegment)
      );
    });
    if (!matches.length) return '';
    return matches.map((f) => fs.readFileSync(f, 'utf8')).join('\n<!-- --- -->\n');
  }

  private async getOwnedSession(comparisonId: string, userId: string) {
    const session = await prisma.metadataComparison.findFirst({
      where: { id: comparisonId, createdBy: userId },
    });
    if (!session) throw new NotFoundException(`Comparison session ${comparisonId} not found`);
    return session;
  }
}
