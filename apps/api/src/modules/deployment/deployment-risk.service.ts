import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  computeDeploymentRisk,
  deploymentRiskRequestSchema,
  type DeploymentRiskResult,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { assertOrgOwned } from '../../common/user-tenancy.util';

const HISTORY_SAMPLE = 20;

@Injectable()
export class DeploymentRiskService {
  private readonly logger = new Logger(DeploymentRiskService.name);

  constructor(private readonly nvidia: NvidiaService) {}

  /**
   * Score a prospective deployment. Deterministic factors come from the
   * package shape, target org type, deployment history, and the latest
   * coverage snapshot; the AI narrative is optional decoration.
   */
  async score(
    body: unknown,
    userId: string,
    isAdmin: boolean,
  ): Promise<DeploymentRiskResult & { narrative: string | null }> {
    const input = deploymentRiskRequestSchema.parse(body);
    const target = isAdmin
      ? await prisma.orgConnection.findUnique({ where: { id: input.targetOrgId } })
      : await assertOrgOwned(input.targetOrgId, userId, prisma);
    if (!target) throw new NotFoundException('Target org not found');

    const [history, coverageSnapshot] = await Promise.all([
      prisma.deployment.findMany({
        where: { targetOrgId: input.targetOrgId, status: { in: ['completed', 'partial', 'failed'] } },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_SAMPLE,
        select: { status: true },
      }),
      prisma.orgCoverageSnapshot.findFirst({
        where: { orgConnectionId: input.targetOrgId },
        orderBy: { capturedAt: 'desc' },
      }),
    ]);

    const failureRate = history.length >= 3
      ? history.filter((row) => row.status === 'failed').length / history.length
      : null;

    const componentCount = input.selections.reduce((sum, sel) => sum + sel.members.length, 0);
    const destructiveCount = (input.destructiveSelections ?? []).reduce(
      (sum, sel) => sum + sel.members.length,
      0,
    );

    const result = computeDeploymentRisk({
      componentCount,
      metadataTypes: [
        ...input.selections.map((sel) => sel.metadataType),
        ...(input.destructiveSelections ?? []).map((sel) => sel.metadataType),
      ],
      destructiveCount,
      testLevel: input.testLevel ?? null,
      targetOrgType: (target.type as 'prod' | 'sandbox' | 'scratch') ?? null,
      recentFailureRate: failureRate,
      orgWideCoverage: coverageSnapshot?.percentCovered ?? null,
    });

    let narrative: string | null = null;
    if (input.narrative) {
      narrative = await this.generateNarrative(result, target.alias);
    }
    return { ...result, narrative };
  }

  private async generateNarrative(
    result: DeploymentRiskResult,
    targetAlias: string,
  ): Promise<string | null> {
    try {
      const triggered = result.factors.filter((factor) => factor.triggered);
      const response = await this.nvidia.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a Salesforce release engineer. In at most 3 sentences, explain the ' +
              'deployment risk to a teammate and give one concrete mitigation. No preamble.',
          },
          {
            role: 'user',
            content:
              `Risk score ${result.score}/100 (${result.level}) deploying to ${targetAlias}.\n` +
              `Triggered factors:\n${triggered.map((factor) => `- ${factor.label}: ${factor.detail}`).join('\n') || '- none'}`,
          },
        ],
        maxTokens: 300,
      });
      const content = response.content?.trim();
      if (!content || /dev mode/i.test(content)) return null;
      return content;
    } catch (error) {
      this.logger.warn(
        `risk narrative failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
