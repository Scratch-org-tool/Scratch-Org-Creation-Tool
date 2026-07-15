import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { activeConnectedOrgWhere, connectedOrgWhere } from '../../common/user-tenancy.util';
import { JobsService } from '../jobs/jobs.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function humanizeJobType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapRecentJob(job: {
  id: string;
  type: string;
  status: string;
  queue: string;
  alias: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  payload: unknown;
  parentRun: { id: string; intent: string; createdBy: string } | null;
}) {
  const durationMs =
    job.startedAt && job.finishedAt
      ? job.finishedAt.getTime() - job.startedAt.getTime()
      : null;

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const source = payload.gitSource as Record<string, unknown> | undefined;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    queue: job.queue,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    displayName: job.alias ?? humanizeJobType(job.type),
    durationMs,
    completedAt: job.finishedAt?.toISOString() ?? null,
    triggeredBy: job.parentRun?.createdBy ?? 'system',
    automationRunId: job.parentRun?.id ?? null,
    runIntent: job.parentRun?.intent ?? null,
    provider: typeof source?.provider === 'string' ? source.provider : null,
  };
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  async getDashboard(days = 7, userId?: string) {
    const periodDays = [7, 14, 30].includes(days) ? days : 7;
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const prevStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const userFilter = userId ? { createdBy: userId } : {};
    const jobUserFilter = userId
      ? {
          OR: [
            { createdBy: userId },
            { parentRun: { createdBy: userId } },
          ],
        }
      : {};

    const orgWhere = userId ? connectedOrgWhere(userId) : { type: { not: 'scratch' as const } };
    const activeOrgWhere = userId ? activeConnectedOrgWhere(userId) : { type: { not: 'scratch' as const }, status: 'active' as const };

    const [
      jobStats,
      orgCount,
      activeOrgCount,
      deploymentCount,
      recentDeployments,
      recentJobs,
      recentRuns,
      periodJobs,
      prevPeriodJobs,
      periodDeployments,
      prevPeriodDeployments,
      completedInPeriod,
      statusGroups,
      queueDepth,
    ] = await Promise.all([
      this.jobsService.getStats(userId),
      prisma.orgConnection.count({ where: orgWhere }),
      prisma.orgConnection.count({ where: activeOrgWhere }),
      prisma.deployment.count({ where: { createdAt: { gte: periodStart }, ...userFilter } }),
      prisma.deployment.findMany({
        where: userFilter,
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          targetOrg: { select: { alias: true } },
          job: {
            select: {
              id: true,
              type: true,
              status: true,
              startedAt: true,
              finishedAt: true,
            },
          },
        },
      }),
      prisma.job.findMany({
        where: jobUserFilter,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          status: true,
          queue: true,
          alias: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          payload: true,
          parentRun: { select: { id: true, intent: true, createdBy: true } },
        },
      }),
      prisma.automationRun.findMany({
        where: userFilter,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { jobs: { select: { id: true, status: true, type: true } } },
      }),
      prisma.job.count({ where: { createdAt: { gte: periodStart }, ...jobUserFilter } }),
      prisma.job.count({ where: { createdAt: { gte: prevStart, lt: periodStart }, ...jobUserFilter } }),
      prisma.deployment.count({ where: { createdAt: { gte: periodStart }, ...userFilter } }),
      prisma.deployment.count({ where: { createdAt: { gte: prevStart, lt: periodStart }, ...userFilter } }),
      prisma.job.findMany({
        where: {
          status: 'completed',
          finishedAt: { not: null, gte: periodStart },
          startedAt: { not: null },
          ...jobUserFilter,
        },
        select: { startedAt: true, finishedAt: true },
        take: 500,
      }),
      prisma.job.groupBy({
        by: ['status'],
        where: { createdAt: { gte: periodStart }, ...jobUserFilter },
        _count: true,
      }),
      prisma.job.count({
        where: { status: { in: ['pending', 'queued', 'running'] }, ...jobUserFilter },
      }),
    ]);

    const periodCompleted = await prisma.job.count({
      where: { status: 'completed', createdAt: { gte: periodStart }, ...jobUserFilter },
    });
    const prevCompleted = await prisma.job.count({
      where: { status: 'completed', createdAt: { gte: prevStart, lt: periodStart }, ...jobUserFilter },
    });
    const periodFailed = await prisma.job.count({
      where: { status: 'failed', createdAt: { gte: periodStart }, ...jobUserFilter },
    });
    const prevFailed = await prisma.job.count({
      where: { status: 'failed', createdAt: { gte: prevStart, lt: periodStart }, ...jobUserFilter },
    });
    const periodRunning = await prisma.job.count({
      where: { status: 'running', createdAt: { gte: periodStart }, ...jobUserFilter },
    });
    const prevRunning = await prisma.job.count({
      where: { status: 'running', createdAt: { gte: prevStart, lt: periodStart }, ...jobUserFilter },
    });

    const avgDuration = completedInPeriod.length
      ? Math.round(
          completedInPeriod.reduce(
            (sum, j) => sum + (j.finishedAt!.getTime() - j.startedAt!.getTime()),
            0,
          ) / completedInPeriod.length,
        )
      : 0;

    const sparklineJobs = await prisma.job.findMany({
      where: { createdAt: { gte: periodStart }, ...jobUserFilter },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const sparklines: { date: string; count: number }[] = [];
    const sparklinesCompleted: { date: string; count: number }[] = [];
    const sparklinesFailed: { date: string; count: number }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      const key = dayKey(d);
      const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      const inDay = sparklineJobs.filter((j) => j.createdAt >= d && j.createdAt < next);
      sparklines.push({ date: key, count: inDay.length });
      sparklinesCompleted.push({
        date: key,
        count: inDay.filter((j) => j.status === 'completed').length,
      });
      sparklinesFailed.push({
        date: key,
        count: inDay.filter((j) => j.status === 'failed').length,
      });
    }

    const durationByDay = new Map<string, number[]>();
    for (const j of completedInPeriod) {
      const key = dayKey(j.finishedAt!);
      const ms = j.finishedAt!.getTime() - j.startedAt!.getTime();
      const arr = durationByDay.get(key) ?? [];
      arr.push(ms);
      durationByDay.set(key, arr);
    }
    const durationSeries = sparklines.map(({ date }) => {
      const samples = durationByDay.get(date) ?? [];
      const avgMs = samples.length
        ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
        : 0;
      return { date, avgMs };
    });

    const statusDistribution = {
      completed: 0,
      failed: 0,
      running: 0,
      cancelled: 0,
      pending: 0,
      queued: 0,
    };
    for (const g of statusGroups) {
      const s = g.status as keyof typeof statusDistribution;
      if (s in statusDistribution) statusDistribution[s] = g._count;
    }

    const successRate =
      periodJobs > 0 ? Math.round((periodCompleted / periodJobs) * 1000) / 10 : 0;
    const failureRate =
      periodJobs > 0 ? Math.round((periodFailed / periodJobs) * 1000) / 10 : 0;

    return {
      days: periodDays,
      jobStats,
      orgCount,
      deploymentCount,
      avgJobDurationMs: avgDuration,
      trends: {
        totalJobs: pctChange(periodJobs, prevPeriodJobs),
        completed: pctChange(periodCompleted, prevCompleted),
        failed: pctChange(periodFailed, prevFailed),
        running: pctChange(periodRunning, prevRunning),
        deployments: pctChange(periodDeployments, prevPeriodDeployments),
      },
      sparklines,
      sparklinesCompleted,
      sparklinesFailed,
      statusDistribution,
      durationSeries,
      recentDeployments: recentDeployments.map((d) => ({
        provider:
          typeof (d.metadata as Record<string, unknown> | null)?.provider === 'string'
            ? ((d.metadata as Record<string, unknown>).provider as string)
            : d.strategy === 'azure'
              ? 'azure_devops'
              : d.strategy,
        id: d.id,
        status: d.status,
        repo: d.repo,
        branch: d.branch,
        strategy: d.strategy,
        createdAt: d.createdAt.toISOString(),
        targetOrgAlias: d.targetOrg?.alias ?? null,
        jobType: d.job?.type ?? null,
        jobId: d.job?.id ?? null,
      })),
      recentJobs: recentJobs.map(mapRecentJob),
      recentRuns,
      health: {
        avgJobDurationMs: avgDuration,
        apiOnline: true,
        redisConnected: Boolean(process.env.REDIS_URL ?? process.env.REDIS_HOST),
        aiProvider: process.env.NVIDIA_API_KEY ? 'NVIDIA NIM' : 'Dev mode',
        successRate,
        failureRate,
        activeOrgs: activeOrgCount,
        queueDepth,
        lastChecked: now.toISOString(),
      },
      datadog: this.getDatadogStub(),
    };
  }

  async getJobThroughput(hours = 24, userId?: string) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const jobUserFilter = userId
      ? { OR: [{ createdBy: userId }, { parentRun: { createdBy: userId } }] }
      : {};
    const jobs = await prisma.job.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since }, ...jobUserFilter },
      _count: true,
    });
    return jobs;
  }

  /**
   * Dead-letter list: failed jobs kept durably in Postgres (not just Bull's
   * capped removeOnFail window) so operators can inspect and replay them.
   */
  async listDeadLetters(userId: string, isAdmin: boolean, limit = 50) {
    const scope = isAdmin
      ? {}
      : { OR: [{ createdBy: userId }, { parentRun: { createdBy: userId } }] };
    const jobs = await prisma.job.findMany({
      where: { status: 'failed', ...scope },
      orderBy: { finishedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        queue: true,
        type: true,
        error: true,
        attempts: true,
        alias: true,
        createdBy: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        parentRunId: true,
        payload: true,
      },
    });
    return jobs.map((j) => {
      const payload = (j.payload ?? {}) as Record<string, unknown>;
      return {
        id: j.id,
        queue: j.queue,
        type: j.type,
        error: j.error,
        attempts: j.attempts,
        alias: j.alias,
        createdBy: j.createdBy,
        createdAt: j.createdAt.toISOString(),
        startedAt: j.startedAt?.toISOString() ?? null,
        failedAt: j.finishedAt?.toISOString() ?? null,
        parentRunId: j.parentRunId,
        replayable: !j.parentRunId && j.type !== 'data_deploy_chunk',
        replayOfJobId: typeof payload.replayOfJobId === 'string' ? payload.replayOfJobId : null,
      };
    });
  }

  /** Replay a dead-lettered job as a fresh queue job with the original payload. */
  async replayDeadLetter(jobId: string, userId: string, isAdmin: boolean) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { parentRun: { select: { createdBy: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');
    const owner = job.parentRun?.createdBy ?? job.createdBy;
    if (!isAdmin && owner !== userId) throw new NotFoundException('Job not found');
    if (job.status !== 'failed') {
      throw new BadRequestException(`Only failed jobs can be replayed — this job is ${job.status}`);
    }
    if (job.parentRunId) {
      throw new BadRequestException(
        'This job belongs to an automation run — resume the run instead of replaying the job directly',
      );
    }
    if (job.type === 'data_deploy_chunk') {
      throw new BadRequestException(
        'Insert data chunks cannot be replayed safely because the failed bulk job may have committed some records',
      );
    }

    const { dbJobId: _dbJobId, ...payload } = (job.payload ?? {}) as Record<string, unknown>;
    const replay = await this.orchestrator.enqueueJob(
      job.queue,
      job.type,
      { ...payload, replayOfJobId: job.id },
      { createdBy: userId },
    );
    return { replayed: true, originalJobId: job.id, jobId: replay.id, queue: job.queue, type: job.type };
  }

  private getDatadogStub() {
    return {
      enabled: Boolean(process.env.DATADOG_API_KEY),
      status: process.env.DATADOG_API_KEY ? 'configured' : 'not_configured',
      metricsEndpoint: '/api/monitoring/datadog',
    };
  }
}
