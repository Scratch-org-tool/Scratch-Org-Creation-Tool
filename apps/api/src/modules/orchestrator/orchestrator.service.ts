import { Injectable } from '@nestjs/common';
import { prisma, Prisma } from '@sfcc/db';
import { QUEUE_NAMES } from '@sfcc/shared';
import type { ScratchOrgCreateConfig } from '@sfcc/shared';
import { QueueService } from '../queue/queue.service';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly queueService: QueueService,
    private readonly jobsService: JobsService,
  ) {}

  async createAutomationRun(intent: string, persona: string, config?: Record<string, unknown>) {
    return prisma.automationRun.create({
      data: { intent, persona: persona as 'developer', config: (config ?? {}) as Prisma.InputJsonValue, status: 'pending' },
    });
  }

  async getRun(id: string) {
    return prisma.automationRun.findUnique({
      where: { id },
      include: { jobs: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async executeScratchOrgWorkflow(config: ScratchOrgCreateConfig) {
    const job = await prisma.job.create({
      data: {
        queue: QUEUE_NAMES.SCRATCH_ORG_CREATE,
        type: 'scratch_org_workflow',
        alias: config.alias,
        currentStep: 'Not Started',
        status: 'pending',
        payload: config as unknown as Prisma.InputJsonValue,
      },
    });

    await this.queueService.addJob(
      QUEUE_NAMES.SCRATCH_ORG_CREATE,
      'scratch_org_workflow',
      { config, dbJobId: job.id },
      job.id,
    );

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'queued', currentStep: 'Pending' },
    });

    return { jobId: job.id, status: 'Pending', currentStep: 'Not Started' };
  }

  async enqueueJob(
    queueName: string,
    jobType: string,
    payload: Record<string, unknown>,
    options?: { parentRunId?: string; createdBy?: string },
  ) {
    const dbJob = await this.jobsService.create({
      queue: queueName,
      type: jobType,
      payload,
      parentRunId: options?.parentRunId,
      createdBy: options?.createdBy,
    });

    // Use the DB job id as the Bull job id so cancel/remove can target the queue job.
    await this.queueService.addJob(
      queueName,
      jobType,
      {
        ...payload,
        dbJobId: dbJob.id,
      },
      dbJob.id,
    );

    return dbJob;
  }
}
