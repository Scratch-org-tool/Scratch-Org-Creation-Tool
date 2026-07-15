import { Injectable } from '@nestjs/common';
import type { Job as BullJob } from 'bullmq';
import { join } from 'path';
import { createSfCliClient, extractPasswordFromCliResult, type SfCommandResult } from '@sfcc/sf-cli';
import { prisma, type Prisma } from '@sfcc/db';
import {
  SCRATCH_ORG_SKIP_STEP_KEYS,
  SCRATCH_PERMISSION_SET,
  type ScratchOrgCreateConfig,
  type ScratchOrgSkipStepKey,
} from '@sfcc/shared';
import { JobsService } from '../modules/jobs/jobs.service';
import { JobProcessRegistryService } from '../modules/jobs/job-process-registry.service';
import { StreamService } from '../modules/stream/stream.service';
import { JobCancelledError, ScratchOrgJobService } from '../modules/environment/scratch-org-job.service';
import { encrypt } from '../common/crypto.util';
import type { PipelineCheckpoint } from '../modules/orchestrator/pipeline-orchestrator.service';
import { ScratchOrgPreparationService } from '../modules/environment/scratch-org-preparation.service';

const WORKFLOW_STEPS = [
  'Create Scratch Org',
  'Generate Password',
  'Retrieve Org Details',
  'Install Packages',
  'Deploy Metadata',
  'Assign Permissions',
  'Complete',
] as const;

type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

function shouldRunStep(lastCompleted: string | undefined, stepName: WorkflowStep): boolean {
  if (!lastCompleted) return true;
  const lastIdx = WORKFLOW_STEPS.indexOf(lastCompleted as WorkflowStep);
  const stepIdx = WORKFLOW_STEPS.indexOf(stepName);
  if (lastIdx < 0 || stepIdx < 0) return true;
  return stepIdx > lastIdx;
}

@Injectable()
export class ScratchOrgWorker {
  private readonly projectRoot: string;
  private readonly sfCli: ReturnType<typeof createSfCliClient>;

  constructor(
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
    private readonly scratchOrgJobService: ScratchOrgJobService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly preparationService: ScratchOrgPreparationService,
  ) {
    this.projectRoot = process.env.SF_PROJECT_ROOT ?? join(process.cwd(), '../..');
    this.sfCli = createSfCliClient({ cwd: this.projectRoot });
  }

  async process(job: BullJob) {
    const { config, dbJobId, automationRunId, resumeFromSubStep } = job.data as {
      config: ScratchOrgCreateConfig;
      dbJobId: string;
      automationRunId?: string;
      resumeFromSubStep?: string;
    };

    let ownerUserId = 'system';
    if (automationRunId) {
      const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
      ownerUserId = run?.createdBy ?? 'system';
    } else {
      const dbJob = await prisma.job.findUnique({ where: { id: dbJobId } });
      ownerUserId = dbJob?.createdBy ?? 'system';
    }

    const username = `${config.alias}@scratch.com`;
    const definitionFile = config.definitionFile ?? config.template ?? 'config/project-scratch-def.json';
    const manifestPath = 'manifest/package.xml';

    let resumeAfter = resumeFromSubStep;
    if (!resumeAfter && automationRunId) {
      const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
      const cp = (run?.checkpoint ?? {}) as unknown as PipelineCheckpoint;
      resumeAfter = cp.scratchSubStep;
    }

    this.scratchOrgJobService.register(dbJobId, config.skipSteps ?? []);

    const log = async (line: string, stream: 'stdout' | 'stderr' = 'stdout') => {
      await this.jobsService.addLog(dbJobId, stream, line);
      await this.streamService.publishJobLog(dbJobId, stream, line);
    };

    const setStep = async (step: string) => {
      await this.assertNotCancelled(dbJobId);
      await prisma.job.update({
        where: { id: dbJobId },
        data: { currentStep: step, status: 'running' },
      });
      await this.streamService.publish('job_status', {
        jobId: dbJobId,
        status: 'running',
        currentStep: step,
      });
    };

    const persistCheckpoint = async (patch: Partial<PipelineCheckpoint>) => {
      if (!automationRunId) return;
      const run = await prisma.automationRun.findUnique({ where: { id: automationRunId } });
      if (!run) return;
      const checkpoint = {
        ...((run.checkpoint ?? {}) as unknown as PipelineCheckpoint),
        ...patch,
      };
      await prisma.automationRun.update({
        where: { id: automationRunId },
        data: { checkpoint: checkpoint as unknown as Prisma.InputJsonValue },
      });
    };

    const markStepDone = async (step: WorkflowStep, extra?: Partial<PipelineCheckpoint>) => {
      await persistCheckpoint({ scratchSubStep: step, ...extra });
    };

    let generatedPassword: string | undefined;

    try {
      await prisma.job.update({
        where: { id: dbJobId },
        data: { alias: config.alias, status: 'running', startedAt: new Date() },
      });

      if (resumeAfter) {
        await log(`Resuming scratch org workflow after step: ${resumeAfter}`);
      }

      // Step: Create Scratch Org
      if (shouldRunStep(resumeAfter, WORKFLOW_STEPS[0])) {
        await setStep(WORKFLOW_STEPS[0]);
        await log('Creating Scratch Org...');
        const createResult = await this.runCli(dbJobId, [
          'org', 'create', 'scratch',
          '-f', definitionFile,
          '-a', config.alias,
          '--username', username,
          '-y', String(config.duration),
          '-w', '15',
          '--target-dev-hub', config.devHubAlias,
        ], { streaming: true, json: true });
        await this.logCliResult(createResult, log, dbJobId);
        await log('Scratch Org Created');
        await markStepDone(WORKFLOW_STEPS[0], { scratchOrgCreated: true });
      } else {
        await log(`Skipped: ${WORKFLOW_STEPS[0]} (already completed)`);
      }

      // Step: Generate Password
      if (shouldRunStep(resumeAfter, WORKFLOW_STEPS[1])) {
        await setStep(WORKFLOW_STEPS[1]);
        await log('Generating Password...');
        const pwdResult = await this.runCli(dbJobId, [
          'org', 'generate', 'password', '--target-org', username,
        ], { json: true });
        if (pwdResult.success) {
          await this.logCliResult(pwdResult, log, dbJobId);
          generatedPassword = extractPasswordFromCliResult(pwdResult);
        } else {
          await log(
            `Warning: credentials are unavailable (${pwdResult.error ?? 'password generation failed'}); continuing`,
            'stderr',
          );
        }
        if (generatedPassword) {
          await prisma.scratchOrg.upsert({
            where: { alias: config.alias },
            create: {
              alias: config.alias,
              username,
              password: encrypt(generatedPassword),
              devHubAlias: config.devHubAlias,
              status: 'Active',
              jobId: dbJobId,
              createdBy: ownerUserId,
            },
            update: {
              password: encrypt(generatedPassword),
              jobId: dbJobId,
              createdBy: ownerUserId,
            },
          });
          await log('Password captured for credentials view');
        } else {
          await log('Warning: Password generated but could not be stored — use Regenerate Password in Credentials view', 'stderr');
        }
        await log(generatedPassword ? 'Password Generated' : 'Password unavailable; continuing');
        await markStepDone(WORKFLOW_STEPS[1]);
      } else {
        await log(`Skipped: ${WORKFLOW_STEPS[1]} (already completed)`);
        const existing = await prisma.scratchOrg.findUnique({ where: { alias: config.alias } });
        if (existing?.password) generatedPassword = '[encrypted]';
      }

      // Step: Retrieve Org Details
      if (shouldRunStep(resumeAfter, WORKFLOW_STEPS[2])) {
        await setStep(WORKFLOW_STEPS[2]);
        await log('Retrieving org details...');
        const displayResult = await this.runCli(dbJobId, [
          'org', 'display', '--target-org', username,
        ], { json: true });
        await this.logCliResult(displayResult, log, dbJobId);

        const display = displayResult.data as {
          result?: {
            alias?: string;
            username?: string;
            id?: string;
            orgId?: string;
            instanceUrl?: string;
            loginUrl?: string;
            expirationDate?: string;
          };
        };
        const details = display?.result ?? {};

        const scratchOrg = await prisma.scratchOrg.upsert({
          where: { alias: config.alias },
          create: {
            alias: config.alias,
            username: details.username ?? username,
            password: generatedPassword && generatedPassword !== '[encrypted]'
              ? encrypt(generatedPassword)
              : null,
            orgId: details.orgId ?? details.id,
            instanceUrl: details.instanceUrl,
            loginUrl: details.loginUrl,
            expirationDate: details.expirationDate ? new Date(details.expirationDate) : null,
            devHubAlias: config.devHubAlias,
            status: 'Active',
            jobId: dbJobId,
            createdBy: ownerUserId,
          },
          update: {
            username: details.username ?? username,
            orgId: details.orgId ?? details.id,
            instanceUrl: details.instanceUrl,
            loginUrl: details.loginUrl,
            expirationDate: details.expirationDate ? new Date(details.expirationDate) : null,
            status: 'Active',
            jobId: dbJobId,
            createdBy: ownerUserId,
          },
        });

        const orgConn = await prisma.orgConnection.upsert({
          where: { alias: config.alias },
          create: {
            alias: config.alias,
            type: 'scratch',
            username: scratchOrg.username,
            orgId: scratchOrg.orgId ?? undefined,
            instanceUrl: scratchOrg.instanceUrl ?? 'https://test.salesforce.com',
            loginUrl: scratchOrg.loginUrl ?? undefined,
            status: 'active',
            createdBy: ownerUserId,
          },
          update: {
            username: scratchOrg.username,
            orgId: scratchOrg.orgId ?? undefined,
            instanceUrl: scratchOrg.instanceUrl ?? undefined,
            loginUrl: scratchOrg.loginUrl ?? undefined,
            status: 'active',
            createdBy: ownerUserId,
          },
        });

        await markStepDone(WORKFLOW_STEPS[2], {
          scratchOrgCreated: true,
          targetOrgConnectionId: orgConn.id,
        });
      } else {
        await log(`Skipped: ${WORKFLOW_STEPS[2]} (already completed)`);
        const orgConn = await prisma.orgConnection.findUnique({ where: { alias: config.alias } });
        if (orgConn?.id) {
          await persistCheckpoint({ targetOrgConnectionId: orgConn.id, scratchOrgCreated: true });
        }
      }

      // Step: Install Error Logger Package
      await this.runOptionalStep(
        dbJobId,
        SCRATCH_ORG_SKIP_STEP_KEYS.INSTALL_PACKAGES,
        WORKFLOW_STEPS[3],
        resumeAfter,
        log,
        setStep,
        markStepDone,
        async () => {
          await this.preparationService.prepare(
            { alias: config.alias, username },
            { verifyAuthentication: false, ensureRequiredPackage: true },
            log,
          );
        },
      );

      // Step: Deploy Metadata
      await this.runOptionalStep(
        dbJobId,
        SCRATCH_ORG_SKIP_STEP_KEYS.DEPLOY_METADATA,
        WORKFLOW_STEPS[4],
        resumeAfter,
        log,
        setStep,
        markStepDone,
        async () => {
          await log('Deploying Metadata...');
          const deployResult = await this.runCli(dbJobId, [
            'project', 'deploy', 'start',
            '--manifest', manifestPath,
            '--target-org', username,
            '--wait', '30',
          ], { streaming: true });
          await this.logCliResult(deployResult, log, dbJobId, SCRATCH_ORG_SKIP_STEP_KEYS.DEPLOY_METADATA);
          await log('Deployment Successful');
        },
      );

      // Step: Assign Permission Set
      await this.runOptionalStep(
        dbJobId,
        SCRATCH_ORG_SKIP_STEP_KEYS.ASSIGN_PERMISSIONS,
        WORKFLOW_STEPS[5],
        resumeAfter,
        log,
        setStep,
        markStepDone,
        async () => {
          await log('Assigning Permission Set...');
          const permResult = await this.runCli(dbJobId, [
            'org', 'assign', 'permset',
            '--name', SCRATCH_PERMISSION_SET,
            '--target-org', username,
          ], { json: true });
          await this.logCliResult(permResult, log, dbJobId, SCRATCH_ORG_SKIP_STEP_KEYS.ASSIGN_PERMISSIONS);
          await log('Permission Assigned');
        },
      );

      await this.assertNotCancelled(dbJobId);

      await setStep(WORKFLOW_STEPS[6]);
      await prisma.job.update({
        where: { id: dbJobId },
        data: {
          status: 'completed',
          currentStep: 'Complete',
          finishedAt: new Date(),
        },
      });
      await this.streamService.publish('job_status', {
        jobId: dbJobId,
        status: 'completed',
        currentStep: 'Complete',
      });
      await log('Completed Successfully');
      await markStepDone(WORKFLOW_STEPS[6]);

      const orgConn = await prisma.orgConnection.findUnique({ where: { alias: config.alias } });
      return {
        success: true,
        targetOrgConnectionId: orgConn?.id,
        automationRunId,
      };
    } catch (error) {
      if (error instanceof JobCancelledError) {
        await log('Job cancelled by user', 'stderr');
        await prisma.job.update({
          where: { id: dbJobId },
          data: { status: 'cancelled', error: 'Cancelled by user', finishedAt: new Date() },
        });
        await this.streamService.publish('job_status', {
          jobId: dbJobId,
          status: 'cancelled',
        });
        return { success: false, cancelled: true };
      }

      const message = error instanceof Error ? error.message : String(error);
      await log(`Error: ${message}`, 'stderr');
      await prisma.job.update({
        where: { id: dbJobId },
        data: { status: 'failed', error: message, finishedAt: new Date() },
      });
      await this.streamService.publish('job_status', {
        jobId: dbJobId,
        status: 'failed',
        error: message,
      });
      throw error;
    } finally {
      this.scratchOrgJobService.unregister(dbJobId);
    }
  }

  private async runOptionalStep(
    dbJobId: string,
    stepKey: ScratchOrgSkipStepKey,
    stepName: WorkflowStep,
    resumeAfter: string | undefined,
    log: (line: string, stream?: 'stdout' | 'stderr') => Promise<void>,
    setStep: (step: string) => Promise<void>,
    markStepDone: (step: WorkflowStep) => Promise<void>,
    run: () => Promise<void>,
  ) {
    if (this.scratchOrgJobService.shouldSkip(dbJobId, stepKey)) {
      await log(`Skipped: ${stepName}`);
      return;
    }
    if (!shouldRunStep(resumeAfter, stepName)) {
      await log(`Skipped: ${stepName} (already completed)`);
      return;
    }
    await setStep(stepName);
    try {
      await run();
      await markStepDone(stepName);
    } catch (error) {
      if (this.scratchOrgJobService.shouldSkip(dbJobId, stepKey)) {
        await log(`Skipped: ${stepName}`);
        return;
      }
      throw error;
    }
  }

  private async runCli(
    dbJobId: string,
    args: string[],
    options?: { streaming?: boolean; json?: boolean },
  ): Promise<SfCommandResult> {
    const cancellable = options?.streaming
      ? this.sfCli.runStreamingCancellable(args, undefined, { json: options.json })
      : this.sfCli.runCancellable(args, { json: options?.json });

    this.scratchOrgJobService.setKill(dbJobId, cancellable.kill);
    const unregisterDistributedKill = this.processRegistry.register(dbJobId, cancellable.kill);
    try {
      const result = await cancellable.promise;
      await this.assertNotCancelled(dbJobId);
      return result;
    } finally {
      unregisterDistributedKill();
      this.scratchOrgJobService.clearKill(dbJobId);
      this.processRegistry.clear(dbJobId);
    }
  }

  private async logCliResult(
    result: SfCommandResult,
    log: (line: string, stream?: 'stdout' | 'stderr') => Promise<void>,
    dbJobId: string,
    skipKey?: ScratchOrgSkipStepKey,
  ) {
    if (result.stdout) {
      for (const line of result.stdout.split('\n').filter(Boolean)) {
        await log(line);
      }
    }
    if (result.stderr) {
      for (const line of result.stderr.split('\n').filter(Boolean)) {
        await log(line, 'stderr');
      }
    }
    if (!result.success) {
      if (skipKey && this.scratchOrgJobService.shouldSkip(dbJobId, skipKey)) {
        return;
      }
      await this.assertNotCancelled(dbJobId);
      throw new Error(result.error ?? 'CLI command failed');
    }
  }

  private async assertNotCancelled(dbJobId: string): Promise<void> {
    if (
      this.scratchOrgJobService.isCancelled(dbJobId) ||
      await this.processRegistry.isCancellationRequested(dbJobId)
    ) {
      throw new JobCancelledError();
    }
  }
}
