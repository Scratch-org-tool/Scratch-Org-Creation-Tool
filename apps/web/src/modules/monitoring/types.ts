export type MonitoringDays = 7 | 14 | 30;

export interface MonitoringJobRow {
  id: string;
  type: string;
  status: string;
  queue: string;
  createdAt: string;
  startedAt: string | null;
  displayName: string;
  durationMs: number | null;
  completedAt: string | null;
  triggeredBy: string;
  automationRunId: string | null;
  runIntent: string | null;
}

export interface SparklinePoint {
  date: string;
  count: number;
}

export interface MonitoringOverview {
  days: number;
  jobStats: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    pending: number;
    queued: number;
  };
  trends: {
    totalJobs: number | null;
    completed: number | null;
    failed: number | null;
    running: number | null;
    deployments: number | null;
  };
  sparklines: SparklinePoint[];
  sparklinesCompleted: SparklinePoint[];
  sparklinesFailed: SparklinePoint[];
  recentJobs: MonitoringJobRow[];
}

export interface MonitoringLogLine {
  stream: string;
  line: string;
  timestamp: string;
}

export type JobStatusFilter = 'all' | 'completed' | 'failed' | 'running';

export interface JobDetailLogLine {
  stream: string;
  line: string;
  timestamp: string;
}

export interface JobDetailAudit {
  id: string;
  action: string;
  status: string;
  componentCount: number | null;
  components: unknown;
  error: string | null;
  testLevel: string | null;
  createdAt: string;
}

export interface JobDetailResponse {
  job: {
    id: string;
    type: string;
    status: string;
    queue: string;
    alias: string | null;
    error: string | null;
    currentStep: string;
    createdBy: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
    payload: unknown;
    logs: JobDetailLogLine[];
    logsTruncated: boolean;
    logCount: number;
  };
  deployment: {
    id: string;
    status: string;
    repo: string;
    branch: string;
    strategy: string;
    sourceOrgId: string | null;
    targetOrgId: string;
    sourceOrgAlias: string | null;
    targetOrgAlias: string | null;
    validationId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  } | null;
  audits: JobDetailAudit[];
  automationRun: {
    id: string;
    intent: string;
    status: string;
    createdBy: string;
  } | null;
  siblingJobs: Array<{
    id: string;
    type: string;
    status: string;
    alias: string | null;
  }>;
  summary: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    deployedComponents: number;
    changedComponents: number;
    newComponents: number;
    deletedComponents: number;
  };
}
