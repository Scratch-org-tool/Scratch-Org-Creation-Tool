import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createSfCliClient, type SfCommandResult } from '@sfcc/sf-cli';
import { encrypt, decrypt } from '../../common/crypto.util';
import { resolveOrgTypeFromInstance } from '../../common/org-type.util';
import { StreamService } from '../stream/stream.service';
import { assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';
import type { AuthorizeOrgInput } from '@sfcc/shared';

interface ActiveAuth {
  kill: () => void;
  orgId: string;
}

type AuthorizationOutcomeStatus = 'authorized' | 'failed' | 'cancelled';

interface AuthorizationOutcome {
  status: AuthorizationOutcomeStatus;
  error?: string;
  recordedAt: number;
}

const AUTHORIZATION_OUTCOME_TTL_MS = 10 * 60 * 1000;

function describeSfAuthError(message: string): string {
  if (message.includes('1717') || message.toLowerCase().includes('oauth redirect server')) {
    return 'Salesforce OAuth port 1717 is already in use. Click Stop on any in-progress connect, run `npm run dev:restart`, then try again.';
  }
  if (message.toLowerCase().includes('authorization cancelled') || message.toLowerCase().includes('cancelled')) {
    return 'Authorization was cancelled.';
  }
  return message;
}

function mapSfAuthError(message: string): Error {
  return new BadRequestException(describeSfAuthError(message));
}

function resolveAuthorizeOrgType(input: AuthorizeOrgInput): 'prod' | 'sandbox' {
  return resolveOrgTypeFromInstance(input.instanceUrl, input.isDevHub ?? false);
}

function isScratchOrgAlreadyGone(error?: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('not found')
    || lower.includes('does not exist')
    || lower.includes('no authorization')
    || lower.includes('expired')
    || lower.includes('already been deleted')
    || lower.includes('invalid alias')
  );
}

@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);
  private readonly sfCli = createSfCliClient();
  private readonly activeAuthorizations = new Map<string, ActiveAuth>();
  private readonly authorizationOutcomes = new Map<string, AuthorizationOutcome>();

  constructor(private readonly streamService: StreamService) {}

  async findAll(userId: string) {
    const orgs = await prisma.orgConnection.findMany({
      where: userOwnedWhere(userId),
      orderBy: { createdAt: 'desc' },
    });
    return orgs.map((o) => this.sanitizeOrg(o));
  }

  async findOne(id: string, userId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id } });
    if (!org) return null;
    assertResourceOwner(org, userId, 'Org');
    return this.sanitizeOrg(org);
  }

  async findByAlias(alias: string, userId?: string) {
    const org = await prisma.orgConnection.findUnique({ where: { alias } });
    if (!org) return null;
    if (userId) assertResourceOwner(org, userId, 'Org');
    return this.sanitizeOrg(org);
  }

  private async requireOrgByAlias(alias: string, userId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { alias } });
    assertResourceOwner(org, userId, 'Org');
    return org!;
  }

  isAuthorizing(alias: string): boolean {
    return this.activeAuthorizations.has(alias);
  }

  async cancelAuthorize(alias: string, userId?: string) {
    if (userId) await this.requireOrgByAlias(alias, userId);
    const active = this.activeAuthorizations.get(alias);
    const org = await prisma.orgConnection.findUnique({ where: { alias } });
    if (!org || org.status !== 'authorizing') {
      return { cancelled: false, alias, status: org?.status ?? 'not_found' };
    }

    active?.kill();
    if (this.activeAuthorizations.get(alias) === active) {
      this.activeAuthorizations.delete(alias);
    }
    await prisma.orgConnection.update({
      where: { alias },
      data: { status: 'revoked' },
    });
    this.rememberAuthorizationOutcome(alias, 'cancelled');
    this.publishAuthStatus({
      orgId: org.id,
      alias,
      status: 'cancelled',
    }, org.createdBy);

    try {
      await this.sfCli.logout(alias);
    } catch {
      // partial auth may not have a session to logout
    }

    return { cancelled: true, alias };
  }

  async authorize(input: AuthorizeOrgInput, userId = 'system') {
    if (this.activeAuthorizations.has(input.alias)) {
      throw new ConflictException(`Authorization already in progress for alias "${input.alias}"`);
    }

    const existing = await prisma.orgConnection.findUnique({ where: { alias: input.alias } });
    if (existing && existing.createdBy !== userId && existing.createdBy !== 'system') {
      throw new BadRequestException(`Alias "${input.alias}" is already in use`);
    }
    const orgType = resolveAuthorizeOrgType(input);
    const org = existing
      ? await prisma.orgConnection.update({
          where: { alias: input.alias },
          data: {
            status: 'authorizing',
            instanceUrl: input.instanceUrl,
            isDevHub: input.isDevHub ?? false,
            type: orgType,
            createdBy: userId,
          },
        })
      : await prisma.orgConnection.create({
          data: {
            alias: input.alias,
            instanceUrl: input.instanceUrl,
            isDevHub: input.isDevHub ?? false,
            type: orgType,
            status: 'authorizing',
            createdBy: userId,
          },
        });

    try {
      const authorization = this.sfCli.loginWebCancellable(
        input.alias,
        input.instanceUrl,
        input.isDevHub,
      );
      const active = { kill: authorization.kill, orgId: org.id };
      this.activeAuthorizations.set(input.alias, active);
      this.authorizationOutcomes.delete(input.alias);
      this.publishAuthStatus({
        orgId: org.id,
        alias: input.alias,
        status: 'authorizing',
      }, userId);
      void this.completeAuthorization(
        input,
        userId,
        orgType,
        active,
        authorization.promise,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markAuthorizationFailed(org.id, input.alias, userId, message);
      throw mapSfAuthError(message);
    }

    // Browser-based OAuth can take several minutes. Return immediately and
    // report completion through auth_status events and the status endpoint.
    return this.sanitizeOrg(org);
  }

  async getAuthorizationStatus(alias: string, userId: string) {
    const org = await this.requireOrgByAlias(alias, userId);
    if (org.status === 'active') {
      return { alias, orgId: org.id, status: 'authorized' as const };
    }

    const outcome = this.getAuthorizationOutcome(alias);
    if (outcome) {
      return {
        alias,
        orgId: org.id,
        status: outcome.status,
        ...(outcome.error ? { error: outcome.error } : {}),
      };
    }

    if (org.status === 'authorizing') {
      return { alias, orgId: org.id, status: 'authorizing' as const };
    }

    return {
      alias,
      orgId: org.id,
      status: 'failed' as const,
      error: 'Authorization did not complete. Start the connection again.',
    };
  }

  private async completeAuthorization(
    input: AuthorizeOrgInput,
    userId: string,
    orgType: 'prod' | 'sandbox',
    active: ActiveAuth,
    promise: Promise<SfCommandResult>,
  ): Promise<void> {
    try {
      const result = await promise;
      if (this.activeAuthorizations.get(input.alias) !== active) return;

      if (!result.success) {
        await this.markAuthorizationFailed(
          active.orgId,
          input.alias,
          userId,
          result.error ?? 'Salesforce authorization failed.',
        );
        return;
      }

      const data = result.data as {
        result?: {
          accessToken?: string;
          refreshToken?: string;
          instanceUrl?: string;
          username?: string;
          orgId?: string;
        };
      };
      const authorized = data?.result;
      await prisma.orgConnection.update({
        where: { id: active.orgId },
        data: {
          status: 'active',
          type: orgType,
          accessToken: authorized?.accessToken ? encrypt(authorized.accessToken) : null,
          refreshToken: authorized?.refreshToken ? encrypt(authorized.refreshToken) : null,
          instanceUrl: authorized?.instanceUrl ?? input.instanceUrl,
          username: authorized?.username,
          orgId: authorized?.orgId,
        },
      });

      this.rememberAuthorizationOutcome(input.alias, 'authorized');
      this.publishAuthStatus({
        orgId: active.orgId,
        alias: input.alias,
        status: 'authorized',
      }, userId);
    } catch (error) {
      if (this.activeAuthorizations.get(input.alias) !== active) return;
      this.logger.error(
        `Failed to finish Salesforce authorization for alias "${input.alias}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.markAuthorizationFailed(
        active.orgId,
        input.alias,
        userId,
        'Salesforce authorization completed, but the connection could not be saved. Try again.',
      );
    } finally {
      if (this.activeAuthorizations.get(input.alias) === active) {
        this.activeAuthorizations.delete(input.alias);
      }
    }
  }

  private async markAuthorizationFailed(
    orgId: string,
    alias: string,
    userId: string,
    rawMessage: string,
  ): Promise<void> {
    const message = describeSfAuthError(rawMessage);
    try {
      await prisma.orgConnection.update({
        where: { id: orgId },
        data: { status: 'revoked' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist authorization failure for alias "${alias}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    this.rememberAuthorizationOutcome(alias, 'failed', message);
    this.publishAuthStatus({
      orgId,
      alias,
      status: 'failed',
      error: message,
    }, userId);
  }

  private publishAuthStatus(payload: Record<string, unknown>, ownerId: string): void {
    void this.streamService.publish('auth_status', payload, ownerId).catch((error) => {
      // Status polling remains available if event delivery is unavailable.
      this.logger.warn(
        `Could not publish Salesforce authorization status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  private rememberAuthorizationOutcome(
    alias: string,
    status: AuthorizationOutcomeStatus,
    error?: string,
  ): void {
    const now = Date.now();
    for (const [key, outcome] of this.authorizationOutcomes) {
      if (now - outcome.recordedAt > AUTHORIZATION_OUTCOME_TTL_MS) {
        this.authorizationOutcomes.delete(key);
      }
    }
    this.authorizationOutcomes.set(alias, { status, error, recordedAt: now });
  }

  private getAuthorizationOutcome(alias: string): AuthorizationOutcome | undefined {
    const outcome = this.authorizationOutcomes.get(alias);
    if (!outcome) return undefined;
    if (Date.now() - outcome.recordedAt <= AUTHORIZATION_OUTCOME_TTL_MS) return outcome;
    this.authorizationOutcomes.delete(alias);
    return undefined;
  }

  async revoke(alias: string, userId: string) {
    await this.requireOrgByAlias(alias, userId);
    if (this.activeAuthorizations.has(alias)) {
      await this.cancelAuthorize(alias);
    }
    try {
      await this.sfCli.logout(alias);
    } catch {
      // ignore if no session
    }
    const org = await prisma.orgConnection.update({
      where: { alias },
      data: { status: 'revoked', accessToken: null, refreshToken: null },
    });
    return this.sanitizeOrg(org);
  }

  async openOrg(alias: string, userId: string) {
    await this.requireOrgByAlias(alias, userId);
    const result = await this.sfCli.openOrg(alias);
    return result.data;
  }

  async deleteScratchOrg(alias: string, userId: string) {
    await this.requireOrgByAlias(alias, userId);
    const [scratchOrg, orgConnection] = await Promise.all([
      prisma.scratchOrg.findUnique({ where: { alias } }),
      prisma.orgConnection.findUnique({ where: { alias } }),
    ]);

    if (!scratchOrg && !orgConnection) {
      throw new NotFoundException(`Scratch org "${alias}" not found`);
    }

    const activeJob = await prisma.job.findFirst({
      where: {
        alias,
        status: { in: ['running', 'queued', 'pending'] },
      },
    });
    if (activeJob) {
      throw new BadRequestException(
        `Scratch org "${alias}" has an active job (${activeJob.status}). Cancel it in Monitoring before deleting.`,
      );
    }

    let deletedFromSalesforce = false;
    let message: string;

    const deleteResult = await this.sfCli.deleteScratchOrg(alias);
    if (deleteResult.success) {
      deletedFromSalesforce = true;
      message = 'Scratch org deleted from Salesforce';
    } else if (isScratchOrgAlreadyGone(deleteResult.error)) {
      message = 'Scratch org was already removed or expired in Salesforce; app records cleaned up';
    } else {
      throw new BadRequestException(
        deleteResult.error ?? 'Failed to delete scratch org from Salesforce',
      );
    }

    try {
      await this.sfCli.logout(alias);
    } catch {
      // best-effort local auth cleanup
    }

    await prisma.$transaction([
      prisma.scratchOrg.deleteMany({ where: { alias } }),
      prisma.orgConnection.deleteMany({ where: { alias, type: 'scratch' } }),
    ]);

    return { alias, deletedFromSalesforce, message };
  }

  async disconnectOrg(alias: string, userId: string) {
    const org = await this.requireOrgByAlias(alias, userId);
    if (org.type === 'scratch') {
      throw new BadRequestException(
        `Use scratch org delete for alias "${alias}" instead of disconnect`,
      );
    }

    if (org.isDefaultDevHub) {
      const otherDevHub = await prisma.orgConnection.findFirst({
        where: {
          isDevHub: true,
          alias: { not: alias },
          status: 'active',
        },
      });
      if (!otherDevHub) {
        throw new BadRequestException(
          'Cannot disconnect the default Dev Hub. Set another Dev Hub as default first.',
        );
      }
    }

    try {
      await this.sfCli.logout(alias);
    } catch {
      // best-effort
    }

    await prisma.orgConnection.delete({ where: { alias } });

    return { alias, disconnected: true };
  }

  async extendScratchOrg(alias: string, duration: number, userId: string) {
    await this.requireOrgByAlias(alias, userId);
    return this.sfCli.extendScratchOrg(alias, duration);
  }

  getDecryptedToken(org: { accessToken: string | null }): string | null {
    if (!org.accessToken) return null;
    try {
      return decrypt(org.accessToken);
    } catch {
      return null;
    }
  }

  private sanitizeOrg(org: Record<string, unknown>) {
    const { accessToken, refreshToken, ...safe } = org;
    return safe;
  }
}
