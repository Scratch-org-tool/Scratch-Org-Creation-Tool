import type { MetadataRepository } from '../repository/metadata-repository';
import type { DeploymentBatch, DeploymentPlan, PlanMetrics } from '../types/plan';
import { DEFAULT_PLANNER_CONFIG, componentWeight, type PlannerConfig } from './planner-config';
import { GraphEngine } from '../graph/graph-engine';

export class DeploymentPlanner {
  constructor(private readonly config: PlannerConfig = DEFAULT_PLANNER_CONFIG) {}

  buildPlan(runId: string, repo: MetadataRepository, graphEngine: GraphEngine): DeploymentPlan {
    const order = graphEngine.topologicalOrder();
    const nodes = repo.allNodes();
    const sorted = order ?? nodes.map((n) => n.id).sort((a, b) => {
      const na = repo.getNode(a)!;
      const nb = repo.getNode(b)!;
      if (na.priority !== nb.priority) return na.priority - nb.priority;
      return a.localeCompare(b);
    });

    const batches = this.createBatches(sorted, repo);
    const sccGroups = graphEngine.findCycles();
    const metrics = this.computeMetrics(repo, batches);

    return {
      runId,
      totalNodes: nodes.length,
      batches,
      estimatedDurationMs: metrics.estimatedDurationMs,
      criticalPath: sorted.slice(0, Math.min(10, sorted.length)),
      sccGroups,
      metrics,
    };
  }

  private createBatches(sortedIds: string[], repo: MetadataRepository): DeploymentBatch[] {
    const batches: DeploymentBatch[] = [];
    let current: string[] = [];
    let currentWeight = 0;
    let batchNumber = 1;

    const flush = () => {
      if (current.length === 0) return;
      batches.push({
        batchNumber,
        nodeIds: [...current],
        tempManifestPath: '',
        estimatedWeight: currentWeight,
        status: 'pending',
      });
      batchNumber += 1;
      current = [];
      currentWeight = 0;
    };

    for (const id of sortedIds) {
      const node = repo.getNode(id);
      if (!node || node.deploymentState === 'DEPLOYED' || node.deploymentState === 'SKIPPED') continue;

      const w = componentWeight(node.metadataType, this.config);
      const wouldExceed =
        current.length >= this.config.maxBatchSize ||
        currentWeight + w > this.config.maxBatchWeight;

      if (wouldExceed && current.length >= this.config.minBatchSize) flush();

      current.push(id);
      currentWeight += w;
      node.deploymentState = 'QUEUED';
      node.batchNumber = batchNumber;
    }
    flush();
    return batches;
  }

  private computeMetrics(repo: MetadataRepository, batches: DeploymentBatch[]): PlanMetrics {
    const nodes = repo.allNodes();
    return {
      totalNodes: nodes.length,
      readyCount: nodes.filter((n) => n.deploymentState === 'READY').length,
      deployedCount: nodes.filter((n) => n.deploymentState === 'DEPLOYED').length,
      failedCount: nodes.filter((n) => n.deploymentState === 'FAILED').length,
      skippedCount: nodes.filter((n) => n.deploymentState === 'SKIPPED').length,
      batchCount: batches.length,
      estimatedDurationMs: nodes.length * this.config.estimatedMsPerComponent,
    };
  }
}
