import { describe, expect, it, vi } from 'vitest';
import { ERROR_LOGGER_PACKAGE_ID } from '@sfcc/shared';
import { ScratchOrgPreparationService } from './scratch-org-preparation.service';

function serviceWithCli(cli: Record<string, unknown>) {
  const service = new ScratchOrgPreparationService();
  (service as unknown as { sfCli: Record<string, unknown> }).sfCli = cli;
  return service;
}

describe('ScratchOrgPreparationService', () => {
  it('does not install when the required package is already installed', async () => {
    const installPackage = vi.fn();
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [{ SubscriberPackageVersionId: ERROR_LOGGER_PACKAGE_ID }] },
      }),
      installPackage,
    });

    await expect(service.prepare(
      { alias: 'scratch', username: 'scratch@example.com' },
      { verifyAuthentication: true, ensureRequiredPackage: true },
    )).resolves.toEqual({
      authenticated: true,
      packageInstalled: true,
      packageAction: 'already_installed',
    });
    expect(installPackage).not.toHaveBeenCalled();
  });

  it('installs a missing package exactly once', async () => {
    const installPackage = vi.fn().mockResolvedValue({ success: true });
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [] },
      }),
      installPackage,
    });

    await expect(service.prepare(
      { alias: 'scratch' },
      { verifyAuthentication: true, ensureRequiredPackage: true },
    )).resolves.toEqual(expect.objectContaining({ packageAction: 'installed' }));
    expect(installPackage).toHaveBeenCalledTimes(1);
  });

  it('fails preparation when authentication is expired or unavailable', async () => {
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: false, error: 'expired auth' }),
    });
    await expect(service.prepare(
      { alias: 'expired' },
      { verifyAuthentication: true, ensureRequiredPackage: false },
    )).rejects.toThrow('not authenticated');
  });
});
