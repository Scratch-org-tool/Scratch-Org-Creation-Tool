import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  automationRun: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  job: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  orgConnection: { findUnique: vi.fn(), findMany: vi.fn() },
  provisioningBatch: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  provisionedUser: { updateMany: vi.fn(), findMany: vi.fn() },
  deployment: { update: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { PipelineOrchestratorService } from './pipeline-orchestrator.service';

function createService(overrides?: {
  queueService?: Record<string, unknown>;
  jobsService?: Record<string, unknown>;
  processRegistry?: Record<string, unknown>;
  streamService?: Record<string, unknown>;
  preparation?: Record<string, unknown>;
}): PipelineOrchestratorService {
  const queueService = {
    removeJob: vi.fn().mockResolvedValue(false),
    ...overrides?.queueService,
  };
  const jobsService = {
    updateStatus: vi.fn().mockResolvedValue({}),
    addLog: vi.fn().mockResolvedValue({}),
    ...overrides?.jobsService,
  };
  return new PipelineOrchestratorService(
    queueService as never,
    jobsService as never,
    ({
      cancel: vi.fn().mockResolvedValue(undefined),
      ...overrides?.processRegistry,
    }) as never,
    ({
      publish: vi.fn().mockResolvedValue(undefined),
      ...overrides?.streamService,
    }) as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (overrides?.preparation ?? {
      requireOwnedActiveScratchTarget: vi.fn().mockImplementation(async (id: string) => ({
        target: await db.orgConnection.findUnique({ where: { id } }),
      })),
    }) as never,
  );
}

function legacyRun() {
  return {
    id: 'run-1',
    intent: 'scratch_org_pipeline',
    status: 'paused',
    createdBy: 'owner-1',
    config: {
      alias: 'scratch',
      devHubAlias: 'dev-hub',
      azureDeploy: {
        project: 'Core',
        repo: 'metadata',
        branch: 'main',
      },
    },
    checkpoint: {
      completedSteps: ['scratch_org_create'],
      resumeFrom: 'azure_metadata_deploy',
      targetOrgConnectionId: 'target-1',
    },
    jobs: [],
  };
}

describe('PipelineOrchestratorService provider-neutral resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.automationRun.findUnique.mockResolvedValue(legacyRun());
    db.automationRun.updateMany.mockResolvedValue({ count: 1 });
    db.automationRun.update.mockResolvedValue({});
    db.job.update.mockResolvedValue({});
    db.job.findFirst.mockResolvedValue(null);
  });

  it('reads legacy queued runs through canonical source and checkpoint aliases', async () => {
    const run = await createService().getRun('run-1', 'owner-1');

    expect(run?.config).toEqual(
      expect.objectContaining({
        gitSource: expect.objectContaining({
          provider: 'azure_devops',
          repo: 'metadata',
        }),
      }),
    );
    expect(run?.checkpoint).toEqual(
      expect.objectContaining({
        resumeFrom: 'git_metadata_deploy',
        legacyResumeFrom: 'azure_metadata_deploy',
      }),
    );
  });

  it('resumes an old Azure checkpoint through the canonical metadata step', async () => {
    const service = createService();
    const enqueueMetadataDeploy = vi.fn().mockResolvedValue({ id: 'job-2' });
    (service as unknown as { enqueueMetadataDeploy: typeof enqueueMetadataDeploy })
      .enqueueMetadataDeploy = enqueueMetadataDeploy;

    await expect(service.resumeRun('run-1', {}, 'owner-1')).resolves.toEqual({
      automationRunId: 'run-1',
      status: 'running',
      resumeFrom: 'git_metadata_deploy',
    });
    expect(enqueueMetadataDeploy).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        gitSource: expect.objectContaining({ provider: 'azure_devops' }),
      }),
      expect.objectContaining({ resumeFrom: 'git_metadata_deploy' }),
    );
  });

  it('does not overwrite persisted SCM source with resume-time defaults', async () => {
    const service = createService();
    const enqueueMetadataDeploy = vi.fn().mockResolvedValue({ id: 'job-2' });
    (service as unknown as { enqueueMetadataDeploy: typeof enqueueMetadataDeploy })
      .enqueueMetadataDeploy = enqueueMetadataDeploy;

    await service.resumeRun('run-1', {
      gitSource: {
        provider: 'github',
        repo: 'current-default',
        branch: 'develop',
      },
    }, 'owner-1');

    const resumedConfig = enqueueMetadataDeploy.mock.calls[0][1];
    expect(resumedConfig.gitSource).toEqual(expect.objectContaining({
      provider: 'azure_devops',
      repo: 'metadata',
      branch: 'main',
    }));
    expect(resumedConfig.gitSource).not.toEqual(expect.objectContaining({
      repo: 'current-default',
    }));
    expect(db.automationRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        config: expect.objectContaining({
          gitSource: expect.objectContaining({ repo: 'metadata' }),
        }),
      }),
    }));
  });

  it('does not disclose or resume another user’s run', async () => {
    const service = createService();
    await expect(service.getRun('run-1', 'other-user')).rejects.toThrow('not found');
    await expect(service.resumeRun('run-1', {}, 'other-user')).rejects.toThrow('not found');
    expect(db.automationRun.updateMany).not.toHaveBeenCalled();
  });

  it('cleans an orphaned queued action before retrying its failed checkpoint', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      checkpoint: {
        ...legacyRun().checkpoint,
        failedUserAction: 'load_data_seed',
      },
    });
    db.job.findFirst.mockResolvedValue({ id: 'orphan-job', queue: 'cona-seed' });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const removeJob = vi.fn().mockResolvedValue(true);
    const updateStatus = vi.fn().mockResolvedValue({});
    const service = createService({
      processRegistry: { cancel },
      queueService: { removeJob },
      jobsService: { updateStatus },
    });
    const runUserActions = vi.fn().mockResolvedValue({ jobs: [{ id: 'retry-job' }] });
    Object.assign(service as object, { runUserActions });

    await service.resumeRun('run-1', {}, 'owner-1');

    expect(cancel).toHaveBeenCalledWith('orphan-job');
    expect(removeJob).toHaveBeenCalledWith('cona-seed', 'orphan-job');
    expect(updateStatus).toHaveBeenCalledWith(
      'orphan-job',
      'failed',
      'Superseded by a resumed post-deploy action',
    );
    expect(runUserActions).toHaveBeenCalledWith('run-1', {
      actions: ['load_data_seed'],
    });
  });
});

describe('PipelineOrchestratorService existing scratch target mode', () => {
  const existingConfig = {
    mode: 'configure_existing' as const,
    existingOrgConnectionId: '11111111-1111-4111-8111-111111111111',
    existingOrgOptions: {
      verifyAuthentication: true,
      ensureRequiredPackage: true,
    },
    alias: 'existing',
    duration: 30,
    template: 'config/project-scratch-def.json',
    definitionFile: 'config/project-scratch-def.json',
    skipSteps: [] as ('installPackages' | 'deployMetadata' | 'assignPermissions')[],
    gitSource: { provider: 'github' as const, repo: 'repo', branch: 'main' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.orgConnection.findUnique.mockResolvedValue({
      id: existingConfig.existingOrgConnectionId,
      alias: 'existing',
      username: 'existing@scratch.example',
      orgId: '00Dscratch',
      createdBy: 'owner-1',
      type: 'scratch',
      status: 'active',
      expiresAt: new Date('2099-08-01T00:00:00Z'),
    });
    db.automationRun.create.mockResolvedValue({ id: 'run-existing' });
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      createdBy: 'owner-1',
      targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      config: existingConfig,
      checkpoint: {
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
        resumeFrom: 'prepare_existing_org',
      },
    });
    db.automationRun.update.mockResolvedValue({});
    db.job.findFirst.mockResolvedValue(null);
    db.orgConnection.findMany.mockResolvedValue([{
      id: existingConfig.existingOrgConnectionId,
    }]);
  });

  it('primes creation checkpoints and queues preparation, never scratch creation', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'prepare-job' });
    const addJob = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      jobsService: { create },
      queueService: { addJob },
    });

    await expect(service.startPipeline(existingConfig, 'owner-1')).resolves.toEqual({
      automationRunId: 'run-existing',
      jobId: 'prepare-job',
      status: 'running',
    });
    expect(db.automationRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        launchMode: 'configure_existing',
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
        checkpoint: expect.objectContaining({
          completedSteps: ['scratch_org_create'],
          skippedSteps: ['create_scratch_org', 'generate_password', 'retrieve_org_details'],
          scratchOrgCreated: true,
          resumeFrom: 'prepare_existing_org',
        }),
      }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      queue: 'org-setup',
      type: 'prepare_existing_org',
      createdBy: 'owner-1',
    }));
    expect(addJob).toHaveBeenCalledWith(
      'org-setup',
      'prepare_existing_org',
      expect.any(Object),
      'prepare-job',
      { attempts: 1 },
    );
    expect(addJob.mock.calls.some((call) => call[0] === 'scratch-org-create')).toBe(false);
  });

  it('hands successful preparation to the shared metadata deploy stage', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      status: 'running',
      createdBy: 'owner-1',
      config: existingConfig,
      checkpoint: {
        completedSteps: ['scratch_org_create'],
        resumeFrom: 'prepare_existing_org',
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      },
    });
    const service = createService();
    const enqueueMetadataDeploy = vi.fn().mockResolvedValue({ id: 'metadata-job' });
    (service as unknown as { enqueueMetadataDeploy: typeof enqueueMetadataDeploy })
      .enqueueMetadataDeploy = enqueueMetadataDeploy;

    await service.handleJobSucceeded('run-existing', 'prepare_existing_org');
    expect(enqueueMetadataDeploy).toHaveBeenCalledWith(
      'run-existing',
      existingConfig,
      expect.objectContaining({
        completedSteps: ['scratch_org_create', 'prepare_existing_org'],
        resumeFrom: 'git_metadata_deploy',
      }),
    );
  });

  it('resumes an existing target at preparation without entering scratch creation', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      intent: 'scratch_org_pipeline',
      status: 'paused',
      createdBy: 'owner-1',
      config: existingConfig,
      checkpoint: {
        completedSteps: ['scratch_org_create'],
        resumeFrom: 'prepare_existing_org',
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      },
    });
    db.automationRun.updateMany.mockResolvedValue({ count: 1 });
    const service = createService();
    const enqueueExistingPreparation = vi.fn().mockResolvedValue({ id: 'prepare-retry' });
    const enqueueScratchOrgResume = vi.fn();
    Object.assign(service as object, { enqueueExistingPreparation, enqueueScratchOrgResume });

    await service.resumeRun('run-existing', {}, 'owner-1');
    expect(enqueueExistingPreparation).toHaveBeenCalled();
    expect(enqueueScratchOrgResume).not.toHaveBeenCalled();
  });

  it('returns the active target run id on a uniqueness race', async () => {
    db.automationRun.create.mockRejectedValue({ code: 'P2002' });
    db.automationRun.findFirst.mockResolvedValue({ id: 'run-conflict' });
    const service = createService();
    await expect(service.startPipeline(existingConfig, 'owner-1')).rejects.toMatchObject({
      response: expect.objectContaining({ conflictRunId: 'run-conflict' }),
    });
    expect(db.automationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        intent: 'scratch_org_pipeline',
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      }),
    }));
    expect(db.automationRun.findFirst.mock.calls[0][0].where).not.toHaveProperty('launchMode');
  });

  it('does not turn a terminal uniqueness-race failure back into an active paused run', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      status: 'failed',
      createdBy: 'owner-1',
      checkpoint: {
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      },
    });
    await createService().handleJobFailed(
      'run-existing',
      'scratch_org_create',
      'Another active pipeline claimed the scratch target',
    );
    expect(db.automationRun.update).not.toHaveBeenCalled();
  });

  it('cancels the preparation job and fails the run when queueing is ambiguous', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'prepare-job' });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const removeJob = vi.fn().mockResolvedValue(true);
    const service = createService({
      jobsService: { create },
      processRegistry: { cancel },
      queueService: {
        addJob: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
        removeJob,
      },
    });

    await expect(service.startPipeline(existingConfig, 'owner-1'))
      .rejects.toThrow('Preparation queueing failed');
    expect(cancel).toHaveBeenCalledWith('prepare-job');
    expect(removeJob).toHaveBeenCalledWith('org-setup', 'prepare-job');
    expect(db.job.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'prepare-job' },
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(db.automationRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-existing' },
      data: expect.objectContaining({
        status: 'failed',
        failedStep: 'prepare_existing_org',
      }),
    }));
  });

  it('compensates an accepted preparation when checkpoint persistence fails', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'prepare-job' });
    const addJob = vi.fn().mockResolvedValue('prepare-job');
    const cancel = vi.fn().mockResolvedValue(undefined);
    const removeJob = vi.fn().mockResolvedValue(true);
    db.automationRun.update
      .mockRejectedValueOnce(new Error('Checkpoint persistence failed'))
      .mockResolvedValueOnce({});
    const service = createService({
      jobsService: { create },
      processRegistry: { cancel },
      queueService: { addJob, removeJob },
    });

    await expect(service.startPipeline(existingConfig, 'owner-1'))
      .rejects.toThrow('Preparation queueing failed');

    expect(addJob).toHaveBeenCalledWith(
      'org-setup',
      'prepare_existing_org',
      expect.objectContaining({ dbJobId: 'prepare-job' }),
      'prepare-job',
      { attempts: 1 },
    );
    expect(cancel).toHaveBeenCalledWith('prepare-job');
    expect(removeJob).toHaveBeenCalledWith('org-setup', 'prepare-job');
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      removeJob.mock.invocationCallOrder[0],
    );
    expect(db.job.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'prepare-job' },
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(db.automationRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'run-existing' },
      data: expect.objectContaining({
        status: 'failed',
        failedStep: 'prepare_existing_org',
      }),
    }));
  });

  it('releases target uniqueness when preparation job creation fails', async () => {
    const service = createService({
      jobsService: {
        create: vi.fn().mockRejectedValue(new Error('Postgres unavailable')),
      },
      queueService: { addJob: vi.fn() },
    });

    await expect(service.startPipeline(existingConfig, 'owner-1'))
      .rejects.toThrow('Preparation queueing failed');
    expect(db.automationRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-existing' },
      data: expect.objectContaining({ status: 'failed' }),
    }));
    expect(db.job.update).not.toHaveBeenCalled();
  });

  it('reruns authoritative target validation before claiming a paused existing run', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      intent: 'scratch_org_pipeline',
      status: 'paused',
      createdBy: 'owner-1',
      targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      config: existingConfig,
      checkpoint: {
        completedSteps: ['scratch_org_create'],
        resumeFrom: 'prepare_existing_org',
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
      },
    });
    const requireOwnedActiveScratchTarget = vi.fn()
      .mockRejectedValue(new Error('Selected scratch org expiration is missing or has passed'));
    const service = createService({
      preparation: { requireOwnedActiveScratchTarget },
    });

    await expect(service.resumeRun('run-existing', {}, 'owner-1'))
      .rejects.toThrow('expiration');
    expect(requireOwnedActiveScratchTarget).toHaveBeenCalledWith(
      existingConfig.existingOrgConnectionId,
      'owner-1',
    );
    expect(db.automationRun.updateMany).not.toHaveBeenCalled();
  });

  it('scopes recent target filters to the caller and target alias/org fields', async () => {
    db.automationRun.findMany.mockResolvedValue([]);
    await createService().getRecentRuns({ target: 'existing', limit: '5' }, 'owner-1');
    expect(db.automationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        intent: 'scratch_org_pipeline',
        createdBy: 'owner-1',
        AND: [expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              targetOrgConnection: {
                OR: expect.arrayContaining([
                  { alias: { contains: 'existing', mode: 'insensitive' } },
                  { orgId: { contains: 'existing', mode: 'insensitive' } },
                ]),
              },
            }),
            expect.objectContaining({
              targetOrgConnectionId: null,
              checkpoint: {
                path: ['targetOrgConnectionId'],
                equals: existingConfig.existingOrgConnectionId,
              },
            }),
          ]),
        })],
      }),
      take: 5,
    }));
  });

  it('filters target-id history through both relational and legacy checkpoint targets', async () => {
    db.automationRun.findMany.mockResolvedValue([]);
    await createService().getRecentRuns({
      targetOrgConnectionId: existingConfig.existingOrgConnectionId,
    }, 'owner-1');
    expect(db.automationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [{
          OR: [
            { targetOrgConnectionId: existingConfig.existingOrgConnectionId },
            {
              targetOrgConnectionId: null,
              checkpoint: {
                path: ['targetOrgConnectionId'],
                equals: existingConfig.existingOrgConnectionId,
              },
            },
          ],
        }],
      }),
    }));
  });

  it('normalizes a legacy checkpoint target into the recent-run DTO', async () => {
    db.automationRun.findMany.mockResolvedValue([{
      id: 'legacy-run',
      status: 'completed',
      targetOrgConnectionId: null,
      targetOrgConnection: null,
      checkpoint: {
        targetOrgConnectionId: existingConfig.existingOrgConnectionId,
        internalState: 'not part of the recent-run DTO',
      },
    }]);

    const result = await createService().getRecentRuns({}, 'owner-1');

    expect(result).toEqual([expect.objectContaining({
      id: 'legacy-run',
      targetOrgConnectionId: existingConfig.existingOrgConnectionId,
    })]);
    expect(result[0]).not.toHaveProperty('checkpoint');
  });
});

describe('PipelineOrchestratorService cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.automationRun.update.mockResolvedValue({});
  });

  it('persists and broadcasts active cancellation despite locked BullMQ removal', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-active',
      status: 'running',
      createdBy: 'owner-1',
      checkpoint: {},
      jobs: [{
        id: 'prepare-active',
        queue: 'org-setup',
        status: 'running',
      }],
    });
    const updateStatus = vi.fn().mockResolvedValue({});
    const addLog = vi.fn().mockResolvedValue({});
    const cancel = vi.fn().mockResolvedValue(undefined);
    const removeJob = vi.fn().mockRejectedValue(
      new Error('Job could not be removed because it is locked by another worker'),
    );
    const publish = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      jobsService: { updateStatus, addLog },
      processRegistry: { cancel },
      queueService: { removeJob },
      streamService: { publish },
    });

    await expect(service.cancelRun('run-active', 'owner-1')).resolves.toEqual({
      cancelled: true,
    });

    expect(db.automationRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-active' },
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(updateStatus).toHaveBeenCalledWith('prepare-active', 'cancelled');
    expect(cancel).toHaveBeenCalledWith('prepare-active');
    expect(removeJob).toHaveBeenCalledWith('org-setup', 'prepare-active');
    expect(updateStatus.mock.invocationCallOrder[0]).toBeLessThan(
      cancel.mock.invocationCallOrder[0],
    );
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      removeJob.mock.invocationCallOrder[0],
    );
    expect(publish).toHaveBeenCalledWith('job_status', {
      automationRunId: 'run-active',
      status: 'cancelled',
    });
  });
});

describe('PipelineOrchestratorService legacy create mode', () => {
  it('keeps the scratch creation queue for default create payloads', async () => {
    vi.clearAllMocks();
    db.automationRun.create.mockResolvedValue({ id: 'run-create' });
    db.automationRun.update.mockResolvedValue({});
    db.job.create.mockResolvedValue({ id: 'scratch-job' });
    db.job.update.mockResolvedValue({});
    const addJob = vi.fn().mockResolvedValue(undefined);
    const service = createService({ queueService: { addJob } });

    await service.startPipeline({
      mode: 'create_new',
      alias: 'new-scratch',
      devHubAlias: 'dev-hub',
      duration: 30,
      definitionFile: 'config/project-scratch-def.json',
      template: 'config/project-scratch-def.json',
      skipSteps: [],
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner-1');

    expect(addJob).toHaveBeenCalledWith(
      'scratch-org-create',
      'scratch_org_workflow',
      expect.any(Object),
      'scratch-job',
      { attempts: 1 },
    );
  });

  it('fails the run and removes an ambiguously queued scratch-creation job', async () => {
    vi.clearAllMocks();
    db.automationRun.create.mockResolvedValue({ id: 'run-create' });
    db.automationRun.update.mockResolvedValue({});
    db.job.create.mockResolvedValue({ id: 'scratch-job' });
    db.job.update.mockResolvedValue({});
    const cancel = vi.fn().mockResolvedValue(undefined);
    const removeJob = vi.fn().mockResolvedValue(true);
    const service = createService({
      processRegistry: { cancel },
      queueService: {
        addJob: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
        removeJob,
      },
    });

    await expect(service.startPipeline({
      mode: 'create_new',
      alias: 'new-scratch',
      devHubAlias: 'dev-hub',
      duration: 30,
      definitionFile: 'config/project-scratch-def.json',
      template: 'config/project-scratch-def.json',
      skipSteps: [],
      gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
    }, 'owner-1')).rejects.toThrow('Scratch org queueing failed');

    expect(cancel).toHaveBeenCalledWith('scratch-job');
    expect(removeJob).toHaveBeenCalledWith('scratch-org-create', 'scratch-job');
    expect(db.job.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'scratch-job' },
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(db.automationRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'run-create' },
      data: expect.objectContaining({
        status: 'failed',
        failedStep: 'scratch_org_create',
      }),
    }));
  });
});

describe('PipelineOrchestratorService custom-settings transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.automationRun.update.mockResolvedValue({});
  });

  it('always queues target-only org config after successful SFDMU', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'running',
      config: {
        alias: 'scratch',
        devHubAlias: 'devhub',
        gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
        customSettings: { enabled: true, mode: 'bundled' },
      },
      checkpoint: {
        completedSteps: ['scratch_org_create', 'git_metadata_deploy'],
        resumeFrom: 'load_custom_settings',
        targetOrgConnectionId: 'scratch-target',
      },
    });
    const service = createService();
    const enqueueLoadOrgConfig = vi.fn().mockResolvedValue(undefined);
    (service as unknown as { enqueueLoadOrgConfig: typeof enqueueLoadOrgConfig })
      .enqueueLoadOrgConfig = enqueueLoadOrgConfig;

    await service.handleJobSucceeded('run-1', 'custom_settings_load');

    expect(enqueueLoadOrgConfig).toHaveBeenCalledWith(
      'run-1',
      expect.any(Object),
      expect.objectContaining({
        targetOrgConnectionId: 'scratch-target',
        completedSteps: expect.arrayContaining(['load_custom_settings']),
      }),
    );
  });
});

describe('PipelineOrchestratorService manual post-deploy integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.automationRun.update.mockResolvedValue({});
  });

  it('completes into an actionable state when configured steps are manual', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'running',
      config: {
        alias: 'scratch',
        devHubAlias: 'devhub',
        gitSource: { provider: 'github', repo: 'repo', branch: 'main' },
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: { mode: 'hybrid', datasets: ['Accounts'] },
        pipelineSteps: {
          autoRunDataSeed: false,
          autoRunPartners: false,
          autoRunUsers: false,
        },
      },
      checkpoint: {
        completedSteps: ['scratch_org_create', 'git_metadata_deploy'],
        resumeFrom: 'load_org_config',
        targetOrgConnectionId: 'target-1',
      },
    });

    await createService().handleJobSucceeded('run-1', 'pipeline_load_org_config');

    expect(db.automationRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'awaiting_input',
        checkpoint: expect.objectContaining({ awaitingUserActions: true }),
      }),
    }));
  });

  it('rejects manual actions on terminal runs that are not awaiting input', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'running',
      checkpoint: {
        targetOrgConnectionId: 'target-1',
        awaitingUserActions: false,
      },
    });

    await expect(createService().runUserActions(
      'run-1',
      { actions: ['load_data_seed'] },
      'owner-1',
    )).rejects.toThrow('awaiting actions');
  });

  it('atomically rejects a second manual submission after another request claims the run', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'awaiting_input',
      config: {
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: { mode: 'hybrid', datasets: ['Accounts'] },
        pipelineSteps: {
          autoRunDataSeed: false,
          autoRunPartners: false,
          autoRunUsers: false,
        },
      },
      checkpoint: {
        targetOrgConnectionId: 'target-1',
        awaitingUserActions: true,
      },
    });
    db.automationRun.updateMany.mockResolvedValue({ count: 0 });
    const create = vi.fn();

    await expect(createService({ jobsService: { create } }).runUserActions(
      'run-1',
      { actions: ['load_data_seed'] },
      'owner-1',
    )).rejects.toThrow('no longer awaiting actions');

    expect(create).not.toHaveBeenCalled();
  });

  it('fails and compensates an orphaned manual job when BullMQ queueing fails', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'awaiting_input',
      config: {
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: { mode: 'hybrid', datasets: ['Accounts'] },
        pipelineSteps: {
          autoRunDataSeed: false,
          autoRunPartners: false,
          autoRunUsers: false,
        },
      },
      checkpoint: {
        targetOrgConnectionId: 'target-1',
        awaitingUserActions: true,
      },
    });
    db.automationRun.updateMany.mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: 'seed-job' });
    const updateStatus = vi.fn().mockResolvedValue({});
    const cancel = vi.fn().mockResolvedValue(undefined);
    const removeJob = vi.fn().mockResolvedValue(true);
    const service = createService({
      jobsService: { create, updateStatus },
      processRegistry: { cancel },
      queueService: {
        addJob: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
        removeJob,
      },
    });

    await expect(service.runUserActions(
      'run-1',
      { actions: ['load_data_seed'] },
      'owner-1',
    )).rejects.toThrow('Redis unavailable');

    expect(cancel).toHaveBeenCalledWith('seed-job');
    expect(removeJob).toHaveBeenCalledWith('cona-seed', 'seed-job');
    expect(updateStatus).toHaveBeenCalledWith(
      'seed-job',
      'failed',
      'Queueing failed: Redis unavailable',
    );
    expect(db.automationRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'paused',
        failedStep: 'load_data_seed',
        checkpoint: expect.objectContaining({
          failedUserAction: 'load_data_seed',
          requestedUserActions: ['load_data_seed'],
        }),
      }),
    }));
  });

  it('does not allow a mode override to duplicate query-section partner loading', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'running',
      config: {
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: {
          mode: 'query_section',
          querySection: { accountPartnerPlan: { enabled: true } },
        },
        partnerImport: {
          enabled: true,
          mode: 'query_section',
          bottler: '5000',
          perOffice: 20,
          matchOrgDistribution: true,
        },
      },
      checkpoint: { targetOrgConnectionId: 'target-1' },
    });
    const create = vi.fn();

    await expect(createService({ jobsService: { create } }).runUserActions(
      'run-1',
      {
        actions: ['load_account_partners'],
        partnerMode: 'org_to_org',
      },
    )).rejects.toThrow('already handled by the configured query section');

    expect(create).not.toHaveBeenCalled();
    expect(db.automationRun.update).not.toHaveBeenCalled();
  });

  it('preserves legacy automatic data and user defaults when pipelineSteps is absent', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'running',
      config: {
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: { mode: 'hybrid', datasets: ['Accounts'] },
        userProvisioning: {
          users: [{
            firstName: 'Legacy',
            lastName: 'User',
            email: 'legacy@example.com',
            role: 'Rep',
            bottler: '5000',
          }],
        },
      },
      checkpoint: {
        completedSteps: ['load_org_config'],
        targetOrgConnectionId: 'target-1',
      },
    });
    const service = createService();
    const runUserActions = vi.fn().mockResolvedValue({ jobs: [] });
    Object.assign(service as object, { runUserActions });

    await service.handleJobSucceeded('run-1', 'pipeline_load_org_config');

    expect(runUserActions).toHaveBeenCalledWith('run-1', {
      actions: ['load_data_seed'],
      partnerExcelBase64: undefined,
      partnerSheet: undefined,
    });
  });

  it('keeps remaining manual actions available after an automatic action is partial', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'running',
      config: {
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: { mode: 'hybrid', datasets: ['Accounts'] },
        pipelineSteps: {
          autoRunDataSeed: true,
          autoRunPartners: false,
          autoRunUsers: false,
        },
        userProvisioning: {
          users: [{
            firstName: 'Manual',
            lastName: 'User',
            email: 'manual@example.com',
            role: 'Rep',
            bottler: '5000',
          }],
        },
      },
      checkpoint: {
        completedSteps: ['load_org_config'],
        targetOrgConnectionId: 'target-1',
        requestedUserActions: ['load_data_seed'],
      },
    });

    await createService().handleJobSucceeded(
      'run-1',
      'cona_seed',
      { successCount: 9, failCount: 1 },
    );

    expect(db.automationRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'awaiting_input',
        checkpoint: expect.objectContaining({
          awaitingUserActions: true,
          partialUserActions: ['load_data_seed'],
        }),
      }),
    }));
  });
});

describe('PipelineOrchestratorService V2 job ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets the automation owner on query-section seed jobs', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      ...legacyRun(),
      status: 'completed',
      config: {
        version: 2,
        dataDeploymentOrgId: '11111111-1111-4111-8111-111111111111',
        dataSeed: {
          mode: 'query_section',
          querySection: {
            name: 'Seed',
            queries: [{
              id: 'account',
              name: 'Account',
              enabled: true,
              order: 0,
              stage: 0,
              category: 'account',
              object: 'Account',
              soql: 'SELECT Name FROM Account',
              limit: 10,
              operation: 'upsert',
              externalIdField: 'Name',
              variables: {},
              dependsOn: [],
            }],
          },
        },
      },
      checkpoint: {
        completedSteps: [],
        resumeFrom: 'load_org_config',
        targetOrgConnectionId: 'target-1',
        awaitingUserActions: true,
      },
    });
    const create = vi.fn().mockResolvedValue({ id: 'seed-job' });
    const addJob = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      jobsService: { create },
      queueService: { addJob },
    });

    await service.runUserActions('run-1', {
      actions: ['load_data_seed'],
      datasets: ['Accounts'],
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cona_seed',
      parentRunId: 'run-1',
      createdBy: 'owner-1',
      payload: expect.objectContaining({ datasets: ['Accounts'] }),
    }));
  });
});

describe('PipelineOrchestratorService provisioning retry checkpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (callback) => callback(db));
    db.provisionedUser.updateMany.mockResolvedValue({ count: 1 });
    db.provisioningBatch.update.mockResolvedValue({});
  });

  it('reuses the original batch and queues only failed immutable users', async () => {
    const resolvedUsers = [{
      firstName: 'Done',
      lastName: 'User',
      email: 'done@example.com',
      username: 'done+run@example.com',
      role: 'Rep',
      bottler: '5000',
      modules: [],
      locations: [],
      profile: 'Standard User',
      permissionSets: [],
    }, {
      firstName: 'Retry',
      lastName: 'User',
      email: 'retry@example.com',
      username: 'retry+run@example.com',
      role: 'Rep',
      bottler: '5000',
      modules: [],
      locations: [],
      profile: 'Standard User',
      permissionSets: [],
    }];
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'paused',
      createdBy: 'owner-1',
      config: {
        version: 2,
        userProvisioning: {
          defaultProfile: 'Standard User',
          execution: {
            mode: 'sequential',
            concurrency: 1,
            failurePolicy: 'fail_fast',
            discoveryFailurePolicy: 'fail',
          },
        },
      },
      checkpoint: {
        targetOrgConnectionId: 'target-1',
        provisioningBatchId: 'batch-original',
        resolvedProvisioningUsers: resolvedUsers,
      },
    });
    db.provisioningBatch.findUnique.mockResolvedValue({
      id: 'batch-original',
      orgId: 'target-1',
      createdBy: 'owner-1',
      users: [
        { username: 'done+run@example.com', status: 'completed' },
        { username: 'retry+run@example.com', status: 'failed' },
      ],
    });
    const create = vi.fn().mockResolvedValue({ id: 'retry-job' });
    const addJob = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      jobsService: { create },
      queueService: { addJob },
    });

    await service.runUserActions('run-1', { actions: ['provision_users'] });

    expect(db.provisioningBatch.create).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        batchId: 'batch-original',
        users: [resolvedUsers[1]],
      }),
    }));
    expect(addJob).toHaveBeenCalledWith(
      expect.any(String),
      'cona_user_provision',
      expect.objectContaining({
        batchId: 'batch-original',
        users: [resolvedUsers[1]],
      }),
      'retry-job',
    );
  });

  it('checkpoints the resolved plan and batch atomically before queueing the same usernames', async () => {
    db.automationRun.findUnique.mockResolvedValue({
      id: 'run-new',
      status: 'running',
      createdBy: 'owner-1',
      config: {
        version: 2,
        userProvisioning: {
          defaultProfile: 'Standard User',
          users: [{
            firstName: 'Generated',
            lastName: 'Username',
            email: 'generated@example.com',
            role: 'Rep',
            bottler: '5000',
          }],
        },
      },
      checkpoint: { targetOrgConnectionId: 'target-1' },
    });
    db.provisioningBatch.create.mockResolvedValue({ id: 'batch-new' });
    db.automationRun.update.mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({ id: 'new-job' });
    const addJob = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      jobsService: { create },
      queueService: { addJob },
    });

    await service.runUserActions('run-new', { actions: ['provision_users'] });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const checkpoint = db.automationRun.update.mock.calls[0][0].data.checkpoint;
    expect(checkpoint.provisioningBatchId).toBe('batch-new');
    const username = checkpoint.resolvedProvisioningUsers[0].username;
    expect(db.provisioningBatch.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        users: { create: [expect.objectContaining({ username })] },
      }),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        batchId: 'batch-new',
        users: [expect.objectContaining({ username })],
      }),
    }));
    expect(addJob).toHaveBeenCalledWith(
      expect.any(String),
      'cona_user_provision',
      expect.objectContaining({
        batchId: 'batch-new',
        users: [expect.objectContaining({ username })],
      }),
      'new-job',
    );
  });
});
