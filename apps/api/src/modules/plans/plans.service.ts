import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma, type DeploymentPlan } from '@sfcc/db';
import {
  computeNextRun,
  deploymentPlanCreateSchema,
  deploymentPlanUpdateSchema,
  deploymentScheduleSchema,
  parseSchedule,
  type DeploymentPlanDataConfig,
  type DeploymentPlanMetadataConfig,
} from '@sfcc/shared';
import { z } from 'zod';
import { DeploymentService } from '../deployment/deployment.service';
import { MetadataPipelineService } from '../metadata/metadata-pipeline.service';
import { DataService } from '../data/data.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FreezeWindowService } from '../calendar/freeze-window.service';
import { assertOrgOwned, assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';

const planScheduleUpdateSchema = z
  .object({
    schedule: deploymentScheduleSchema.nullish(),
    scheduleEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleEnabled && !data.schedule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A schedule is required to enable automatic runs',
        path: ['schedule'],
      });
    }
  });

type PlanTrigger = 'manual' | 'schedule';

function extractRunIds(result: unknown): { jobId: string | null; automationRunId: string | null } {
  const record = (result ?? {}) as Record<string, unknown>;
  const jobId = typeof record.jobId === 'string' ? record.jobId : null;
  const automationRunId =
    typeof record.automationRunId === 'string'
      ? record.automationRunId
      : typeof record.runId === 'string'
        ? record.runId
        : null;
  return { jobId, automationRunId };
}

/**
 * Saved, reusable deployment plans — the automation seam. A plan captures
 * source org, target org, metadata selections, and data query sets. Plans can
 * be executed manually (`POST /plans/:id/execute`) or on a schedule; the same
 * execution path serves both, and every run is recorded for history.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly metadataPipeline: MetadataPipelineService,
    private readonly dataService: DataService,
    private readonly notifications: NotificationsService,
    private readonly freezeWindows: FreezeWindowService,
  ) {}

  async list(userId: string) {
    return prisma.deploymentPlan.findMany({
      where: userOwnedWhere(userId),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string, userId: string) {
    const plan = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(plan, userId, 'Deployment plan');
    return plan;
  }

  async create(body: unknown, userId: string) {
    const input = deploymentPlanCreateSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);

    return prisma.deploymentPlan.create({
      data: {
        name: input.name,
        description: input.description,
        sourceOrgId: input.sourceOrgId,
        targetOrgId: input.targetOrgId,
        planType: input.planType,
        metadataConfig: input.metadataConfig as Prisma.InputJsonValue,
        dataConfig: input.dataConfig as Prisma.InputJsonValue,
        enabled: input.enabled,
        createdBy: userId,
      },
    });
  }

  async update(id: string, body: unknown, userId: string) {
    const existing = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(existing, userId, 'Deployment plan');
    const input = deploymentPlanUpdateSchema.parse(body);
    if (input.sourceOrgId) await assertOrgOwned(input.sourceOrgId, userId, prisma);
    if (input.targetOrgId) await assertOrgOwned(input.targetOrgId, userId, prisma);

    return prisma.deploymentPlan.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sourceOrgId !== undefined ? { sourceOrgId: input.sourceOrgId } : {}),
        ...(input.targetOrgId !== undefined ? { targetOrgId: input.targetOrgId } : {}),
        ...(input.planType !== undefined ? { planType: input.planType } : {}),
        ...(input.metadataConfig !== undefined
          ? { metadataConfig: input.metadataConfig as Prisma.InputJsonValue }
          : {}),
        ...(input.dataConfig !== undefined
          ? { dataConfig: input.dataConfig as Prisma.InputJsonValue }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(existing, userId, 'Deployment plan');
    await prisma.deploymentPlan.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Attach, replace, enable or disable a plan's automation schedule. Enabling
   * computes the next fire time; disabling clears it while keeping the schedule
   * definition so it can be toggled back on later.
   */
  async updateSchedule(id: string, body: unknown, userId: string) {
    const existing = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(existing, userId, 'Deployment plan');
    const input = planScheduleUpdateSchema.parse(body);
    const schedule = input.schedule ?? parseSchedule(existing!.schedule);
    if (input.scheduleEnabled && !schedule) {
      throw new BadRequestException('A schedule is required to enable automatic runs');
    }
    const nextRunAt = input.scheduleEnabled && schedule ? computeNextRun(schedule) : null;
    return prisma.deploymentPlan.update({
      where: { id },
      data: {
        ...(schedule ? { schedule: schedule as unknown as Prisma.InputJsonValue } : {}),
        scheduleEnabled: input.scheduleEnabled,
        nextRunAt,
      },
    });
  }

  async listRuns(id: string, userId: string, limit = 20) {
    const existing = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(existing, userId, 'Deployment plan');
    return prisma.deploymentPlanRun.findMany({
      where: { planId: id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  /** Manually execute a plan (owner-checked). Records a run and returns its result. */
  async execute(id: string, userId: string) {
    const plan = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(plan, userId, 'Deployment plan');
    return this.runPlan(plan!, userId, 'manual');
  }

  /** Ids of plans whose schedule is due to fire. */
  async dueScheduledPlanIds(now = new Date(), take = 25): Promise<string[]> {
    const rows = await prisma.deploymentPlan.findMany({
      where: { scheduleEnabled: true, enabled: true, nextRunAt: { not: null, lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /**
   * Claim a due plan and run it. The claim advances nextRunAt in a single
   * conditional update so that, across clustered API replicas, exactly one
   * caller wins and the plan fires once per slot.
   */
  async runScheduledPlan(id: string, now = new Date()): Promise<{ claimed: boolean }> {
    const plan = await prisma.deploymentPlan.findUnique({ where: { id } });
    if (!plan || !plan.scheduleEnabled || !plan.enabled) return { claimed: false };
    const schedule = parseSchedule(plan.schedule);
    const nextRunAt = schedule ? computeNextRun(schedule, now) : null;
    const claim = await prisma.deploymentPlan.updateMany({
      where: { id, scheduleEnabled: true, enabled: true, nextRunAt: { not: null, lte: now } },
      data: { nextRunAt, lastScheduledRunAt: now },
    });
    if (claim.count !== 1) return { claimed: false };
    await this.runPlan(plan, plan.createdBy, 'schedule').catch(() => undefined);
    return { claimed: true };
  }

  private async runPlan(plan: DeploymentPlan, userId: string, trigger: PlanTrigger) {
    const run = await prisma.deploymentPlanRun.create({
      data: {
        planId: plan.id,
        trigger,
        status: 'started',
        planType: plan.planType,
        createdBy: userId,
      },
    });
    try {
      const result = await this.executePlanCore(plan, userId);
      const { jobId, automationRunId } = extractRunIds(result);
      await prisma.deploymentPlanRun.update({
        where: { id: run.id },
        data: { status: 'succeeded', jobId, automationRunId, finishedAt: new Date() },
      });
      await prisma.deploymentPlan.update({
        where: { id: plan.id },
        data: { lastRunAt: new Date(), lastRunStatus: 'started' },
      });
      return { planId: plan.id, planType: plan.planType, runId: run.id, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.deploymentPlanRun
        .update({
          where: { id: run.id },
          data: { status: 'failed', error: message.slice(0, 2000), finishedAt: new Date() },
        })
        .catch(() => undefined);
      await prisma.deploymentPlan
        .update({ where: { id: plan.id }, data: { lastRunAt: new Date(), lastRunStatus: 'failed' } })
        .catch(() => undefined);
      // A scheduled run has no human watching, and an enqueue failure never
      // reaches a worker (which is where job-terminal alerts come from), so we
      // surface it directly. Manual runs return the error to the caller instead.
      if (trigger === 'schedule') {
        await this.notifications
          .notify({
            userId,
            category: 'deployment',
            level: 'error',
            title: `Scheduled deployment could not start: ${plan.name}`,
            body: message.slice(0, 240),
            link: '/deployment-center/automations',
            metadata: { planId: plan.id, runId: run.id },
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  /**
   * Execute a plan through the existing orchestration paths:
   * - metadata plans → org-to-org metadata deploy (validate/quick-deploy capable)
   * - data plans → chunked org-to-org data batch deploy
   * - combined plans → metadata deploy with chained data deploys (data runs
   *   only after the metadata deploy completes; the automation run tracks both)
   */
  private async executePlanCore(plan: DeploymentPlan, userId: string) {
    if (!plan.enabled) throw new BadRequestException('Plan is disabled');
    if (!plan.sourceOrgId || !plan.targetOrgId) {
      throw new NotFoundException('Plan is missing source or target org');
    }

    // Freeze gate covers all plan types (metadata plans are also gated at the
    // deploy queue; data plans are only gated here).
    await this.freezeWindows.assertDeployAllowed({ targetOrgId: plan.targetOrgId });

    const metadataConfig = (plan.metadataConfig ?? undefined) as DeploymentPlanMetadataConfig | undefined;
    const dataConfig = (plan.dataConfig ?? undefined) as DeploymentPlanDataConfig | undefined;

    if (plan.planType === 'data') {
      if (!dataConfig?.objects?.length) {
        throw new BadRequestException('Plan has no dataConfig to execute');
      }
      return this.dataService.deployOrgToOrgBatch(
        {
          sourceOrgId: plan.sourceOrgId,
          targetOrgId: plan.targetOrgId,
          strategy: dataConfig.strategy ?? 'upsert',
          objects: dataConfig.objects,
        },
        userId,
      );
    }

    if (!metadataConfig) {
      throw new BadRequestException('Plan has no metadataConfig to execute');
    }

    const deployInput = {
      sourceOrgId: plan.sourceOrgId,
      targetOrgId: plan.targetOrgId,
      ...metadataConfig,
      deploymentName: plan.name,
    };

    if (plan.planType === 'combined') {
      if (!dataConfig?.objects?.length) {
        throw new BadRequestException('Combined plan has no dataConfig to execute');
      }
      return this.metadataPipeline.startPipeline(
        {
          ...deployInput,
          chainDataDeploy: true,
          dataDeployConfig: dataConfig.objects.map((obj) => ({
            objectName: obj.objectName,
            soql: obj.soql,
            strategy: dataConfig.strategy ?? 'upsert',
            matchField: obj.matchField,
          })),
        },
        userId,
      );
    }

    return this.deploymentService.deployOrgToOrgMetadata(deployInput, userId);
  }
}
