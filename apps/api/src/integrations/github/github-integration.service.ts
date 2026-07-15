import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { z } from 'zod';
import { decrypt, encrypt } from '../../common/crypto.util';
import { GitHubAuthService } from './github-auth.service';
import {
  normalizeGitHubBaseUrl,
  type GitHubConnectInput,
  type GitHubCredentials,
  type GitHubIdentity,
  type GitHubProjectBindingRecord,
} from './github.types';

const githubConnectSchema = z
  .object({
    appId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d+$/)),
    privateKey: z.string().min(64),
    installationId: z
      .union([z.string(), z.number()])
      .transform(String)
      .pipe(z.string().regex(/^\d+$/)),
    baseUrl: z.string().url().optional(),
    pat: z.string().min(20).optional(),
    webhookSecret: z.string().min(16).optional(),
    projectBindings: z
      .array(
        z.object({
          projectId: z.string().min(1),
          owner: z.string().min(1),
          repository: z.string().min(1).optional(),
          fieldMapping: z.record(z.string(), z.string()).optional(),
        }),
      )
      .default([]),
  })
  .strict();

const SCM_CAPABILITIES = {
  repositories: true,
  branches: true,
  checkout: true,
  pipelines: false,
  pullRequests: false,
  webhooks: true,
} as const;

const WORK_ITEM_CAPABILITIES = {
  read: true,
  write: true,
  webhooks: true,
  // GitHub issue-body links are not treated as secure attachments.
  attachments: false,
  history: true,
  stateTransitions: true,
} as const;

interface ConnectionRow {
  id: string;
  externalAccountId: string | null;
  displayName: string;
  namespace: string | null;
  baseUrl: string | null;
  encryptedCredentials: string;
  status: string;
  createdAt: Date;
  lastVerifiedAt: Date | null;
}

@Injectable()
export class GitHubIntegrationService {
  constructor(private readonly auth: GitHubAuthService) {}

  async connect(body: unknown, connectedBy?: string) {
    const parsed = githubConnectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join('; '));
    }
    let baseUrl: string;
    try {
      baseUrl = normalizeGitHubBaseUrl(parsed.data.baseUrl);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid GitHub URL');
    }
    const credentials: GitHubCredentials = {
      appId: parsed.data.appId,
      privateKey: parsed.data.privateKey.replace(/\\n/g, '\n'),
      installationId: parsed.data.installationId,
      baseUrl,
      ...(parsed.data.pat ? { pat: parsed.data.pat } : {}),
      ...(parsed.data.webhookSecret ? { webhookSecret: parsed.data.webhookSecret } : {}),
    };
    const identity = await this.auth.verify(credentials);
    const encryptedCredentials = encrypt(JSON.stringify(credentials));
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const common = {
        externalAccountId: identity.installationId,
        displayName: identity.accountLogin,
        namespace: identity.accountLogin,
        baseUrl,
        encryptedCredentials,
        status: 'connected' as const,
        connectedBy: connectedBy ?? null,
        lastVerifiedAt: now,
        metadata: {
          appId: identity.appId,
          appSlug: identity.appSlug,
          accountId: identity.accountId,
          accountType: identity.accountType,
          authMode: parsed.data.pat ? 'github_app_with_pat_fallback' : 'github_app',
        },
      };
      const scm = await tx.scmConnection.upsert({
        where: {
          provider_externalAccountId: {
            provider: 'github',
            externalAccountId: identity.installationId,
          },
        },
        create: { ...common, provider: 'github', capabilities: SCM_CAPABILITIES },
        update: { ...common, capabilities: SCM_CAPABILITIES },
      });
      const workItems = await tx.workItemConnection.upsert({
        where: {
          provider_externalAccountId: {
            provider: 'github_issues',
            externalAccountId: identity.installationId,
          },
        },
        create: {
          ...common,
          provider: 'github_issues',
          capabilities: WORK_ITEM_CAPABILITIES,
        },
        update: { ...common, capabilities: WORK_ITEM_CAPABILITIES },
      });

      await tx.projectBinding.deleteMany({
        where: {
          OR: [{ scmConnectionId: scm.id }, { workItemConnectionId: workItems.id }],
        },
      });
      if (parsed.data.projectBindings.length > 0) {
        await tx.projectBinding.createMany({
          data: parsed.data.projectBindings.map((binding) => ({
            scmConnectionId: scm.id,
            workItemConnectionId: workItems.id,
            externalProjectId: binding.projectId,
            projectKey: binding.owner,
            repositoryName: binding.repository ?? null,
            createdBy: connectedBy ?? 'system',
            metadata: { fieldMapping: binding.fieldMapping ?? {} },
          })),
        });
      }
      return { scm, workItems };
    });

    return {
      connected: true,
      installationId: identity.installationId,
      account: identity.accountLogin,
      app: identity.appSlug,
      baseUrl,
      scmConnectionId: result.scm.id,
      workItemConnectionId: result.workItems.id,
      capabilities: { scm: SCM_CAPABILITIES, workItems: WORK_ITEM_CAPABILITIES },
    };
  }

  async verify(connectionId?: string) {
    const { credentials, row } = await this.requireCredentials(connectionId);
    const identity = await this.auth.verify(credentials);
    const verifiedAt = new Date();
    await prisma.$transaction([
      prisma.scmConnection.updateMany({
        where: { provider: 'github', externalAccountId: identity.installationId },
        data: { status: 'connected', lastVerifiedAt: verifiedAt },
      }),
      prisma.workItemConnection.updateMany({
        where: { provider: 'github_issues', externalAccountId: identity.installationId },
        data: { status: 'connected', lastVerifiedAt: verifiedAt },
      }),
    ]);
    return {
      verified: true,
      connectionId: row.id,
      installationId: identity.installationId,
      account: identity.accountLogin,
      app: identity.appSlug,
      baseUrl: identity.baseUrl,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  async verifyWorkItem(connectionId: string) {
    const workItems = await this.getWorkItemConnection(connectionId);
    if (!workItems) throw new NotFoundException('GitHub work-item connection not found');
    const scm = await prisma.scmConnection.findFirst({
      where: {
        provider: 'github',
        externalAccountId: workItems.externalAccountId,
      },
    });
    if (!scm) throw new NotFoundException('Paired GitHub SCM connection not found');
    return this.verify(scm.id);
  }

  async disconnect(connectionId?: string) {
    const row = await this.findScmConnection(connectionId);
    if (!row) throw new NotFoundException('No GitHub connection configured');
    const credentials = this.decodeCredentials(row.encryptedCredentials);
    const installationId = row.externalAccountId;
    const deleted = await prisma.$transaction(async (tx) => {
      const scm = await tx.scmConnection.deleteMany({
        where: {
          provider: 'github',
          ...(connectionId ? { id: connectionId } : { externalAccountId: installationId }),
        },
      });
      const workItems = await tx.workItemConnection.deleteMany({
        where: { provider: 'github_issues', externalAccountId: installationId },
      });
      return scm.count + workItems.count;
    });
    this.auth.clear(credentials);
    return { disconnected: true, count: deleted };
  }

  async disconnectWorkItem(connectionId: string) {
    const workItems = await this.getWorkItemConnection(connectionId);
    if (!workItems) throw new NotFoundException('GitHub work-item connection not found');
    const scm = await prisma.scmConnection.findFirst({
      where: {
        provider: 'github',
        externalAccountId: workItems.externalAccountId,
      },
    });
    if (!scm) {
      const deleted = await prisma.workItemConnection.deleteMany({
        where: { id: connectionId, provider: 'github_issues' },
      });
      return { disconnected: true, count: deleted.count };
    }
    return this.disconnect(scm.id);
  }

  async getStatus(connectionId?: string) {
    const row = await this.findScmConnection(connectionId);
    if (!row) {
      return {
        connected: false,
        source: null,
        connectionId: null,
        installationId: null,
        account: null,
        baseUrl: null,
        lastVerifiedAt: null,
      };
    }
    return {
      connected: row.status === 'connected' || row.status === 'degraded',
      source: 'database' as const,
      connectionId: row.id,
      installationId: row.externalAccountId,
      account: row.displayName,
      baseUrl: row.baseUrl,
      state: row.status,
      connectedAt: row.createdAt.toISOString(),
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  async getCredentials(connectionId?: string): Promise<GitHubCredentials | null> {
    const row = await this.findScmConnection(connectionId);
    return row ? this.decodeCredentials(row.encryptedCredentials) : null;
  }

  async requireCredentials(
    connectionId?: string,
  ): Promise<{ credentials: GitHubCredentials; row: ConnectionRow }> {
    const row = await this.findScmConnection(connectionId);
    if (!row) throw new NotFoundException('No GitHub connection configured');
    return { credentials: this.decodeCredentials(row.encryptedCredentials), row };
  }

  async getWorkItemConnection(connectionId?: string): Promise<ConnectionRow | null> {
    return prisma.workItemConnection.findFirst({
      where: {
        provider: 'github_issues',
        ...(connectionId ? { id: connectionId } : { status: { in: ['connected', 'degraded'] } }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getWorkItemCredentials(connectionId?: string): Promise<GitHubCredentials | null> {
    const row = await this.getWorkItemConnection(connectionId);
    return row ? this.decodeCredentials(row.encryptedCredentials) : null;
  }

  async listProjectBindings(connectionId?: string): Promise<GitHubProjectBindingRecord[]> {
    const connection = await this.getWorkItemConnection(connectionId);
    if (!connection) return [];
    const rows = await prisma.projectBinding.findMany({
      where: { workItemConnectionId: connection.id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => {
      const metadata = (row.metadata ?? {}) as { fieldMapping?: Record<string, string> };
      return {
        projectId: row.externalProjectId,
        owner: row.projectKey ?? connection.namespace ?? '',
        repository: row.repositoryName,
        fieldMapping: metadata.fieldMapping ?? {},
      };
    });
  }

  private async findScmConnection(connectionId?: string): Promise<ConnectionRow | null> {
    return prisma.scmConnection.findFirst({
      where: {
        provider: 'github',
        ...(connectionId ? { id: connectionId } : { status: { in: ['connected', 'degraded'] } }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private decodeCredentials(ciphertext: string): GitHubCredentials {
    try {
      const value = JSON.parse(decrypt(ciphertext)) as GitHubCredentials;
      return {
        ...value,
        baseUrl: normalizeGitHubBaseUrl(value.baseUrl),
      };
    } catch {
      throw new Error('Stored GitHub credentials could not be decrypted');
    }
  }
}

export type { GitHubConnectInput, GitHubIdentity };
