import type { TestLevel } from '../deployment-center/azure/types';

export type { TestLevel };

export interface Org {
  id: string;
  alias: string;
  type?: string;
  username?: string | null;
}

export interface MetadataTypeInfo {
  xmlName: string;
  directoryName?: string;
  inFolder?: boolean;
}

export interface MetadataSelection {
  metadataType: string;
  members: string[];
  folder?: string;
}

export interface MetadataComponentInfo {
  fullName: string;
  metadataType?: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
}

export type MetadataDiffType = 'new' | 'changed' | 'deleted' | 'same';

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
  byType: Record<string, { total: number; new: number; changed: number; deleted: number; same: number }>;
}

export interface MetadataCompareSession {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  status: string;
  summary: MetadataComparisonSummary | null;
  items: MetadataCompareItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type DiffLoadStatus = 'ok' | 'partial' | 'failed';

export interface ItemDiffPayload {
  sourceXml: string;
  targetXml: string;
  diffLines: Array<{ value: string; added?: boolean; removed?: boolean }>;
  contentDiffers: boolean;
  cached?: boolean;
  loadStatus?: DiffLoadStatus;
  retrieveWarnings?: { source?: string; target?: string };
}

export interface ProblemAnalysisResult {
  comparisonId: string;
  summary: {
    totalSelected: number;
    deployable: number;
    excluded: number;
    errors: number;
    warnings: number;
  };
  suggestedFixes: Array<{
    id: string;
    severity: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    suggestedAction: string;
    affectedItems: Array<{ fullName: string; metadataType: string }>;
    autoExclude?: boolean;
  }>;
  warnings: ProblemAnalysisResult['suggestedFixes'];
  deployableItems: Array<{ fullName: string; metadataType: string; diffType?: MetadataDiffType }>;
}

export interface MetadataDeployForm {
  sourceOrgId: string;
  targetOrgId: string;
  testLevel: TestLevel;
  deploymentName: string;
  deploymentNotes: string;
  chainDataDeploy: boolean;
  dataObjectName: string;
  dataSoql: string;
}

export type ComparePhase = 'setup' | 'compare' | 'analysis' | 'summary' | 'deploying' | 'success';

export type WorkspaceTab = 'compare' | 'history';

export type HistoryFilter = 'all' | 'running' | 'success' | 'failed' | 'cancelled';

export const METADATA_DRAFT_KEY = 'metadata-deployment-draft';

export const METADATA_LOG_TAIL = 500;
export const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];
export const ACTIVE_STATUSES = ['running', 'queued', 'pending'];

export const TEST_LEVEL_OPTIONS = [
  { value: 'NoTestRun' as const, label: 'No Test Run' },
  { value: 'RunSpecifiedTests' as const, label: 'Run Specified Tests' },
  { value: 'RunLocalTests' as const, label: 'Run Local Tests' },
  { value: 'RunAllTestsInOrg' as const, label: 'Run All Tests In Org' },
];

export const DIFF_TYPE_LABELS: Record<MetadataDiffType, string> = {
  new: 'New',
  changed: 'Changed',
  deleted: 'Deleted',
  same: 'No difference',
};

export interface DeploymentRow {
  id: string;
  repo: string;
  branch: string;
  status: string;
  strategy: string;
  createdAt: string;
  sourceOrgId?: string | null;
  jobId?: string | null;
  metadata?: {
    deployMode?: string;
    selections?: MetadataSelection[];
    comparisonId?: string;
    deploymentName?: string;
    error?: string;
  } | null;
  job?: {
    id: string;
    status: string;
    currentStep: string;
    error?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    createdAt?: string;
  } | null;
  targetOrg?: { alias: string; username?: string | null } | null;
  sourceOrg?: { alias: string; username?: string | null } | null;
}

export interface JobData {
  id: string;
  status: string;
  currentStep?: string;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  logs?: Array<{ line: string; stream?: string }>;
  logsTruncated?: boolean;
  logCount?: number;
}

export interface MetadataDraft {
  sourceOrgId: string;
  targetOrgId: string;
  comparisonId?: string;
  selectedKeys: string[];
  selectionSnapshot?: Record<string, MetadataCompareItem>;
  phase: ComparePhase;
  deploymentName?: string;
}

export function itemKey(metadataType: string, fullName: string) {
  return `${metadataType}::${fullName}`;
}

export function parseItemKey(key: string): { metadataType: string; fullName: string } {
  const [metadataType, ...rest] = key.split('::');
  return { metadataType, fullName: rest.join('::') };
}

export function selectionsFromItems(items: MetadataCompareItem[]): MetadataSelection[] {
  const map = new Map<string, string[]>();
  for (const item of items) {
    if (item.diffType === 'deleted' || item.diffType === 'same') continue;
    const members = map.get(item.metadataType) ?? [];
    members.push(item.fullName);
    map.set(item.metadataType, members);
  }
  return [...map.entries()].map(([metadataType, members]) => ({ metadataType, members }));
}

export function isDeployableDiffType(diffType: MetadataDiffType) {
  return diffType !== 'deleted' && diffType !== 'same';
}
