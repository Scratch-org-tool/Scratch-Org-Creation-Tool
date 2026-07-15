import type {
  DeploymentEnvironment,
  DeploymentPolicy,
  DeploymentWorkbenchCapabilities,
  DeploymentWorkbenchInput,
  MetadataSelection,
  WorkbenchStrategy,
} from '@sfcc/shared';

export type SourceMode = 'org_compare' | 'scm';
export type WizardStep =
  | 'source'
  | 'components'
  | 'dependencies'
  | 'quality'
  | 'review'
  | 'execute';

export interface CompareItem {
  fullName: string;
  metadataType: string;
  diffType: 'new' | 'changed' | 'deleted' | 'same' | 'unknown';
}

export interface CompareSummary {
  total: number;
  new: number;
  changed: number;
  deleted: number;
  same: number;
  unknown: number;
}

export interface WorkbenchForm {
  name: string;
  description: string;
  sourceMode: SourceMode;
  sourceOrgId: string;
  targetOrgId: string;
  targetProfile: DeploymentEnvironment;
  comparisonId?: string;
  strategy: WorkbenchStrategy;
  components: MetadataSelection[];
  destructiveSelections: MetadataSelection[];
  dependencyPolicy: DeploymentWorkbenchInput['dependencyPolicy'];
  policy: DeploymentPolicy;
  chainedDataEnabled: boolean;
  chainedDataStopOnError: boolean;
  chainedDataJson: string;
}

export interface WorkbenchPreview {
  normalized: unknown;
  policy: DeploymentPolicy;
  stages: WorkbenchStage[];
  capabilities: DeploymentWorkbenchCapabilities;
  executionAvailable: boolean;
  readOnly?: boolean;
  sourceResolution?: {
    type: SourceMode;
    mode: string;
    manifest: string;
    apiVersion: string;
    selectedComponents: number;
  };
  dependencies?: {
    nodes: DependencyGraph['nodes'];
    edges: DependencyGraph['edges'];
    missing: Array<{ nodeId: string; requiredBy?: string[]; explanation?: string }>;
    cycles: string[][];
    reasons: Array<{ nodeId: string; decision: string; reason: string }>;
    decisions: Array<{ nodeId: string; decision: string; reason: string }>;
    blocking: string[];
    summary: Record<string, number | boolean>;
    resolvedSelections: MetadataSelection[];
    batches: unknown[];
    batchEstimate: Record<string, number>;
  };
}

export interface WorkbenchStatus {
  id: string;
  status: string;
  currentStage: string | null;
  validationId: string | null;
  approvalRequired: boolean;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job?: { id: string; status: string; currentStep?: string; error?: string | null } | null;
}

export interface WorkbenchStage {
  id?: string;
  key: string;
  ordinal: number;
  required: boolean;
  status: string;
  summary?: Record<string, unknown> | null;
  artifacts?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
}

export interface WorkbenchIssue {
  id: string;
  engine: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  component?: string | null;
  file?: string | null;
  line?: number | null;
}

export interface WorkbenchTestResult {
  id: string;
  className: string;
  methodName: string;
  status: string;
  durationMs?: number | null;
  message?: string | null;
  stackTrace?: string | null;
  diagnostics?: unknown;
}

export interface WorkbenchAudit {
  id: string;
  action: string;
  actorId: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkbenchResults {
  id: string;
  status: string;
  summary?: Record<string, unknown> | null;
  artifacts?: Record<string, unknown> | null;
  validationId?: string | null;
  stages: WorkbenchStage[];
  issues: WorkbenchIssue[];
  testResults: WorkbenchTestResult[];
  audits: WorkbenchAudit[];
}

export interface WorkbenchProgress {
  id: string;
  status: string;
  currentStage: string | null;
  intelligentRunId?: string;
  batches: Array<{
    id: string;
    batchNumber: number;
    status: string;
    componentCount?: number;
    error?: string | null;
  }>;
  completedBatches: number;
  totalBatches: number;
  resumable: boolean;
}

export interface DeploymentHistoryRow {
  id: string;
  name?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  strategy: string;
  environment: DeploymentEnvironment;
  source: { type: SourceMode; label: string };
  target: { id: string; alias?: string; username?: string | null };
  owner: { id: string; displayName?: string; email?: string };
  durationMs: number;
  stageCounts: Record<string, number>;
  validation: { id?: string | null; status: string };
  coverage?: number | null;
  gateOutcome: 'passed' | 'blocked' | 'cancelled' | 'pending';
  summary?: Record<string, unknown> | null;
  detailLinks: { status: string; stages: string; results: string };
}

export interface DeploymentHistoryResponse {
  items: DeploymentHistoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DeploymentHistoryFilters {
  page: number;
  pageSize: number;
  source: '' | SourceMode;
  target: string;
  environment: '' | DeploymentEnvironment;
  status: string;
  dateFrom: string;
  dateTo: string;
  owner: string;
}

export interface DependencyGraph {
  nodes: Array<{
    id: string;
    metadataType?: string;
    member?: string;
    selected?: boolean;
    filePath?: string;
  }>;
  edges: Array<{ from: string; to: string; explanation?: string }>;
}

export type ApexTestPolicy = DeploymentPolicy['tests'];
export type { DeploymentWorkbenchCapabilities };
