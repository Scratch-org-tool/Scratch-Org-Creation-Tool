import type { DeployError, DeployErrorClass } from '../types/deployment-state';
import type { MetadataRepository } from '../repository/metadata-repository';
import type { DeploymentPlan } from '../types/plan';
import type { DeployCheckpoint } from '../types/checkpoint';

export interface SfDeployComponentFailure {
  componentType?: string;
  fullName?: string;
  problem?: string;
  problemType?: string;
}

export interface SfDeployResult {
  success: boolean;
  componentFailures?: SfDeployComponentFailure[];
  numberComponentsDeployed?: number;
  numberComponentErrors?: number;
}

export interface BatchDeployOutcome {
  batchNumber: number;
  success: boolean;
  deployedNodeIds: string[];
  failedNodeIds: string[];
  durationMs: number;
  rawResult?: unknown;
}

export class FailureAnalyzer {
  analyzeBatchFailures(
    outcome: BatchDeployOutcome,
    repo: MetadataRepository,
    failures: SfDeployComponentFailure[],
  ): Array<{ nodeId: string; error: DeployError; suggestedDependency?: string }> {
    const results: Array<{ nodeId: string; error: DeployError; suggestedDependency?: string }> = [];

    for (const f of failures) {
      const type = f.componentType ?? 'Unknown';
      const name = f.fullName ?? 'Unknown';
      const nodeId = `${type}:${name}`;
      const error = this.classifyError(f.problem ?? 'Unknown error', f.problemType);
      let suggestedDependency: string | undefined;

      if (error.class === 'MISSING_DEPENDENCY' || error.class === 'REFERENCE_ERROR') {
        suggestedDependency = error.missingComponentId ?? this.inferMissingFromMessage(f.problem ?? '');
        if (suggestedDependency && repo.getNode(nodeId)) {
          const from = nodeId;
          const to = suggestedDependency.includes(':')
            ? suggestedDependency
            : `CustomObject:${suggestedDependency}`;
          if (from !== to) {
            repo.addLearnedEdge(from, to);
            suggestedDependency = to;
          }
        }
      }

      repo.markFailed(nodeId, error);
      results.push({ nodeId, error, suggestedDependency });
    }

    for (const id of outcome.failedNodeIds) {
      if (!results.some((r) => r.nodeId === id)) {
        repo.markFailed(id, { class: 'UNKNOWN', message: 'Batch deploy failed' });
      }
    }

    return results;
  }

  classifyError(message: string, problemType?: string): DeployError {
    const lower = message.toLowerCase();
    let cls: DeployErrorClass = 'UNKNOWN';

    if (lower.includes('no such column') || lower.includes('invalid cross reference') || lower.includes('does not exist')) {
      cls = 'MISSING_DEPENDENCY';
    } else if (lower.includes('compile error') || lower.includes('syntax error')) {
      cls = 'COMPILE_ERROR';
    } else if (lower.includes('reference') || lower.includes('dependent')) {
      cls = 'REFERENCE_ERROR';
    } else if (lower.includes('insufficient access') || lower.includes('permission')) {
      cls = 'PERMISSION_ISSUE';
    } else if (lower.includes('unknown') && lower.includes('metadata')) {
      cls = 'UNKNOWN_METADATA';
    } else if (lower.includes('timeout') || lower.includes('connection')) {
      cls = 'TRANSIENT';
    } else if (problemType?.toLowerCase().includes('dependency')) {
      cls = 'MISSING_DEPENDENCY';
    }

    return {
      class: cls,
      message,
      missingComponentId: this.inferMissingFromMessage(message),
    };
  }

  private inferMissingFromMessage(message: string): string | undefined {
    const patterns = [
      /No such column '([^']+)'/i,
      /Invalid cross reference id for ([A-Za-z0-9_.]+)/i,
      /dependent class is invalid and needs recompilation:\s*Class\s+([A-Za-z0-9_]+)/i,
      /Variable does not exist:\s*([A-Za-z0-9_]+)/i,
      /Object\s+([A-Za-z0-9_]+)\s+does not exist/i,
    ];
    for (const p of patterns) {
      const m = message.match(p);
      if (m?.[1]) return m[1];
    }
    return undefined;
  }

  buildRetryQueue(
    _plan: DeploymentPlan,
    repo: MetadataRepository,
    maxRetries: number,
  ): string[] {
    const retry: string[] = [];
    for (const node of repo.allNodes()) {
      if (node.deploymentState === 'FAILED' && node.retryCount < maxRetries) {
        const err = node.lastError;
        if (err && (err.class === 'MISSING_DEPENDENCY' || err.class === 'REFERENCE_ERROR' || err.class === 'TRANSIENT')) {
          retry.push(node.id);
        }
      }
    }
    return retry;
  }
}

export const failureAnalyzer = new FailureAnalyzer();

export function parseSfDeployResult(data: unknown): SfDeployResult {
  if (!data || typeof data !== 'object') return { success: false };
  const obj = data as Record<string, unknown>;
  const result = (obj.result ?? obj) as Record<string, unknown>;
  const details = result.details as Record<string, unknown> | undefined;
  const componentFailures = (details?.componentFailures ?? result.componentFailures) as
    | SfDeployComponentFailure[]
    | undefined;

  const success =
    result.success === true ||
    result.status === 'Succeeded' ||
    (result.numberComponentErrors === 0 && result.numberComponentsDeployed !== undefined);

  return {
    success: Boolean(success),
    componentFailures: Array.isArray(componentFailures) ? componentFailures : undefined,
    numberComponentsDeployed: Number(result.numberComponentsDeployed ?? 0),
    numberComponentErrors: Number(result.numberComponentErrors ?? 0),
  };
}

export function checkpointFromPlan(
  runId: string,
  plan: DeploymentPlan,
  repo: MetadataRepository,
  projectRoot: string,
  manifestPath: string,
  mode: DeployCheckpoint['mode'],
  lastCompletedBatch: number,
): DeployCheckpoint {
  const deployed = repo.allNodes().filter((n) => n.deploymentState === 'DEPLOYED').map((n) => n.id);
  const pending = repo.allNodes()
    .filter((n) => n.deploymentState !== 'DEPLOYED' && n.deploymentState !== 'SKIPPED')
    .map((n) => n.id);

  return {
    runId,
    lastCompletedBatch,
    deployedNodeIds: deployed,
    pendingNodeIds: pending,
    graphSnapshotVersion: 1,
    learnedEdges: repo.getLearnedEdges(),
    projectRoot,
    manifestPath,
    mode,
  };
}
