import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { encrypt, decrypt } from '../../common/crypto.util';
import { resolveOrgTypeFromInstance } from '../../common/org-type.util';
import { StreamService } from '../stream/stream.service';
import { assertResourceOwner, userOwnedWhere } from '../../common/user-tenancy.util';
import type { AuthorizeOrgInput } from '@sfcc/shared';

interface ActiveAuth {
  kill: () => void;
  orgId: string;
}

function mapSfAuthError(message: string): Error {
  if (message.includes('1717') || message.toLowerCase().includes('oauth redirect server')) {
    return new BadRequestException(
      'Salesforce OAuth port 1717 is already in use. Click Stop on any in-progress connect, run `npm run dev:restart`, then try again.',
    );
  }
  if (message.toLowerCase().includes('authorization cancelled') || message.toLowerCase().includes('cancelled')) {
    return new BadRequestException('Authorization was cancelled.');
  }
  return new BadRequestException(message);
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
  private readonly sfCli = createSfCliClient();
  private readonly activeAuthorizations = new Map<string, ActiveAuth>();

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
    if (active) {
      active.kill();
      this.activeAuthorizations.delete(alias);
    }

    const org = await prisma.orgConnection.findUnique({ where: { alias } });
    if (org?.status === 'authorizing') {
      await prisma.orgConnection.update({
        where: { alias },
        data: { status: 'revoked' },
      });
      await this.streamService.publish('auth_status', {
        orgId: org.id,
        alias,
        status: 'cancelled',
      });
    }

    try {
      await this.sfCli.logout(alias);
    } catch {
      // partial auth may not have a session to logout
    }

    return { cancelled: true, alias };
  }

  async authorize(input: AuthorizeOrgInput, userId = 'system') {
    if (this.activeAuthorizations.has(input.alias)) {
      throw new Error(`Authorization already in progress for alias "${input.alias}"`);
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

    await this.streamService.publish('auth_status', {
      orgId: org.id,
      alias: input.alias,
      status: 'authorizing',
    });

    const { promise, kill } = this.sfCli.loginWebCancellable(
      input.alias,
      input.instanceUrl,
      input.isDevHub,
    );

    this.activeAuthorizations.set(input.alias, { kill, orgId: org.id });

    try {
      const result = await promise;

      if (!this.activeAuthorizations.has(input.alias)) {
        throw new Error('Authorization was cancelled');
      }

      if (!result.success) {
        await prisma.orgConnection.update({
          where: { id: org.id },
          data: { status: 'revoked' },
        });
        await this.streamService.publish('auth_status', {
          orgId: org.id,
          alias: input.alias,
          status: 'failed',
          error: result.error,
        });
        throw mapSfAuthError(result.error ?? 'Authorization failed');
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

      const r = data?.result;
      const updated = await prisma.orgConnection.update({
        where: { id: org.id },
        data: {
          status: 'active',
          type: orgType,
          accessToken: r?.accessToken ? encrypt(r.accessToken) : null,
          refreshToken: r?.refreshToken ? encrypt(r.refreshToken) : null,
          instanceUrl: r?.instanceUrl ?? input.instanceUrl,
          username: r?.username,
          orgId: r?.orgId,
        },
      });

      await this.streamService.publish('auth_status', {
        orgId: org.id,
        alias: input.alias,
        status: 'authorized',
      });

      return this.sanitizeOrg(updated);
    } catch (error) {
      const wasCancelled = !this.activeAuthorizations.has(input.alias);
      if (!wasCancelled) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.orgConnection.update({
          where: { id: org.id },
          data: { status: 'revoked' },
        }).catch(() => undefined);
        await this.streamService.publish('auth_status', {
          orgId: org.id,
          alias: input.alias,
          status: 'failed',
          error: message,
        });
        throw mapSfAuthError(message);
      }
      throw new BadRequestException('Authorization cancelled');
    } finally {
      this.activeAuthorizations.delete(input.alias);
    }
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
