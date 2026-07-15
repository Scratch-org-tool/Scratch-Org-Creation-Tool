import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  automationRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  job: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  scratchOrg: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  orgConnection: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { ScratchOrgWorker } from './scratch-org.worker';

describe('ScratchOrgWorker password recovery semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-1',
      createdBy: 'owner-1',
      checkpoint: {},
    });
    db.automationRun.update.mockResolvedValue({});
    db.job.update.mockResolvedValue({});
  });

  it('fails the workflow instead of completing without generated credentials', async () => {
    const jobsService = { addLog: vi.fn().mockResolvedValue(undefined) };
    const streamService = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishJobLog: vi.fn().mockResolvedValue(undefined),
    };
    const scratchOrgJobs = {
      register: vi.fn(),
      unregister: vi.fn(),
      setKill: vi.fn(),
      clearKill: vi.fn(),
      isCancelled: vi.fn().mockReturnValue(false),
      shouldSkip: vi.fn().mockReturnValue(false),
    };
    const processRegistry = {
      register: vi.fn().mockReturnValue(vi.fn()),
      clear: vi.fn(),
      isCancellationRequested: vi.fn().mockResolvedValue(false),
    };
    const worker = new ScratchOrgWorker(
      jobsService as never,
      streamService as never,
      scratchOrgJobs as never,
      processRegistry as never,
      {} as never,
    );
    const success = {
      success: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
    };
    const passwordFailure = {
      success: false,
      error: 'password generation failed',
      stdout: '',
      stderr: 'password generation failed',
      exitCode: 1,
    };
    (worker as unknown as { sfCli: Record<string, unknown> }).sfCli = {
      runStreamingCancellable: vi.fn().mockReturnValue({
        promise: Promise.resolve(success),
        kill: vi.fn(),
      }),
      runCancellable: vi.fn().mockReturnValue({
        promise: Promise.resolve(passwordFailure),
        kill: vi.fn(),
      }),
    };

    await expect(worker.process({
      data: {
        dbJobId: 'job-1',
        automationRunId: 'run-1',
        config: {
          alias: 'new-scratch',
          devHubAlias: 'dev-hub',
          duration: 7,
          definitionFile: 'config/project-scratch-def.json',
          skipSteps: [],
        },
      },
    } as never)).rejects.toThrow('password generation failed');

    expect(db.job.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'failed',
        error: 'password generation failed',
      }),
    }));
    expect(db.job.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed' }),
    }));
    expect(db.scratchOrg.upsert).not.toHaveBeenCalled();
  });
});
