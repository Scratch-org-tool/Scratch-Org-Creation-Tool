import { describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {} }));

import { ProvisioningService } from './provisioning.service';

function service(discover: ReturnType<typeof vi.fn>) {
  return new ProvisioningService(
    {} as never,
    { discover } as never,
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
    const result = await service(discover).previewTemplatePlan({
      orgId: 'org-1',
      automationRunId: 'run-1',
      config: { ...baseConfig, discoveryPolicy: 'disabled' },
    }, 'owner');

    expect(discover).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.users[0].role).toBe('Salesforce Role');
  });

  it('continues best-effort discovery failures only when configured', async () => {
    const discover = vi.fn().mockRejectedValue(new Error('org unavailable'));
    const result = await service(discover).previewTemplatePlan({
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
