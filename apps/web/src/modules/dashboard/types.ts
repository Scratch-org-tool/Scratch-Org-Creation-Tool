export type DashboardDays = 7 | 14 | 30;

export interface DashboardJobStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  pending: number;
  queued: number;
}

export interface DashboardTrends {
  totalJobs: number | null;
  completed: number | null;
  failed: number | null;
  running: number | null;
  deployments: number | null;
}

export interface SparklinePoint {
  date: string;
  count: number;
}

export interface DurationPoint {
  date: string;
  avgMs: number;
}

export interface StatusDistribution {
  completed: number;
  failed: number;
  running: number;
  cancelled: number;
  pending: number;
  queued: number;
}

export interface RecentDeployment {
  id: string;
  status: string;
  repo: string | null;
  branch: string | null;
  strategy: string | null;
  createdAt: string;
  targetOrgAlias: string | null;
  jobType: string | null;
  jobId: string | null;
}

export interface DashboardHealth {
  avgJobDurationMs: number;
  apiOnline: boolean;
  redisConnected: boolean;
  aiProvider: string;
  successRate: number;
  failureRate: number;
  activeOrgs: number;
  queueDepth: number;
  lastChecked: string;
}

export interface DashboardData {
  days: number;
  jobStats: DashboardJobStats;
  orgCount: number;
  deploymentCount: number;
  avgJobDurationMs: number;
  trends: DashboardTrends;
  sparklines: SparklinePoint[];
  statusDistribution: StatusDistribution;
  durationSeries: DurationPoint[];
  recentDeployments: RecentDeployment[];
  recentJobs: Array<{
    id: string;
    type: string;
    status: string;
    queue: string;
    createdAt: string;
  }>;
  health: DashboardHealth;
}
