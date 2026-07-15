import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

const db = vi.hoisted(() => ({
  deploymentQualityRun: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  deploymentQualityStage: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  deploymentQualityIssue: { findMany: vi.fn() },
  deploymentQualityTestResult: { findMany: vi.fn() },
  deploymentQualityAudit: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  job: { findUnique: vi.fn() },
  orgConnection: { findUnique: vi.fn(), findMany: vi.fn() },
  appUser: { findMany: vi.fn() },
  metadataComparison: { findFirst: vi.fn() },
  scmConnection: { findFirst: vi.fn() },
  projectBinding: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { DeploymentWorkbenchService } from './deployment-workbench.service';

const policySnapshot = {
  tests: { level: 'RunLocalTests', tests: [], minimumCoverage: 75 },
  staticAnalysis: {
    enabled: false,
    engines: [],
    severityThreshold: 'error',
    maxCounts: { info: null, warning: null, error: 0, critical: 0 },
    blockMode: 'threshold',
  },
  validation: { required: true },
  snapshot: { required: true, rollbackRequired: true },
  approval: { required: true, approverType: 'admin', minimumApprovals: 1 },
};

describe('DeploymentWorkbenchService authorization and approval', () => {
  let service: DeploymentWorkbenchService;
  const enqueue = vi.fn();
  const removeJob = vi.fn();
  const cancelProcess = vi.fn();
  const updateStatus = vi.fn();
  const rollback = vi.fn();
  const resolveSource = vi.fn();
  const tempRoots: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeploymentWorkbenchService(
      { enqueue } as never,
      { cancel: vi.fn() } as never,
      { removeJob } as never,
      { updateStatus } as never,
      { cancel: cancelProcess } as never,
      { publish: vi.fn() } as never,
      { detectAvailability: vi.fn().mockResolvedValue({}) } as never,
      { rollback } as never,
      { resolve: resolveSource } as never,
    );
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.deploymentQualityRun.updateMany.mockResolvedValue({ count: 1 });
    db.deploymentQualityStage.updateMany.mockResolvedValue({ count: 1 });
    db.deploymentQualityAudit.create.mockResolvedValue({});
    db.deploymentQualityRun.update.mockResolvedValue({});
    enqueue.mockResolvedValue({ id: 'job-2' });
    removeJob.mockResolvedValue(true);
    updateStatus.mockResolvedValue({});
    rollback.mockResolvedValue({ rollbackId: 'rollback-1', jobId: 'job-rb' });
  });

  afterEach(() => {
    for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('hides another user’s workbench policy as not found', async () => {
    db.deploymentQualityRun.findFirst.mockResolvedValue(null);

    await expect(service.getPolicy('run-1', 'user-2')).rejects.toThrow(
      'Deployment workbench run not found',
    );
    expect(db.deploymentQualityRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1', createdBy: 'user-2' },
    }));
  });

  it('requires an administrator for an admin approval policy', async () => {
    db.deploymentQualityRun.findUnique.mockResolvedValue({
      id: 'run-1',
      createdBy: 'user-1',
      policySnapshot,
      approvedAt: null,
      rejectedAt: null,
    });

    await expect(service.approve('run-1', {
      userId: 'user-1',
      isAdmin: false,
    })).rejects.toThrow('Administrator approval is required');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('allows an admin to approve another user’s production plan and audits it', async () => {
    db.deploymentQualityRun.findUnique
      .mockResolvedValueOnce({
        id: 'run-1',
        createdBy: 'user-1',
        policySnapshot,
        approvedAt: null,
        rejectedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'approved',
        approvedBy: 'admin-1',
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      });
    db.deploymentQualityRun.findFirst.mockResolvedValue({
      id: 'run-1',
      targetOrgId: 'target-1',
      artifacts: {},
      status: 'approved',
    });
    db.orgConnection.findUnique.mockResolvedValue({
      id: 'target-1',
      createdBy: 'user-1',
      type: 'prod',
      alias: 'target',
    });

    const result = await service.approve('run-1', {
      userId: 'admin-1',
      isAdmin: true,
    });

    expect(result?.status).toBe('approved');
    expect(db.deploymentQualityRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1', approvedAt: null, rejectedAt: null },
      data: expect.objectContaining({ approvedBy: 'admin-1', status: 'approved' }),
    }));
    expect(db.deploymentQualityAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runId: 'run-1',
        action: 'approved',
        actorId: 'admin-1',
      }),
    });
  });

  it('rejects a target profile that understates a production org', async () => {
    db.orgConnection.findUnique.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      createdBy: 'user-1',
      type: 'prod',
    });
    db.orgConnection.findUnique.mockResolvedValueOnce({
      id: '22222222-2222-4222-8222-222222222222',
      createdBy: 'user-1',
      type: 'prod',
    });

    await expect(service.preview({
      source: {
        type: 'scm',
        provider: 'github',
        repo: 'example',
        branch: 'main',
      },
      target: {
        orgId: '22222222-2222-4222-8222-222222222222',
        profile: 'scratch',
      },
      components: [{ metadataType: 'ApexClass', members: ['Example'] }],
    }, 'user-1')).rejects.toThrow('Target profile mismatch');
  });

  it('resolves a read-only preview, returns dependency planning, caches it, and cleans up', async () => {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'workbench-preview-service-'));
    tempRoots.push(root);
    const classes = path.join(root, 'force-app', 'main', 'default', 'classes');
    const manifestDir = path.join(root, 'manifest');
    fs.mkdirSync(classes, { recursive: true });
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(classes, 'Example.cls'), 'public class Example {}');
    fs.writeFileSync(
      path.join(manifestDir, 'package.xml'),
      '<Package><types><members>Example</members><name>ApexClass</name></types><version>62.0</version></Package>',
    );
    const cleanup = vi.fn().mockResolvedValue(undefined);
    resolveSource.mockResolvedValue({
      projectRoot: root,
      manifestRelative: 'manifest/package.xml',
      manifestAbsolutePath: path.join(manifestDir, 'package.xml'),
      mode: 'azure_manifest',
      cleanup,
    });
    db.orgConnection.findUnique.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      createdBy: 'user-1',
      type: 'scratch',
      alias: 'target',
    });
    const input = {
      source: { type: 'scm', provider: 'github', repo: 'example', branch: 'main' },
      target: {
        orgId: '22222222-2222-4222-8222-222222222222',
        profile: 'scratch',
      },
      components: [{ metadataType: 'ApexClass', members: ['Example'] }],
    };

    const first = await service.preview(input, 'user-1');
    const second = await service.preview(input, 'user-1');

    expect(first).toEqual(expect.objectContaining({
      readOnly: true,
      dependencies: expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: 'ApexClass:Example' })]),
        batchEstimate: expect.objectContaining({ batchCount: expect.any(Number) }),
      }),
    }));
    expect(second.cache).toEqual({ hit: true });
    expect(resolveSource).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(db.deploymentQualityRun.create).not.toHaveBeenCalled();
    expect(db.deploymentQualityRun.update).not.toHaveBeenCalled();
  });

  it('pages quality history within strict owner scope and includes gate summaries', async () => {
    db.deploymentQualityRun.count.mockResolvedValue(1);
    db.deploymentQualityRun.findMany.mockResolvedValue([{
      id: 'run-1',
      name: 'Release',
      description: null,
      source: { type: 'scm', provider: 'github', repo: 'repo', branch: 'main' },
      targetOrgId: 'target-1',
      targetProfile: 'sandbox',
      strategy: 'direct',
      status: 'passed',
      createdBy: 'user-1',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:01:00Z'),
      validationId: '0Af',
      summary: { passed: true },
      stages: [{
        key: 'validation',
        status: 'passed',
        durationMs: 1200,
        summary: { coverage: 88 },
        artifacts: null,
      }],
    }]);
    db.appUser.findMany.mockResolvedValue([{
      id: 'user-1',
      displayName: 'Owner',
      email: 'owner@example.com',
    }]);
    db.orgConnection.findMany.mockResolvedValue([{
      id: 'target-1',
      alias: 'sandbox',
      username: null,
      type: 'sandbox',
    }]);

    const response = await service.listHistory(
      { page: '2', pageSize: '10', status: 'passed', source: 'scm' },
      { userId: 'user-1', isAdmin: false },
    );

    expect(db.deploymentQualityRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ createdBy: 'user-1', status: 'passed' }),
      skip: 10,
      take: 10,
    }));
    expect(response.items[0]).toEqual(expect.objectContaining({
      id: 'run-1',
      durationMs: 1200,
      coverage: 88,
      gateOutcome: 'passed',
      stageCounts: { passed: 1 },
    }));
  });

  it('forbids a non-admin owner override in quality history', async () => {
    await expect(service.listHistory(
      { owner: 'user-2' },
      { userId: 'user-1', isAdmin: false },
    )).rejects.toThrow('Only administrators');
    expect(db.deploymentQualityRun.findMany).not.toHaveBeenCalled();
  });

  it('cancels the owned queued worker and all unfinished stages', async () => {
    db.deploymentQualityRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: 'running',
      artifacts: { execution: { jobId: 'job-1' } },
    });
    db.job.findUnique.mockResolvedValue({ id: 'job-1', status: 'running' });

    const result = await service.cancel('run-1', 'user-1');

    expect(result).toEqual(expect.objectContaining({ cancelled: true, jobId: 'job-1' }));
    expect(removeJob).toHaveBeenCalledWith('metadata-deploy', 'job-1');
    expect(cancelProcess).toHaveBeenCalledWith('job-1');
    expect(db.deploymentQualityStage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ runId: 'run-1' }),
        data: expect.objectContaining({ status: 'cancelled' }),
      }),
    );
  });

  it('queues quick deploy only from the persisted validation id', async () => {
    db.deploymentQualityRun.findFirst.mockResolvedValue({
      id: 'run-1',
      validationId: '0Af-valid',
      targetOrgId: 'target-1',
      deploymentId: 'deployment-1',
      strategy: 'validate_then_quick',
      approvedAt: new Date(),
      policySnapshot,
    });
    db.orgConnection.findUnique.mockResolvedValue({
      id: 'target-1',
      createdBy: 'user-1',
      alias: 'target',
    });

    const result = await service.quickDeploy('run-1', 'user-1');

    expect(result.validationId).toBe('0Af-valid');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      workbenchRunId: 'run-1',
    }));
  });

  it('preserves the selected Apex test policy for rollback', async () => {
    db.deploymentQualityRun.findFirst.mockResolvedValue({
      id: 'run-1',
      deploymentId: 'deployment-1',
      policySnapshot: {
        ...policySnapshot,
        tests: {
          level: 'RunSpecifiedTests',
          tests: ['RollbackSafetyTest'],
          minimumCoverage: 75,
        },
      },
      components: [],
    });

    await service.rollback('run-1', 'restore target', 'user-1');

    expect(rollback).toHaveBeenCalledWith(
      'deployment-1',
      'restore target',
      'user-1',
      {
        testLevel: 'RunSpecifiedTests',
        tests: ['RollbackSafetyTest'],
      },
    );
  });
});
