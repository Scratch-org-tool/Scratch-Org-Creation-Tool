import { generateKeyPairSync } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  scmConnection: { upsert: vi.fn() },
  workItemConnection: { upsert: vi.fn() },
  projectBinding: { deleteMany: vi.fn(), createMany: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
}));
vi.mock('@sfcc/db', () => ({ prisma }));

import type { GitHubAuthService } from './github-auth.service';
import { GitHubIntegrationService } from './github-integration.service';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

describe('GitHubIntegrationService', () => {
  it('encrypts credentials, creates paired connections, and returns no secrets', async () => {
    tx.scmConnection.upsert.mockResolvedValue({ id: 'scm-1' });
    tx.workItemConnection.upsert.mockResolvedValue({ id: 'wi-1' });
    tx.projectBinding.deleteMany.mockResolvedValue({ count: 0 });
    tx.projectBinding.createMany.mockResolvedValue({ count: 1 });
    const auth = {
      verify: vi.fn().mockResolvedValue({
        appId: '123',
        appSlug: 'sfcc-app',
        installationId: '456',
        accountId: '789',
        accountLogin: 'acme',
        accountType: 'Organization',
        baseUrl: 'https://github.com',
      }),
    } as unknown as GitHubAuthService;
    const service = new GitHubIntegrationService(auth);
    const result = await service.connect(
      {
        appId: '123',
        privateKey: pem,
        installationId: '456',
        pat: 'github_pat_admin_fallback_secret',
        webhookSecret: 'webhook-signing-secret-value',
        projectBindings: [
          {
            projectId: 'PVT_1',
            owner: 'acme',
            repository: 'repo',
            fieldMapping: { Severity: 'Impact' },
          },
        ],
      },
      'admin-user',
    );
    const create = tx.scmConnection.upsert.mock.calls[0][0].create;
    expect(create.encryptedCredentials).not.toContain('github_pat_admin_fallback_secret');
    expect(create.encryptedCredentials).not.toContain('BEGIN PRIVATE KEY');
    expect(create.metadata).not.toHaveProperty('pat');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result).toMatchObject({
      connected: true,
      scmConnectionId: 'scm-1',
      workItemConnectionId: 'wi-1',
    });
    expect(tx.projectBinding.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          externalProjectId: 'PVT_1',
          projectKey: 'acme',
          repositoryName: 'repo',
          metadata: { fieldMapping: { Severity: 'Impact' } },
        }),
      ],
    });
  });
});
