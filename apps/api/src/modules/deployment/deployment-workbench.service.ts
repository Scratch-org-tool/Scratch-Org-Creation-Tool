import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  buildDestructiveChangesXml,
  buildDeploymentStagePlan,
  deploymentPolicySchema,
  deploymentWorkbenchCreateSchema,
  deploymentWorkbenchPreviewSchema,
  parsePackageXml,
  type DeploymentWorkbenchCapabilities,
  type DeploymentWorkbenchInput,
} from '@sfcc/shared';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import { MetadataDeployQueueService } from './metadata-deploy-queue.service';
import { MetadataDeployJobService } from './metadata-deploy-job.service';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';
import { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { StreamService } from '../stream/stream.service';
import { QUEUE_NAMES } from '@sfcc/shared';
import { StaticAnalysisService } from './static-analysis.service';
import { DeploymentService } from './deployment.service';

export interface WorkbenchActor {
  userId: string;
  isAdmin: boolean;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function orgEnvironment(type: 'scratch' | 'sandbox' | 'prod') {
  return type === 'prod' ? 'production' : type;
}

@Injectable()
export class DeploymentWorkbenchService {
  constructor(
    private readonly metadataQueue: MetadataDeployQueueService,
    private readonly deployJobs: MetadataDeployJobService,
    private readonly queue: QueueService,
    private readonly jobs: JobsService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly stream: StreamService,
    private readonly staticAnalysis: StaticAnalysisService,
    private readonly deployments: DeploymentService,
  ) {}

  async capabilities(): Promise<DeploymentWorkbenchCapabilities & {
    staticAnalysisAvailability: Record<string, boolean>;
  }> {
    const staticAnalysisEngines = ['code-analyzer', 'pmd', 'eslint'];
    const staticAnalysisAvailability = await this.staticAnalysis.detectAvailability(
      staticAnalysisEngines,
    );
    return {
      executionAvailable: true,
      strategies: ['direct', 'intelligent', 'validate_then_quick'],
      sourceTypes: ['org_compare', 'scm'],
      environments: ['scratch', 'sandbox', 'production'],
      testLevels: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
      staticAnalysisEngines,
      staticAnalysisAvailability,
      supports: {
        dependencies: true,
        destructiveChanges: true,
        snapshots: true,
        rollback: true,
        approvals: true,
        chainedData: true,
      },
    };
  }

  async preview(body: unknown, userId: string) {
    const input = deploymentWorkbenchPreviewSchema.parse(body);
    await this.assertInputAccess(input, userId);
    const stages = buildDeploymentStagePlan(input);
    return {
      normalized: input,
      policy: input.policy,
      stages,
      capabilities: await this.capabilities(),
      executionAvailable: true as const,
    };
  }

  async create(body: unknown, userId: string) {
    const input = deploymentWorkbenchCreateSchema.parse(body);
    await this.assertInputAccess(input, userId);
    const stagePlan = buildDeploymentStagePlan(input);

    const run = await prisma.$transaction(async (tx) => {
      const run = await tx.deploymentQualityRun.create({
        data: {
          name: input.name,
          description: input.description,
          source: json(input.source),
          targetOrgId: input.target.orgId,
          targetProfile: input.target.profile,
          strategy: input.strategy,
          components: json(input.components),
          manifestXml: input.manifestXml,
          apiVersion: input.apiVersion,
          destructiveSelections: json(input.destructiveSelections),
          dependencyPolicy: json(input.dependencyPolicy),
          chainedData: input.chainedData ? json(input.chainedData) : undefined,
          policySnapshot: json(input.policy),
          stagePlan: json(stagePlan),
          status: 'planned',
          currentStage: stagePlan[0]?.key,
          createdBy: userId,
          stages: {
            create: stagePlan.map((stage) => ({
              key: stage.key,
              ordinal: stage.ordinal,
              required: stage.required,
              status: stage.status,
            })),
          },
        },
        include: { stages: { orderBy: { ordinal: 'asc' } } },
      });
      await tx.deploymentQualityAudit.create({
        data: {
          runId: run.id,
          action: 'created',
          actorId: userId,
          details: json({
            targetProfile: input.target.profile,
            strategy: input.strategy,
            policySnapshot: input.policy,
          }),
        },
      });
      return run;
    });
    const job = await this.enqueueExecution(run.id, userId);
    return { ...run, jobId: job.id, executionAvailable: true as const };
  }

  async getStatus(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      status: true,
      currentStage: true,
      validationId: true,
      approvedAt: true,
      rejectedAt: true,
      policySnapshot: true,
      artifacts: true,
      createdAt: true,
      updatedAt: true,
    });
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    const execution = ((run.artifacts ?? {}) as Record<string, unknown>).execution as
      | Record<string, unknown>
      | undefined;
    const job = typeof execution?.jobId === 'string'
      ? await prisma.job.findUnique({
          where: { id: execution.jobId },
          select: { id: true, status: true, currentStep: true, error: true },
        })
      : null;
    return {
      id: run.id,
      status: run.status,
      currentStage: run.currentStage,
      validationId: run.validationId,
      approvalRequired: policy.approval.required,
      approvedAt: run.approvedAt,
      rejectedAt: run.rejectedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      job,
    };
  }

  async getPolicy(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      targetProfile: true,
      strategy: true,
      policySnapshot: true,
      dependencyPolicy: true,
      createdAt: true,
    });
    return {
      id: run.id,
      targetProfile: run.targetProfile,
      strategy: run.strategy,
      policy: deploymentPolicySchema.parse(run.policySnapshot),
      dependencyPolicy: run.dependencyPolicy,
      capturedAt: run.createdAt,
    };
  }

  async getStages(id: string, userId: string) {
    await this.requireOwnedRun(id, userId);
    return prisma.deploymentQualityStage.findMany({
      where: { runId: id },
      orderBy: { ordinal: 'asc' },
    });
  }

  async getResults(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      status: true,
      summary: true,
      artifacts: true,
      validationId: true,
    });
    const [stages, issues, testResults, audits] = await Promise.all([
      prisma.deploymentQualityStage.findMany({
        where: { runId: id },
        orderBy: { ordinal: 'asc' },
      }),
      prisma.deploymentQualityIssue.findMany({
        where: { runId: id },
        orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.deploymentQualityTestResult.findMany({
        where: { runId: id },
        orderBy: [{ className: 'asc' }, { methodName: 'asc' }],
      }),
      prisma.deploymentQualityAudit.findMany({
        where: { runId: id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { ...run, stages, issues, testResults, audits };
  }

  async approve(id: string, actor: WorkbenchActor) {
    const run = await this.decisionRun(id);
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    this.assertDecisionAuthorized(run.createdBy, policy.approval.approverType, actor);
    if (!policy.approval.required) {
      throw new BadRequestException('This workbench plan does not require approval');
    }
    if (run.rejectedAt) throw new BadRequestException('A rejected workbench plan cannot be approved');
    if (run.approvedAt) return this.getStatusForDecision(id);

    const approvedAt = new Date();
    await prisma.$transaction(async (tx) => {
      if (policy.approval.minimumApprovals > 1) {
        const priorDecision = await tx.deploymentQualityAudit.findFirst({
          where: { runId: id, action: 'approved', actorId: actor.userId },
          select: { id: true },
        });
        if (priorDecision) throw new BadRequestException('This user has already approved the plan');
        const approvalCount = await tx.deploymentQualityAudit.count({
          where: { runId: id, action: 'approved' },
        });
        await tx.deploymentQualityAudit.create({
          data: {
            runId: id,
            action: 'approved',
            actorId: actor.userId,
            details: json({
              approverType: policy.approval.approverType,
              approvalNumber: approvalCount + 1,
              approvalsRequired: policy.approval.minimumApprovals,
            }),
          },
        });
        if (approvalCount + 1 < policy.approval.minimumApprovals) return;
      }
      const updated = await tx.deploymentQualityRun.updateMany({
        where: { id, approvedAt: null, rejectedAt: null },
        data: {
          approvedBy: actor.userId,
          approvedAt,
          status: 'approved',
        },
      });
      if (updated.count !== 1) throw new BadRequestException('Approval decision already recorded');
      await tx.deploymentQualityStage.updateMany({
        where: { runId: id, key: 'approval' },
        data: { status: 'passed', startedAt: approvedAt, finishedAt: approvedAt, durationMs: 0 },
      });
      if (policy.approval.minimumApprovals === 1) {
        await tx.deploymentQualityAudit.create({
          data: {
            runId: id,
            action: 'approved',
            actorId: actor.userId,
            details: json({ approverType: policy.approval.approverType }),
          },
        });
      }
    });
    const result = await this.getStatusForDecision(id);
    if (result?.status === 'approved') {
      await this.stream.publish(
        'deployment_stage',
        { workbenchRunId: id, stage: 'approval', status: 'passed' },
        run.createdBy,
      );
      await this.enqueueExecution(id, run.createdBy);
    }
    return result;
  }

  async reject(id: string, reason: unknown, actor: WorkbenchActor) {
    const parsedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!parsedReason || parsedReason.length > 2000) {
      throw new BadRequestException('A rejection reason between 1 and 2000 characters is required');
    }
    const run = await this.decisionRun(id);
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    this.assertDecisionAuthorized(run.createdBy, policy.approval.approverType, actor);
    if (!policy.approval.required) {
      throw new BadRequestException('This workbench plan does not require approval');
    }
    if (run.approvedAt) throw new BadRequestException('An approved workbench plan cannot be rejected');
    if (run.rejectedAt) return this.getStatusForDecision(id);

    const rejectedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.deploymentQualityRun.updateMany({
        where: { id, approvedAt: null, rejectedAt: null },
        data: {
          rejectedBy: actor.userId,
          rejectedAt,
          rejectionReason: parsedReason,
          status: 'rejected',
        },
      });
      if (updated.count !== 1) throw new BadRequestException('Approval decision already recorded');
      await tx.deploymentQualityStage.updateMany({
        where: { runId: id, key: 'approval' },
        data: {
          status: 'failed',
          startedAt: rejectedAt,
          finishedAt: rejectedAt,
          durationMs: 0,
          error: parsedReason,
        },
      });
      await tx.deploymentQualityAudit.create({
        data: {
          runId: id,
          action: 'rejected',
          actorId: actor.userId,
          details: json({ reason: parsedReason, approverType: policy.approval.approverType }),
        },
      });
    });
    await this.cancelActiveJob(id, actor.userId);
    await this.stream.publish(
      'deployment_result',
      { workbenchRunId: id, stage: 'approval', status: 'rejected', reason: parsedReason },
      run.createdBy,
    );
    return this.getStatusForDecision(id);
  }

  async resume(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      status: true,
      rejectedAt: true,
      policySnapshot: true,
      approvedAt: true,
    });
    if (['cancelled', 'rejected', 'passed'].includes(run.status)) {
      throw new BadRequestException(`A ${run.status} workbench run cannot be resumed`);
    }
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    if (policy.approval.required && !run.approvedAt && run.status === 'awaiting_approval') {
      throw new BadRequestException('Required approval has not been granted');
    }
    const job = await this.enqueueExecution(id, userId);
    await this.audit(id, 'resumed', userId, { jobId: job.id });
    return { id, jobId: job.id, status: 'queued' };
  }

  async cancel(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      status: true,
      artifacts: true,
    });
    if (['passed', 'failed', 'cancelled', 'rejected'].includes(run.status)) {
      return { id, cancelled: false, reason: 'Run is not active', status: run.status };
    }
    const jobId = this.executionJobId(run.artifacts);
    if (jobId) {
      await this.queue.removeJob(QUEUE_NAMES.METADATA_DEPLOY, jobId).catch(() => false);
      this.deployJobs.cancel(jobId);
      await this.processRegistry.cancel(jobId);
      await this.jobs.updateStatus(jobId, 'cancelled').catch(() => undefined);
    }
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.deploymentQualityRun.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      await tx.deploymentQualityStage.updateMany({
        where: { runId: id, status: { in: ['pending', 'ready', 'running', 'blocked'] } },
        data: { status: 'cancelled', finishedAt: now, error: 'Cancelled by user' },
      });
      await tx.deploymentQualityAudit.create({
        data: { runId: id, action: 'cancelled', actorId: userId, details: json({ jobId }) },
      });
    });
    await this.stream.publish(
      'deployment_result',
      { workbenchRunId: id, status: 'cancelled' },
      userId,
    );
    return { id, jobId, cancelled: true, status: 'cancelled' };
  }

  async quickDeploy(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      status: true,
      validationId: true,
      targetOrgId: true,
      deploymentId: true,
      strategy: true,
      approvedAt: true,
      policySnapshot: true,
    });
    if (!run.validationId) {
      throw new BadRequestException('A successful validation id is required for quick deploy');
    }
    if (run.strategy !== 'validate_then_quick') {
      throw new BadRequestException('Quick deploy is only available for validate_then_quick runs');
    }
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    if (policy.approval.required && !run.approvedAt) {
      throw new BadRequestException('Required approval has not been granted');
    }
    const job = await this.enqueueExecution(id, userId);
    await this.audit(id, 'quick_deploy_enqueued', userId, {
      jobId: job.id,
      validationId: run.validationId,
    });
    return { id, jobId: job.id, validationId: run.validationId, status: 'queued' };
  }

  async rollback(id: string, reason: unknown, userId: string) {
    const parsedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!parsedReason || parsedReason.length > 2000) {
      throw new BadRequestException('A rollback reason between 1 and 2000 characters is required');
    }
    const run = await this.ownedRun(id, userId, {
      id: true,
      deploymentId: true,
      policySnapshot: true,
      components: true,
    });
    if (!run.deploymentId) throw new BadRequestException('No deployed compatibility record is available');
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
    const result = await this.deployments.rollback(run.deploymentId, parsedReason, userId, {
      testLevel: policy.tests.level,
      tests: policy.tests.tests,
    });
    await this.audit(id, 'rollback_enqueued', userId, {
      ...result,
      testPolicy: policy.tests,
      warning: 'Net-new metadata is not present in the snapshot and requires reviewed destructive cleanup.',
    });
    return {
      ...result,
      warning: 'Rollback restores prior metadata but does not delete net-new components.',
    };
  }

  async destructiveReview(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      destructiveSelections: true,
      apiVersion: true,
      manifestXml: true,
    });
    const selections = run.destructiveSelections as unknown as Array<{
      metadataType: string;
      members: string[];
      folder?: string;
    }>;
    const selectedVersion = run.manifestXml
      ? (parseManifestVersion(run.manifestXml) ?? run.apiVersion ?? '62.0')
      : run.apiVersion ?? '62.0';
    return {
      id,
      selections,
      componentCount: selections.reduce((count, item) => count + item.members.length, 0),
      apiVersion: selectedVersion,
      manifestXml: selections.length
        ? buildDestructiveChangesXml(selections, selectedVersion)
        : null,
      requiresReview: selections.length > 0,
      warning: 'Destructive changes are irreversible and rollback snapshots cannot recreate net-new cleanup targets.',
    };
  }

  async getProgress(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      artifacts: true,
      status: true,
      currentStage: true,
    });
    const intelligent = ((run.artifacts ?? {}) as Record<string, unknown>).intelligent as
      | Record<string, unknown>
      | undefined;
    const intelligentRunId = typeof intelligent?.runId === 'string' ? intelligent.runId : undefined;
    const batches = intelligentRunId
      ? await prisma.intelligentDeployBatch.findMany({
          where: { runId: intelligentRunId },
          orderBy: { batchNumber: 'asc' },
        })
      : [];
    return {
      id,
      status: run.status,
      currentStage: run.currentStage,
      intelligentRunId,
      batches,
      completedBatches: batches.filter((batch) => batch.status === 'completed').length,
      totalBatches: batches.length,
      resumable: !['passed', 'cancelled', 'rejected'].includes(run.status),
    };
  }

  private async enqueueExecution(id: string, userId: string) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      targetOrgId: true,
      artifacts: true,
      status: true,
    });
    const existingJobId = this.executionJobId(run.artifacts);
    if (existingJobId) {
      const existing = await prisma.job.findUnique({ where: { id: existingJobId } });
      if (existing && ['pending', 'queued', 'running'].includes(existing.status)) return existing;
    }
    const target = await assertOrgOwned(run.targetOrgId, userId, prisma);
    const job = await this.metadataQueue.enqueue({
      orgAlias: target.username ?? target.alias,
      workbenchRunId: id,
      createdBy: userId,
      intelligentDeployEnabled: false,
    });
    const artifacts = (run.artifacts ?? {}) as Record<string, unknown>;
    await prisma.deploymentQualityRun.update({
      where: { id },
      data: {
        status: run.status === 'approved' ? 'approved' : 'planned',
        artifacts: json({
          ...artifacts,
          execution: {
            jobId: job.id,
            queuedAt: new Date().toISOString(),
          },
        }),
      },
    });
    await this.audit(id, 'execution_enqueued', userId, { jobId: job.id });
    return job;
  }

  private executionJobId(artifacts: unknown): string | undefined {
    const root = (artifacts ?? {}) as Record<string, unknown>;
    const execution = root.execution as Record<string, unknown> | undefined;
    return typeof execution?.jobId === 'string' ? execution.jobId : undefined;
  }

  private async cancelActiveJob(id: string, actorId: string) {
    const run = await prisma.deploymentQualityRun.findUnique({
      where: { id },
      select: { artifacts: true },
    });
    const jobId = this.executionJobId(run?.artifacts);
    if (!jobId) return;
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!job || !['pending', 'queued', 'running'].includes(job.status)) return;
    await this.queue.removeJob(QUEUE_NAMES.METADATA_DEPLOY, jobId).catch(() => false);
    this.deployJobs.cancel(jobId);
    await this.processRegistry.cancel(jobId);
    await this.jobs.updateStatus(jobId, 'cancelled').catch(() => undefined);
    await this.audit(id, 'execution_cancelled', actorId, { jobId });
  }

  private async audit(id: string, action: string, actorId: string, details: unknown) {
    await prisma.deploymentQualityAudit.create({
      data: { runId: id, action, actorId, details: json(details) },
    });
  }

  private async assertInputAccess(input: DeploymentWorkbenchInput, userId: string) {
    const target = await assertOrgOwned(input.target.orgId, userId, prisma);
    const actualProfile = orgEnvironment(target.type);
    if (actualProfile !== input.target.profile) {
      throw new BadRequestException(
        `Target profile mismatch: connected org is ${actualProfile}, not ${input.target.profile}`,
      );
    }
    if (input.source.type === 'org_compare') {
      await assertOrgOwned(input.source.sourceOrgId, userId, prisma);
      if (input.source.comparisonId) {
        const comparison = await prisma.metadataComparison.findFirst({
          where: { id: input.source.comparisonId, createdBy: userId },
          select: { id: true },
        });
        if (!comparison) throw new NotFoundException('Metadata comparison not found');
      }
      return;
    }
    if (input.source.connectionId) {
      const connection = await prisma.scmConnection.findFirst({
        where: { id: input.source.connectionId, connectedBy: userId },
        select: { id: true },
      });
      if (!connection) throw new NotFoundException('SCM connection not found');
    }
    if (input.source.bindingId) {
      const binding = await prisma.projectBinding.findFirst({
        where: { id: input.source.bindingId, createdBy: userId },
        select: { id: true },
      });
      if (!binding) throw new NotFoundException('Project binding not found');
    }
  }

  private async requireOwnedRun(id: string, userId: string) {
    const run = await prisma.deploymentQualityRun.findFirst({
      where: { id, createdBy: userId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Deployment workbench run not found');
    return run;
  }

  private async ownedRun<T extends Prisma.DeploymentQualityRunSelect>(
    id: string,
    userId: string,
    select: T,
  ) {
    const run = await prisma.deploymentQualityRun.findFirst({
      where: { id, createdBy: userId },
      select,
    });
    if (!run) throw new NotFoundException('Deployment workbench run not found');
    return run;
  }

  private async decisionRun(id: string) {
    const run = await prisma.deploymentQualityRun.findUnique({
      where: { id },
      select: {
        id: true,
        createdBy: true,
        policySnapshot: true,
        approvedAt: true,
        rejectedAt: true,
      },
    });
    if (!run) throw new NotFoundException('Deployment workbench run not found');
    return run;
  }

  private assertDecisionAuthorized(
    createdBy: string,
    approverType: 'owner' | 'admin' | 'distinct_user',
    actor: WorkbenchActor,
  ) {
    if (approverType === 'admin' && !actor.isAdmin) {
      throw new ForbiddenException('Administrator approval is required');
    }
    if (approverType === 'distinct_user' && actor.userId === createdBy) {
      throw new ForbiddenException('The plan creator cannot approve this plan');
    }
    if (approverType === 'owner' && actor.userId !== createdBy && !actor.isAdmin) {
      throw new NotFoundException('Deployment workbench run not found');
    }
  }

  private async getStatusForDecision(id: string) {
    return prisma.deploymentQualityRun.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approvedBy: true,
        approvedAt: true,
        rejectedBy: true,
        rejectedAt: true,
        rejectionReason: true,
      },
    });
  }
}

function parseManifestVersion(xml: string): string | null {
  try {
    return parsePackageXml(xml).apiVersion;
  } catch {
    return null;
  }
}
