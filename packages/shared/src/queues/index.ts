import { QUEUE_NAMES } from '../constants.js';
import type { ScratchOrgWizardConfig } from '../types/index.js';

function envInt(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DATA_DEPLOY_LOCK_DURATION_MS = 4 * 60 * 60 * 1000;
export const SFDMU_LOCK_DURATION_MS = 4 * 60 * 60 * 1000;

export interface BaseJobPayload {
  runId?: string;
  userId: string;
}

export interface ScratchOrgCreatePayload extends BaseJobPayload {
  config: ScratchOrgWizardConfig;
  step: string;
}

export interface MetadataDeployPayload extends BaseJobPayload {
  orgAlias: string;
  metadataPath?: string;
  manifestPath?: string;
  testLevel?: string;
  sourceOrgId?: string;
  sourceOrgAlias?: string;
  deployMode?: 'azure' | 'org_to_org' | 'local_workspace';
  intelligentDeployEnabled?: boolean;
  intelligentDeployRunId?: string;
  deploymentId?: string;
  automationRunId?: string;
}

export interface SfdmuRunPayload extends BaseJobPayload {
  sourceOrgAlias: string;
  targetOrgAlias: string;
  configPath: string;
}

export interface DataDeployPayload extends BaseJobPayload {
  sourceOrgId: string;
  targetOrgId: string;
  objectName: string;
  soql?: string;
}

export interface UserProvisionPayload extends BaseJobPayload {
  orgId: string;
  batchId: string;
  users: Array<{
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    profile?: string;
    role?: string;
    permissionSets?: string[];
  }>;
}

export interface OrgSetupPayload extends BaseJobPayload {
  orgId: string;
  setupType: string;
  config: Record<string, unknown>;
}

export interface AiAnalysisPayload extends BaseJobPayload {
  agentType: string;
  query: string;
  context?: Record<string, unknown>;
  sessionId?: string;
}

export type QueueJobPayload =
  | ScratchOrgCreatePayload
  | MetadataDeployPayload
  | SfdmuRunPayload
  | DataDeployPayload
  | UserProvisionPayload
  | OrgSetupPayload
  | AiAnalysisPayload;

export const METADATA_DEPLOY_LOCK_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Deploy-type jobs (metadata deploy, data deploy, SFDMU) are NOT auto-retried:
 * a partially applied deploy re-run blindly against the same target can duplicate
 * records or redeploy failed metadata. Retries must be explicit (operator-driven).
 */
export const QUEUE_CONFIG = {
  [QUEUE_NAMES.SCRATCH_ORG_CREATE]: { concurrency: 2, attempts: 2, backoff: 5000 },
  [QUEUE_NAMES.METADATA_DEPLOY]: {
    concurrency: 3,
    attempts: 1,
    backoff: 3000,
    lockDuration: METADATA_DEPLOY_LOCK_DURATION_MS,
    stalledInterval: 60_000,
  },
  [QUEUE_NAMES.SFDMU_RUN]: {
    concurrency: envInt('SFDMU_RUN_CONCURRENCY', 2),
    attempts: 1,
    backoff: 5000,
    lockDuration: SFDMU_LOCK_DURATION_MS,
    stalledInterval: 60_000,
  },
  [QUEUE_NAMES.DATA_DEPLOY]: {
    concurrency: envInt('DATA_DEPLOY_CONCURRENCY', 2),
    attempts: 1,
    backoff: 5000,
    lockDuration: DATA_DEPLOY_LOCK_DURATION_MS,
    stalledInterval: 60_000,
  },
  [QUEUE_NAMES.CONA_SEED]: {
    concurrency: 1,
    attempts: 1,
    backoff: 5000,
    lockDuration: DATA_DEPLOY_LOCK_DURATION_MS,
    stalledInterval: 60_000,
  },
  [QUEUE_NAMES.ACCOUNT_PARTNER_IMPORT]: {
    concurrency: 1,
    attempts: 1,
    backoff: 5000,
    lockDuration: DATA_DEPLOY_LOCK_DURATION_MS,
    stalledInterval: 60_000,
  },
  [QUEUE_NAMES.USER_PROVISION]: { concurrency: 3, attempts: 3, backoff: 2000 },
  [QUEUE_NAMES.ORG_SETUP]: { concurrency: 3, attempts: 3, backoff: 3000 },
  [QUEUE_NAMES.AI_ANALYSIS]: { concurrency: 5, attempts: 2, backoff: 2000 },
} as const;
