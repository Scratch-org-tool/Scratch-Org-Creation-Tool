import { JOB_STATUS, ORG_TYPES, PERSONAS, DEPLOYMENT_STRATEGIES } from '../constants.js';

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
export type OrgType = (typeof ORG_TYPES)[keyof typeof ORG_TYPES];
export type Persona = (typeof PERSONAS)[keyof typeof PERSONAS];
export type DeploymentStrategy = (typeof DEPLOYMENT_STRATEGIES)[keyof typeof DEPLOYMENT_STRATEGIES];

export interface OrgConnection {
  id: string;
  alias: string;
  type: OrgType;
  instanceUrl: string;
  username: string;
  orgId: string;
  isDevHub: boolean;
  status: 'active' | 'expired' | 'revoked';
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  intent: string;
  persona: Persona;
  status: JobStatus;
  createdBy: string;
  jobs: Job[];
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  queue: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  parentRunId?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  createdAt: string;
}

export interface JobLog {
  id: string;
  jobId: string;
  timestamp: string;
  stream: 'stdout' | 'stderr';
  line: string;
}

export interface Deployment {
  id: string;
  sourceOrg?: string;
  targetOrg: string;
  repo: string;
  branch: string;
  strategy: DeploymentStrategy;
  status: JobStatus;
  approvedBy?: string;
  createdAt: string;
}

export interface DataMovement {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  objectName: string;
  soql?: string;
  recordCount?: number;
  sfdmuConfig?: Record<string, unknown>;
  status: JobStatus;
  createdAt: string;
}

export interface ScratchOrgCreateConfig {
  alias: string;
  duration: number;
  devHubAlias: string;
  definitionFile?: string;
  template?: string;
  skipSteps?: Array<'installPackages' | 'deployMetadata' | 'assignPermissions'>;
}

export type ScratchOrgWizardConfig = ScratchOrgCreateConfig;

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  timestamp: string;
}

export interface AgentSession {
  id: string;
  userId: string;
  agentType: string;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface StreamEvent {
  type:
    | 'job_log'
    | 'job_status'
    | 'job_skip'
    | 'job_failed'
    | 'auth_status'
    | 'copilot_chunk'
    | 'deployment_stage'
    | 'deployment_result';
  payload: Record<string, unknown>;
  timestamp: string;
  /** Owning app-user id — SSE events are only delivered to their owner (admins see all). */
  ownerId?: string;
}
