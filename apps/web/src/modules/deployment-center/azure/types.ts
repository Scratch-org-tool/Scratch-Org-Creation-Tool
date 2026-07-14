export type TestLevel = 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';

export interface Org {
  id: string;
  alias: string;
}

export interface AzureRepo {
  id: string;
  name: string;
  project: string;
}

export interface AzureStatus {
  connected: boolean;
  orgSlug?: string | null;
  project?: string | null;
}

export interface AzureDefaults {
  manifestPath: string;
  project?: string;
  repo?: string;
  branch?: string;
}

export interface DeploymentJob {
  id: string;
  status: string;
  currentStep: string;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
}

export interface DeploymentRow {
  id: string;
  repo: string;
  branch: string;
  status: string;
  strategy: string;
  createdAt: string;
  sourceOrgId?: string | null;
  jobId?: string | null;
  metadata?: { error?: string; manifestPath?: string; deployMode?: string } | null;
  job?: DeploymentJob | null;
  targetOrg?: { alias: string; username?: string | null } | null;
  sourceOrg?: { alias: string; username?: string | null } | null;
}

export interface JobData {
  id: string;
  status: string;
  currentStep?: string;
  error?: string | null;
  logs?: Array<{ line: string; stream?: string }>;
  startedAt?: string | null;
  finishedAt?: string | null;
  logsTruncated?: boolean;
  logCount?: number;
}

export const AZURE_LOG_TAIL = 500;

export interface AzureDeployForm {
  targetOrgId: string;
  repo: string;
  branch: string;
  project: string;
  manifestPath: string;
  testLevel: TestLevel;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ClassifiedLog {
  line: string;
  level: LogLevel;
}

export type DeployPhase =
  | 'connecting'
  | 'fetching'
  | 'deploying'
  | 'completed'
  | 'failed';

export const DEPLOY_PHASES = [
  { id: 'connecting' as const, label: 'Connecting to Azure DevOps', shortName: 'Connect' },
  { id: 'fetching' as const, label: 'Fetching Repository', shortName: 'Fetch' },
  { id: 'deploying' as const, label: 'Deploying Metadata', shortName: 'Deploy' },
  { id: 'completed' as const, label: 'Deployment Completed', shortName: 'Done' },
];

export const TEST_LEVEL_OPTIONS: { value: TestLevel; label: string }[] = [
  { value: 'NoTestRun', label: 'No Test Run' },
  { value: 'RunSpecifiedTests', label: 'Run Specified Tests' },
  { value: 'RunLocalTests', label: 'Run Local Tests' },
  { value: 'RunAllTestsInOrg', label: 'Run All Tests In Org' },
];

export const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];
export const ACTIVE_STATUSES = ['running', 'queued', 'pending'];

export type HistoryFilter = 'all' | 'running' | 'success' | 'failed' | 'cancelled';
