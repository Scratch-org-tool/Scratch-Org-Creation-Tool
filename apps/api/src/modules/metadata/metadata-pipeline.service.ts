import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { orgToOrgMetadataPipelineSchema, resolveManifestXml } from '@sfcc/shared';
import { DeploymentService } from '../deployment/deployment.service';
import { assertOrgOwned } from '../../common/user-tenancy.util';

@Injectable()
export class MetadataPipelineService {
  constructor(private readonly deploymentService: DeploymentService) {}

  async startPipeline(body: unknown, userId: string) {
    const input = orgToOrgMetadataPipelineSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);

    const packageXml = resolveManifestXml({
      selections: input.selections,
      packageXml: input.packageXml,
      apiVersion: input.apiVersion,
    });

    const run = await prisma.automationRun.create({
      data: {
        intent: 'org_to_org_metadata_data',
        status: 'running',
        createdBy: userId,
        // The full deploy input is persisted so a paused run can be resumed
        // (re-deployed) without the client resubmitting selections.
        config: { ...input, packageXml } as Prisma.InputJsonValue,
        checkpoint: {
          completedSteps: [],
          // Must be a valid PipelineStepId — resumeRun dispatches on this.
          resumeFrom: 'azure_metadata_deploy',
        } as Prisma.InputJsonValue,
      },
    });

    const deployResult = await this.deploymentService.deployOrgToOrgMetadata(
      { ...input, packageXml },
      userId,
      { automationRunId: run.id },
    );

    return {
      automationRunId: run.id,
      ...deployResult,
    };
  }
}
