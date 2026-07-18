import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {} }));

import { prisma } from '@sfcc/db';
import { QUEUE_NAMES } from '@sfcc/shared';
import { ProvisioningService } from './provisioning.service';

function service(
  discover: ReturnType<typeof vi.fn>,
  discoverProfiles: ReturnType<typeof vi.fn> = vi.fn(),
) {
  return new ProvisioningService(
    {} as never,
    { discover, discoverProfiles } as never,
  );
}

const baseConfig = {
  defaultProfile: 'Standard User',
  users: [{
    firstName: 'Preview',
    lastName: 'User',
    email: 'preview@example.com',
    role: 'Requested Role',
    bottler: '5000',
  }],
  roleBottlerMappings: [{
    role: 'Requested Role',
    bottler: '5000',
    salesforceRole: 'Salesforce Role',
  }],
};

describe('ProvisioningService standalone preview policies', () => {
  it('skips discovery when disabled and still applies the Salesforce role mapping', async () => {
    const discover = vi.fn();
    const discoverProfiles = vi.fn().mockResolvedValue([{
      Id: '00e000000000001AAA',
      Name: 'Standard User',
    }]);
    const result = await service(discover, discoverProfiles).previewTemplatePlan({
      orgId: 'org-1',
      automationRunId: 'run-1',
      config: { ...baseConfig, discoveryPolicy: 'disabled' },
    }, 'owner');

    expect(discover).not.toHaveBeenCalled();
    expect(discoverProfiles).toHaveBeenCalledWith('org-1', 'owner');
    expect(result.ok).toBe(true);
    expect(result.users[0].role).toBe('Salesforce Role');
    expect(result.users[0].profile).toBe('00e000000000001AAA');
    expect(result.warnings).toEqual(['Target metadata discovery is disabled']);
  });

  it.each([
    '00e000000000001',
    '00e000000000001AAA',
  ])('accepts an explicit profile id without profile discovery (%s)', async (profile) => {
    const discover = vi.fn();
    const discoverProfiles = vi.fn();
    const result = await service(discover, discoverProfiles).previewTemplatePlan({
      orgId: 'org-1',
      automationRunId: 'run-1',
      config: { ...baseConfig, defaultProfile: profile, discoveryPolicy: 'disabled' },
    }, 'owner');

    expect(result.ok).toBe(true);
    expect(result.users[0].profile).toBe(profile);
    expect(discover).not.toHaveBeenCalled();
    expect(discoverProfiles).not.toHaveBeenCalled();
  });

  it('continues best-effort discovery failures only when configured', async () => {
    const discover = vi.fn().mockRejectedValue(new Error('org unavailable'));
    const discoverProfiles = vi.fn().mockResolvedValue([{
      Id: '00e000000000001AAA',
      Name: 'Standard User',
    }]);
    const result = await service(discover, discoverProfiles).previewTemplatePlan({
      orgId: 'org-1',
      automationRunId: 'run-1',
      config: {
        ...baseConfig,
        discoveryPolicy: 'best_effort',
        execution: {
          mode: 'sequential',
          concurrency: 1,
          failurePolicy: 'continue',
          discoveryFailurePolicy: 'continue',
        },
      },
    }, 'owner');
    expect(result.ok).toBe(true);
    expect(result.warnings[0]).toContain('org unavailable');
    expect(result.users[0].profile).toBe('00e000000000001AAA');
  });

  it('fails strict discovery even if execution requested continuation', async () => {
    const discover = vi.fn().mockRejectedValue(new Error('strict failure'));
    await expect(service(discover).previewTemplatePlan({
      orgId: 'org-1',
      automationRunId: 'run-1',
      config: {
        ...baseConfig,
        discoveryPolicy: 'strict',
        execution: {
          mode: 'sequential',
          concurrency: 1,
          failurePolicy: 'continue',
          discoveryFailurePolicy: 'continue',
        },
      },
    }, 'owner')).rejects.toThrow('strict failure');
  });
});

describe('ProvisioningService lifecycle users', () => {
  const orgId = '3f0e8f38-8f5f-4bb0-9c33-92aa8d6f9df1';
  const prismaMock = prisma as unknown as {
    orgConnection: { findUnique: ReturnType<typeof vi.fn> };
    provisioningBatch: { create: ReturnType<typeof vi.fn> };
  };
  const baseRequest = {
    orgId,
    bottler: '4600',
    roles: ['Requestor', 'Master Data'],
    modules: ['Onboarding'],
    locations: [],
    emails: ['qa@example.com'],
    usernamePattern: '{role}.{bottlerLabel}@lifecycle.scratch',
  };

  beforeEach(() => {
    prismaMock.orgConnection = {
      findUnique: vi.fn().mockResolvedValue({ id: orgId, createdBy: 'owner' }),
    };
    prismaMock.provisioningBatch = {
      create: vi.fn().mockResolvedValue({ id: 'batch-1' }),
    };
  });

  function lifecycleService(enqueueJob: ReturnType<typeof vi.fn>) {
    return new ProvisioningService({ enqueueJob } as never, {} as never);
  }

  it('expands one user per role, persists batch rows, and enqueues the CONA-mode job', async () => {
    const enqueueJob = vi.fn().mockResolvedValue({ id: 'job-1' });
    const result = await lifecycleService(enqueueJob).provisionLifecycleUsers(baseRequest, 'owner');

    expect(result).toMatchObject({ batchId: 'batch-1', jobId: 'job-1', totalUsers: 2 });
    const rows = prismaMock.provisioningBatch.create.mock.calls[0][0].data.users.create;
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      firstName: 'MasterData',
      lastName: 'Reyes',
      username: 'masterdata.reyes@lifecycle.scratch',
      profile: 'System Administrator',
      role: 'Master Data',
      permissionSets: ['Onboarding_Admin_Extension', 'Lifecycle_Super_User'],
      status: 'queued',
    });
    expect(rows[0].permissionSets).toEqual(['Onboarding_Admin_Extension']);

    expect(enqueueJob).toHaveBeenCalledWith(
      QUEUE_NAMES.USER_PROVISION,
      'lifecycle_user_provision',
      expect.objectContaining({ orgId, batchId: 'batch-1', conaMode: true }),
      { createdBy: 'owner' },
    );
    const payloadUsers = enqueueJob.mock.calls[0][2].users;
    expect(payloadUsers.every((user: { email: string }) => user.email === 'qa@example.com')).toBe(true);
    expect(payloadUsers[0]).toMatchObject({
      bottler: '4600',
      modules: ['Onboarding'],
      username: 'requestor.reyes@lifecycle.scratch',
    });
  });

  it('rejects orgs the caller does not own before any writes', async () => {
    prismaMock.orgConnection.findUnique.mockResolvedValue({ id: orgId, createdBy: 'someone-else' });
    const enqueueJob = vi.fn();
    await expect(lifecycleService(enqueueJob).provisionLifecycleUsers(baseRequest, 'owner'))
      .rejects.toThrow('Org not found');
    expect(prismaMock.provisioningBatch.create).not.toHaveBeenCalled();
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it('rejects duplicate-username patterns without creating a batch', async () => {
    const enqueueJob = vi.fn();
    await expect(lifecycleService(enqueueJob).provisionLifecycleUsers({
      ...baseRequest,
      usernamePattern: 'static@lifecycle.scratch',
    }, 'owner')).rejects.toThrow(/duplicate username/);
    expect(prismaMock.provisioningBatch.create).not.toHaveBeenCalled();
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});
