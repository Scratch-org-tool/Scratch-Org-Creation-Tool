import { Injectable } from '@nestjs/common';
import { prisma, type Prisma, type ScmProvider, type WorkItemProvider } from '@sfcc/db';
import { decrypt, encrypt } from '../../common/crypto.util';
import type {
  AtlassianCredential,
  BitbucketConnectionConfig,
  JiraConnectionConfig,
  StoredAtlassianConnection,
} from './atlassian.types';

interface StoredSecret<TConfig> {
  version: 1;
  credential: AtlassianCredential;
  config: TConfig;
}

interface SaveConnection<TConfig> {
  externalAccountId: string;
  displayName: string;
  namespace?: string | null;
  baseUrl: string;
  credential: AtlassianCredential;
  config: TConfig;
  connectedBy?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AtlassianConnectionStore {
  async getBitbucket(connectionId?: string): Promise<StoredAtlassianConnection<BitbucketConnectionConfig> | null> {
    const row = await prisma.scmConnection.findFirst({
      where: {
        provider: 'bitbucket',
        status: 'connected',
        ...(connectionId ? { id: connectionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? this.decode<BitbucketConnectionConfig>(row) : null;
  }

  async getJira(connectionId?: string): Promise<StoredAtlassianConnection<JiraConnectionConfig> | null> {
    const row = await prisma.workItemConnection.findFirst({
      where: {
        provider: 'jira',
        status: 'connected',
        ...(connectionId ? { id: connectionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? this.decode<JiraConnectionConfig>(row) : null;
  }

  async saveBitbucket(input: SaveConnection<BitbucketConnectionConfig>) {
    const encryptedCredentials = this.encode(input.credential, input.config);
    return prisma.scmConnection.upsert({
      where: {
        provider_externalAccountId: {
          provider: 'bitbucket',
          externalAccountId: input.externalAccountId,
        },
      },
      create: {
        provider: 'bitbucket',
        externalAccountId: input.externalAccountId,
        displayName: input.displayName,
        namespace: input.namespace,
        baseUrl: input.baseUrl,
        encryptedCredentials,
        status: 'connected',
        capabilities: this.scmCapabilities(),
        connectedBy: input.connectedBy,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        lastVerifiedAt: new Date(),
      },
      update: {
        displayName: input.displayName,
        namespace: input.namespace,
        baseUrl: input.baseUrl,
        encryptedCredentials,
        status: 'connected',
        capabilities: this.scmCapabilities(),
        connectedBy: input.connectedBy,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        lastVerifiedAt: new Date(),
      },
    });
  }

  async saveJira(input: SaveConnection<JiraConnectionConfig>) {
    const encryptedCredentials = this.encode(input.credential, input.config);
    return prisma.workItemConnection.upsert({
      where: {
        provider_externalAccountId: {
          provider: 'jira',
          externalAccountId: input.externalAccountId,
        },
      },
      create: {
        provider: 'jira',
        externalAccountId: input.externalAccountId,
        displayName: input.displayName,
        namespace: input.namespace,
        baseUrl: input.baseUrl,
        encryptedCredentials,
        status: 'connected',
        capabilities: this.workItemCapabilities(),
        connectedBy: input.connectedBy,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        lastVerifiedAt: new Date(),
      },
      update: {
        displayName: input.displayName,
        namespace: input.namespace,
        baseUrl: input.baseUrl,
        encryptedCredentials,
        status: 'connected',
        capabilities: this.workItemCapabilities(),
        connectedBy: input.connectedBy,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        lastVerifiedAt: new Date(),
      },
    });
  }

  async markScmVerified(id: string): Promise<void> {
    await prisma.scmConnection.update({
      where: { id },
      data: { status: 'connected', lastVerifiedAt: new Date() },
    });
  }

  async markWorkItemsVerified(id: string): Promise<void> {
    await prisma.workItemConnection.update({
      where: { id },
      data: { status: 'connected', lastVerifiedAt: new Date() },
    });
  }

  async updateBitbucketCredential(
    id: string,
    credential: AtlassianCredential,
    config: BitbucketConnectionConfig,
  ): Promise<void> {
    await prisma.scmConnection.update({
      where: { id },
      data: { encryptedCredentials: this.encode(credential, config) },
    });
  }

  async updateJiraCredential(
    id: string,
    credential: AtlassianCredential,
    config: JiraConnectionConfig,
  ): Promise<void> {
    await prisma.workItemConnection.update({
      where: { id },
      data: { encryptedCredentials: this.encode(credential, config) },
    });
  }

  async disconnectScm(id: string, provider: ScmProvider): Promise<boolean> {
    const result = await prisma.scmConnection.updateMany({
      where: { id, provider },
      data: { status: 'disconnected', encryptedCredentials: encrypt('{}') },
    });
    return result.count > 0;
  }

  async disconnectWorkItems(id: string, provider: WorkItemProvider): Promise<boolean> {
    const result = await prisma.workItemConnection.updateMany({
      where: { id, provider },
      data: { status: 'disconnected', encryptedCredentials: encrypt('{}') },
    });
    return result.count > 0;
  }

  async listPublicConnections() {
    const [scm, workItems] = await Promise.all([
      prisma.scmConnection.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.workItemConnection.findMany({ orderBy: { updatedAt: 'desc' } }),
    ]);
    return {
      scm: scm.map((row) => this.publicRow(row)),
      workItems: workItems.map((row) => this.publicRow(row)),
    };
  }

  async getJiraBindingMetadata(
    connectionId: string,
    projectKey: string,
  ): Promise<Record<string, unknown>> {
    const binding = await prisma.projectBinding.findFirst({
      where: { workItemConnectionId: connectionId, projectKey },
      orderBy: { updatedAt: 'desc' },
    });
    return (binding?.metadata ?? {}) as Record<string, unknown>;
  }

  private encode<TConfig>(credential: AtlassianCredential, config: TConfig): string {
    return encrypt(JSON.stringify({ version: 1, credential, config } satisfies StoredSecret<TConfig>));
  }

  private decode<TConfig>(row: {
    id: string;
    externalAccountId: string | null;
    displayName: string;
    namespace: string | null;
    encryptedCredentials: string;
    createdAt: Date;
    lastVerifiedAt: Date | null;
  }): StoredAtlassianConnection<TConfig> {
    let secret: StoredSecret<TConfig>;
    try {
      secret = JSON.parse(decrypt(row.encryptedCredentials)) as StoredSecret<TConfig>;
    } catch {
      throw new Error(`Connection "${row.id}" contains unreadable credentials`);
    }
    if (secret.version !== 1 || !secret.credential || !secret.config) {
      throw new Error(`Connection "${row.id}" has an unsupported credential format`);
    }
    return {
      id: row.id,
      externalAccountId: row.externalAccountId,
      displayName: row.displayName,
      namespace: row.namespace,
      credential: secret.credential,
      config: secret.config,
      connectedAt: row.createdAt.toISOString(),
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  private publicRow(row: {
    id: string;
    provider: string;
    externalAccountId: string | null;
    displayName: string;
    namespace: string | null;
    baseUrl: string | null;
    status: string;
    capabilities: Prisma.JsonValue;
    createdAt: Date;
    lastVerifiedAt: Date | null;
  }) {
    return {
      id: row.id,
      provider: row.provider,
      externalAccountId: row.externalAccountId,
      displayName: row.displayName,
      namespace: row.namespace,
      baseUrl: row.baseUrl,
      source: 'database' as 'database' | 'environment',
      status: row.status,
      capabilities: row.capabilities,
      connectedAt: row.createdAt.toISOString() as string | null,
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  private scmCapabilities(): Prisma.InputJsonValue {
    return {
      repositories: true,
      branches: true,
      checkout: true,
      pipelines: false,
      pullRequests: false,
      webhooks: true,
    };
  }

  private workItemCapabilities(): Prisma.InputJsonValue {
    return {
      read: true,
      write: true,
      create: true,
      update: true,
      comments: true,
      webhooks: true,
      attachments: true,
      attachmentUploads: true,
      history: true,
      stateTransitions: true,
      issueTypes: true,
      users: true,
      labels: false,
      subIssues: false,
    };
  }
}
