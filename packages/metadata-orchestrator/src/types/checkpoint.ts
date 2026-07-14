import type { DependencySource } from './deployment-state';

export interface EdgeMeta {
  from: string;
  to: string;
  source: DependencySource;
  confidence: number;
}

export interface DeployCheckpoint {
  runId: string;
  lastCompletedBatch: number;
  deployedNodeIds: string[];
  pendingNodeIds: string[];
  graphSnapshotVersion: number;
  learnedEdges: EdgeMeta[];
  projectRoot: string;
  manifestPath: string;
  mode: import('./deploy-source').DeploySourceMode;
}
