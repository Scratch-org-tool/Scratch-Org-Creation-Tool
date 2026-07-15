import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma, Prisma } from '@sfcc/db';
import {
  DEFAULT_METADATA_API_VERSION,
  buildPackageXml,
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
import { DeploySourceResolver } from '../intelligent-deploy/intelligent-orchestrator.service';
import {
  buildDependencyPreview,
  type WorkbenchWorkspace,
} from './deployment-workbench-runtime.service';

export interface WorkbenchActor {
  userId: string;
  isAdmin: boolean;
}

export interface WorkbenchHistoryQuery {
  page?: string;
  pageSize?: string;
  source?: string;
  target?: string;
  environment?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  owner?: string;
}

interface PreviewCacheEntry {
  expiresAt: number;
  value: Record<string, unknown>;
}

const PREVIEW_CACHE_LIMIT = 100;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function orgEnvironment(type: 'scratch' | 'sandbox' | 'prod') {
  return type === 'prod' ? 'production' : type;
}

@Injectable()
export class DeploymentWorkbenchService {
  private readonly previewCache = new Map<string, PreviewCacheEntry>();

  constructor(
    private readonly metadataQueue: MetadataDeployQueueService,
    private readonly deployJobs: MetadataDeployJobService,
    private readonly queue: QueueService,
    private readonly jobs: JobsService,
    private readonly processRegistry: JobProcessRegistryService,
    private readonly stream: StreamService,
    private readonly staticAnalysis: StaticAnalysisService,
    private readonly deployments: DeploymentService,
    private readonly sourceResolver: DeploySourceResolver,
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
    const access = await this.assertInputAccess(input, userId);
    const stages = buildDeploymentStagePlan(input);
    const cacheKey = createHash('sha256')
      .update(userId)
      .update('\0')
      .update(JSON.stringify(input))
      .digest('hex');
    const cached = this.getPreviewCache(cacheKey);
    if (cached) return { ...cached, cache: { hit: true } };

    const suppliedManifest = input.manifestXml?.trim();
    const apiVersion = suppliedManifest
      ? parsePackageXml(suppliedManifest).apiVersion ?? DEFAULT_METADATA_API_VERSION
      : input.apiVersion ?? DEFAULT_METADATA_API_VERSION;
    const manifestContent = suppliedManifest || (
      input.components.length
        ? buildPackageXml(input.components, apiVersion)
        : undefined
    );
    const resolution = this.sourceResolver.resolve({
      orgAlias: access.target.username ?? access.target.alias,
      sourceOrgAlias: access.sourceOrg
        ? access.sourceOrg.username ?? access.sourceOrg.alias
        : undefined,
      deployMode: input.source.type === 'org_compare' ? 'org_to_org' : 'git',
      gitSource: input.source.type === 'scm' ? {
        provider: input.source.provider,
        connectionId: input.source.connectionId,
        bindingId: input.source.bindingId,
        namespace: input.source.namespace,
        project: input.source.project,
        repositoryId: input.source.repositoryId,
        repo: input.source.repo,
        branch: input.source.branch,
        manifestPath: input.source.manifestPath,
      } : undefined,
      manifestPath: input.source.type === 'scm'
        ? input.source.manifestPath
        : 'manifest/package.xml',
      manifestContent,
    });

    let workspace: WorkbenchWorkspace | undefined;
    try {
      workspace = await this.resolvePreviewWorkspace(resolution);
      if (manifestContent) {
        fs.mkdirSync(path.dirname(workspace.manifestAbsolutePath), { recursive: true });
        fs.writeFileSync(workspace.manifestAbsolutePath, manifestContent, 'utf8');
      }
      const dependency = buildDependencyPreview(
        `preview-${cacheKey.slice(0, 16)}`,
        workspace,
        input.dependencyPolicy,
      );
      const resolvedManifest = parsePackageXml(
        fs.readFileSync(workspace.manifestAbsolutePath, 'utf8'),
      );
      const value = {
        normalized: input,
        policy: input.policy,
        stages,
        capabilities: await this.capabilities(),
        executionAvailable: true as const,
        readOnly: true as const,
        sourceResolution: {
          type: input.source.type,
          mode: workspace.mode,
          manifest: workspace.manifestRelative,
          apiVersion: resolvedManifest.apiVersion ?? apiVersion,
          selectedComponents: resolvedManifest.members.length,
        },
        dependencies: {
          nodes: dependency.graph.nodes,
          edges: dependency.graph.edges,
          missing: dependency.missing,
          cycles: dependency.cycles,
          reasons: dependency.decisions,
          decisions: dependency.decisions,
          blocking: dependency.blocking,
          summary: dependency.summary,
          resolvedSelections: dependency.resolvedSelections,
          batches: dependency.plan.batches,
          batchEstimate: {
            ...dependency.plan.metrics,
          },
        },
      };
      this.setPreviewCache(cacheKey, value);
      return { ...value, cache: { hit: false } };
    } finally {
      await workspace?.cleanup?.().catch(() => undefined);
    }
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

  async listHistory(query: WorkbenchHistoryQuery, actor: WorkbenchActor) {
    const page = positivePage(query.page, 1, 10_000);
    const pageSize = positivePage(query.pageSize, 20, 100);
    const source = query.source?.trim();
    const environment = query.environment?.trim();
    const status = query.status?.trim();
    const owner = query.owner?.trim();
    if (source && !['org_compare', 'scm'].includes(source)) {
      throw new BadRequestException('source must be org_compare or scm');
    }
    if (environment && !['scratch', 'sandbox', 'production'].includes(environment)) {
      throw new BadRequestException('Invalid deployment environment');
    }
    if (status && ![
      'planned',
      'awaiting_approval',
      'approved',
      'rejected',
      'running',
      'passed',
      'failed',
      'cancelled',
    ].includes(status)) {
      throw new BadRequestException('Invalid deployment quality status');
    }
    if (!actor.isAdmin && owner && owner !== actor.userId) {
      throw new ForbiddenException('Only administrators can view another owner’s deployment history');
    }
    const dateFrom = parseHistoryDate(query.dateFrom, 'dateFrom');
    const dateTo = parseHistoryDate(query.dateTo, 'dateTo', true);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be before dateTo');
    }

    const where: Prisma.DeploymentQualityRunWhereInput = {
      createdBy: actor.isAdmin ? owner || undefined : actor.userId,
      targetOrgId: query.target?.trim() || undefined,
      targetProfile: environment || undefined,
      status: status || undefined,
      createdAt: dateFrom || dateTo ? { gte: dateFrom, lte: dateTo } : undefined,
      source: source ? { path: ['type'], equals: source } : undefined,
    };
    const [total, runs] = await Promise.all([
      prisma.deploymentQualityRun.count({ where }),
      prisma.deploymentQualityRun.findMany({
        where,
        include: {
          stages: {
            orderBy: { ordinal: 'asc' },
            select: {
              key: true,
              status: true,
              durationMs: true,
              summary: true,
              artifacts: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const [owners, targets] = await Promise.all([
      prisma.appUser.findMany({
        where: { id: { in: [...new Set(runs.map((run) => run.createdBy))] } },
        select: { id: true, displayName: true, email: true },
      }),
      prisma.orgConnection.findMany({
        where: { id: { in: [...new Set(runs.map((run) => run.targetOrgId))] } },
        select: { id: true, alias: true, username: true, type: true },
      }),
    ]);
    const ownerById = new Map(owners.map((item) => [item.id, item]));
    const targetById = new Map(targets.map((item) => [item.id, item]));
    return {
      items: runs.map((run) => {
        const sourceRecord = record(run.source);
        const stageCounts = run.stages.reduce<Record<string, number>>((counts, stage) => {
          counts[stage.status] = (counts[stage.status] ?? 0) + 1;
          return counts;
        }, {});
        const validation = run.stages.find((stage) => stage.key === 'validation');
        const coverage = historyCoverage(run.stages);
        const sourceType = sourceRecord.type === 'org_compare' ? 'org_compare' : 'scm';
        const sourceLabel = sourceType === 'org_compare'
          ? String(sourceRecord.sourceOrgId ?? 'Source org')
          : [
              sourceRecord.provider,
              sourceRecord.repo,
              sourceRecord.branch ? `@${String(sourceRecord.branch)}` : undefined,
            ].filter(Boolean).join(' ');
        return {
          id: run.id,
          name: run.name,
          description: run.description,
          source: { type: sourceType, label: sourceLabel, value: sourceRecord },
          target: targetById.get(run.targetOrgId) ?? { id: run.targetOrgId },
          environment: run.targetProfile,
          strategy: run.strategy,
          status: run.status,
          owner: ownerById.get(run.createdBy) ?? { id: run.createdBy },
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          durationMs: run.stages.reduce((sum, stage) => sum + (stage.durationMs ?? 0), 0),
          stageCounts,
          validation: {
            id: run.validationId,
            status: validation?.status ?? 'not_required',
          },
          coverage,
          gateOutcome: historyGateOutcome(run.status, run.stages),
          summary: run.summary,
          detailLinks: {
            status: `/deployment-workbench/${run.id}/status`,
            stages: `/deployment-workbench/${run.id}/stages`,
            results: `/deployment-workbench/${run.id}/results`,
          },
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStatus(id: string, userId: string, isAdmin = false) {
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
    }, isAdmin);
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

  async getPolicy(id: string, userId: string, isAdmin = false) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      targetProfile: true,
      strategy: true,
      policySnapshot: true,
      dependencyPolicy: true,
      createdAt: true,
    }, isAdmin);
    return {
      id: run.id,
      targetProfile: run.targetProfile,
      strategy: run.strategy,
      policy: deploymentPolicySchema.parse(run.policySnapshot),
      dependencyPolicy: run.dependencyPolicy,
      capturedAt: run.createdAt,
    };
  }

  async getStages(id: string, userId: string, isAdmin = false) {
    await this.requireOwnedRun(id, userId, isAdmin);
    return prisma.deploymentQualityStage.findMany({
      where: { runId: id },
      orderBy: { ordinal: 'asc' },
    });
  }

  async getResults(id: string, userId: string, isAdmin = false) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      status: true,
      summary: true,
      artifacts: true,
      validationId: true,
    }, isAdmin);
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

  async destructiveReview(id: string, userId: string, isAdmin = false) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      destructiveSelections: true,
      apiVersion: true,
      manifestXml: true,
    }, isAdmin);
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

  async getProgress(id: string, userId: string, isAdmin = false) {
    const run = await this.ownedRun(id, userId, {
      id: true,
      artifacts: true,
      status: true,
      currentStage: true,
    }, isAdmin);
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

  private async resolvePreviewWorkspace(
    resolution: Promise<WorkbenchWorkspace>,
  ): Promise<WorkbenchWorkspace> {
    const configured = Number.parseInt(process.env.WORKBENCH_PREVIEW_TIMEOUT_MS ?? '', 10);
    const timeoutMs = Number.isFinite(configured)
      ? Math.min(Math.max(configured, 1_000), 120_000)
      : 45_000;
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        resolution,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new RequestTimeoutException('Workbench source preview timed out')),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      if (error instanceof RequestTimeoutException) {
        void resolution.then(
          (workspace) => workspace.cleanup?.().catch(() => undefined),
          () => undefined,
        );
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private getPreviewCache(key: string): Record<string, unknown> | undefined {
    const entry = this.previewCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.previewCache.delete(key);
      return undefined;
    }
    this.previewCache.delete(key);
    this.previewCache.set(key, entry);
    return entry.value;
  }

  private setPreviewCache(key: string, value: Record<string, unknown>) {
    const configured = Number.parseInt(process.env.WORKBENCH_PREVIEW_CACHE_TTL_MS ?? '', 10);
    const ttlMs = Number.isFinite(configured)
      ? Math.min(Math.max(configured, 0), 300_000)
      : 30_000;
    if (ttlMs === 0) return;
    const now = Date.now();
    for (const [candidate, entry] of this.previewCache) {
      if (entry.expiresAt <= now) this.previewCache.delete(candidate);
    }
    this.previewCache.set(key, { expiresAt: now + ttlMs, value });
    while (this.previewCache.size > PREVIEW_CACHE_LIMIT) {
      const oldest = this.previewCache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.previewCache.delete(oldest);
    }
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
      const sourceOrg = await assertOrgOwned(input.source.sourceOrgId, userId, prisma);
      if (input.source.comparisonId) {
        const comparison = await prisma.metadataComparison.findFirst({
          where: { id: input.source.comparisonId, createdBy: userId },
          select: { id: true },
        });
        if (!comparison) throw new NotFoundException('Metadata comparison not found');
      }
      return { target, sourceOrg };
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
    return { target, sourceOrg: undefined };
  }

  private async requireOwnedRun(id: string, userId: string, isAdmin = false) {
    const run = await prisma.deploymentQualityRun.findFirst({
      where: { id, createdBy: isAdmin ? undefined : userId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Deployment workbench run not found');
    return run;
  }

  private async ownedRun<T extends Prisma.DeploymentQualityRunSelect>(
    id: string,
    userId: string,
    select: T,
    isAdmin = false,
  ) {
    const run = await prisma.deploymentQualityRun.findFirst({
      where: { id, createdBy: isAdmin ? undefined : userId },
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positivePage(value: string | undefined, fallback: number, maximum: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new BadRequestException(`Pagination value must be an integer from 1 to ${maximum}`);
  }
  return parsed;
}

function parseHistoryDate(
  value: string | undefined,
  label: 'dateFrom' | 'dateTo',
  endOfDay = false,
): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is not a valid date`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function historyCoverage(stages: Array<{ summary: unknown; artifacts: unknown }>): number | null {
  for (const stage of stages) {
    const summaryCoverage = Number(record(stage.summary).coverage);
    if (Number.isFinite(summaryCoverage)) return summaryCoverage;
    const artifactCoverage = Number(record(stage.artifacts).coverage);
    if (Number.isFinite(artifactCoverage)) return artifactCoverage;
  }
  return null;
}

function historyGateOutcome(
  status: string,
  stages: Array<{ status: string }>,
): 'passed' | 'blocked' | 'cancelled' | 'pending' {
  if (status === 'passed') return 'passed';
  if (status === 'cancelled') return 'cancelled';
  if (
    ['failed', 'rejected'].includes(status)
    || stages.some((stage) => ['failed', 'blocked'].includes(stage.status))
  ) return 'blocked';
  return 'pending';
}
