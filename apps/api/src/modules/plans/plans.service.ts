import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import {
  deploymentPlanCreateSchema,
  deploymentPlanUpdateSchema,
  type DeploymentPlanDataConfig,
  type DeploymentPlanMetadataConfig,
} from '@sfcc/shared';
import { DeploymentService } from '../deployment/deployment.service';
import { MetadataPipelineService } from '../metadata/metadata-pipeline.service';
import { DataService } from '../data/data.service';
import { assertOrgOwned, assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';

/**
 * Saved, reusable deployment plans — the automation seam. A plan captures
 * source org, target org, metadata selections, and data query sets; today it
 * is executed manually, later the same execute path can be triggered by
 * schedules or webhooks without rework.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly metadataPipeline: MetadataPipelineService,
    private readonly dataService: DataService,
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
   * Execute a saved plan through the existing orchestration paths:
   * - metadata plans → org-to-org metadata deploy (validate/quick-deploy capable)
   * - data plans → chunked org-to-org data batch deploy
   * - combined plans → metadata deploy with chained data deploys (data runs
   *   only after the metadata deploy completes; the automation run tracks both)
   */
  async execute(id: string, userId: string) {
    const plan = await prisma.deploymentPlan.findUnique({ where: { id } });
    assertResourceOwner(plan, userId, 'Deployment plan');
    const p = plan!;
    if (!p.enabled) throw new BadRequestException('Plan is disabled');
    if (!p.sourceOrgId || !p.targetOrgId) {
      throw new NotFoundException('Plan is missing source or target org');
    }

    const metadataConfig = (p.metadataConfig ?? undefined) as DeploymentPlanMetadataConfig | undefined;
    const dataConfig = (p.dataConfig ?? undefined) as DeploymentPlanDataConfig | undefined;

    const markStarted = () =>
      prisma.deploymentPlan.update({
        where: { id },
        data: { lastRunAt: new Date(), lastRunStatus: 'started' },
      });

    if (p.planType === 'data') {
      if (!dataConfig?.objects?.length) {
        throw new BadRequestException('Plan has no dataConfig to execute');
      }
      const result = await this.dataService.deployOrgToOrgBatch(
        {
          sourceOrgId: p.sourceOrgId,
          targetOrgId: p.targetOrgId,
          strategy: dataConfig.strategy ?? 'upsert',
          objects: dataConfig.objects,
        },
        userId,
      );
      await markStarted();
      return { planId: id, planType: p.planType, ...result };
    }

    if (!metadataConfig) {
      throw new BadRequestException('Plan has no metadataConfig to execute');
    }

    const deployInput = {
      sourceOrgId: p.sourceOrgId,
      targetOrgId: p.targetOrgId,
      ...metadataConfig,
      deploymentName: p.name,
    };

    if (p.planType === 'combined') {
      if (!dataConfig?.objects?.length) {
        throw new BadRequestException('Combined plan has no dataConfig to execute');
      }
      // Chained data deploys run only after the metadata deploy completes; the
      // automation run reaches a terminal state when every chained job does.
      const result = await this.metadataPipeline.startPipeline(
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
      await markStarted();
      return { planId: id, planType: p.planType, ...result };
    }

    const result = await this.deploymentService.deployOrgToOrgMetadata(deployInput, userId);
    await markStarted();
    return { planId: id, planType: p.planType, ...result };
  }
}
