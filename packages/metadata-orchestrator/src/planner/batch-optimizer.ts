import type { DeploymentBatch, DeploymentPlan } from '../types/plan';
import type { PlannerConfig } from './planner-config';
import { DEFAULT_PLANNER_CONFIG, componentWeight } from './planner-config';

export class BatchOptimizer {
  constructor(private readonly config: PlannerConfig = DEFAULT_PLANNER_CONFIG) {}

  optimize(plan: DeploymentPlan): DeploymentPlan {
    const merged = this.mergeSmallBatches(plan.batches);
  return {
      ...plan,
      batches: merged,
      metrics: {
        ...plan.metrics,
        batchCount: merged.length,
      },
    };
  }

  private mergeSmallBatches(batches: DeploymentBatch[]): DeploymentBatch[] {
    if (batches.length <= 1) return batches;

    const result: DeploymentBatch[] = [];
    let pending: DeploymentBatch | null = null;

    for (const batch of batches) {
      if (!pending) {
        pending = { ...batch, nodeIds: [...batch.nodeIds] };
        continue;
      }

      const combinedWeight: number = pending.estimatedWeight + batch.estimatedWeight;
      const combinedSize = pending.nodeIds.length + batch.nodeIds.length;
      const shouldMerge =
        pending.nodeIds.length < this.config.minBatchSize * 2 &&
        combinedSize <= this.config.maxBatchSize &&
        combinedWeight <= this.config.maxBatchWeight;

      if (shouldMerge) {
        pending = {
          ...pending,
          nodeIds: [...pending.nodeIds, ...batch.nodeIds],
          estimatedWeight: combinedWeight,
        };
      } else {
        result.push(this.renumber(pending, result.length + 1));
        pending = { ...batch, nodeIds: [...batch.nodeIds] };
      }
    }
    if (pending) result.push(this.renumber(pending, result.length + 1));
    return result;
  }

  private renumber(batch: DeploymentBatch, batchNumber: number): DeploymentBatch {
    return { ...batch, batchNumber, tempManifestPath: batch.tempManifestPath };
  }
}

/** Tune batch sizes for large manifests */
export function tunePlannerForManifestSize(nodeCount: number): PlannerConfig {
  if (nodeCount > 5000) {
    return {
      ...DEFAULT_PLANNER_CONFIG,
      maxBatchSize: 75,
      maxBatchWeight: 300,
      estimatedMsPerComponent: 2500,
    };
  }
  if (nodeCount > 1000) {
    return {
      ...DEFAULT_PLANNER_CONFIG,
      maxBatchSize: 60,
      maxBatchWeight: 250,
    };
  }
  return DEFAULT_PLANNER_CONFIG;
}
