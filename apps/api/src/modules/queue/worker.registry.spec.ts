import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  job: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  automationRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  deployment: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  deploymentAudit: {
    create: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { WorkerRegistry } from './worker.registry';

function createRegistry() {
  const processors = new Map<string, (job: never) => Promise<unknown>>();
  const queueService = {
    registerWorker: vi.fn(
      (queueName: string, processor: (job: never) => Promise<unknown>) => {
        processors.set(queueName, processor);
        return {};
      },
    ),
  };
  const streamService = {
    publish: vi.fn().mockResolvedValue(undefined),
  };
  const jobsService = {
    updateStatus: vi.fn().mockResolvedValue({}),
  };
  const notificationsService = {
    notify: vi.fn().mockResolvedValue(null),
  };
  const pipelineOrchestrator = {
    handleJobSucceeded: vi.fn().mockResolvedValue(undefined),
    handleJobFailed: vi.fn().mockResolvedValue(undefined),
    handleUserActionFailed: vi.fn().mockResolvedValue(undefined),
  };
  const worker = { process: vi.fn().mockResolvedValue({ prepared: true }) };
  const registry = new WorkerRegistry(
    queueService as never,
    streamService as never,
    jobsService as never,
    notificationsService as never,
    pipelineOrchestrator as never,
    worker as never,
    worker as never,
    worker as never,
    worker as never,
    worker as never,
    worker as never,
    worker as never,
    worker as never,
    worker as never,
  );
  registry.onModuleInit();
  return {
    processor: processors.get('org-setup')!,
    jobsService,
    notificationsService,
    pipelineOrchestrator,
    streamService,
    worker,
  };
}

describe('WorkerRegistry parent-run terminal guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['failed', 'cancelled'])(
    'does not execute a queued child of a %s run',
    async (parentStatus) => {
      db.job.findUnique.mockResolvedValue({
        status: 'queued',
        parentRun: { status: parentStatus },
      });
      const { processor, jobsService, worker } = createRegistry();

      await expect(processor({
        name: 'prepare_existing_org',
        data: {
          dbJobId: 'queued-child',
          automationRunId: 'terminal-run',
        },
      } as never)).resolves.toBeUndefined();

      expect(worker.process).not.toHaveBeenCalled();
      expect(jobsService.updateStatus).toHaveBeenCalledWith(
        'queued-child',
        'cancelled',
      );
    },
  );

  it('refuses terminal success handling when the parent fails during execution', async () => {
    db.job.findUnique
      .mockResolvedValueOnce({
        status: 'queued',
        parentRun: { status: 'running' },
      })
      .mockResolvedValueOnce({
        status: 'running',
        parentRunId: 'superseded-run',
        type: 'prepare_existing_org',
        parentRun: { status: 'failed' },
      });
    const {
      processor,
      jobsService,
      pipelineOrchestrator,
      worker,
    } = createRegistry();

    await expect(processor({
      name: 'prepare_existing_org',
      data: {
        dbJobId: 'active-child',
        automationRunId: 'superseded-run',
      },
    } as never)).resolves.toEqual({ prepared: true });

    expect(worker.process).toHaveBeenCalledTimes(1);
    expect(jobsService.updateStatus).toHaveBeenNthCalledWith(
      1,
      'active-child',
      'running',
    );
    expect(jobsService.updateStatus).toHaveBeenNthCalledWith(
      2,
      'active-child',
      'cancelled',
    );
    expect(jobsService.updateStatus).not.toHaveBeenCalledWith(
      'active-child',
      'completed',
    );
    expect(pipelineOrchestrator.handleJobSucceeded).not.toHaveBeenCalled();
  });

  it('keeps a worker-declared cancellation out of the completed state', async () => {
    db.job.findUnique
      .mockResolvedValueOnce({
        status: 'queued',
        parentRun: { status: 'running' },
      })
      .mockResolvedValueOnce({
        status: 'running',
        parentRunId: null,
        type: 'prepare_existing_org',
        parentRun: null,
      });
    const { processor, jobsService, pipelineOrchestrator, worker } = createRegistry();
    worker.process.mockResolvedValue({ cancelled: true });

    await expect(processor({
      name: 'prepare_existing_org',
      data: { dbJobId: 'cancelled-child' },
    } as never)).resolves.toEqual({ cancelled: true });

    expect(jobsService.updateStatus).toHaveBeenNthCalledWith(1, 'cancelled-child', 'running');
    expect(jobsService.updateStatus).toHaveBeenNthCalledWith(2, 'cancelled-child', 'cancelled');
    expect(jobsService.updateStatus).not.toHaveBeenCalledWith('cancelled-child', 'completed');
    expect(pipelineOrchestrator.handleJobSucceeded).not.toHaveBeenCalled();
  });
});
