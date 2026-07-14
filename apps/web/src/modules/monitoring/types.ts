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
