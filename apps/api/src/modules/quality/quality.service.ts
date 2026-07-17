import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import { createSfCliClient, type ApexTestRunResult } from '@sfcc/sf-cli';
import { z } from 'zod';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import { NotificationsService } from '../notifications/notifications.service';

export const apexRunRequestSchema = z
  .object({
    orgId: z.string().uuid(),
    testLevel: z
      .enum(['RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests'])
      .default('RunLocalTests'),
    classNames: z.array(z.string().trim().min(1).max(255)).max(200).optional(),
    waitMinutes: z.number().int().min(5).max(240).default(60),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.testLevel === 'RunSpecifiedTests' && (value.classNames?.length ?? 0) === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['classNames'],
        message: 'RunSpecifiedTests requires at least one class name',
      });
    }
  });

function percent(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);
  private readonly sfCli = createSfCliClient();

  constructor(private readonly notifications: NotificationsService) {}

  /**
   * Start an Apex test run. The CLI call (which can take many minutes) runs
   * detached; clients poll the run row for progress. One active run per org.
   */
  async startRun(body: unknown, userId: string, isAdmin: boolean) {
    const input = apexRunRequestSchema.parse(body);
    const org = isAdmin
      ? await prisma.orgConnection.findUnique({ where: { id: input.orgId } })
      : await assertOrgOwned(input.orgId, userId, prisma);
    if (!org) throw new NotFoundException('Org not found');

    const active = await prisma.apexTestRun.findFirst({
      where: { orgConnectionId: org.id, status: { in: ['pending', 'running'] } },
    });
    if (active) {
      throw new ConflictException('An Apex test run is already in progress for this org');
    }

    const alias = org.username ?? org.alias;
    const run = await prisma.apexTestRun.create({
      data: {
        orgConnectionId: org.id,
        alias: org.alias,
        testLevel: input.testLevel,
        status: 'running',
        requestedBy: userId,
      },
    });

    // Detached execution — outcome lands on the row; a failure here must
    // never bubble into the HTTP request that started the run.
    void this.executeRun(run.id, alias, org.id, input, userId).catch((error) => {
      this.logger.warn(
        `apex run ${run.id} crashed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return { runId: run.id, status: 'running' };
  }

  private async executeRun(
    runId: string,
    alias: string,
    orgConnectionId: string,
    input: z.infer<typeof apexRunRequestSchema>,
    userId: string,
  ): Promise<void> {
    try {
      const result = await this.sfCli.runApexTests(alias, {
        testLevel: input.testLevel,
        classNames: input.classNames,
        waitMinutes: input.waitMinutes,
      });
      const parsed = (result.data as { result?: ApexTestRunResult } | undefined)?.result;
      if (!result.success || !parsed?.summary) {
        // Some CLI versions exit non-zero when tests fail but still emit the
        // JSON summary; only treat it as an execution failure without one.
        if (!parsed?.summary) {
          throw new Error(result.error || 'Apex test execution failed');
        }
      }

      const summary = parsed.summary ?? {};
      const failing = summary.failing ?? 0;
      const orgWide = percent(summary.orgWideCoverage);
      await prisma.apexTestRun.update({
        where: { id: runId },
        data: {
          status: failing > 0 ? 'partial' : 'completed',
          outcome: summary.outcome ?? (failing > 0 ? 'Failed' : 'Passed'),
          testsRan: summary.testsRan ?? null,
          passing: summary.passing ?? null,
          failing,
          skipped: summary.skipped ?? null,
          testRunCoverage: percent(summary.testRunCoverage),
          orgWideCoverage: orgWide,
          summary: summary as Prisma.InputJsonValue,
          tests: (parsed.tests ?? []) as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      if (orgWide !== null) {
        await prisma.orgCoverageSnapshot.create({
          data: { orgConnectionId, percentCovered: orgWide, source: 'test_run' },
        });
      }
      await this.notifications.notify({
        userId,
        category: 'deployment',
        level: failing > 0 ? 'warning' : 'success',
        title: failing > 0
          ? `Apex tests finished with ${failing} failure${failing === 1 ? '' : 's'}`
          : 'Apex tests passed',
        body: `${summary.testsRan ?? 0} tests ran against ${alias}.`,
        link: `/quality?org=${orgConnectionId}`,
      });
    } catch (error) {
      await prisma.apexTestRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      }).catch(() => undefined);
    }
  }

  async listRuns(orgId: string | undefined, userId: string, isAdmin: boolean) {
    if (orgId && !isAdmin) await assertOrgOwned(orgId, userId, prisma);
    const runs = await prisma.apexTestRun.findMany({
      where: {
        ...(orgId ? { orgConnectionId: orgId } : {}),
        ...(isAdmin ? {} : { requestedBy: userId }),
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return runs.map((run) => ({
      id: run.id,
      orgConnectionId: run.orgConnectionId,
      alias: run.alias,
      testLevel: run.testLevel,
      status: run.status,
      outcome: run.outcome,
      testsRan: run.testsRan,
      passing: run.passing,
      failing: run.failing,
      skipped: run.skipped,
      testRunCoverage: run.testRunCoverage,
      orgWideCoverage: run.orgWideCoverage,
      error: run.error,
      requestedBy: run.requestedBy,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    }));
  }

  async getRun(id: string, userId: string, isAdmin: boolean) {
    const run = await prisma.apexTestRun.findUnique({ where: { id } });
    if (!run || (!isAdmin && run.requestedBy !== userId)) {
      throw new NotFoundException('Test run not found');
    }
    return {
      id: run.id,
      orgConnectionId: run.orgConnectionId,
      alias: run.alias,
      testLevel: run.testLevel,
      status: run.status,
      outcome: run.outcome,
      testsRan: run.testsRan,
      passing: run.passing,
      failing: run.failing,
      skipped: run.skipped,
      testRunCoverage: run.testRunCoverage,
      orgWideCoverage: run.orgWideCoverage,
      error: run.error,
      tests: (run.tests as Array<Record<string, unknown>> | null) ?? [],
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  }

  /** Current + historical org-wide coverage for the trend chart. */
  async getCoverage(orgId: string, userId: string, isAdmin: boolean) {
    if (!orgId) throw new BadRequestException('orgId is required');
    const org = isAdmin
      ? await prisma.orgConnection.findUnique({ where: { id: orgId } })
      : await assertOrgOwned(orgId, userId, prisma);
    if (!org) throw new NotFoundException('Org not found');

    const snapshots = await prisma.orgCoverageSnapshot.findMany({
      where: { orgConnectionId: orgId },
      orderBy: { capturedAt: 'asc' },
      take: 200,
    });
    return {
      orgId,
      alias: org.alias,
      current: snapshots.length > 0 ? snapshots[snapshots.length - 1].percentCovered : null,
      snapshots: snapshots.map((snapshot) => ({
        percentCovered: snapshot.percentCovered,
        source: snapshot.source,
        capturedAt: snapshot.capturedAt.toISOString(),
      })),
    };
  }

  /** Query live org-wide coverage from the Tooling API and store a snapshot. */
  async captureCoverage(orgId: string, userId: string, isAdmin: boolean) {
    const org = isAdmin
      ? await prisma.orgConnection.findUnique({ where: { id: orgId } })
      : await assertOrgOwned(orgId, userId, prisma);
    if (!org) throw new NotFoundException('Org not found');

    const alias = org.username ?? org.alias;
    const result = await this.sfCli.queryTooling(
      alias,
      'SELECT PercentCovered FROM ApexOrgWideCoverage',
    );
    const records = (result.data as { result?: { records?: Array<{ PercentCovered?: number }> } } | undefined)
      ?.result?.records;
    const value = records?.[0]?.PercentCovered;
    if (!result.success || typeof value !== 'number') {
      throw new BadRequestException(
        result.error || 'Could not read org-wide coverage from the Tooling API',
      );
    }
    await prisma.orgCoverageSnapshot.create({
      data: { orgConnectionId: orgId, percentCovered: value, source: 'manual' },
    });
    return { orgId, percentCovered: value };
  }
}
