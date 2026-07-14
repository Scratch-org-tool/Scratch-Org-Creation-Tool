import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { SCRATCH_PERMISSION_SET, DEFAULT_AZURE_MANIFEST_PATH, type AzureDeployConfig, type PipelineStepId } from '@sfcc/shared';
import type { DeployCheckpoint } from '@sfcc/metadata-orchestrator';
import { JobsService } from '../modules/jobs/jobs.service';
import { JobProcessRegistryService } from '../modules/jobs/job-process-registry.service';
import { StreamService } from '../modules/stream/stream.service';
import { MetadataDeployJobService } from '../modules/deployment/metadata-deploy-job.service';
import { JobCancelledError } from '../modules/environment/scratch-org-job.service';
import {
  DeploySourceResolver,
  IntelligentOrchestratorService,
  isIntelligentDeployEnabled,
  resolveTargetOrgProfile,
} from '../modules/intelligent-deploy/intelligent-orchestrator.service';
import { PipelineStepError } from './metadata-deploy.worker.errors';
import { MetadataDataChainService } from '../modules/metadata/metadata-data-chain.service';
import { bootstrapOrgToOrgWorkspace } from '../integrations/azure/org-to-org-workspace.util';

export { PipelineStepError } from './metadata-deploy.worker.errors';

function snapshotRootDir(): string {
  return process.env.DEPLOY_SNAPSHOT_DIR?.trim() || path.join(tmpdir(), 'sfcc-deploy-snapshots');
}

@Injectable()
export class MetadataDeployWorker {
  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly metadataDeployJobService: MetadataDeployJobService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly deploySourceResolver: DeploySourceResolver,
    private readonly intelligentOrchestrator: IntelligentOrchestratorService,
    private readonly metadataDataChain: MetadataDataChainService,
  ) {}

  async process(job: Job) {
    const {
      orgAlias,
      manifestPath,
      manifestContent,
      azureDeploy,
      testLevel,
      dbJobId,
      automationRunId,
      deploymentId,
      assignPermissionSet,
      assignPermissionSetOnly,
      sourceOrgId,
      sourceOrgAlias,
      deployMode,
      intelligentDeployRunId,
      intelligentDeployEnabled,
      chainDataDeploy,
      dataDeployConfig,
      tests,
      validateOnly,
      destructiveChangesXml,
      quickDeployValidationId,
      localProjectRoot,
    } = job.data as {
      orgAlias: string;
      manifestPath?: string;
      manifestContent?: string;
      azureDeploy?: AzureDeployConfig;
      testLevel?: string;
      dbJobId: string;
      automationRunId?: string;
      deploymentId?: string;
      assignPermissionSet?: boolean;
      assignPermissionSetOnly?: boolean;
      sourceOrgId?: string;
      sourceOrgAlias?: string;
      deployMode?: 'azure' | 'org_to_org' | 'local_workspace';
      intelligentDeployRunId?: string;
      intelligentDeployEnabled?: boolean;
      chainDataDeploy?: boolean;
      dataDeployConfig?: Array<Record<string, unknown>>;
      tests?: string[];
      validateOnly?: boolean;
      destructiveChangesXml?: string;
      quickDeployValidationId?: string;
      localProjectRoot?: string;
    };

    const log = async (stream: 'stdout' | 'stderr', line: string) => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    const setStep = async (step: string) => {
      await prisma.job.update({
        where: { id: dbJobId },
        data: { currentStep: step, status: 'running', startedAt: new Date() },
      });
      await this.streamService.publish('job_status', { jobId: dbJobId, status: 'running', currentStep: step });
    };

    const isCancelled = async () => {
      const current = await prisma.job.findUnique({ where: { id: dbJobId }, select: { status: true } });
      return current?.status === 'cancelled';
    };

    // Quick deploy re-uses a previously validated deploy request — no
    // workspace resolution or re-upload of metadata required.
    if (quickDeployValidationId) {
      await setStep('Quick Deploying Validated Changes');
      await log('stdout', `Quick deploying validation ${quickDeployValidationId} to ${orgAlias}...`);
      const sfCli = createSfCliClient();
      const quick = sfCli.quickDeployCancellable(orgAlias, quickDeployValidationId);
      this.metadataDeployJobService.setKill(dbJobId, quick.kill);
      const unregisterQuickKill = this.processRegistry.register(dbJobId, quick.kill);
      let quickResult: Awaited<typeof quick.promise>;
      try {
        quickResult = await quick.promise;
      } finally {
        unregisterQuickKill();
        this.metadataDeployJobService.clearKill(dbJobId);
        this.processRegistry.clear(dbJobId);
      }
      if (await isCancelled()) throw new JobCancelledError();
      if (quickResult.stdout) await log('stdout', quickResult.stdout);
      if (quickResult.stderr) await log('stderr', quickResult.stderr);
      if (!quickResult.success) {
        throw new PipelineStepError(quickResult.error ?? 'Quick deploy failed', 'azure_metadata_deploy');
      }
      await setStep('Deployment Completed');
      return { quickDeployed: true, validationId: quickDeployValidationId };
    }

    if (!assignPermissionSetOnly) {
      // Validate-only and destructive-change deploys need the plain
      // `sf project deploy` flags — the intelligent orchestrator does not
      // support them, so those runs always take the direct path.
      const useIntelligent =
        intelligentDeployEnabled !== false &&
        isIntelligentDeployEnabled() &&
        !validateOnly &&
        !destructiveChangesXml;

      const manifest =
        manifestPath ??
        azureDeploy?.manifestPath ??
        process.env.AZURE_DEFAULT_MANIFEST_PATH ??
        DEFAULT_AZURE_MANIFEST_PATH;

      let resolvedSourceOrgAlias = sourceOrgAlias;
      if (!resolvedSourceOrgAlias && sourceOrgId) {
        const sourceOrg = await prisma.orgConnection.findUnique({ where: { id: sourceOrgId } });
        resolvedSourceOrgAlias = sourceOrg?.username ?? sourceOrg?.alias;
      }

      await setStep('Connecting to Azure DevOps');
      await log('stdout', useIntelligent
        ? `Preparing intelligent metadata deploy (${deployMode ?? 'azure'})...`
        : deployMode === 'org_to_org'
          ? 'Preparing org-to-org metadata retrieve and deploy...'
          : `Cloning ${azureDeploy?.repo}@${azureDeploy?.branch} from Azure DevOps...`);

      const workspace = await this.deploySourceResolver.resolve({
        orgAlias,
        azureDeploy,
        manifestPath: manifest,
        manifestContent,
        sourceOrgAlias: resolvedSourceOrgAlias,
        deployMode,
        localProjectRoot,
      });

      try {
        if (useIntelligent) {
          const runId = intelligentDeployRunId ?? randomUUID();
          let resumeCheckpoint: DeployCheckpoint | undefined;
          if (intelligentDeployRunId) {
            const existing = await prisma.intelligentDeployRun.findUnique({
              where: { id: intelligentDeployRunId },
            });
            resumeCheckpoint = (existing?.checkpoint as DeployCheckpoint | null) ?? undefined;
          }

          await setStep('Planning Deployment');
          const targetOrgProfile = await resolveTargetOrgProfile(orgAlias, automationRunId);
          await log('stdout', `Intelligent deploy run ${runId} — analyzing manifest and dependencies...`);
          if (targetOrgProfile === 'greenfield') {
            await log('stdout', 'Greenfield deploy profile — schema-before-code ordering enabled');
          }

          const report = await this.intelligentOrchestrator.runIntelligentDeploy({
            runId,
            workspace,
            orgAlias,
            testLevel,
            deploymentId,
            automationRunId,
            resumeCheckpoint,
            targetOrgProfile,
            registerKill: (kill) => {
              this.metadataDeployJobService.setKill(dbJobId, kill);
              this.processRegistry.register(dbJobId, kill);
            },
            clearKill: () => {
              this.metadataDeployJobService.clearKill(dbJobId);
              this.processRegistry.clear(dbJobId);
            },
            callbacks: {
              isCancelled,
              onBatchStart: async (batch, index, total) => {
                await setStep(`Deploying Batch ${index}/${total}`);
                await log('stdout', `[Batch ${index}/${total}] Deploying ${batch.nodeIds.length} components…`);
              },
              onBatchComplete: async (outcome) => {
                const status = outcome.success ? 'succeeded' : 'failed';
                await log('stdout', `[Batch ${outcome.batchNumber}] ${status} (${outcome.deployedNodeIds.length} deployed)`);
              },
              onLog: async (stream, line) => log(stream, line),
            },
          });

          if (await isCancelled()) throw new JobCancelledError();

          if (!report.success) {
            throw new PipelineStepError(
              `Intelligent deploy failed: ${report.failedCount} component(s) failed`,
              'azure_metadata_deploy',
            );
          }
          await setStep('Deployment Completed');
          await log('stdout', `Intelligent deploy complete — ${report.deployedCount} components in ${report.totalBatches} batches`);
        } else {
          const sfCli = createSfCliClient({ cwd: workspace.projectRoot });

          // Pre-deploy snapshot: retrieve the affected components from the
          // target org so a failed/regressed deploy can be rolled back by
          // redeploying the snapshot. Skipped for validate-only runs (no
          // changes are applied) and rollback runs themselves.
          if (deploymentId && !validateOnly && deployMode !== 'local_workspace') {
            try {
              await setStep('Snapshotting Target Org');
              const snapshotPath = await this.captureTargetSnapshot(
                orgAlias,
                workspace.manifestAbsolutePath,
                deploymentId,
                log,
              );
              if (snapshotPath) {
                await prisma.deployment.update({
                  where: { id: deploymentId },
                  data: { snapshotPath },
                }).catch(() => undefined);
              }
            } catch (err) {
              await log('stderr', `Snapshot failed (deploy continues, rollback unavailable): ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          let destructivePath: string | undefined;
          if (destructiveChangesXml?.trim()) {
            destructivePath = path.join(workspace.projectRoot, 'destructiveChanges.xml');
            fs.writeFileSync(destructivePath, destructiveChangesXml, 'utf8');
            await log('stdout', 'Destructive changes manifest attached (post-deploy deletes)');
          }

          await setStep(validateOnly ? 'Validating Metadata (check-only)' : 'Deploying Metadata');
          await log('stdout', `${validateOnly ? 'Validating' : 'Deploying'} manifest ${workspace.manifestRelative} from ${workspace.projectRoot}...`);
          if (testLevel === 'RunSpecifiedTests' && tests?.length) {
            await log('stdout', `Running specified tests: ${tests.join(', ')}`);
          }

          const deploy = sfCli.deployManifestCancellable(orgAlias, workspace.manifestRelative, testLevel, {
            tests,
            dryRun: validateOnly,
            postDestructiveChanges: destructivePath,
          });
          this.metadataDeployJobService.setKill(dbJobId, deploy.kill);
          const unregisterKill = this.processRegistry.register(dbJobId, deploy.kill);

          const deployStarted = Date.now();
          const heartbeat = setInterval(() => {
            const mins = Math.floor((Date.now() - deployStarted) / 60_000);
            void log('stdout', `Deploy still running… ${mins}m elapsed`);
          }, 60_000);

          let result: Awaited<typeof deploy.promise>;
          try {
            result = await deploy.promise;
          } finally {
            clearInterval(heartbeat);
            unregisterKill();
          }
          this.metadataDeployJobService.clearKill(dbJobId);

          if (await isCancelled()) throw new JobCancelledError();

          if (result.stdout) await log('stdout', result.stdout);
          if (result.stderr) await log('stderr', result.stderr);

          // Persist the Salesforce deploy request id: for validate-only runs
          // this is the quick-deploy handle; for real runs it's audit data.
          const parsed = sfCli.parseDeployJson(result.stdout ?? result.data);
          if (deploymentId && parsed.id) {
            await prisma.deployment.update({
              where: { id: deploymentId },
              data: validateOnly ? { validationId: parsed.id } : {},
            }).catch(() => undefined);
          }

          if (!result.success) {
            throw new PipelineStepError(
              result.error ?? (validateOnly ? 'Metadata validation failed' : 'Metadata deploy failed'),
              'azure_metadata_deploy',
            );
          }

          if (validateOnly) {
            await setStep('Validation Completed');
            await log('stdout', parsed.id
              ? `Validation succeeded — quick deploy available (validation id ${parsed.id})`
              : 'Validation succeeded');
            return { validated: true, validationId: parsed.id };
          }
          await setStep('Deployment Completed');
        }
      } finally {
        this.metadataDeployJobService.clearKill(dbJobId);
        this.processRegistry.clear(dbJobId);
        try {
          await workspace.cleanup?.();
        } catch {
          // best-effort — deploy outcome already determined
        }
      }
    }

    if (automationRunId && (assignPermissionSet || assignPermissionSetOnly)) {
      if (await isCancelled()) throw new JobCancelledError();
      await log('stdout', 'Assigning Permission Set...');
      const sfCli = createSfCliClient();
      const permResult = await sfCli.assignPermissionSet(orgAlias, SCRATCH_PERMISSION_SET);
      if (permResult.stdout) await log('stdout', permResult.stdout);
      if (permResult.stderr) await log('stderr', permResult.stderr);
      if (!permResult.success) {
        throw new PipelineStepError(
          permResult.error ?? 'Permission set assignment failed',
          'assign_permission_set',
        );
      }
      await log('stdout', 'Permission Assigned');
      return { assignPermissionSetCompleted: true };
    }

    if (chainDataDeploy && dataDeployConfig?.length && sourceOrgId && deploymentId) {
      const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
      const targetId = deployment?.targetOrgId;
      if (targetId) {
        const jobRecord = await prisma.job.findUnique({ where: { id: dbJobId }, select: { createdBy: true } });
        const chainedJobIds = await this.metadataDataChain.runChainedDataDeploys({
          sourceOrgId,
          targetOrgId: targetId,
          dataDeployConfig: dataDeployConfig as Array<{ objectName: string; soql?: string; strategy?: 'insert' | 'upsert'; matchField?: string }>,
          automationRunId,
          createdBy: jobRecord?.createdBy,
          onLog: (line) => log('stdout', line),
        });
        // The run stays 'running' until every chained SFDMU job reaches a
        // terminal state — completion is handled by the worker registry when
        // the last chained job finishes (never report success early).
        if (automationRunId && chainedJobIds.length > 0) {
          await prisma.automationRun.update({
            where: { id: automationRunId },
            data: { status: 'running' },
          }).catch(() => undefined);
          await log('stdout', `Metadata deploy complete — waiting on ${chainedJobIds.length} chained data job(s)`);
        }
      }
    }

    return {};
  }

  /**
   * Retrieve the deploy manifest's components from the *target* org into a
   * snapshot workspace. Rollback = redeploy this snapshot. Components that do
   * not exist on the target yet (net-new) simply won't be in the snapshot.
   */
  private async captureTargetSnapshot(
    orgAlias: string,
    manifestAbsolutePath: string,
    deploymentId: string,
    log: (stream: 'stdout' | 'stderr', line: string) => Promise<void>,
  ): Promise<string | null> {
    const manifestContent = fs.readFileSync(manifestAbsolutePath, 'utf8');
    const snapshotDir = path.join(snapshotRootDir(), deploymentId);
    fs.rmSync(snapshotDir, { recursive: true, force: true });
    const bootstrapped = bootstrapOrgToOrgWorkspace(snapshotDir, manifestContent);

    await log('stdout', `Capturing pre-deploy snapshot of ${orgAlias} into ${snapshotDir}...`);
    const sfCli = createSfCliClient({ cwd: bootstrapped.projectRoot });
    const retrieve = await sfCli.retrieveManifest(orgAlias, bootstrapped.manifestRelative);
    if (!retrieve.success) {
      // Partial snapshots are still useful; a hard failure means no rollback.
      await log('stderr', `Snapshot retrieve reported: ${retrieve.error ?? 'unknown error'}`);
      const forceApp = path.join(bootstrapped.projectRoot, 'force-app');
      const hasContent = fs.existsSync(forceApp) && fs.readdirSync(forceApp, { recursive: true }).length > 1;
      if (!hasContent) {
        fs.rmSync(snapshotDir, { recursive: true, force: true });
        return null;
      }
    }
    await log('stdout', 'Pre-deploy snapshot captured — rollback available for this deployment');
    return snapshotDir;
  }
}
