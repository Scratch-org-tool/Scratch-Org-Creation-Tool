import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitSourceConfig } from '@sfcc/shared';

const db = vi.hoisted(() => ({
  job: { create: vi.fn() },
  deploymentAudit: { create: vi.fn() },
  deployment: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import type { QueueService } from '../queue/queue.service';
import type { ScmSourceService } from '../../integrations/foundation/scm-source.service';
import {
  MetadataDeployQueueService,
  metadataEnqueueSideEffectMayHavePersisted,
} from './metadata-deploy-queue.service';

describe('MetadataDeployQueueService SCM payloads', () => {
  const addJob = vi.fn();
  const requireActive = vi.fn();
  let service: MetadataDeployQueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    db.job.create.mockResolvedValue({ id: 'job-1', type: 'metadata_deploy' });
    db.deploymentAudit.create.mockResolvedValue({});
    db.deployment.findUnique.mockResolvedValue({ status: 'pending', metadata: {} });
    db.deployment.update.mockResolvedValue({});
    requireActive.mockImplementation((source: GitSourceConfig) => Promise.resolve(source));
    service = new MetadataDeployQueueService(
      { addJob } as unknown as QueueService,
      { requireActive } as unknown as ScmSourceService,
      { assertDeployAllowed: vi.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it.each(['azure_devops', 'github', 'bitbucket'] as const)(
    'queues canonical %s context without secrets',
    async (provider) => {
      await service.enqueue({
        orgAlias: 'target@example.com',
        deploymentId: 'deployment-1',
        createdBy: 'user-1',
        gitSource: {
          provider,
          connectionId: `${provider}-connection`,
          namespace: 'acme',
          repo: 'metadata',
          branch: 'main',
          manifestPath: 'manifest/package.xml',
          token: 'never-persist',
        } as GitSourceConfig & { token: string },
      });

      const queued = addJob.mock.calls[0][2] as Record<string, unknown>;
      expect(queued.gitSource).toEqual({
        provider,
        connectionId: `${provider}-connection`,
        namespace: 'acme',
        repo: 'metadata',
        branch: 'main',
        manifestPath: 'manifest/package.xml',
      });
      expect(JSON.stringify(queued)).not.toContain('never-persist');
      if (provider === 'azure_devops') {
        expect(queued.azureDeploy).toEqual(
          expect.objectContaining({ repo: 'metadata', branch: 'main' }),
        );
      } else {
        expect(queued.azureDeploy).toBeUndefined();
      }
    },
  );

  it('normalizes a legacy Azure payload before queueing', async () => {
    await service.enqueue({
      orgAlias: 'target@example.com',
      azureDeploy: {
        project: 'Core',
        repo: 'metadata',
        branch: 'release',
      },
    });

    expect(requireActive).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'azure_devops',
        project: 'Core',
        repo: 'metadata',
        branch: 'release',
      }),
    );
    expect(addJob.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        gitSource: expect.objectContaining({ provider: 'azure_devops' }),
        azureDeploy: expect.objectContaining({ project: 'Core' }),
      }),
    );
  });

  it('preserves template permission sets in the immutable worker payload', async () => {
    await service.enqueue({
      orgAlias: 'target@example.com',
      automationRunId: 'run-1',
      assignPermissionSet: true,
      permissionSets: ['Onboarding_Admin_Extension', 'Lifecycle_Super_User'],
      gitSource: {
        provider: 'github',
        repo: 'metadata',
        branch: 'main',
      },
    });

    expect(addJob.mock.calls[0][2]).toEqual(expect.objectContaining({
      assignPermissionSet: true,
      permissionSets: ['Onboarding_Admin_Extension', 'Lifecycle_Super_User'],
    }));
  });

  it('does not persist or enqueue when the connection is inactive', async () => {
    requireActive.mockRejectedValue(new Error('SCM connection is not active'));

    await expect(
      service.enqueue({
        orgAlias: 'target@example.com',
        gitSource: {
          provider: 'github',
          connectionId: 'inactive',
          namespace: 'acme',
          repo: 'metadata',
          branch: 'main',
        },
      }),
    ).rejects.toThrow('not active');
    expect(db.job.create).not.toHaveBeenCalled();
    expect(addJob).not.toHaveBeenCalled();
  });

  it('marks pre-dispatch failures safe and queue-dispatch failures ambiguous', async () => {
    requireActive.mockRejectedValueOnce(new Error('inactive'));
    const safe = await service.enqueue({
      orgAlias: 'target@example.com',
      gitSource: { provider: 'github', repo: 'metadata', branch: 'main' },
    }).catch((error: unknown) => error);
    expect(safe).toBeInstanceOf(Error);
    expect(metadataEnqueueSideEffectMayHavePersisted(safe)).toBe(false);

    requireActive.mockImplementation((source: GitSourceConfig) => Promise.resolve(source));
    addJob.mockRejectedValueOnce(new Error('connection reset'));
    const ambiguous = await service.enqueue({
      orgAlias: 'target@example.com',
      gitSource: { provider: 'github', repo: 'metadata', branch: 'main' },
    }).catch((error: unknown) => error);
    expect(ambiguous).toBeInstanceOf(Error);
    expect(metadataEnqueueSideEffectMayHavePersisted(ambiguous)).toBe(true);
  });
});
