import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  workItemConnection: { findUnique: vi.fn() },
  externalIdentityBinding: { upsert: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import { IntegrationAdminService } from './integration-admin.service';

describe('IntegrationAdminService identity mappings', () => {
  it('stores GitHub immutable ids and logins in separate fields', async () => {
    db.workItemConnection.findUnique.mockResolvedValue({
      id: 'github-work-items',
      provider: 'github_issues',
    });
    db.externalIdentityBinding.upsert.mockResolvedValue({ id: 'identity-1' });
    const service = new IntegrationAdminService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.saveIdentityBinding({
      workItemConnectionId: 'github-work-items',
      appUserId: 'app-user',
      externalUserId: '42',
      externalLogin: 'octocat',
      externalEmail: 'not-used-for-auth@example.test',
      displayName: 'The Octocat',
    });

    expect(db.externalIdentityBinding.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        externalUserId: '42',
        externalLogin: 'octocat',
        externalEmail: 'not-used-for-auth@example.test',
      }),
      update: expect.objectContaining({
        externalLogin: 'octocat',
      }),
    }));
  });

  it('returns a stable conflict when an app user is already mapped on the connection', async () => {
    db.workItemConnection.findUnique.mockResolvedValue({
      id: 'github-work-items',
      provider: 'github_issues',
    });
    db.externalIdentityBinding.upsert.mockRejectedValue({ code: 'P2002' });
    const service = new IntegrationAdminService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.saveIdentityBinding({
      workItemConnectionId: 'github-work-items',
      appUserId: 'app-user',
      externalUserId: '84',
      externalLogin: 'other',
    })).rejects.toMatchObject({ status: 409 });
  });

  it('marks Azure admin operations with the requested connection kind', async () => {
    const azure = {
      verify: vi.fn().mockResolvedValue({ verified: true }),
      disconnect: vi.fn().mockResolvedValue({ disconnected: true }),
    };
    const service = new IntegrationAdminService(
      {} as never,
      {} as never,
      {} as never,
      azure as never,
    );

    await service.verifyScm('azure_devops', 'scm-id');
    await service.verifyWorkItems('azure_boards', 'work-item-id');
    await service.disconnectScm('azure_devops', 'scm-id');
    await service.disconnectWorkItems('azure_boards', 'work-item-id');

    expect(azure.verify).toHaveBeenNthCalledWith(1, 'scm-id', 'scm');
    expect(azure.verify).toHaveBeenNthCalledWith(2, 'work-item-id', 'workItems');
    expect(azure.disconnect).toHaveBeenNthCalledWith(1, 'scm-id', 'scm');
    expect(azure.disconnect).toHaveBeenNthCalledWith(2, 'work-item-id', 'workItems');
  });
});
