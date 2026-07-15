import { describe, expect, it, vi } from 'vitest';
import { ERROR_LOGGER_PACKAGE_ID } from '@sfcc/shared';
import { ScratchOrgPreparationService } from './scratch-org-preparation.service';
import { JobCancelledError } from './scratch-org-job.service';

function serviceWithCli(cli: Record<string, unknown>) {
  const service = new ScratchOrgPreparationService();
  (service as unknown as { sfCli: Record<string, unknown> }).sfCli = cli;
  return service;
}

describe('ScratchOrgPreparationService', () => {
  it('does not install when the required package is already installed', async () => {
    const installPackageCancellable = vi.fn();
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [{ SubscriberPackageVersionId: ERROR_LOGGER_PACKAGE_ID }] },
      }),
      installPackageCancellable,
    });

    await expect(service.prepare(
      { alias: 'scratch', username: 'scratch@example.com' },
      { verifyAuthentication: true, ensureRequiredPackage: true },
    )).resolves.toEqual({
      authenticated: true,
      packageInstalled: true,
      packageAction: 'already_installed',
    });
    expect(installPackageCancellable).not.toHaveBeenCalled();
  });

  it('installs a missing package exactly once', async () => {
    const installPackageCancellable = vi.fn().mockReturnValue({
      promise: Promise.resolve({ success: true }),
      kill: vi.fn(),
    });
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [] },
      }),
      installPackageCancellable,
    });

    await expect(service.prepare(
      { alias: 'scratch' },
      { verifyAuthentication: true, ensureRequiredPackage: true },
    )).resolves.toEqual(expect.objectContaining({ packageAction: 'installed' }));
    expect(installPackageCancellable).toHaveBeenCalledTimes(1);
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

  it('does not allow verifyAuthentication false to bypass target authentication', async () => {
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: false, error: 'expired auth' }),
    });
    await expect(service.prepare(
      { alias: 'expired' },
      { verifyAuthentication: false, ensureRequiredPackage: false },
    )).rejects.toThrow('not authenticated');
  });

  it('registers package installation by DB job id so cancellation kills the CLI process', async () => {
    const kill = vi.fn();
    const register = vi.fn((_jobId: string, handler: () => void) => {
      handler();
      return vi.fn();
    });
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [] },
      }),
      installPackageCancellable: vi.fn().mockReturnValue({
        promise: Promise.resolve({ success: false, error: 'terminated' }),
        kill,
      }),
    });

    await expect(service.prepare(
      { alias: 'scratch' },
      { verifyAuthentication: true, ensureRequiredPackage: true },
      undefined,
      {
        dbJobId: 'db-job-1',
        processRegistry: {
          register,
          isCancellationRequested: vi.fn().mockResolvedValue(true),
        },
      },
    )).rejects.toBeInstanceOf(JobCancelledError);
    expect(register).toHaveBeenCalledWith('db-job-1', kill);
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('surfaces an active package-process kill as cancellation', async () => {
    let resolveInstall!: (result: { success: boolean; error?: string }) => void;
    let registeredKill: (() => void) | undefined;
    let cancellationRequested = false;
    const promise = new Promise<{ success: boolean; error?: string }>((resolve) => {
      resolveInstall = resolve;
    });
    const kill = vi.fn(() => {
      cancellationRequested = true;
      resolveInstall({ success: false, error: 'Process terminated' });
    });
    const register = vi.fn((_jobId: string, handler: () => void) => {
      registeredKill = handler;
      return vi.fn();
    });
    const service = serviceWithCli({
      displayOrg: vi.fn().mockResolvedValue({ success: true }),
      listInstalledPackages: vi.fn().mockResolvedValue({
        success: true,
        data: { result: [] },
      }),
      installPackageCancellable: vi.fn().mockReturnValue({ promise, kill }),
    });

    const preparing = service.prepare(
      { alias: 'scratch' },
      { verifyAuthentication: true, ensureRequiredPackage: true },
      undefined,
      {
        dbJobId: 'active-job',
        processRegistry: {
          register,
          isCancellationRequested: vi.fn(
            async () => cancellationRequested,
          ),
        },
      },
    );
    await vi.waitFor(() => expect(registeredKill).toBeTypeOf('function'));
    registeredKill?.();

    await expect(preparing).rejects.toBeInstanceOf(JobCancelledError);
    expect(kill).toHaveBeenCalledTimes(1);
  });
});
