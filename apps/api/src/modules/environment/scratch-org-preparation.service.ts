import { Injectable } from '@nestjs/common';
import { ERROR_LOGGER_PACKAGE_ID, type ExistingOrgOptions } from '@sfcc/shared';
import { createSfCliClient, type SfInstalledPackage } from '@sfcc/sf-cli';

export interface ScratchOrgPreparationTarget {
  alias: string;
  username?: string | null;
}

export interface ScratchOrgPreparationResult {
  authenticated: boolean | null;
  packageInstalled: boolean | null;
  packageAction: 'already_installed' | 'installed' | 'skipped';
}

@Injectable()
export class ScratchOrgPreparationService {
  private readonly sfCli = createSfCliClient({
    cwd: process.env.SF_PROJECT_ROOT ?? process.cwd(),
  });

  private targetName(target: ScratchOrgPreparationTarget): string {
    return target.username ?? target.alias;
  }

  async verifyAuthentication(target: ScratchOrgPreparationTarget): Promise<void> {
    const result = await this.sfCli.displayOrg(this.targetName(target));
    if (!result.success) {
      throw new Error(
        `Scratch org "${target.alias}" is not authenticated in Salesforce CLI`,
      );
    }
  }

  async isRequiredPackageInstalled(
    target: ScratchOrgPreparationTarget,
  ): Promise<boolean> {
    const result = await this.sfCli.listInstalledPackages(this.targetName(target));
    if (!result.success) {
      throw new Error(
        result.error
        ?? `Unable to inspect installed packages for scratch org "${target.alias}"`,
      );
    }
    const packages = result.data?.result ?? [];
    return packages.some((pkg: SfInstalledPackage) =>
      pkg.SubscriberPackageVersionId === ERROR_LOGGER_PACKAGE_ID
      || pkg.SubscriberPackageId === ERROR_LOGGER_PACKAGE_ID
      || pkg.Id === ERROR_LOGGER_PACKAGE_ID);
  }

  async ensureRequiredPackage(
    target: ScratchOrgPreparationTarget,
  ): Promise<'already_installed' | 'installed'> {
    if (await this.isRequiredPackageInstalled(target)) return 'already_installed';

    const result = await this.sfCli.installPackage(
      ERROR_LOGGER_PACKAGE_ID,
      this.targetName(target),
      30,
    );
    if (!result.success) {
      // A concurrent preparation may have completed while this install was
      // starting. Re-check before surfacing a package install failure.
      if (await this.isRequiredPackageInstalled(target).catch(() => false)) {
        return 'already_installed';
      }
      throw new Error(result.error ?? 'Required package installation failed');
    }
    return 'installed';
  }

  async prepare(
    target: ScratchOrgPreparationTarget,
    options: ExistingOrgOptions,
    log?: (line: string, stream?: 'stdout' | 'stderr') => Promise<void>,
  ): Promise<ScratchOrgPreparationResult> {
    let authenticated: boolean | null = null;
    if (options.verifyAuthentication) {
      await log?.('Verifying Salesforce CLI authentication...');
      await this.verifyAuthentication(target);
      authenticated = true;
      await log?.('Salesforce CLI authentication verified');
    } else {
      await log?.('Skipped Salesforce CLI authentication verification');
    }

    if (!options.ensureRequiredPackage) {
      await log?.('Skipped required package preparation');
      return {
        authenticated,
        packageInstalled: null,
        packageAction: 'skipped',
      };
    }

    await log?.('Checking required package installation...');
    const packageAction = await this.ensureRequiredPackage(target);
    await log?.(
      packageAction === 'installed'
        ? 'Required package installed'
        : 'Required package already installed',
    );
    return {
      authenticated,
      packageInstalled: true,
      packageAction,
    };
  }
}
