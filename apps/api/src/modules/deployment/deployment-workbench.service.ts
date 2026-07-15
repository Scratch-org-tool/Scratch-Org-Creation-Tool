import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  buildDeploymentStagePlan,
  deploymentPolicySchema,
  deploymentWorkbenchCreateSchema,
  deploymentWorkbenchPreviewSchema,
  type DeploymentWorkbenchCapabilities,
  type DeploymentWorkbenchInput,
} from '@sfcc/shared';
import { assertOrgOwned } from '../../common/user-tenancy.util';

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
  capabilities(): DeploymentWorkbenchCapabilities {
    return {
      executionAvailable: false,
      strategies: ['direct', 'intelligent', 'validate_then_quick'],
      sourceTypes: ['org_compare', 'scm'],
      environments: ['scratch', 'sandbox', 'production'],
      testLevels: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
      staticAnalysisEngines: [],
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
      capabilities: this.capabilities(),
      executionAvailable: false as const,
    };
  }

  async create(body: unknown, userId: string) {
    const input = deploymentWorkbenchCreateSchema.parse(body);
    await this.assertInputAccess(input, userId);
    const stagePlan = buildDeploymentStagePlan(input);

    return prisma.$transaction(async (tx) => {
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
          status: input.policy.approval.required ? 'awaiting_approval' : 'planned',
          currentStage: stagePlan[0]?.key,
          createdBy: userId,
          stages: {
            create: stagePlan.map((stage) => ({
              key: stage.key,
              ordinal: stage.ordinal,
              required: stage.required,
              status: stage.key === 'approval' ? 'blocked' : stage.status,
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
      return { ...run, executionAvailable: false as const };
    });
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
      createdAt: true,
      updatedAt: true,
    });
    const policy = deploymentPolicySchema.parse(run.policySnapshot);
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
    return this.getStatusForDecision(id);
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
    return this.getStatusForDecision(id);
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
