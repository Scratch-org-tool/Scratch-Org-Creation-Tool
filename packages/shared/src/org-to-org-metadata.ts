import { z } from 'zod';

export const FOLDER_METADATA_TYPES = [
  'Dashboard',
  'Report',
  'Document',
  'EmailTemplate',
  'EmailFolder',
  'ReportFolder',
  'DashboardFolder',
] as const;

export type FolderMetadataType = (typeof FOLDER_METADATA_TYPES)[number];

export function isFolderMetadataType(type: string): type is FolderMetadataType {
  return (FOLDER_METADATA_TYPES as readonly string[]).includes(type);
}

export interface MetadataSelection {
  metadataType: string;
  members: string[];
  folder?: string;
}

/** One default for generated manifests and temporary Salesforce projects. */
export const DEFAULT_METADATA_API_VERSION = '62.0';

export interface ParsedManifestMember {
  metadataType: string;
  apiName: string;
  isWildcard: boolean;
}

export interface ParsedManifest {
  apiVersion: string | null;
  members: ParsedManifestMember[];
  selections: MetadataSelection[];
}

export interface MetadataCompareResult {
  metadataType: string;
  onlyInSource: string[];
  onlyInTarget: string[];
  inBoth: string[];
}

export type MetadataDiffType = 'new' | 'changed' | 'deleted' | 'same' | 'unknown';

export interface MetadataComponentInfo {
  fullName: string;
  metadataType?: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
}

export interface MetadataCompareItem {
  fullName: string;
  metadataType: string;
  diffType: MetadataDiffType;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
  childTypes?: Array<{ type: string; count: number }>;
}

export interface MetadataComparisonSummary {
  total: number;
  new: number;
  changed: number;
  deleted: number;
  same: number;
  unknown: number;
  byType: Record<string, {
    total: number;
    new: number;
    changed: number;
    deleted: number;
    same: number;
    unknown: number;
  }>;
}

/** Metadata types compared in a full org comparison (expandable). */
export const CURATED_COMPARE_TYPES = [
  'ApexClass',
  'ApexTrigger',
  'ApexPage',
  'ApexComponent',
  'CustomObject',
  'CustomField',
  'Flow',
  'Layout',
  'PermissionSet',
  'Profile',
  'LightningComponentBundle',
  'FlexiPage',
  'CustomTab',
  'ValidationRule',
  'ListView',
  'EmailTemplate',
  'Report',
  'Dashboard',
  'StaticResource',
  'Workflow',
] as const;

export function classifyMetadataPair(
  source: MetadataComponentInfo | undefined,
  target: MetadataComponentInfo | undefined,
): MetadataDiffType {
  if (source && !target) return 'new';
  if (!source && target) return 'deleted';
  if (!source || !target) return 'unknown';
  // Listing APIs prove only that an item exists on both sides. XML must be
  // inspected before it can safely be called changed or identical.
  return 'unknown';
}

export function buildComparisonItems(
  metadataType: string,
  sourceList: MetadataComponentInfo[],
  targetList: MetadataComponentInfo[],
): MetadataCompareItem[] {
  const sourceMap = new Map(sourceList.map((c) => [c.fullName, c]));
  const targetMap = new Map(targetList.map((c) => [c.fullName, c]));
  const allNames = new Set([...sourceMap.keys(), ...targetMap.keys()]);
  const items: MetadataCompareItem[] = [];
  for (const fullName of [...allNames].sort()) {
    const s = sourceMap.get(fullName);
    const t = targetMap.get(fullName);
    const diffType = classifyMetadataPair(s, t);
    items.push({
      fullName,
      metadataType,
      diffType,
      lastModifiedDate: s?.lastModifiedDate ?? t?.lastModifiedDate,
      lastModifiedBy: s?.lastModifiedBy ?? t?.lastModifiedBy,
    });
  }
  return items;
}

export function summarizeComparisonItems(items: MetadataCompareItem[]): MetadataComparisonSummary {
  const summary: MetadataComparisonSummary = {
    total: items.length,
    new: 0,
    changed: 0,
    deleted: 0,
    same: 0,
    unknown: 0,
    byType: {},
  };
  for (const item of items) {
    summary[item.diffType] += 1;
    const bt = summary.byType[item.metadataType] ?? {
      total: 0,
      new: 0,
      changed: 0,
      deleted: 0,
      same: 0,
      unknown: 0,
    };
    bt.total += 1;
    bt[item.diffType] += 1;
    summary.byType[item.metadataType] = bt;
  }
  return summary;
}

export const metadataCompareStartSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  types: z.array(z.string()).optional(),
});

export const metadataCompareAnalyzeSchema = z.object({
  selectedItems: z.array(z.object({
    fullName: z.string(),
    metadataType: z.string(),
    diffType: z.enum(['new', 'changed', 'deleted', 'same', 'unknown']).optional(),
  })),
  excludeFullNames: z.array(z.string()).optional(),
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPackageXml(
  selections: MetadataSelection[],
  apiVersion = DEFAULT_METADATA_API_VERSION,
): string {
  const byType = new Map<string, Set<string>>();
  for (const sel of selections) {
    if (!sel.members.length) continue;
    const set = byType.get(sel.metadataType) ?? new Set<string>();
    for (const m of sel.members) {
      if (m.trim()) set.add(m.trim());
    }
    byType.set(sel.metadataType, set);
  }

  const typesXml = [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, members]) => {
      const memberLines = [...members]
        .sort()
        .map((m) => `        <members>${escapeXml(m)}</members>`)
        .join('\n');
      return `    <types>\n${memberLines}\n        <name>${escapeXml(name)}</name>\n    </types>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
${typesXml}
    <version>${apiVersion}</version>
</Package>
`;
}

function normalizeMembers(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

/** Parse package.xml string into members and selections. */
export function parsePackageXml(xml: string): ParsedManifest {
  const trimmed = xml.trim();
  if (!trimmed.includes('<Package') && !trimmed.includes('<package')) {
    throw new Error('Invalid package.xml: missing Package root element');
  }

  const versionMatch = trimmed.match(/<version>([^<]+)<\/version>/i);
  const apiVersion = versionMatch?.[1]?.trim() ?? null;

  const members: ParsedManifestMember[] = [];
  const typeBlockRegex = /<types>([\s\S]*?)<\/types>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = typeBlockRegex.exec(trimmed)) !== null) {
    const block = blockMatch[1];
    const nameMatch = block.match(/<name>([^<]+)<\/name>/i);
    if (!nameMatch) continue;
    const metadataType = nameMatch[1].trim();

    const memberRegex = /<members>([^<]*)<\/members>/gi;
    let memberMatch: RegExpExecArray | null;
    while ((memberMatch = memberRegex.exec(block)) !== null) {
      const apiName = memberMatch[1].trim();
      if (!apiName) continue;
      members.push({
        metadataType,
        apiName,
        isWildcard: apiName === '*' || apiName.endsWith('.*'),
      });
    }
  }

  if (!members.length && !apiVersion) {
    throw new Error('Invalid package.xml: no metadata types or members found');
  }

  return {
    apiVersion,
    members,
    selections: membersToSelections(members),
  };
}

export function membersToSelections(members: ParsedManifestMember[]): MetadataSelection[] {
  const byType = new Map<string, Set<string>>();
  for (const m of members) {
    if (m.isWildcard) continue;
    const set = byType.get(m.metadataType) ?? new Set<string>();
    set.add(m.apiName);
    byType.set(m.metadataType, set);
  }
  return [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([metadataType, memberSet]) => ({
      metadataType,
      members: [...memberSet].sort(),
    }));
}

export function parseAndNormalizeManifest(xml: string): ParsedManifest {
  return parsePackageXml(xml);
}

export function compareMetadataLists(
  source: string[],
  target: string[],
): Pick<MetadataCompareResult, 'onlyInSource' | 'onlyInTarget' | 'inBoth'> {
  const sourceSet = new Set(source.map((s) => s.trim()).filter(Boolean));
  const targetSet = new Set(target.map((s) => s.trim()).filter(Boolean));

  const onlyInSource: string[] = [];
  const inBoth: string[] = [];
  for (const name of sourceSet) {
    if (targetSet.has(name)) inBoth.push(name);
    else onlyInSource.push(name);
  }
  const onlyInTarget = [...targetSet].filter((n) => !sourceSet.has(n)).sort();

  return {
    onlyInSource: onlyInSource.sort(),
    onlyInTarget,
    inBoth: inBoth.sort(),
  };
}

export function countProfileSelections(selections: MetadataSelection[]): number {
  return selections
    .filter((s) => s.metadataType === 'Profile')
    .reduce((sum, s) => sum + s.members.length, 0);
}

export const metadataSelectionSchema = z.object({
  metadataType: z.string().min(1),
  members: z.array(z.string().min(1)).min(1),
  folder: z.string().optional(),
});

const orgToOrgDataDeployConfigSchema = z.object({
  objectName: z.string().min(1),
  soql: z.string().min(1).optional(),
  strategy: z.enum(['insert', 'upsert']).optional(),
}).passthrough();

export const orgToOrgMetadataPreviewSchema = z.object({
  selections: z.array(metadataSelectionSchema).optional(),
  packageXml: z.string().min(1).optional(),
  apiVersion: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasSelections = Boolean(data.selections?.length);
  const hasXml = Boolean(data.packageXml?.trim());
  if (!hasSelections && !hasXml) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide selections or packageXml',
      path: ['selections'],
    });
  }
});

export const orgToOrgMetadataDeploySchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  selections: z.array(metadataSelectionSchema).optional(),
  packageXml: z.string().min(1).optional(),
  testLevel: z
    .enum(['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'])
    .optional(),
  /** Apex test classes to run when testLevel is RunSpecifiedTests. */
  tests: z.array(z.string().min(1)).optional(),
  /** Check-only deploy (`--dry-run`); the validation id is persisted for quick deploy. */
  validateOnly: z.boolean().optional(),
  /** Opt-in: components to delete on the target (from compare `deleted` items). */
  destructiveSelections: z.array(metadataSelectionSchema).optional(),
  apiVersion: z.string().optional(),
  chainDataDeploy: z.boolean().optional(),
  dataDeployConfig: z.array(orgToOrgDataDeployConfigSchema).optional(),
  comparisonId: z.string().uuid().optional(),
  deploymentName: z.string().optional(),
  deploymentNotes: z.string().optional(),
  intelligentDeployEnabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.testLevel === 'RunSpecifiedTests' && !data.tests?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide at least one test class for RunSpecifiedTests',
      path: ['tests'],
    });
  }
  if (data.sourceOrgId === data.targetOrgId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and target org must differ',
      path: ['targetOrgId'],
    });
  }
  const hasSelections = Boolean(data.selections?.length);
  const hasXml = Boolean(data.packageXml?.trim());
  if (!hasSelections && !hasXml) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide selections or packageXml',
      path: ['selections'],
    });
  }
  if (data.chainDataDeploy && !data.dataDeployConfig?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dataDeployConfig is required when chainDataDeploy is true',
      path: ['dataDeployConfig'],
    });
  }
});

export const orgToOrgMetadataPipelineSchema = orgToOrgMetadataDeploySchema;

export type OrgToOrgMetadataPreviewInput = z.infer<typeof orgToOrgMetadataPreviewSchema>;
export type OrgToOrgMetadataDeployInput = z.infer<typeof orgToOrgMetadataDeploySchema>;

export function resolveManifestXml(input: {
  selections?: MetadataSelection[];
  packageXml?: string;
  apiVersion?: string;
}): string {
  // A raw package.xml is authoritative when provided — never silently rebuild
  // it from UI selections (the user may have hand-edited the manifest).
  if (input.packageXml?.trim()) {
    parsePackageXml(input.packageXml); // validate
    return input.packageXml.trim();
  }
  if (!input.selections?.length) {
    throw new Error('Provide selections or packageXml');
  }
  return buildPackageXml(input.selections, input.apiVersion ?? DEFAULT_METADATA_API_VERSION);
}

/** destructiveChanges.xml shares the package.xml format (no version element required). */
export function buildDestructiveChangesXml(
  selections: MetadataSelection[],
  apiVersion = DEFAULT_METADATA_API_VERSION,
): string {
  return buildPackageXml(selections, apiVersion);
}
