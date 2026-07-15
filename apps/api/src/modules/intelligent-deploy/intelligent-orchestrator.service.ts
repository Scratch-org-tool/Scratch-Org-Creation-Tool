import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { prisma, Prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  createIntelligentOrchestrator,
  CheckpointStore,
  type DeployCheckpoint,
  type DeploySourceContext,
  type DeploySourceMode,
  type CheckpointPersistence,
  type FinalReport,
  type ExecutionCallbacks,
  type TargetOrgProfile,
} from '@sfcc/metadata-orchestrator';
import {
  normalizeGitSourceConfig,
  type AzureDeployConfig,
  type GitSourceConfig,
} from '@sfcc/shared';
import { bootstrapOrgToOrgWorkspace } from '../../integrations/azure/org-to-org-workspace.util';
import { removeTempDir } from '../../common/temp-cleanup.util';
import { resolveSfdxWorkspace } from '../../common/sfdx-workspace.util';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';

export interface ResolvedDeployWorkspace {
  mode: DeploySourceMode;
  projectRoot: string;
  manifestRelative: string;
  manifestAbsolutePath: string;
  cleanup?: () => Promise<void>;
}

export interface DeploySourceResolveInput {
  orgAlias: string;
  sourceOrgAlias?: string;
  deployMode?: 'git' | 'azure' | 'org_to_org' | 'local_workspace';
  gitSource?: GitSourceConfig;
  azureDeploy?: AzureDeployConfig;
  manifestPath?: string;
  manifestContent?: string;
  localProjectRoot?: string;
  intelligentDeployRunId?: string;
}

@Injectable()
export class DeploySourceResolver {
  constructor(private readonly scmSources: ScmSourceService) {}

  async resolve(input: DeploySourceResolveInput): Promise<ResolvedDeployWorkspace> {
    const mode = this.resolveMode(input);
    const gitSource = normalizeGitSourceConfig({
      gitSource: input.gitSource,
      azureDeploy: input.azureDeploy,
    }).gitSource;

    if (mode === 'local_workspace') {
      if (!input.localProjectRoot) {
        throw new Error('localProjectRoot is required for local_workspace mode');
      }
      const manifest = input.manifestPath ?? 'manifest/package.xml';
      const { projectRoot, manifestRelative } = resolveSfdxWorkspace(
        input.localProjectRoot,
        manifest,
      );
      return {
        mode,
        projectRoot,
        manifestRelative,
        manifestAbsolutePath: path.join(projectRoot, manifestRelative),
      };
    }

    if (mode === 'org_to_org_manifest') {
      if (!input.sourceOrgAlias) {
        throw new Error('sourceOrgAlias is required for org_to_org deploy');
      }

      let workDir: string;
      let cleanup: (() => Promise<void>) | undefined;
      const manifest = input.manifestPath ?? 'manifest/package.xml';

      if (gitSource) {
        const checkout = await this.scmSources.checkout(gitSource);
        workDir = checkout.workspaceDir;
        cleanup = checkout.cleanup;
      } else {
        workDir = await mkdtemp(path.join(tmpdir(), 'sfcc-org-retrieve-'));
        cleanup = () => removeTempDir(workDir);
      }

      try {
        if (input.manifestContent) {
          const bootstrapped = bootstrapOrgToOrgWorkspace(workDir, input.manifestContent);
          const sfCli = createSfCliClient({ cwd: workDir });
          const retrieve = await sfCli.retrieveManifest(
            input.sourceOrgAlias,
            bootstrapped.manifestRelative,
          );
          if (!retrieve.success) {
            throw new Error(retrieve.error ?? 'Metadata retrieve from source org failed');
          }
          return {
            mode,
            projectRoot: bootstrapped.projectRoot,
            manifestRelative: bootstrapped.manifestRelative,
            manifestAbsolutePath: bootstrapped.manifestAbsolutePath,
            cleanup,
          };
        }

        const { manifestRelative } = resolveSfdxWorkspace(workDir, manifest);
        const sfCli = createSfCliClient({ cwd: workDir });
        const retrieve = await sfCli.retrieveManifest(
          input.sourceOrgAlias,
          manifestRelative,
        );
        if (!retrieve.success) {
          throw new Error(retrieve.error ?? 'Metadata retrieve from source org failed');
        }

        return {
          mode,
          projectRoot: workDir,
          manifestRelative,
          manifestAbsolutePath: path.join(workDir, manifestRelative),
          cleanup,
        };
      } catch (error) {
        await cleanup?.();
        throw error;
      }
    }

    if (!gitSource) {
      throw new Error('gitSource repo and branch are required');
    }
    const manifest =
      input.manifestPath ??
      gitSource.manifestPath ??
      process.env.AZURE_DEFAULT_MANIFEST_PATH ??
      'manifest/package.xml';

    const checkout = await this.scmSources.checkout(gitSource);
    try {
      const { projectRoot, manifestRelative } = resolveSfdxWorkspace(
        checkout.workspaceDir,
        manifest,
      );
      return {
        // DeploySourceMode predates provider-neutral SCM; this value describes
        // manifest-from-git semantics and is retained for persisted run compatibility.
        mode: 'azure_manifest',
        projectRoot,
        manifestRelative,
        manifestAbsolutePath: path.join(projectRoot, manifestRelative),
        cleanup: checkout.cleanup,
      };
    } catch (error) {
      await checkout.cleanup();
      throw error;
    }
  }

  private resolveMode(input: DeploySourceResolveInput): DeploySourceMode {
    if (input.deployMode === 'local_workspace' || input.localProjectRoot) return 'local_workspace';
    if (input.deployMode === 'org_to_org' || input.sourceOrgAlias) return 'org_to_org_manifest';
    return 'azure_manifest';
  }
}

@Injectable()
export class IntelligentOrchestratorService {
  async runIntelligentDeploy(options: {
    runId: string;
    workspace: ResolvedDeployWorkspace;
    orgAlias: string;
    testLevel?: string;
    tests?: string[];
    apiVersion?: string;
    deploymentId?: string;
    automationRunId?: string;
    createdBy?: string;
    resumeCheckpoint?: DeployCheckpoint;
    callbacks: ExecutionCallbacks;
    registerKill: (kill: () => void) => void;
    clearKill: () => void;
    targetOrgProfile?: TargetOrgProfile;
  }): Promise<FinalReport> {
    const persistence = this.createPrismaPersistence(options.runId);
    const checkpointStore = new CheckpointStore(persistence);

    await prisma.intelligentDeployRun.upsert({
      where: { id: options.runId },
      create: {
        id: options.runId,
        deploymentId: options.deploymentId,
        projectRoot: options.workspace.projectRoot,
        manifestPath: options.workspace.manifestRelative,
        deployMode: options.workspace.mode,
        status: 'running',
        createdBy: options.createdBy ?? 'system',
      },
      update: { status: 'running' },
    });

    const source: DeploySourceContext = {
      mode: options.workspace.mode,
      projectRoot: options.workspace.projectRoot,
      manifestPath: options.workspace.manifestRelative,
      manifestAbsolutePath: options.workspace.manifestAbsolutePath,
      targetOrgAlias: options.orgAlias,
      testLevel: options.testLevel,
      tests: options.tests,
      apiVersion: options.apiVersion,
      targetOrgProfile: options.targetOrgProfile,
    };

    const sfCli = createSfCliClient({ cwd: options.workspace.projectRoot });
    const intelligentWorkDir = path.join(tmpdir(), 'sfcc-intelligent-deploy', options.runId);
    fs.mkdirSync(intelligentWorkDir, { recursive: true });
    const orchestrator = createIntelligentOrchestrator({
      sfCli,
      checkpointStore,
      workDir: intelligentWorkDir,
    });

    let report: FinalReport;
    try {
      report = await orchestrator.run(
        {
          runId: options.runId,
          source,
          deploymentId: options.deploymentId,
          automationRunId: options.automationRunId,
          resumeCheckpoint: options.resumeCheckpoint,
          targetOrgProfile: options.targetOrgProfile,
        },
        {
          ...options.callbacks,
          registerKill: options.registerKill,
          clearKill: options.clearKill,
          onPlan: async (plan, nodes) => {
            await options.callbacks.onPlan?.(plan, nodes);
            await prisma.intelligentDeployRun.update({
              where: { id: options.runId },
              data: { plan: plan as unknown as Prisma.InputJsonValue },
            });
            for (const node of nodes) {
              await prisma.intelligentDeployNode.upsert({
                where: {
                  runId_nodeKey: { runId: options.runId, nodeKey: node.id },
                },
                create: {
                  runId: options.runId,
                  nodeKey: node.id,
                  metadataType: node.metadataType,
                  apiName: node.apiName,
                  deploymentState: node.deploymentState,
                  batchNumber: node.batchNumber,
                  retryCount: node.retryCount,
                },
                update: {
                  deploymentState: node.deploymentState,
                  batchNumber: node.batchNumber,
                  retryCount: node.retryCount,
                },
              });
            }
          },
          onBatchStart: async (batch, index, total) => {
            await options.callbacks.onBatchStart?.(batch, index, total);
            await prisma.intelligentDeployBatch.upsert({
              where: { runId_batchNumber: { runId: options.runId, batchNumber: batch.batchNumber } },
              create: {
                runId: options.runId,
                batchNumber: batch.batchNumber,
                nodeCount: batch.nodeIds.length,
                status: 'running',
                manifestPath: batch.tempManifestPath,
              },
              update: { status: 'running', nodeCount: batch.nodeIds.length },
            });
          },
          onBatchComplete: async (outcome) => {
            await options.callbacks.onBatchComplete?.(outcome);
            await prisma.$transaction([
              prisma.intelligentDeployBatch.update({
                where: { runId_batchNumber: { runId: options.runId, batchNumber: outcome.batchNumber } },
                data: {
                  status: outcome.success ? 'completed' : 'failed',
                  durationMs: outcome.durationMs,
                },
              }),
              prisma.intelligentDeployNode.updateMany({
                where: { runId: options.runId, nodeKey: { in: outcome.deployedNodeIds } },
                data: { deploymentState: 'DEPLOYED', batchNumber: outcome.batchNumber },
              }),
              prisma.intelligentDeployNode.updateMany({
                where: { runId: options.runId, nodeKey: { in: outcome.failedNodeIds } },
                data: { deploymentState: 'FAILED', batchNumber: outcome.batchNumber },
              }),
            ]);
          },
        },
      );
    } finally {
      await removeTempDir(intelligentWorkDir);
    }

    await prisma.intelligentDeployRun.update({
      where: { id: options.runId },
      data: {
        status: report.success ? 'completed' : 'failed',
        metrics: report as unknown as Prisma.InputJsonValue,
      },
    });

    const checkpoint = await checkpointStore.load(options.runId);
    for (const edge of checkpoint?.learnedEdges ?? []) {
      await prisma.learnedDependency.upsert({
        where: {
          fromNodeKey_toNodeKey: {
            fromNodeKey: edge.from,
            toNodeKey: edge.to,
          },
        },
        create: {
          fromNodeKey: edge.from,
          toNodeKey: edge.to,
          source: edge.source,
          confidence: edge.confidence,
        },
        update: {
          source: edge.source,
          confidence: edge.confidence,
          hitCount: { increment: 1 },
        },
      });
    }

    if (options.deploymentId) {
      const existing = await prisma.deployment.findUnique({
        where: { id: options.deploymentId },
        select: { metadata: true },
      });
      const meta = (existing?.metadata ?? {}) as Record<string, unknown>;
      await prisma.deployment.update({
        where: { id: options.deploymentId },
        data: {
          // The metadata worker may still need to assign permissions or queue
          // chained data work. Only the outer worker may mark success terminal.
          ...(!report.success ? { status: 'failed' as const } : {}),
          metadata: {
            ...meta,
            intelligentDeployRunId: options.runId,
            deployMode: options.workspace.mode,
            planSummary: {
              totalNodes: report.deployedCount + report.failedCount + report.skippedCount,
              batchCount: report.totalBatches,
            },
            metrics: {
              deployed: report.deployedCount,
              failed: report.failedCount,
              skipped: report.skippedCount,
            },
          } as Prisma.InputJsonValue,
        },
      });
    }

    if (options.automationRunId) {
      const run = await prisma.automationRun.findUnique({ where: { id: options.automationRunId } });
      const cp = (run?.checkpoint ?? {}) as Record<string, unknown>;
      await prisma.automationRun.update({
        where: { id: options.automationRunId },
        data: {
          checkpoint: {
            ...cp,
            intelligentDeployRunId: options.runId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return report;
  }

  async getRun(runId: string) {
    return prisma.intelligentDeployRun.findUnique({
      where: { id: runId },
      include: { batches: { orderBy: { batchNumber: 'asc' } }, nodes: true },
    });
  }

  /** Owner-scoped lookup for API consumers ('system' runs are visible to any authenticated user). */
  async getRunForUser(runId: string, userId: string) {
    const run = await this.getRun(runId);
    if (!run || (run.createdBy !== 'system' && run.createdBy !== userId)) {
      throw new NotFoundException('Intelligent deploy run not found');
    }
    return run;
  }

  private createPrismaPersistence(runId: string): CheckpointPersistence {
    return {
      save: async (checkpoint: DeployCheckpoint) => {
        await prisma.intelligentDeployRun.update({
          where: { id: runId },
          data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
        });
      },
      load: async (id: string) => {
        const row = await prisma.intelligentDeployRun.findUnique({ where: { id } });
        return (row?.checkpoint as DeployCheckpoint | null) ?? null;
      },
    };
  }
}

export function isIntelligentDeployEnabled(): boolean {
  const flag = process.env.INTELLIGENT_DEPLOY_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

export async function resolveTargetOrgProfile(
  orgAlias: string,
  automationRunId?: string,
): Promise<TargetOrgProfile> {
  if (automationRunId) return 'greenfield';

  const org = await prisma.orgConnection.findFirst({
    where: { OR: [{ alias: orgAlias }, { username: orgAlias }] },
    select: { type: true },
  });
  return org?.type === 'scratch' ? 'greenfield' : 'incremental';
}
