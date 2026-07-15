import type { SfCliClient } from '@sfcc/sf-cli';
import type { MetadataRepository } from '../repository/metadata-repository';
import type { DeploymentPlan, DeploymentBatch } from '../types/plan';
import { ManifestBuilder } from './manifest-builder';
import {
  failureAnalyzer,
  parseSfDeployResult,
  type BatchDeployOutcome,
  type SfDeployComponentFailure,
} from '../analyzer/failure-analyzer';
import { CheckpointStore } from '../checkpoint/checkpoint-store';
import { checkpointFromPlan } from '../analyzer/failure-analyzer';
import type { DeploySourceContext } from '../types/deploy-source';

export interface ExecutionCallbacks {
  onBatchStart?: (batch: DeploymentBatch, index: number, total: number) => void | Promise<void>;
  onBatchComplete?: (outcome: BatchDeployOutcome) => void | Promise<void>;
  onLog?: (stream: 'stdout' | 'stderr', line: string) => void | Promise<void>;
  isCancelled?: () => boolean | Promise<boolean>;
  registerKill?: (kill: () => void) => void;
  clearKill?: () => void;
}

export class ExecutionEngine {
  constructor(
    private readonly sfCli: SfCliClient,
    private readonly manifestBuilder: ManifestBuilder,
    private readonly checkpointStore: CheckpointStore,
  ) {}

  async executePlan(
    plan: DeploymentPlan,
    repo: MetadataRepository,
    source: DeploySourceContext,
    callbacks: ExecutionCallbacks,
    options?: {
      startBatch?: number;
      maxRetries?: number;
      testLevel?: string;
    },
  ): Promise<{ success: boolean; outcomes: BatchDeployOutcome[] }> {
    const outcomes: BatchDeployOutcome[] = [];
    const startBatch = options?.startBatch ?? 1;
    const maxRetries = options?.maxRetries ?? 3;
    const testLevel = options?.testLevel ?? source.testLevel ?? 'NoTestRun';

    for (let i = 0; i < plan.batches.length; i++) {
      const batch = plan.batches[i];
      if (batch.batchNumber < startBatch) continue;

      if (await callbacks.isCancelled?.()) {
        return { success: false, outcomes };
      }

      await callbacks.onBatchStart?.(batch, i + 1, plan.batches.length);
      batch.status = 'running';

      const started = Date.now();
      let attemptBatch = batch;
      let rawResult: unknown;

      while (true) {
        const manifestPath = this.manifestBuilder.buildBatchManifest(attemptBatch, repo);
        const deploy = this.sfCli.deployManifestCancellable(
          source.targetOrgAlias,
          manifestPath,
          testLevel,
        );
        callbacks.registerKill?.(deploy.kill);

        let result: Awaited<typeof deploy.promise>;
        try {
          result = await deploy.promise;
        } finally {
          callbacks.clearKill?.();
        }

        if (result.stdout) await callbacks.onLog?.('stdout', result.stdout);
        if (result.stderr) await callbacks.onLog?.('stderr', result.stderr);

        rawResult = result.data;
        const parsed = parseSfDeployResult(result.data ?? result.stdout);
        if (parsed.success) {
          for (const nodeId of attemptBatch.nodeIds) {
            repo.markDeployed(nodeId, batch.batchNumber, Date.now() - started);
            repo.decrementIndegreeForDependents(nodeId);
          }
          break;
        }

        const failures = parsed.componentFailures ?? this.extractFailuresFromStdout(result.stdout);
        failureAnalyzer.analyzeBatchFailures(
          {
            batchNumber: batch.batchNumber,
            success: false,
            deployedNodeIds: [],
            failedNodeIds: attemptBatch.nodeIds,
            durationMs: Date.now() - started,
            rawResult,
          },
          repo,
          failures,
        );

        const attemptedIds = new Set(attemptBatch.nodeIds);
        const retryNodeIds = failureAnalyzer
          .buildRetryQueue(plan, repo, maxRetries)
          .filter((nodeId) => attemptedIds.has(nodeId));
        if (retryNodeIds.length === 0) break;

        for (const nodeId of retryNodeIds) {
          const node = repo.getNode(nodeId);
          if (node) node.deploymentState = 'RETRYING';
        }
        attemptBatch = {
          ...batch,
          nodeIds: retryNodeIds,
          tempManifestPath: '',
          status: 'running',
        };
      }

      const durationMs = Date.now() - started;
      const deployedNodeIds = batch.nodeIds.filter(
        (nodeId) => repo.getNode(nodeId)?.deploymentState === 'DEPLOYED',
      );
      const failedNodeIds = batch.nodeIds.filter(
        (nodeId) => repo.getNode(nodeId)?.deploymentState !== 'DEPLOYED',
      );
      const batchSucceeded = failedNodeIds.length === 0;
      batch.status = batchSucceeded ? 'completed' : 'failed';

      const outcome: BatchDeployOutcome = {
        batchNumber: batch.batchNumber,
        success: batchSucceeded,
        deployedNodeIds,
        failedNodeIds,
        durationMs,
        rawResult,
      };
      outcomes.push(outcome);
      await callbacks.onBatchComplete?.(outcome);

      const checkpoint = checkpointFromPlan(
        plan.runId,
        plan,
        repo,
        source.projectRoot,
        source.manifestPath,
        source.mode,
        batchSucceeded ? batch.batchNumber : Math.max(0, batch.batchNumber - 1),
      );
      await this.checkpointStore.save(checkpoint);

      if (!batchSucceeded) {
        return { success: false, outcomes };
      }
    }

    return { success: true, outcomes };
  }

  private extractFailuresFromStdout(stdout: string): SfDeployComponentFailure[] {
    try {
      const start = stdout.indexOf('{');
      if (start < 0) return [];
      const data = JSON.parse(stdout.slice(start)) as Record<string, unknown>;
      const parsed = parseSfDeployResult(data);
      return parsed.componentFailures ?? [];
    } catch {
      return [];
    }
  }
}
