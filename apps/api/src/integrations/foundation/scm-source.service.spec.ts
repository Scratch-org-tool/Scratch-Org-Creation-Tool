import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitSourceConfig, ScmProvider } from '@sfcc/shared';
import type { ScmAdapter } from './adapter.contracts';

const db = vi.hoisted(() => ({
  scmConnection: { findUnique: vi.fn() },
  projectBinding: { findUnique: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import { ScmAdapterRegistry } from './adapter.registry';
import { ScmSourceService } from './scm-source.service';

function adapter(provider: ScmProvider) {
  return {
    provider,
    getConnectionStatus: vi.fn().mockResolvedValue({
      provider,
      connected: true,
      state: 'connected',
    }),
    checkout: vi.fn().mockResolvedValue({
      workspaceDir: `/tmp/${provider}`,
      cleanup: vi.fn(),
    }),
  } as unknown as ScmAdapter;
}

describe('ScmSourceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.scmConnection.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          provider: where.id.replace('connection-', '') as ScmProvider,
          status: 'connected',
        }),
    );
    db.projectBinding.findUnique.mockResolvedValue(null);
  });

  it.each(['azure_devops', 'github', 'bitbucket'] as const)(
    'dispatches %s checkout without carrying credential fields',
    async (provider) => {
      const selected = adapter(provider);
      const service = new ScmSourceService(new ScmAdapterRegistry([selected]));
      const source = {
        provider,
        connectionId: `connection-${provider}`,
        namespace: 'acme',
        repo: 'metadata',
        branch: 'main',
        token: 'must-not-reach-adapter',
      } as GitSourceConfig & { token: string };

      await expect(service.checkout(source)).resolves.toMatchObject({
        workspaceDir: `/tmp/${provider}`,
      });
      expect(selected.checkout).toHaveBeenCalledWith(
        expect.not.objectContaining({ token: expect.anything() }),
      );
    },
  );

  it('rejects inactive connections before invoking a provider', async () => {
    const github = adapter('github');
    db.scmConnection.findUnique.mockResolvedValue({
      provider: 'github',
      status: 'disconnected',
    });
    const service = new ScmSourceService(new ScmAdapterRegistry([github]));

    await expect(
      service.checkout({
        provider: 'github',
        connectionId: 'connection-github',
        namespace: 'acme',
        repo: 'metadata',
        branch: 'main',
      }),
    ).rejects.toThrow('not active');
    expect(github.checkout).not.toHaveBeenCalled();
  });

  it('allows the environment-backed Azure sentinel without a database lookup', async () => {
    const azure = adapter('azure_devops');
    const service = new ScmSourceService(new ScmAdapterRegistry([azure]));

    await expect(service.resolve({
      provider: 'azure_devops',
      connectionId: 'environment-azure-devops',
      project: 'Core',
      repo: 'metadata',
      branch: 'main',
    })).resolves.toMatchObject({
      connectionId: 'environment-azure-devops',
    });
    expect(db.scmConnection.findUnique).not.toHaveBeenCalled();
  });

  it('enforces binding provider, connection, and repository boundaries', async () => {
    const bitbucket = adapter('bitbucket');
    db.projectBinding.findUnique.mockResolvedValue({
      scmConnection: {
        id: 'bb-connection',
        provider: 'bitbucket',
        status: 'connected',
      },
      projectKey: 'workspace',
      externalProjectId: 'workspace-id',
      repositoryId: 'repo-id',
      repositoryName: 'bound-repo',
      metadata: { workspace: 'workspace' },
    });
    const service = new ScmSourceService(new ScmAdapterRegistry([bitbucket]));

    await expect(
      service.resolve({
        provider: 'bitbucket',
        bindingId: 'binding-1',
        repo: 'another-repo',
        branch: 'main',
      }),
    ).rejects.toThrow('Repository does not match');
  });
});
