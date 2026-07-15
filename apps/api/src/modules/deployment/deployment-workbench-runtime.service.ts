import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import {
  DEFAULT_METADATA_API_VERSION,
  buildDestructiveChangesXml,
  buildPackageXml,
  deploymentPolicySchema,
  evaluateDeploymentQualityGate,
  parsePackageXml,
  type DeploymentPolicy,
  type DeploymentSource,
  type MetadataSelection,
  type StaticAnalysisIssue,
} from '@sfcc/shared';
import {
  DeploymentPlanner,
  BatchOptimizer,
  GraphEngine,
  MetadataRepository,
  dependencyDiscoveryEngine,
  packageParser,
  sourceScanner,
  tunePlannerForManifestSize,
  type DeployCheckpoint,
  type MetadataNode,
} from '@sfcc/metadata-orchestrator';
import { IntelligentOrchestratorService } from '../intelligent-deploy/intelligent-orchestrator.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { JobsService } from '../jobs/jobs.service';
import { StreamService } from '../stream/stream.service';
import { MetadataDeployJobService } from './metadata-deploy-job.service';
import { StaticAnalysisService } from './static-analysis.service';
import { bootstrapOrgToOrgWorkspace } from '../../integrations/azure/org-to-org-workspace.util';
import { MetadataDataChainService } from '../metadata/metadata-data-chain.service';
import { DeploymentArtifactStore } from './deployment-artifact.store';

type StageKey =
  | 'source'
  | 'dependencies'
  | 'snapshot'
  | 'static_analysis'
  | 'validation'
  | 'apex_tests'
  | 'intelligent_plan'
  | 'approval'
  | 'deploy'
  | 'quick_deploy'
  | 'chained_data'
  | 'rollback_ready';

interface WorkbenchJobData {
  workbenchRunId: string;
  dbJobId: string;
}

export interface WorkbenchWorkspace {
  projectRoot: string;
  manifestRelative: string;
  manifestAbsolutePath: string;
  mode: 'azure_manifest' | 'org_to_org_manifest' | 'local_workspace';
  cleanup?: () => Promise<void>;
}

interface ParsedDeploy {
  id?: string;
  success: boolean;
  componentFailures: Array<Record<string, unknown>>;
  tests: Array<{
    className: string;
    methodName: string;
    status: 'passed' | 'failed' | 'skipped';
    durationMs?: number;
    message?: string;
    stackTrace?: string;
  }>;
  coverage?: number;
  coverageDetails: Array<Record<string, unknown>>;
  raw: unknown;
}

class WorkbenchStageError extends Error {
  constructor(
    readonly stage: StageKey,
    message: string,
  ) {
    super(message);
    this.name = 'WorkbenchStageError';
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

@Injectable()
export class DeploymentWorkbenchRuntimeService {
  constructor(
    private readonly intelligent: IntelligentOrchestratorService,
    private readonly staticAnalysis: StaticAnalysisService,
    private readonly jobs: JobsService,
    private readonly stream: StreamService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly deployJobs: MetadataDeployJobService,
    private readonly dataChain: MetadataDataChainService,
    private readonly artifactStore: DeploymentArtifactStore,
  ) {}

  async process(data: WorkbenchJobData) {
    const run = await prisma.deploymentQualityRun.findUnique({
      where: { id: data.workbenchRunId },
      include: { stages: { orderBy: { ordinal: 'asc' } } },
    });
    if (!run) throw new Error('Deployment workbench run not found');
    if (['cancelled', 'rejected', 'passed'].includes(run.status)) {
      return { workbenchRunId: run.id, status: run.status, idempotent: true };
    }
    const artifacts = record(run.artifacts);
    const execution = record(artifacts.execution);
    if (execution.jobId && execution.jobId !== data.dbJobId) {
      return { workbenchRunId: run.id, status: run.status, staleJob: true };
    }
    const job = await prisma.job.findUnique({
      where: { id: data.dbJobId },
      select: { createdBy: true, status: true },
    });
    if (!job || job.createdBy !== run.createdBy) {
      throw new Error('Workbench queue ownership mismatch');
    }

    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    const source = run.source as unknown as DeploymentSource;
    const target = await prisma.orgConnection.findUnique({ where: { id: run.targetOrgId } });
    if (!target || target.createdBy !== run.createdBy) {
      throw new Error('Workbench target org is unavailable');
    }
    const targetAlias = target.username ?? target.alias;
    if (!targetAlias) throw new Error('Workbench target org has no Salesforce alias');

    const claimed = await prisma.deploymentQualityRun.updateMany({
      where: { id: run.id, status: { notIn: ['cancelled', 'rejected', 'passed'] } },
      data: { status: 'running' },
    });
    if (claimed.count !== 1) {
      return { workbenchRunId: run.id, status: 'cancelled', staleJob: true };
    }
    await this.audit(run.id, 'execution_started', run.createdBy, { jobId: data.dbJobId });

    let workspace: WorkbenchWorkspace | undefined;
    let currentStage: StageKey = 'source';
    try {
      const sourceContext = await this.resolveSource(run, data);
      workspace = sourceContext.workspace;
      const apiVersion = sourceContext.apiVersion;
      await this.invalidateChangedSource(run.id, sourceContext.digest);
      await this.passStage(run.id, 'source', sourceContext.summary, {
        digest: sourceContext.digest,
        manifestHash: hashFile(workspace.manifestAbsolutePath),
        manifest: workspace.manifestRelative,
        apiVersion,
      });

      let dependencyPreview: ReturnType<typeof buildDependencyPreview> | undefined;
      if (run.stages.some((stage) => stage.key === 'dependencies')) {
        currentStage = 'dependencies';
        await this.startStage(run.id, currentStage);
        dependencyPreview = buildDependencyPreview(
          run.id,
          workspace,
          run.dependencyPolicy as Record<string, unknown>,
          target.type === 'scratch' ? 'greenfield' : 'incremental',
        );
        if (dependencyPreview.blocking.length) {
          throw new WorkbenchStageError('dependencies', dependencyPreview.blocking.join('; '));
        }
        const approvedSelectionHash = stringValue(record(record(run.artifacts).source).selectionHash);
        if (!approvedSelectionHash || stableHash(dependencyPreview.resolvedSelections) !== approvedSelectionHash) {
          throw new WorkbenchStageError(
            'dependencies',
            'Dependency resolution differs from the immutable approved source',
          );
        }
        await this.passStage(run.id, 'dependencies', dependencyPreview.summary, {
          graph: dependencyPreview.graph,
          decisions: dependencyPreview.decisions,
          missing: dependencyPreview.missing,
          cycles: dependencyPreview.cycles,
          plan: dependencyPreview.plan,
        });
      }

      const deploymentId = await this.ensureCompatibilityDeployment(run, source);

      if (run.stages.some((stage) => stage.key === 'snapshot')) {
        currentStage = 'snapshot';
        if (!(await this.stagePassed(run.id, currentStage))) {
          await this.startStage(run.id, currentStage);
          const snapshot = await this.captureSnapshot(
            run.id,
            deploymentId,
            targetAlias,
            workspace.manifestAbsolutePath,
            run.destructiveSelections as unknown as MetadataSelection[],
            apiVersion,
            data,
          );
          if (!snapshot && policy.snapshot.required) {
            throw new WorkbenchStageError('snapshot', 'Required target snapshot could not be created');
          }
          await this.passStage(run.id, currentStage, {
            created: Boolean(snapshot),
            rollbackCoverage: 'existing selected components and destructive deletion targets',
            netNewCleanupRequired: true,
          }, snapshot ? {
            snapshotArtifactId: snapshot,
            warning: 'Rollback restores pre-existing metadata; net-new components require explicit destructive cleanup.',
          } : undefined);
        }
      }

      if (run.stages.some((stage) => stage.key === 'static_analysis')) {
        currentStage = 'static_analysis';
        if (!(await this.stagePassed(run.id, currentStage))) {
          await this.startStage(run.id, currentStage);
          const analysis = await this.staticAnalysis.run({
            projectRoot: workspace.projectRoot,
            engines: policy.staticAnalysis.engines,
            registerKill: (kill) => this.registerKill(data.dbJobId, kill),
            clearKill: () => this.clearKill(data.dbJobId),
            persistArtifact: (engine, content) => this.artifactStore.putBytes(
              'static-analysis',
              Buffer.from(content, 'utf8'),
              { runId: run.id, engine },
            ),
          });
          await this.replaceIssues(run.id, currentStage, analysis.issues);
          const counts = countSeverities(analysis.issues);
          const gate = evaluateDeploymentQualityGate({
            ...policy,
            validation: { required: false },
            tests: { level: 'NoTestRun', tests: [], minimumCoverage: 0 },
            approval: { ...policy.approval, required: false },
            snapshot: { required: false, rollbackRequired: false },
          }, { staticCounts: counts });
          const summary = {
            counts,
            availableEngines: analysis.availableEngines,
            unavailableEngines: analysis.unavailableEngines,
            skippedEngines: analysis.skippedEngines,
            timedOut: analysis.timedOut,
            engineResults: analysis.engineResults,
            gate: policy.staticAnalysis.blockMode === 'never' && analysis.issues.length
              ? 'warned'
              : gate.passed
                ? 'passed'
                : 'blocked',
          };
          const engineFailure = analysis.engineResults.find((engine) =>
            ['unavailable', 'timed_out', 'crashed'].includes(engine.status));
          if (engineFailure || (!gate.passed && policy.staticAnalysis.blockMode !== 'never')) {
            const error = engineFailure
              ? `Required static analysis engine ${engineFailure.engine} ${engineFailure.status}`
              : 'Static analysis quality gate blocked deployment';
            await this.failStage(run.id, currentStage, error, summary);
            throw new WorkbenchStageError(currentStage, error);
          }
          await this.passStage(run.id, currentStage, summary, {
            reports: analysis.artifacts.map(({ engine, checksum, artifactId }) => ({
              engine,
              checksum,
              artifactId,
            })),
          });
        }
      }

      let validation = await this.readValidation(run.id);
      if (run.stages.some((stage) => stage.key === 'validation') && !validation) {
        currentStage = 'validation';
        await this.startStage(run.id, currentStage);
        validation = await this.runDeployCommand({
          runId: run.id,
          stage: currentStage,
          dbJobId: data.dbJobId,
          targetAlias,
          workspace,
          policy,
          dryRun: true,
          destructiveSelections: run.destructiveSelections as unknown as MetadataSelection[],
          apiVersion,
        });
        await this.persistDeployResult(run.id, currentStage, validation);
        const testsFailed = validation.tests.filter((test) => test.status === 'failed').length;
        const validationGate = evaluateDeploymentQualityGate({
          ...policy,
          approval: { ...policy.approval, required: false },
          snapshot: { required: false, rollbackRequired: false },
          staticAnalysis: { ...policy.staticAnalysis, enabled: false },
        }, {
          validationPassed: validation.success && validation.componentFailures.length === 0,
          testsRun: validation.tests.length,
          testsFailed,
          coverage: validation.coverage,
        });
        if (!validationGate.passed) {
          await this.failStage(run.id, currentStage, validationGate.blockedBy.map((item) => item.message).join('; '), {
            gate: validationGate,
          });
          throw new WorkbenchStageError(currentStage, validationGate.blockedBy.map((item) => item.message).join('; '));
        }
        await prisma.deploymentQualityRun.update({
          where: { id: run.id },
          data: { validationId: validation.id },
        });
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: { validationId: validation.id },
        });
        await this.passStage(run.id, currentStage, deploySummary(validation), {
          validationId: validation.id,
          sourceDigest: sourceContext.digest,
          raw: validation.raw,
        });
      }

      if (run.stages.some((stage) => stage.key === 'apex_tests')) {
        currentStage = 'apex_tests';
        if (!(await this.stagePassed(run.id, currentStage))) {
          await this.startStage(run.id, currentStage);
          if (!validation) {
            throw new WorkbenchStageError(currentStage, 'Apex tests were not produced by full-package validation');
          }
          const failed = validation.tests.filter((test) => test.status === 'failed').length;
          if (!validation.tests.length || failed || (validation.coverage ?? 0) < policy.tests.minimumCoverage) {
            throw new WorkbenchStageError(currentStage, 'Apex test or coverage policy failed');
          }
          await this.passStage(run.id, currentStage, {
            level: policy.tests.level,
            specifiedTests: policy.tests.tests,
            run: validation.tests.length,
            failed,
            coverage: validation.coverage,
            minimumCoverage: policy.tests.minimumCoverage,
          });
        }
      }

      if (run.stages.some((stage) => stage.key === 'intelligent_plan')) {
        currentStage = 'intelligent_plan';
        if (!(await this.stagePassed(run.id, currentStage))) {
          await this.startStage(run.id, currentStage);
          const preview = dependencyPreview ?? buildDependencyPreview(
            run.id,
            workspace,
            run.dependencyPolicy as Record<string, unknown>,
            target.type === 'scratch' ? 'greenfield' : 'incremental',
          );
          await this.passStage(run.id, currentStage, preview.plan.metrics, {
            batches: preview.plan.batches,
            nodes: preview.graph.nodes,
            edges: preview.graph.edges,
            cycles: preview.cycles,
          });
        }
      }

      if (run.stages.some((stage) => stage.key === 'approval')) {
        currentStage = 'approval';
        const refreshed = await prisma.deploymentQualityRun.findUnique({
          where: { id: run.id },
          select: { approvedAt: true, rejectedAt: true },
        });
        if (refreshed?.rejectedAt) {
          throw new WorkbenchStageError(currentStage, 'Deployment was rejected');
        }
        if (!refreshed?.approvedAt) {
          await prisma.deploymentQualityStage.updateMany({
            where: { runId: run.id, key: currentStage, status: { not: 'passed' } },
            data: { status: 'blocked' },
          });
          await prisma.deploymentQualityRun.update({
            where: { id: run.id },
            data: { status: 'awaiting_approval', currentStage },
          });
          await this.mergeArtifacts(run.id, {
            execution: {
              lastJobId: data.dbJobId,
              pausedAt: new Date().toISOString(),
              reason: 'approval',
            },
          });
          await this.emit(run.id, run.createdBy, 'deployment_stage', {
            stage: currentStage,
            status: 'blocked',
          });
          await this.audit(run.id, 'awaiting_approval', run.createdBy, {});
          return { workbenchRunId: run.id, status: 'awaiting_approval' };
        }
      }

      const mutationStage: StageKey = run.strategy === 'validate_then_quick' ? 'quick_deploy' : 'deploy';
      currentStage = mutationStage;
      if (!(await this.stagePassed(run.id, mutationStage))) {
        if (hasDestructive(run.destructiveSelections) && !(await this.destructiveReviewed(run.id, run.destructiveSelections, apiVersion))) {
          await prisma.deploymentQualityRun.updateMany({
            where: { id: run.id, status: { notIn: ['cancelled', 'rejected'] } },
            data: { status: 'awaiting_approval', currentStage: mutationStage },
          });
          await this.audit(run.id, 'awaiting_destructive_review', run.createdBy, {
            digest: destructiveDigest(run.destructiveSelections as unknown as MetadataSelection[], apiVersion),
          });
          return { workbenchRunId: run.id, status: 'awaiting_approval', reason: 'destructive_review' };
        }
        await this.startStage(run.id, mutationStage);
        if (await this.cancelled(data.dbJobId)) throw new WorkbenchStageError(mutationStage, 'Deployment cancelled');
        if (mutationStage === 'quick_deploy') {
          const validationId = validation?.id ?? run.validationId;
          if (!validationId) throw new WorkbenchStageError(mutationStage, 'Validation id is unavailable');
          const sf = createSfCliClient({ cwd: workspace.projectRoot });
          const quick = sf.quickDeployCancellable(targetAlias, validationId, { cwd: workspace.projectRoot });
          this.registerKill(data.dbJobId, quick.kill);
          const quickResult = await quick.promise.finally(() => this.clearKill(data.dbJobId));
          const parsed = parseDeployPayload(quickResult.data ?? quickResult.stdout);
          if (!quickResult.success || !parsed.success) {
            throw new WorkbenchStageError(mutationStage, quickResult.error ?? 'Quick deploy failed');
          }
          await this.passStage(run.id, mutationStage, deploySummary(parsed), {
            validationId,
            raw: parsed.raw,
          });
        } else if (run.strategy === 'intelligent' && !hasDestructive(run.destructiveSelections)) {
          const intelligentRunId = stringValue(record(record(run.artifacts).intelligent).runId) ?? randomUUID();
          const existing = await prisma.intelligentDeployRun.findUnique({ where: { id: intelligentRunId } });
          await this.mergeArtifacts(run.id, {
            intelligent: { runId: intelligentRunId, status: 'running' },
          });
          const report = await this.intelligent.runIntelligentDeploy({
            runId: intelligentRunId,
            workspace,
            orgAlias: targetAlias,
            testLevel: policy.tests.level,
            tests: policy.tests.tests,
            apiVersion,
            deploymentId,
            createdBy: run.createdBy,
            resumeCheckpoint: (existing?.checkpoint as DeployCheckpoint | null) ?? undefined,
            targetOrgProfile: target.type === 'scratch' ? 'greenfield' : 'incremental',
            approvedNodeIds: arrayOfStrings(
              record(record(run.artifacts).source).approvedNodeIds,
            ),
            expectedPlanHash: stringValue(record(record(run.artifacts).source).planHash),
            registerKill: (kill) => this.registerKill(data.dbJobId, kill),
            clearKill: () => this.clearKill(data.dbJobId),
            callbacks: {
              isCancelled: () => this.cancelled(data.dbJobId),
              onBatchStart: async (batch, index, total) => {
                await this.emit(run.id, run.createdBy, 'deployment_stage', {
                  stage: mutationStage,
                  status: 'running',
                  batch: index,
                  totalBatches: total,
                  nodeIds: batch.nodeIds,
                });
              },
            },
          });
          if (!report.success) {
            throw new WorkbenchStageError(mutationStage, `${report.failedCount} intelligent deployment component(s) failed`);
          }
          await this.mergeArtifacts(run.id, {
            intelligent: { runId: intelligentRunId, status: 'completed', report },
          });
          await this.passStage(run.id, mutationStage, report, { intelligentRunId });
        } else {
          const deployed = await this.runDeployCommand({
            runId: run.id,
            stage: mutationStage,
            dbJobId: data.dbJobId,
            targetAlias,
            workspace,
            policy,
            destructiveSelections: run.destructiveSelections as unknown as MetadataSelection[],
            apiVersion,
          });
          await this.persistDeployResult(run.id, mutationStage, deployed);
          if (!deployed.success) {
            throw new WorkbenchStageError(mutationStage, 'Metadata deployment failed');
          }
          await this.passStage(run.id, mutationStage, deploySummary(deployed), {
            raw: deployed.raw,
            destructiveReviewDigest: hasDestructive(run.destructiveSelections)
              ? destructiveDigest(run.destructiveSelections as unknown as MetadataSelection[], apiVersion)
              : undefined,
          });
        }
      }

      if (run.stages.some((stage) => stage.key === 'chained_data')) {
        currentStage = 'chained_data';
        if (!(await this.stagePassed(run.id, currentStage))) {
          await this.startStage(run.id, currentStage);
          const chained = record(run.chainedData);
          if (source.type !== 'org_compare') {
            throw new WorkbenchStageError(currentStage, 'Chained data deployment requires an org-to-org source');
          }
          const ids = await this.dataChain.runChainedDataDeploys({
            sourceOrgId: source.sourceOrgId,
            targetOrgId: run.targetOrgId,
            dataDeployConfig: (chained.config ?? []) as Array<{
              objectName: string;
              soql?: string;
              strategy?: 'insert' | 'upsert';
              matchField?: string;
            }>,
            createdBy: run.createdBy,
            onLog: (line) => this.log(data.dbJobId, 'stdout', line),
            awaitTerminal: true,
            sequential: chained.sequential !== false,
            stopOnError: chained.stopOnError !== false,
          });
          await this.passStage(run.id, currentStage, { jobIds: ids, completed: ids.length });
        }
      }

      if (run.stages.some((stage) => stage.key === 'rollback_ready')) {
        currentStage = 'rollback_ready';
        if (!(await this.stagePassed(run.id, currentStage))) {
          await this.startStage(run.id, currentStage);
          const deployment = await prisma.deployment.findUnique({
            where: { id: deploymentId },
            select: { snapshotPath: true },
          });
          if (!deployment?.snapshotPath && policy.snapshot.rollbackRequired) {
            throw new WorkbenchStageError(currentStage, 'Rollback snapshot is unavailable');
          }
          await this.passStage(run.id, currentStage, {
            ready: Boolean(deployment?.snapshotPath),
            warning: 'Rollback does not delete net-new components; review and approve a cleanup destructive manifest.',
            rollbackTestPolicy: policy.tests,
          });
        }
      }

      const finished = new Date();
      await prisma.deploymentQualityRun.updateMany({
        where: { id: run.id, status: { notIn: ['cancelled', 'rejected'] } },
        data: {
          status: 'passed',
          currentStage: null,
          summary: json({ passed: true, finishedAt: finished.toISOString() }),
        },
      });
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'completed' },
      }).catch(() => undefined);
      await this.audit(run.id, 'execution_passed', run.createdBy, { jobId: data.dbJobId });
      await this.emit(run.id, run.createdBy, 'deployment_result', { status: 'passed' });
      return { workbenchRunId: run.id, deploymentId, status: 'passed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cancelled = await this.cancelled(data.dbJobId);
      const terminal = await prisma.deploymentQualityRun.findUnique({
        where: { id: run.id },
        select: { status: true },
      });
      if (cancelled || terminal?.status === 'cancelled') {
        await this.cancelRun(run.id, currentStage, run.createdBy, data.dbJobId);
        return { workbenchRunId: run.id, status: 'cancelled' };
      }
      if (terminal?.status === 'rejected') {
        return { workbenchRunId: run.id, status: 'rejected' };
      }
      if (!(error instanceof WorkbenchStageError && await this.stageFailed(run.id, error.stage))) {
        await this.failStage(run.id, error instanceof WorkbenchStageError ? error.stage : currentStage, message);
      }
      await prisma.deploymentQualityRun.updateMany({
        where: { id: run.id, status: { notIn: ['cancelled', 'rejected'] } },
        data: {
          status: run.rejectedAt ? 'rejected' : 'failed',
          currentStage: error instanceof WorkbenchStageError ? error.stage : currentStage,
          summary: json({ passed: false, error: message }),
        },
      });
      await this.audit(run.id, 'execution_failed', run.createdBy, {
        jobId: data.dbJobId,
        stage: error instanceof WorkbenchStageError ? error.stage : currentStage,
        error: message,
      });
      await this.emit(run.id, run.createdBy, 'deployment_result', { status: 'failed', error: message });
      throw error;
    } finally {
      this.clearKill(data.dbJobId);
      await workspace?.cleanup?.().catch(() => undefined);
    }
  }

  private async resolveSource(
    run: {
      id: string;
      manifestXml: string | null;
      components: Prisma.JsonValue;
      apiVersion: string | null;
      createdBy: string;
      artifacts: Prisma.JsonValue | null;
    },
    data: WorkbenchJobData,
  ): Promise<{
    workspace: WorkbenchWorkspace;
    apiVersion: string;
    digest: string;
    summary: Record<string, unknown>;
  }> {
    await this.startStage(run.id, 'source');
    if (await this.cancelled(data.dbJobId)) throw new WorkbenchStageError('source', 'Deployment cancelled');
    const sourceArtifact = record(record(run.artifacts).source);
    const artifactId = stringValue(sourceArtifact.artifactId);
    const expectedDigest = stringValue(sourceArtifact.digest);
    const manifestRelative = stringValue(sourceArtifact.manifest);
    if (!artifactId || !expectedDigest || !manifestRelative) {
      throw new WorkbenchStageError('source', 'Pinned durable source artifact is unavailable');
    }
    const materialized = await this.artifactStore.materializeDirectory(
      artifactId,
      `sfcc-workbench-${run.id}-`,
    );
    const manifestAbsolutePath = path.resolve(materialized.root, manifestRelative);
    if (
      manifestAbsolutePath !== materialized.root
      && !manifestAbsolutePath.startsWith(`${materialized.root}${path.sep}`)
    ) {
      await materialized.cleanup();
      throw new WorkbenchStageError('source', 'Pinned source manifest path is unsafe');
    }
    if (!fs.existsSync(manifestAbsolutePath)) {
      await materialized.cleanup();
      throw new WorkbenchStageError('source', 'Pinned source manifest is missing');
    }
    const manifestContent = fs.readFileSync(manifestAbsolutePath, 'utf8');
    const manifest = parsePackageXml(manifestContent);
    const apiVersion = manifest.apiVersion ?? run.apiVersion ?? DEFAULT_METADATA_API_VERSION;
    if (
      hashFile(manifestAbsolutePath) !== sourceArtifact.manifestHash
      || stableHash(manifest.selections) !== sourceArtifact.selectionHash
      || artifactId.slice(artifactId.indexOf(':') + 1) !== expectedDigest
    ) {
      await materialized.cleanup();
      throw new WorkbenchStageError('source', 'Pinned source checksum does not match the approved plan');
    }
    const workspace: WorkbenchWorkspace = {
      projectRoot: materialized.root,
      manifestRelative,
      manifestAbsolutePath,
      mode: sourceArtifact.mode === 'org_to_org_manifest'
        ? 'org_to_org_manifest'
        : sourceArtifact.mode === 'local_workspace'
          ? 'local_workspace'
          : 'azure_manifest',
      cleanup: materialized.cleanup,
    };
    return {
      workspace,
      apiVersion,
      digest: expectedDigest,
      summary: {
        mode: workspace.mode,
        apiVersion,
        selectedComponents: manifest.members.length,
        digest: expectedDigest,
        commitSha: sourceArtifact.commitSha,
      },
    };
  }

  private async ensureCompatibilityDeployment(
    run: {
      id: string;
      deploymentId: string | null;
      targetOrgId: string;
      strategy: string;
      createdBy: string;
      name: string | null;
    },
    source: DeploymentSource,
  ): Promise<string> {
    if (run.deploymentId) return run.deploymentId;
    const deployment = await prisma.deployment.create({
      data: {
        targetOrgId: run.targetOrgId,
        sourceOrgId: source.type === 'org_compare' ? source.sourceOrgId : undefined,
        repo: source.type === 'scm' ? source.repo : 'org-to-org',
        branch: source.type === 'scm' ? source.branch : 'metadata',
        strategy: 'azure',
        status: 'running',
        createdBy: run.createdBy,
        metadata: json({
          workbenchRunId: run.id,
          workbenchStrategy: run.strategy,
          name: run.name,
          compatibilityShim: true,
        }),
      },
    });
    const claimed = await prisma.deploymentQualityRun.updateMany({
      where: { id: run.id, deploymentId: null },
      data: { deploymentId: deployment.id },
    });
    if (claimed.count === 1) return deployment.id;
    const existing = await prisma.deploymentQualityRun.findUnique({
      where: { id: run.id },
      select: { deploymentId: true },
    });
    if (!existing?.deploymentId) throw new Error('Failed to attach compatibility deployment');
    return existing.deploymentId;
  }

  private async captureSnapshot(
    runId: string,
    deploymentId: string,
    targetAlias: string,
    manifestPath: string,
    destructiveSelections: MetadataSelection[],
    apiVersion: string,
    data: WorkbenchJobData,
  ): Promise<string | null> {
    const snapshotPath = fs.mkdtempSync(path.join(tmpdir(), `sfcc-snapshot-${deploymentId}-`));
    try {
      const selected = parsePackageXml(fs.readFileSync(manifestPath, 'utf8')).selections;
      const manifest = buildPackageXml(mergeSelections(selected, destructiveSelections), apiVersion);
      const bootstrapped = bootstrapOrgToOrgWorkspace(snapshotPath, manifest);
      const sf = createSfCliClient({ cwd: bootstrapped.projectRoot });
      const retrieve = await sf.retrieveManifest(targetAlias, bootstrapped.manifestRelative);
      if (await this.cancelled(data.dbJobId)) {
        throw new WorkbenchStageError('snapshot', 'Deployment cancelled');
      }
      const forceApp = path.join(snapshotPath, 'force-app');
      const hasSource = retrieve.success || (
        fs.existsSync(forceApp) && fs.readdirSync(forceApp, { recursive: true }).length > 1
      );
      if (!hasSource) return null;
      const artifactId = await this.artifactStore.putDirectory('deployment-snapshot', snapshotPath, {
        runId,
        deploymentId,
        manifestHash: createHash('sha256').update(manifest).digest('hex'),
        includesDestructiveRestoreScope: destructiveSelections.length > 0,
      });
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { snapshotPath: artifactId },
      });
      await this.mergeArtifacts(runId, { rollback: { snapshotArtifactId: artifactId } });
      return artifactId;
    } finally {
      fs.rmSync(snapshotPath, { recursive: true, force: true });
    }
  }

  private async runDeployCommand(input: {
    runId: string;
    stage: StageKey;
    dbJobId: string;
    targetAlias: string;
    workspace: WorkbenchWorkspace;
    policy: DeploymentPolicy;
    dryRun?: boolean;
    destructiveSelections?: MetadataSelection[];
    apiVersion?: string;
  }): Promise<ParsedDeploy> {
    let destructivePath: string | undefined;
    if (input.destructiveSelections?.length) {
      destructivePath = path.join(input.workspace.projectRoot, 'destructiveChanges.xml');
      const destructiveManifest = buildDestructiveChangesXml(
        input.destructiveSelections,
        input.apiVersion ?? DEFAULT_METADATA_API_VERSION,
      );
      fs.writeFileSync(
        destructivePath,
        destructiveManifest,
        'utf8',
      );
      const artifactId = await this.artifactStore.putBytes(
        'destructive-manifest',
        Buffer.from(destructiveManifest, 'utf8'),
        { runId: input.runId, stage: input.stage },
      );
      await this.mergeArtifacts(input.runId, {
        destructiveChanges: {
          digest: createHash('sha256').update(destructiveManifest).digest('hex'),
          artifactId,
          selections: input.destructiveSelections,
        },
      });
    }
    try {
      const sf = createSfCliClient({ cwd: input.workspace.projectRoot });
      const command = sf.deployManifestCancellable(
        input.targetAlias,
        input.workspace.manifestRelative,
        input.policy.tests.level,
        {
          tests: input.policy.tests.tests,
          dryRun: input.dryRun,
          postDestructiveChanges: destructivePath,
          cwd: input.workspace.projectRoot,
        },
      );
      this.registerKill(input.dbJobId, command.kill);
      const result = await command.promise.finally(() => this.clearKill(input.dbJobId));
      if (result.stdout) await this.log(input.dbJobId, 'stdout', result.stdout);
      if (result.stderr) await this.log(input.dbJobId, 'stderr', result.stderr);
      if (await this.cancelled(input.dbJobId)) {
        throw new WorkbenchStageError(input.stage, 'Deployment cancelled');
      }
      const parsed = parseDeployPayload(result.data ?? result.stdout);
      return { ...parsed, success: result.success && parsed.success };
    } finally {
      if (destructivePath) fs.rmSync(destructivePath, { force: true });
    }
  }

  private async persistDeployResult(runId: string, stage: StageKey, parsed: ParsedDeploy) {
    const stageRow = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key: stage } },
      select: { id: true },
    });
    if (!stageRow) return;
    await prisma.deploymentQualityIssue.deleteMany({
      where: { runId, stageId: stageRow.id, engine: 'salesforce' },
    });
    if (parsed.componentFailures.length) {
      await prisma.deploymentQualityIssue.createMany({
        data: parsed.componentFailures.map((failure) => ({
          runId,
          stageId: stageRow.id,
          engine: 'salesforce',
          ruleId: stringValue(failure.problemType) ?? 'COMPONENT_FAILURE',
          severity: 'error',
          message: stringValue(failure.problem) ?? 'Metadata component failed',
          component: [failure.componentType, failure.fullName].filter(Boolean).join(':') || undefined,
          file: stringValue(failure.fileName),
          line: positiveInt(failure.lineNumber),
          column: positiveInt(failure.columnNumber),
          metadata: json(failure),
        })),
      });
    }
    await prisma.deploymentQualityTestResult.deleteMany({ where: { runId } });
    if (parsed.tests.length) {
      await prisma.deploymentQualityTestResult.createMany({
        data: parsed.tests.map((test) => ({
          runId,
          stageId: stageRow.id,
          className: test.className,
          methodName: test.methodName,
          status: test.status,
          durationMs: test.durationMs,
          message: test.message,
          stackTrace: test.stackTrace,
          coverage: parsed.coverageDetails.length ? json(parsed.coverageDetails) : undefined,
        })),
      });
    }
    await this.mergeArtifacts(runId, {
      [stage]: {
        validationId: parsed.id,
        coverage: parsed.coverage,
        coverageDetails: parsed.coverageDetails,
        componentFailures: parsed.componentFailures,
        tests: parsed.tests,
      },
    });
  }

  private async readValidation(runId: string): Promise<ParsedDeploy | undefined> {
    const stage = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key: 'validation' } },
    });
    if (stage?.status !== 'passed') return undefined;
    const artifacts = record(stage.artifacts);
    const raw = artifacts.raw;
    const parsed = parseDeployPayload(raw);
    if (!parsed.id && typeof artifacts.validationId === 'string') parsed.id = artifacts.validationId;
    return parsed;
  }

  private registerKill(jobId: string, kill: () => void) {
    this.deployJobs.setKill(jobId, kill);
    this.processRegistry.register(jobId, kill);
  }

  private clearKill(jobId: string) {
    this.deployJobs.clearKill(jobId);
    this.processRegistry.clear(jobId);
  }

  private async cancelled(jobId: string) {
    return this.processRegistry.isCancellationRequested(jobId);
  }

  private async log(jobId: string, stream: 'stdout' | 'stderr', line: string) {
    await this.jobs.addLog(jobId, stream, line);
    await this.stream.publishJobLog(jobId, stream, line);
  }

  private async startStage(runId: string, key: StageKey) {
    const now = new Date();
    const updated = await prisma.deploymentQualityRun.updateMany({
      where: { id: runId, status: { notIn: ['cancelled', 'rejected', 'passed'] } },
      data: { currentStage: key, status: 'running' },
    });
    if (updated.count !== 1) {
      throw new WorkbenchStageError(key, 'Deployment is no longer executable');
    }
    await prisma.deploymentQualityStage.updateMany({
      where: { runId, key, status: { not: 'passed' } },
      data: { status: 'running', startedAt: now, finishedAt: null, error: null },
    });
    const owner = await this.owner(runId);
    await this.emit(runId, owner, 'deployment_stage', { stage: key, status: 'running' });
    await this.audit(runId, 'stage_started', owner, { stage: key });
  }

  private async passStage(
    runId: string,
    key: StageKey,
    summary?: unknown,
    artifacts?: unknown,
  ) {
    const stage = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key } },
      select: { startedAt: true },
    });
    const finished = new Date();
    await prisma.deploymentQualityStage.updateMany({
      where: { runId, key },
      data: {
        status: 'passed',
        finishedAt: finished,
        durationMs: stage?.startedAt ? finished.getTime() - stage.startedAt.getTime() : 0,
        summary: summary === undefined ? undefined : json(summary),
        artifacts: artifacts === undefined ? undefined : json(artifacts),
        error: null,
      },
    });
    const owner = await this.owner(runId);
    await this.emit(runId, owner, 'deployment_stage', {
      stage: key,
      status: 'passed',
      summary: summary ?? null,
    });
    await this.audit(runId, 'stage_passed', owner, { stage: key, summary });
  }

  private async failStage(runId: string, key: StageKey, error: string, summary?: unknown) {
    const finished = new Date();
    const stage = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key } },
      select: { startedAt: true },
    });
    await prisma.deploymentQualityStage.updateMany({
      where: { runId, key },
      data: {
        status: 'failed',
        finishedAt: finished,
        durationMs: stage?.startedAt ? finished.getTime() - stage.startedAt.getTime() : 0,
        error,
        summary: summary === undefined ? undefined : json(summary),
      },
    });
    const owner = await this.owner(runId);
    await this.emit(runId, owner, 'deployment_stage', { stage: key, status: 'failed', error });
  }

  private async cancelRun(runId: string, stage: StageKey, owner: string, jobId: string) {
    const now = new Date();
    await prisma.$transaction([
      prisma.deploymentQualityRun.update({
        where: { id: runId },
        data: { status: 'cancelled', currentStage: stage },
      }),
      prisma.deploymentQualityStage.updateMany({
        where: { runId, status: { in: ['pending', 'ready', 'running', 'blocked'] } },
        data: { status: 'cancelled', finishedAt: now, error: 'Cancelled by user' },
      }),
      prisma.deploymentQualityAudit.create({
        data: { runId, action: 'cancelled', actorId: owner, details: json({ jobId, stage }) },
      }),
    ]);
    await this.emit(runId, owner, 'deployment_result', { status: 'cancelled', stage });
  }

  private async replaceIssues(runId: string, stage: StageKey, issues: StaticAnalysisIssue[]) {
    const row = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key: stage } },
      select: { id: true },
    });
    if (!row) return;
    await prisma.deploymentQualityIssue.deleteMany({ where: { runId, stageId: row.id } });
    if (!issues.length) return;
    await prisma.deploymentQualityIssue.createMany({
      data: issues.map((issue) => ({
        runId,
        stageId: row.id,
        engine: issue.engine,
        ruleId: issue.ruleId,
        severity: issue.severity,
        message: issue.message,
        component: issue.component,
        file: issue.file,
        line: issue.line,
        column: issue.column,
        fingerprint: issue.fingerprint,
        helpUrl: issue.helpUrl,
      })),
    });
  }

  private async mergeArtifacts(runId: string, patch: Record<string, unknown>) {
    const run = await prisma.deploymentQualityRun.findUnique({
      where: { id: runId },
      select: { artifacts: true },
    });
    await prisma.deploymentQualityRun.update({
      where: { id: runId },
      data: { artifacts: json({ ...record(run?.artifacts), ...patch }) },
    });
  }

  private async invalidateChangedSource(runId: string, digest: string) {
    const sourceStage = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key: 'source' } },
      select: { ordinal: true, artifacts: true },
    });
    const priorDigest = stringValue(record(sourceStage?.artifacts).digest);
    if (!priorDigest || priorDigest === digest) return;
    const owner = await this.owner(runId);
    await prisma.$transaction(async (tx) => {
      await tx.deploymentQualityStage.updateMany({
        where: { runId, ordinal: { gt: sourceStage!.ordinal } },
        data: {
          status: 'pending',
          startedAt: null,
          finishedAt: null,
          durationMs: null,
          summary: Prisma.DbNull,
          artifacts: Prisma.DbNull,
          error: null,
        },
      });
      await tx.deploymentQualityIssue.deleteMany({ where: { runId } });
      await tx.deploymentQualityTestResult.deleteMany({ where: { runId } });
      await tx.deploymentQualityApproval.deleteMany({ where: { runId } });
      await tx.deploymentQualityRun.update({
        where: { id: runId },
        data: {
          validationId: null,
          approvedBy: null,
          approvedAt: null,
          status: 'running',
        },
      });
      await tx.deploymentQualityAudit.create({
        data: {
          runId,
          action: 'source_digest_changed',
          actorId: owner,
          details: json({ priorDigest, digest, downstreamInvalidated: true }),
        },
      });
    });
  }

  private async destructiveReviewed(
    runId: string,
    selectionsValue: unknown,
    apiVersion: string,
  ) {
    const selections = selectionsValue as MetadataSelection[];
    if (!selections.length) return true;
    const digest = destructiveDigest(selections, apiVersion);
    return Boolean(await prisma.deploymentDestructiveReview.findFirst({
      where: { runId, digest, approved: true },
      select: { id: true },
    }));
  }

  private async stagePassed(runId: string, key: StageKey) {
    const stage = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key } },
      select: { status: true },
    });
    return stage?.status === 'passed';
  }

  private async stageFailed(runId: string, key: StageKey) {
    const stage = await prisma.deploymentQualityStage.findUnique({
      where: { runId_key: { runId, key } },
      select: { status: true },
    });
    return stage?.status === 'failed';
  }

  private async audit(runId: string, action: string, actorId: string, details: unknown) {
    await prisma.deploymentQualityAudit.create({
      data: { runId, action, actorId, details: json(details) },
    });
  }

  private async owner(runId: string) {
    const run = await prisma.deploymentQualityRun.findUnique({
      where: { id: runId },
      select: { createdBy: true },
    });
    return run?.createdBy ?? 'system';
  }

  private async emit(
    runId: string,
    ownerId: string,
    type: 'deployment_stage' | 'deployment_result',
    payload: Record<string, unknown>,
  ) {
    await this.stream.publish(type, { workbenchRunId: runId, ...payload }, ownerId);
  }
}

export function buildDependencyPreview(
  runId: string,
  workspace: WorkbenchWorkspace,
  rawPolicy: Record<string, unknown>,
  targetOrgProfile: 'greenfield' | 'incremental' = 'incremental',
) {
  const mode = String(rawPolicy.mode ?? 'include_required');
  const maxDepth = Number(rawPolicy.maxDepth ?? 10);
  const failOnMissing = rawPolicy.failOnMissing !== false;
  const allowCycles = rawPolicy.allowCycles === true;
  const includeOptional = rawPolicy.includeOptional === true;
  const manifest = packageParser.parseFile(workspace.manifestAbsolutePath);
  const selected = sourceScanner.expandWildcards(manifest.members, workspace.projectRoot);
  const all = [...sourceScanner.scanProject(workspace.projectRoot).values()];
  const selectedIds = new Set(selected.map((item) => `${item.metadataType}:${item.apiName}`));
  const repo = new MetadataRepository();
  // Scan the complete pinned workspace so transitive depth and cycle policy are
  // evaluated before filtering to the approved node set.
  const discoveryComponents = all;
  for (const component of discoveryComponents) {
    repo.getOrCreate(component.metadataType, component.apiName, { filePath: component.filePath });
  }
  dependencyDiscoveryEngine.discover(repo, discoveryComponents, {
    projectRoot: workspace.projectRoot,
    targetOrgProfile,
  });
  const allIndex = new Map(all.map((item) => [`${item.metadataType}:${item.apiName}`, item]));
  const missing: Array<{ nodeId: string; requiredBy: string[]; explanation: string }> = [];
  const decisions: Array<{
    nodeId: string;
    decision: 'selected' | 'included' | 'excluded' | 'missing';
    reason: string;
  }> = [];
  const depth = dependencyDepths(repo, selectedIds);

  for (const node of repo.allNodes()) {
    const selectedNode = selectedIds.has(node.id);
    const discovered = allIndex.get(node.id);
    if (discovered && !node.filePath) node.filePath = discovered.filePath;
    const nodeDepth = depth.get(node.id) ?? Infinity;
    if (!selectedNode && (mode === 'selected_only' || nodeDepth > maxDepth)) {
      decisions.push({ nodeId: node.id, decision: 'excluded', reason: 'Dependency policy excluded this node' });
      continue;
    }
    if (!node.filePath || !fs.existsSync(path.resolve(workspace.projectRoot, node.filePath))) {
      const requiredBy = [...node.dependents];
      missing.push({
        nodeId: node.id,
        requiredBy,
        explanation: requiredBy.length
          ? `Referenced by ${requiredBy.join(', ')} but source was not found`
          : selectedNode
            ? 'Selected component source was not found in the resolved workspace'
            : 'Dependency source was not found in the resolved workspace',
      });
      decisions.push({ nodeId: node.id, decision: 'missing', reason: 'Selected or referenced source is absent' });
      continue;
    }
    if (selectedNode) {
      decisions.push({ nodeId: node.id, decision: 'selected', reason: 'Explicitly selected or wildcard-expanded' });
      continue;
    }
    decisions.push({ nodeId: node.id, decision: 'included', reason: 'Required transitive dependency' });
  }

  if (mode === 'include_all' || includeOptional) {
    for (const component of all) {
      const node = repo.getOrCreate(component.metadataType, component.apiName, { filePath: component.filePath });
      const existingDecision = decisions.find((decision) => decision.nodeId === node.id);
      if ((mode === 'include_all' || includeOptional) && existingDecision?.decision === 'excluded') {
        existingDecision.decision = 'included';
        existingDecision.reason = mode === 'include_all'
          ? 'include_all policy'
          : 'Optional source component included by policy';
      } else if (!existingDecision) {
        decisions.push({
          nodeId: node.id,
          decision: 'included',
          reason: mode === 'include_all' ? 'include_all policy' : 'Optional source component included by policy',
        });
      }
    }
  }

  const includedIds = new Set(
    decisions
      .filter((decision) => decision.decision === 'selected' || decision.decision === 'included')
      .map((decision) => decision.nodeId),
  );
  const resolvedSelections = nodesToSelections(
    repo.allNodes().filter((node) => includedIds.has(node.id)),
  );
  const approvedRepo = new MetadataRepository();
  for (const node of repo.allNodes().filter((item) => includedIds.has(item.id))) {
    approvedRepo.getOrCreate(node.metadataType, node.apiName, { filePath: node.filePath ?? undefined });
  }
  for (const node of repo.allNodes().filter((item) => includedIds.has(item.id))) {
    for (const dependency of node.dependencies) {
      if (includedIds.has(dependency)) approvedRepo.addEdge(node.id, dependency, 'known_rule');
    }
  }
  const plannerConfig = tunePlannerForManifestSize(approvedRepo.size());
  const approvedEngine = GraphEngine.fromRepository(approvedRepo);
  const cycles = approvedEngine.findCycles();
  let plan = new DeploymentPlanner(plannerConfig).buildPlan(
    runId,
    approvedRepo,
    approvedEngine,
  );
  plan = new BatchOptimizer(plannerConfig).optimize(plan);
  const graph = {
    nodes: repo.allNodes().map((node) => ({
      id: node.id,
      metadataType: node.metadataType,
      member: node.apiName,
      selected: selectedIds.has(node.id),
      filePath: node.filePath,
      discoveredBy: node.discoveredBy,
    })),
    edges: repo.allNodes().flatMap((node) =>
      [...node.dependencies].map((dependency) => ({
        from: node.id,
        to: dependency,
        explanation: `${node.id} references ${dependency}`,
      }))),
  };
  const blocking = [
    ...(failOnMissing && missing.length ? [`${missing.length} required dependencies are missing`] : []),
    ...(!allowCycles && cycles.length ? [`${cycles.length} dependency cycles require review`] : []),
  ];
  return {
    graph,
    cycles,
    missing,
    decisions,
    resolvedSelections,
    plan,
    blocking,
    summary: {
      requested: selectedIds.size,
      resolved: includedIds.size,
      added: [...includedIds].filter((id) => !selectedIds.has(id)).length,
      missing: missing.length,
      cycles: cycles.length,
      truncated: [...depth.values()].some((value) => value > maxDepth),
      optionalIncluded: includeOptional
        ? decisions.filter((decision) => decision.reason.startsWith('Optional')).length
        : 0,
    },
  };
}

function dependencyDepths(repo: MetadataRepository, selected: Set<string>): Map<string, number> {
  const depth = new Map<string, number>();
  const queue = [...selected].map((id) => ({ id, depth: 0 }));
  while (queue.length) {
    const current = queue.shift()!;
    if ((depth.get(current.id) ?? Infinity) <= current.depth) continue;
    depth.set(current.id, current.depth);
    const node = repo.getNode(current.id);
    for (const dependency of node?.dependencies ?? []) {
      queue.push({ id: dependency, depth: current.depth + 1 });
    }
  }
  return depth;
}

function nodesToSelections(nodes: MetadataNode[]): MetadataSelection[] {
  const grouped = new Map<string, Set<string>>();
  for (const node of nodes) {
    const members = grouped.get(node.metadataType) ?? new Set<string>();
    members.add(node.apiName);
    grouped.set(node.metadataType, members);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([metadataType, members]) => ({ metadataType, members: [...members].sort() }));
}

export function parseDeployPayload(value: unknown): ParsedDeploy {
  let raw = value;
  if (typeof raw === 'string') {
    const start = raw.indexOf('{');
    try {
      raw = start >= 0 ? JSON.parse(raw.slice(start)) : {};
    } catch {
      raw = {};
    }
  }
  const root = record(raw);
  const result = record(root.result ?? root);
  const details = record(result.details);
  const testBlock = record(details.runTestResult ?? result.runTestResult);
  const successes = arrayOfRecords(testBlock.successes ?? testBlock.tests);
  const failures = arrayOfRecords(testBlock.failures);
  const tests = [
    ...successes.map((test) => normalizeTest(test, 'passed' as const)),
    ...failures.map((test) => normalizeTest(test, 'failed' as const)),
  ];
  const coverageDetails = arrayOfRecords(
    testBlock.codeCoverage ?? testBlock.codeCoverageWarnings ?? result.codeCoverage,
  );
  const covered = coverageDetails.reduce((sum, item) => {
    const total = Number(item.numLocations ?? item.totalLines ?? 0);
    const uncovered = Number(item.numLocationsNotCovered ?? item.uncoveredLines ?? 0);
    return sum + Math.max(0, total - uncovered);
  }, 0);
  const total = coverageDetails.reduce(
    (sum, item) => sum + Number(item.numLocations ?? item.totalLines ?? 0),
    0,
  );
  const explicitCoverage = Number(
    testBlock.codeCoveragePercentage ?? result.coverage ?? result.testCoverage,
  );
  const coverage = Number.isFinite(explicitCoverage)
    ? explicitCoverage
    : total > 0 ? (covered / total) * 100 : undefined;
  const status = String(result.status ?? '').toLowerCase();
  const componentFailures = arrayOfRecords(details.componentFailures ?? result.componentFailures);
  return {
    id: stringValue(result.id),
    success: componentFailures.length === 0 && (
      result.success === true
      || status === 'succeeded'
      || (Number(result.numberComponentErrors) === 0 && result.numberComponentsDeployed !== undefined)
    ),
    componentFailures,
    tests,
    coverage,
    coverageDetails,
    raw,
  };
}

function normalizeTest(
  test: Record<string, unknown>,
  status: 'passed' | 'failed',
) {
  return {
    className: stringValue(test.name ?? test.className) ?? 'Unknown',
    methodName: stringValue(test.methodName ?? test.method) ?? 'Unknown',
    status,
    durationMs: nonNegativeInt(test.time ?? test.duration ?? test.durationMs),
    message: stringValue(test.message),
    stackTrace: stringValue(test.stackTrace ?? test.stack),
  };
}

function deploySummary(parsed: ParsedDeploy) {
  return {
    success: parsed.success,
    validationId: parsed.id,
    componentFailures: parsed.componentFailures.length,
    testsRun: parsed.tests.length,
    testsFailed: parsed.tests.filter((test) => test.status === 'failed').length,
    coverage: parsed.coverage,
  };
}

function countSeverities(issues: StaticAnalysisIssue[]) {
  const counts = { info: 0, warning: 0, error: 0, critical: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map(record);
}

function arrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return strings.length === value.length ? strings : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function positiveInt(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function nonNegativeInt(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}

function hashFile(file: string) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function hasDestructive(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function mergeSelections(...groups: MetadataSelection[][]): MetadataSelection[] {
  const members = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const selection of group) {
      const values = members.get(selection.metadataType) ?? new Set<string>();
      for (const member of selection.members) values.add(member);
      members.set(selection.metadataType, values);
    }
  }
  return [...members.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([metadataType, values]) => ({
      metadataType,
      members: [...values].sort(),
    }));
}

function destructiveDigest(selections: MetadataSelection[], apiVersion: string) {
  return createHash('sha256')
    .update(buildDestructiveChangesXml(selections, apiVersion), 'utf8')
    .digest('hex');
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(sortJson(value))).digest('hex');
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortJson(item)]),
  );
}
