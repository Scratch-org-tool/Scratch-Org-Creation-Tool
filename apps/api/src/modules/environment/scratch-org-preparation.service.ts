import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { ERROR_LOGGER_PACKAGE_ID, type ExistingOrgOptions } from '@sfcc/shared';
import {
  createSfCliClient,
  type SfInstalledPackage,
  type SfOrgInfo,
} from '@sfcc/sf-cli';
import type { JobProcessRegistryService } from '../jobs/job-process-registry.service';
import { JobCancelledError } from './scratch-org-job.service';
import { resolveSfProjectRoot } from '../../common/sf-project-root.util';

export interface ScratchOrgPreparationTarget {
  alias: string;
  username?: string | null;
  orgId?: string | null;
}

export interface ScratchOrgPreparationResult {
  authenticated: boolean | null;
  packageInstalled: boolean | null;
  packageAction: 'already_installed' | 'installed' | 'skipped';
}

interface PreparationExecution {
  dbJobId: string;
  processRegistry: Pick<
    JobProcessRegistryService,
    'register' | 'isCancellationRequested'
  >;
}

@Injectable()
export class ScratchOrgPreparationService {
  private readonly sfCli = createSfCliClient({
    cwd: resolveSfProjectRoot(),
  });

  private targetName(target: ScratchOrgPreparationTarget): string {
    return target.username ?? target.alias;
  }

  async verifyAuthentication(target: ScratchOrgPreparationTarget): Promise<void> {
    const result = await this.sfCli.displayOrg(this.targetName(target));
    if (!result.success) {
      throw new Error(
        `Salesforce org "${target.alias}" is not authenticated in Salesforce CLI`,
      );
    }
  }

  async requireOwnedActiveScratchTarget(targetId: string, userId: string) {
    const target = await prisma.orgConnection.findUnique({ where: { id: targetId } });
    if (!target || target.createdBy !== userId) {
      throw new Error('Existing scratch org target was not found');
    }
    const scratch = await prisma.scratchOrg.findUnique({ where: { alias: target.alias } });
    if (!scratch || scratch.createdBy !== userId) {
      throw new Error('Caller-owned scratch org association was not found');
    }

    const now = new Date();
    if (target.type !== 'scratch' || target.status !== 'active') {
      throw new Error('Selected org is not an active scratch org');
    }
    if (!target.expiresAt || target.expiresAt <= now) {
      throw new Error('Selected scratch org expiration is missing or has passed');
    }
    if (scratch.status.toLowerCase() !== 'active') {
      throw new Error('Associated scratch org is not active');
    }
    if (!scratch.expirationDate || scratch.expirationDate <= now) {
      throw new Error('Associated scratch org expiration is missing or has passed');
    }
    if (
      scratch.alias !== target.alias
      || !target.username
      || scratch.username !== target.username
      || !target.orgId
      || scratch.orgId !== target.orgId
    ) {
      throw new Error('Scratch org association does not match alias, username, and org ID');
    }
    if (!scratch.devHubAlias) {
      throw new Error('Associated scratch org has no Dev Hub identity');
    }

    const live = await this.requireLiveScratchIdentity(target);
    return { target, scratch, live };
  }

  async requireLiveScratchIdentity(target: ScratchOrgPreparationTarget) {
    const listed = await this.sfCli.listOrgs();
    if (!listed.success) {
      throw new Error(listed.error ?? 'Unable to list Salesforce CLI orgs');
    }
    const scratchOrgs = (listed.data?.result?.scratchOrgs ?? []) as SfOrgInfo[];
    const listedOrg = scratchOrgs.find(
      (org) => org.alias === target.alias || org.username === target.username,
    );
    if (!listedOrg || listedOrg.alias !== target.alias) {
      throw new Error(`Scratch org "${target.alias}" is not authenticated as a scratch org`);
    }

    const display = await this.sfCli.displayOrg(target.username ?? target.alias);
    if (!display.success) {
      throw new Error(`Scratch org "${target.alias}" is not authenticated in Salesforce CLI`);
    }
    const details = ((display.data as { result?: SfOrgInfo })?.result ?? {}) as SfOrgInfo;
    const username = details.username ?? listedOrg.username;
    const orgId = details.orgId ?? details.id ?? listedOrg.orgId ?? listedOrg.id;
    const listedOrgId = listedOrg.orgId ?? listedOrg.id;
    if (
      !username
      || !orgId
      || (details.alias && details.alias !== target.alias)
      || (listedOrg.username && username !== listedOrg.username)
      || (listedOrgId && orgId !== listedOrgId)
      || (target.username && username !== target.username)
      || (target.orgId && orgId !== target.orgId)
    ) {
      throw new Error('Salesforce CLI scratch identity does not match the selected target');
    }
    if (details.isDevHub === true || listedOrg.isDevHub === true) {
      throw new Error('Selected Salesforce CLI identity is a Dev Hub, not a scratch org');
    }
    const connectedStatus = details.connectedStatus ?? listedOrg.connectedStatus;
    if (connectedStatus && connectedStatus.toLowerCase() !== 'connected') {
      throw new Error(`Scratch org Salesforce CLI status is ${connectedStatus}`);
    }
    const scratchStatus = details.status ?? listedOrg.status;
    if (scratchStatus && scratchStatus.toLowerCase() !== 'active') {
      throw new Error(`Scratch org status is ${scratchStatus}`);
    }
    const expirations = [details.expirationDate, listedOrg.expirationDate]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value));
    if (
      !expirations.length
      || expirations.some(
        (value) => Number.isNaN(value.getTime()) || value <= new Date(),
      )
    ) {
      throw new Error('Salesforce CLI scratch org expiration is missing, invalid, or has passed');
    }
    const expirationDate = expirations[0];
    const devHub =
      details.devHubUsername
      ?? details.devHubAlias
      ?? details.devHubOrgId
      ?? listedOrg.devHubUsername
      ?? listedOrg.devHubAlias
      ?? listedOrg.devHubOrgId;
    if (!devHub) {
      throw new Error('Salesforce CLI did not prove the scratch org Dev Hub identity');
    }
    return { listed: listedOrg, details, username, orgId, expirationDate, devHub };
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
    execution?: PreparationExecution,
  ): Promise<'already_installed' | 'installed'> {
    if (await this.isRequiredPackageInstalled(target)) return 'already_installed';

    const install = this.sfCli.installPackageCancellable(
      ERROR_LOGGER_PACKAGE_ID,
      this.targetName(target),
      30,
    );
    const unregister = execution?.processRegistry.register(execution.dbJobId, install.kill);
    let result;
    try {
      result = await install.promise;
      if (
        execution
        && await execution.processRegistry.isCancellationRequested(execution.dbJobId)
      ) {
        throw new JobCancelledError('Required package installation was cancelled');
      }
    } finally {
      unregister?.();
    }
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
    execution?: PreparationExecution,
  ): Promise<ScratchOrgPreparationResult> {
    // Authentication is a mandatory safety proof for any Salesforce mutation.
    // The option only controls optional preparation behavior; false must never
    // permit a stale database target to bypass CLI authentication.
    await log?.('Verifying Salesforce CLI authentication...');
    await this.verifyAuthentication(target);
    const authenticated = true;
    await log?.('Salesforce CLI authentication verified');

    if (!options.ensureRequiredPackage) {
      await log?.('Skipped required package preparation');
      return {
        authenticated,
        packageInstalled: null,
        packageAction: 'skipped',
      };
    }

    await log?.('Checking required package installation...');
    const packageAction = await this.ensureRequiredPackage(target, execution);
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
