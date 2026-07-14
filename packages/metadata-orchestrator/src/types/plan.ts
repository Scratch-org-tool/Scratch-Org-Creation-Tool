import type { DeploymentState } from './deployment-state';

export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface PlanMetrics {
  totalNodes: number;
  readyCount: number;
  deployedCount: number;
  failedCount: number;
  skippedCount: number;
  batchCount: number;
  estimatedDurationMs: number;
}

export interface DeploymentBatch {
  batchNumber: number;
  nodeIds: string[];
  tempManifestPath: string;
  estimatedWeight: number;
  status: BatchStatus;
}

export interface DeploymentPlan {
  runId: string;
  totalNodes: number;
  batches: DeploymentBatch[];
  estimatedDurationMs: number;
  criticalPath: string[];
  sccGroups: string[][];
  metrics: PlanMetrics;
}

export interface OrchestratorProgress {
  runId: string;
  currentBatch: number;
  totalBatches: number;
  deployedCount: number;
  totalNodes: number;
  state: DeploymentState | 'running' | 'completed' | 'failed';
  message: string;
}

export interface FinalReport {
  runId: string;
  success: boolean;
  deployedCount: number;
  failedCount: number;
  skippedCount: number;
  totalBatches: number;
  durationMs: number;
  learnedEdges: number;
  errors: Array<{ nodeId: string; message: string }>;
}
