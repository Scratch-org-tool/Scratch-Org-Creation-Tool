import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  automationRun: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  job: { findFirst: vi.fn() },
  provisioningBatch: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  provisionedUser: { updateMany: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { PipelineOrchestratorService } from './pipeline-orchestrator.service';

function createService(overrides?: {
  queueService?: Record<string, unknown>;
  jobsService?: Record<string, unknown>;
}): PipelineOrchestratorService {
  return new PipelineOrchestratorService(
    (overrides?.queueService ?? {}) as never,
    (overrides?.jobsService ?? {}) as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
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
      },
    });
    const create = vi.fn().mockResolvedValue({ id: 'seed-job' });
    const addJob = vi.fn().mockResolvedValue(undefined);
    const service = createService({
      jobsService: { create },
      queueService: { addJob },
    });

    await service.runUserActions('run-1', { actions: ['load_data_seed'] }, 'owner-1');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cona_seed',
      parentRunId: 'run-1',
      createdBy: 'owner-1',
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

    await service.runUserActions('run-1', { actions: ['provision_users'] }, 'owner-1');

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

    await service.runUserActions('run-new', { actions: ['provision_users'] }, 'owner-1');

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
