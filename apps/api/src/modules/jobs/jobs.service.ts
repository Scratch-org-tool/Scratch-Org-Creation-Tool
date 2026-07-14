import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, type JobStatus, type LogStream, Prisma } from '@sfcc/db';
import { assertResourceOwner } from '../../common/user-tenancy.util';

const DEFAULT_LOG_TAIL = 500;

@Injectable()
export class JobsService {
  async create(data: {
    queue: string;
    type: string;
    payload: Record<string, unknown>;
    parentRunId?: string;
    createdBy?: string;
  }) {
    return prisma.job.create({
      data: {
        queue: data.queue,
        type: data.type,
        payload: data.payload as Prisma.InputJsonValue,
        parentRunId: data.parentRunId,
        createdBy: data.createdBy ?? 'system',
        status: 'queued',
      },
    });
  }

  async findAll(filters?: { status?: JobStatus; parentRunId?: string }, userId?: string) {
    const userScope = userId
      ? {
          OR: [
            { createdBy: userId },
            { parentRun: { createdBy: userId } },
          ],
        }
      : {};
    return prisma.job.findMany({
      where: {
        status: filters?.status,
        parentRunId: filters?.parentRunId,
        ...userScope,
      },
      include: { logs: { orderBy: { timestamp: 'asc' }, take: 100 } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, userId?: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { parentRun: true },
    });
    if (!job) return null;
    if (userId) {
      if (job.parentRun) assertResourceOwner(job.parentRun, userId, 'Job');
      else assertResourceOwner(job, userId, 'Job');
    }

    const logCount = await prisma.jobLog.count({ where: { jobId: id } });
    const logs = await prisma.jobLog.findMany({
      where: { jobId: id },
      orderBy: { timestamp: 'desc' },
      take: DEFAULT_LOG_TAIL,
    });

    return {
      ...job,
      logs: logs.reverse(),
      logsTruncated: logCount > DEFAULT_LOG_TAIL,
      logCount,
    };
  }

  async updateStatus(id: string, status: JobStatus, error?: string) {
    return prisma.job.update({
      where: { id },
      data: {
        status,
        error,
        startedAt: status === 'running' ? new Date() : undefined,
        finishedAt: ['completed', 'failed', 'cancelled'].includes(status) ? new Date() : undefined,
        attempts: status === 'running' ? { increment: 1 } : undefined,
      },
    });
  }

  async addLog(jobId: string, stream: LogStream, line: string) {
    return prisma.jobLog.create({
      data: { jobId, stream, line },
    });
  }

  async getLogs(jobId: string, tail = DEFAULT_LOG_TAIL) {
    const limit = Math.min(Math.max(tail, 1), 2000);
    const logs = await prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return logs.reverse();
  }

  async getStats(userId?: string) {
    const userScope = userId
      ? { OR: [{ createdBy: userId }, { parentRun: { createdBy: userId } }] }
      : {};
    const [total, running, completed, failed, cancelled, pending, queued] = await Promise.all([
      prisma.job.count({ where: userScope }),
      prisma.job.count({ where: { status: 'running', ...userScope } }),
      prisma.job.count({ where: { status: 'completed', ...userScope } }),
      prisma.job.count({ where: { status: 'failed', ...userScope } }),
      prisma.job.count({ where: { status: 'cancelled', ...userScope } }),
      prisma.job.count({ where: { status: 'pending', ...userScope } }),
      prisma.job.count({ where: { status: 'queued', ...userScope } }),
    ]);
    return { total, running, completed, failed, cancelled, pending, queued };
  }
}
