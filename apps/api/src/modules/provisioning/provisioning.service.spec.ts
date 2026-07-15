import { describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {} }));

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
