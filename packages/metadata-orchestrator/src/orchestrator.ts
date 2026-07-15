import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SfCliClient } from '@sfcc/sf-cli';
import { MetadataRepository } from './repository/metadata-repository';
import { packageParser } from './parser/package-parser';
import { sourceScanner } from './scanner/source-scanner';
import { dependencyDiscoveryEngine } from './discovery/dependency-engine';
import { DeploymentPlanner } from './planner/deployment-planner';
import { BatchOptimizer, tunePlannerForManifestSize } from './planner/batch-optimizer';
import { ManifestBuilder } from './executor/manifest-builder';
import { ExecutionEngine, type ExecutionCallbacks } from './executor/execution-engine';
import { CheckpointStore } from './checkpoint/checkpoint-store';
import type { OrchestratorRunContext } from './types/deploy-source';
import type { FinalReport } from './types/plan';
import type { MetadataNode } from './types/metadata-node';

export interface IntelligentOrchestratorOptions {
  sfCli: SfCliClient;
  checkpointStore?: CheckpointStore;
  workDir?: string;
}

export class IntelligentOrchestrator {
  private readonly checkpointStore: CheckpointStore;
  private readonly workDir: string;
  private readonly ownsWorkDir: boolean;

  constructor(private readonly options: IntelligentOrchestratorOptions) {
    this.checkpointStore = options.checkpointStore ?? new CheckpointStore();
    this.ownsWorkDir = !options.workDir;
    this.workDir =
      options.workDir ??
      path.join(os.tmpdir(), 'sfcc-intelligent-deploy', randomUUID());
    fs.mkdirSync(this.workDir, { recursive: true });
  }

  async run(ctx: OrchestratorRunContext, callbacks: ExecutionCallbacks = {}): Promise<FinalReport> {
    try {
      return await this.executeRun(ctx, callbacks);
    } finally {
      if (this.ownsWorkDir) {
        fs.rmSync(this.workDir, { recursive: true, force: true });
      }
    }
  }

  private async executeRun(
    ctx: OrchestratorRunContext,
    callbacks: ExecutionCallbacks,
  ): Promise<FinalReport> {
    const started = Date.now();
    const repo = new MetadataRepository();
    const source = ctx.source;

    const manifestAbs = source.manifestAbsolutePath;
    const parsed = packageParser.parseFile(manifestAbs);
    const components = sourceScanner.expandWildcards(parsed.members, source.projectRoot);

    for (const comp of components) {
      repo.getOrCreate(comp.metadataType, comp.apiName, { filePath: comp.filePath });
    }

    if (ctx.resumeCheckpoint) {
      this.checkpointStore.applyToRepository(ctx.resumeCheckpoint, repo);
    }

    const targetOrgProfile =
      ctx.targetOrgProfile ?? ctx.source.targetOrgProfile ?? 'incremental';

    const graphEngine = dependencyDiscoveryEngine.discover(repo, components, {
      projectRoot: source.projectRoot,
      targetOrgProfile,
    });

    if (ctx.resumeCheckpoint?.learnedEdges?.length) {
      repo.applyLearnedEdges(ctx.resumeCheckpoint.learnedEdges);
    }

    const config = tunePlannerForManifestSize(repo.size());
    const planner = new DeploymentPlanner(config);
    let plan = planner.buildPlan(ctx.runId, repo, graphEngine);
    plan = new BatchOptimizer(config).optimize(plan);
    await callbacks.onPlan?.(plan, repo.allNodes());

    const manifestBuilder = new ManifestBuilder(
      path.join(this.workDir, 'manifests'),
      source.apiVersion ?? parsed.apiVersion ?? '62.0',
    );
    const engine = new ExecutionEngine(this.options.sfCli, manifestBuilder, this.checkpointStore);

    const startBatch = ctx.resumeCheckpoint
      ? this.checkpointStore.getResumeBatchNumber(ctx.resumeCheckpoint)
      : 1;

    const { success, outcomes } = await engine.executePlan(
      plan,
      repo,
      source,
      callbacks,
      {
        startBatch,
        maxRetries: ctx.maxRetriesPerNode ?? 3,
        testLevel: source.testLevel,
        tests: source.tests,
      },
    );

    const nodes: MetadataNode[] = repo.allNodes();
    const deployedCount = nodes.filter((n) => n.deploymentState === 'DEPLOYED').length;
    const failedCount = nodes.filter((n) => n.deploymentState === 'FAILED').length;
    const skippedCount = nodes.filter((n) => n.deploymentState === 'SKIPPED').length;

    return {
      runId: ctx.runId,
      success,
      deployedCount,
      failedCount,
      skippedCount,
      totalBatches: plan.batches.length,
      durationMs: Date.now() - started,
      learnedEdges: repo.getLearnedEdges().length,
      errors: nodes
        .filter((n) => n.lastError)
        .map((n) => ({ nodeId: n.id, message: n.lastError!.message })),
    };
  }

  getCheckpointStore(): CheckpointStore {
    return this.checkpointStore;
  }
}

export function createIntelligentOrchestrator(options: IntelligentOrchestratorOptions): IntelligentOrchestrator {
  return new IntelligentOrchestrator(options);
}
