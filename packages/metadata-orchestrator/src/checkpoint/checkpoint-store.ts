import type { DeployCheckpoint } from '../types/checkpoint';
import type { MetadataRepository } from '../repository/metadata-repository';

export interface CheckpointPersistence {
  save(checkpoint: DeployCheckpoint): Promise<void>;
  load(runId: string): Promise<DeployCheckpoint | null>;
}

export class CheckpointStore {
  private readonly memory = new Map<string, DeployCheckpoint>();

  constructor(private readonly persistence?: CheckpointPersistence) {}

  async save(checkpoint: DeployCheckpoint): Promise<void> {
    this.memory.set(checkpoint.runId, { ...checkpoint });
    await this.persistence?.save(checkpoint);
  }

  async load(runId: string): Promise<DeployCheckpoint | null> {
    const mem = this.memory.get(runId);
    if (mem) return mem;
    return this.persistence?.load(runId) ?? null;
  }

  applyToRepository(checkpoint: DeployCheckpoint, repo: MetadataRepository): void {
    repo.applyLearnedEdges(checkpoint.learnedEdges);
    for (const id of checkpoint.deployedNodeIds) {
      repo.markDeployed(id, checkpoint.lastCompletedBatch, 0);
    }
    for (const id of checkpoint.pendingNodeIds) {
      const node = repo.getNode(id);
      if (node && node.deploymentState !== 'DEPLOYED') {
        node.deploymentState = 'READY';
      }
    }
  }

  getResumeBatchNumber(checkpoint: DeployCheckpoint): number {
    return checkpoint.lastCompletedBatch + 1;
  }
}

export const checkpointStore = new CheckpointStore();
