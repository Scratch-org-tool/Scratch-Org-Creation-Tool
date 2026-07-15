import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  azureConnectSchema,
  azureProjectUrl,
  azureProjectsUrl,
} from '@sfcc/shared';
import { ZodError } from 'zod';
import { encrypt, decrypt } from '../../common/crypto.util';

export interface AzureCredentials {
  orgSlug: string;
  pat: string;
  project?: string;
}

export const AZURE_ENV_SCM_CONNECTION_ID = 'environment-azure-devops';
export const AZURE_ENV_WORK_ITEM_CONNECTION_ID = 'environment-azure-boards';

@Injectable()
export class AzureIntegrationService {
  async getStatus(connectionId?: string) {
    if (connectionId && !this.isEnvironmentConnection(connectionId)) {
      const neutral = await this.findNeutralConnection(connectionId);
      if (!neutral) {
        return { connected: false, source: null, orgSlug: null, project: null, status: null };
      }
      const metadata = this.metadata(neutral.metadata);
      return {
        connected: neutral.status === 'connected' || neutral.status === 'degraded',
        source: 'database' as const,
        connectionId: neutral.id,
        orgSlug: neutral.namespace ?? neutral.externalAccountId ?? neutral.displayName,
        project: this.optionalMetadataString(metadata.defaultProject),
        status: neutral.status,
        connectedAt: neutral.createdAt.toISOString(),
      };
    }
    if (connectionId) return this.environmentStatus();

    const row = await prisma.azureDevOpsConnection.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) {
      return this.environmentStatus();
    }
    return {
      connected: true,
      source: 'database' as const,
      orgSlug: row.orgSlug,
      project: row.project,
      status: row.status,
      connectedAt: row.createdAt.toISOString(),
    };
  }

  async getCredentials(connectionId?: string): Promise<AzureCredentials | null> {
    if (connectionId && !this.isEnvironmentConnection(connectionId)) {
      const neutral = await this.findNeutralConnection(connectionId);
      if (!neutral || !['connected', 'degraded'].includes(neutral.status)) return null;
      const metadata = this.metadata(neutral.metadata);
      return {
        orgSlug: neutral.namespace ?? neutral.externalAccountId ?? neutral.displayName,
        pat: decrypt(neutral.encryptedCredentials),
        project: this.optionalMetadataString(metadata.defaultProject) ?? undefined,
      };
    }
    if (connectionId) return this.environmentCredentials();

    const row = await prisma.azureDevOpsConnection.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (row) {
      return {
        orgSlug: row.orgSlug,
        pat: decrypt(row.pat),
        project: row.project ?? undefined,
      };
    }
    return this.environmentCredentials();
  }

  async connect(body: unknown, connectedBy?: string) {
    const parsed = azureConnectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatZodError(parsed.error));
    }
    const input = parsed.data;
    await this.verifyPat(input.orgSlug, input.pat, input.project);
    const encryptedPat = encrypt(input.pat);

    const record = await prisma.$transaction(async (tx) => {
      const legacy = await tx.azureDevOpsConnection.upsert({
        where: { orgSlug: input.orgSlug },
        create: {
          orgSlug: input.orgSlug,
          project: input.project ?? null,
          pat: encryptedPat,
          status: 'active',
          connectedBy: connectedBy ?? null,
        },
        update: {
          project: input.project ?? null,
          pat: encryptedPat,
          status: 'active',
          connectedBy: connectedBy ?? null,
        },
      });
      const common = {
        externalAccountId: input.orgSlug,
        displayName: input.orgSlug,
        namespace: input.orgSlug,
        baseUrl: `https://dev.azure.com/${input.orgSlug}`,
        encryptedCredentials: encryptedPat,
        status: 'connected' as const,
        connectedBy: connectedBy ?? null,
        metadata: {
          defaultProject: input.project ?? null,
          credentialFormat: 'legacy_encrypted_pat',
        },
      };
      await Promise.all([
        tx.scmConnection.upsert({
          where: { legacyAzureDevOpsConnectionId: legacy.id },
          create: {
            ...common,
            provider: 'azure_devops',
            capabilities: {
              repositories: true,
              branches: true,
              checkout: true,
              pipelines: true,
              pullRequests: false,
              webhooks: false,
            },
            legacyAzureDevOpsConnectionId: legacy.id,
          },
          update: common,
        }),
        tx.workItemConnection.upsert({
          where: { legacyAzureDevOpsConnectionId: legacy.id },
          create: {
            ...common,
            provider: 'azure_boards',
            capabilities: {
              read: true,
              write: true,
              create: true,
              update: true,
              comments: true,
              webhooks: false,
              attachments: true,
              attachmentUploads: true,
              history: true,
              stateTransitions: true,
              issueTypes: true,
              users: false,
              labels: false,
              subIssues: false,
            },
            legacyAzureDevOpsConnectionId: legacy.id,
          },
          update: common,
        }),
      ]);
      return legacy;
    });

    return {
      connected: true,
      orgSlug: record.orgSlug,
      project: record.project,
      status: record.status,
    };
  }

  async verify(connectionId?: string) {
    const creds = await this.getCredentials(connectionId);
    if (!creds) throw new NotFoundException('No Azure DevOps connection configured');
    await this.verifyPat(creds.orgSlug, creds.pat, creds.project);
    if (connectionId && !this.isEnvironmentConnection(connectionId)) {
      const neutral = await this.findNeutralConnection(connectionId);
      if (!neutral) throw new NotFoundException('Azure DevOps connection not found');
      const verifiedAt = new Date();
      const pair = neutral.legacyAzureDevOpsConnectionId
        ? { legacyAzureDevOpsConnectionId: neutral.legacyAzureDevOpsConnectionId }
        : { id: neutral.id };
      await prisma.$transaction([
        prisma.scmConnection.updateMany({
          where: { provider: 'azure_devops', ...pair },
          data: { status: 'connected', lastVerifiedAt: verifiedAt },
        }),
        prisma.workItemConnection.updateMany({
          where: { provider: 'azure_boards', ...pair },
          data: { status: 'connected', lastVerifiedAt: verifiedAt },
        }),
      ]);
    }
    return {
      verified: true,
      connectionId: connectionId ?? null,
      orgSlug: creds.orgSlug,
      project: creds.project ?? null,
    };
  }

  async disconnect(connectionId?: string) {
    if (connectionId) {
      if (this.isEnvironmentConnection(connectionId)) {
        throw new BadRequestException(
          'Environment-backed Azure DevOps connections must be removed from server configuration',
        );
      }
      const neutral = await this.findNeutralConnection(connectionId);
      if (!neutral) throw new NotFoundException('Azure DevOps connection not found');
      const deleted = await prisma.$transaction(async (tx) => {
        if (neutral.legacyAzureDevOpsConnectionId) {
          const pair = { legacyAzureDevOpsConnectionId: neutral.legacyAzureDevOpsConnectionId };
          const [scm, workItems, legacy] = await Promise.all([
            tx.scmConnection.deleteMany({ where: { provider: 'azure_devops', ...pair } }),
            tx.workItemConnection.deleteMany({ where: { provider: 'azure_boards', ...pair } }),
            tx.azureDevOpsConnection.deleteMany({
              where: { id: neutral.legacyAzureDevOpsConnectionId },
            }),
          ]);
          return scm.count + workItems.count + legacy.count;
        }
        if (neutral.kind === 'scm') {
          return (await tx.scmConnection.deleteMany({
            where: { id: neutral.id, provider: 'azure_devops' },
          })).count;
        }
        return (await tx.workItemConnection.deleteMany({
          where: { id: neutral.id, provider: 'azure_boards' },
        })).count;
      });
      return { disconnected: true, connectionId, count: deleted };
    }
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.scmConnection.deleteMany({
        where: { legacyAzureDevOpsConnectionId: { not: null } },
      });
      await tx.workItemConnection.deleteMany({
        where: { legacyAzureDevOpsConnectionId: { not: null } },
      });
      return tx.azureDevOpsConnection.deleteMany({});
    });
    return { disconnected: true, count: deleted.count };
  }

  private async findNeutralConnection(connectionId: string) {
    const [scm, workItems] = await Promise.all([
      prisma.scmConnection.findFirst({
        where: { id: connectionId, provider: 'azure_devops' },
      }),
      prisma.workItemConnection.findFirst({
        where: { id: connectionId, provider: 'azure_boards' },
      }),
    ]);
    return scm
      ? { ...scm, kind: 'scm' as const }
      : workItems
        ? { ...workItems, kind: 'workItems' as const }
        : null;
  }

  private isEnvironmentConnection(connectionId: string): boolean {
    return connectionId === AZURE_ENV_SCM_CONNECTION_ID ||
      connectionId === AZURE_ENV_WORK_ITEM_CONNECTION_ID;
  }

  private environmentCredentials(): AzureCredentials | null {
    const orgSlug = process.env.AZURE_DEVOPS_ORG;
    const pat = process.env.AZURE_DEVOPS_PAT;
    return orgSlug && pat
      ? {
          orgSlug,
          pat,
          project: process.env.AZURE_DEFAULT_PROJECT ?? undefined,
        }
      : null;
  }

  private environmentStatus() {
    const credentials = this.environmentCredentials();
    return credentials
      ? {
          connected: true,
          source: 'environment' as const,
          orgSlug: credentials.orgSlug,
          project: credentials.project ?? null,
          status: 'active',
        }
      : { connected: false, source: null, orgSlug: null, project: null, status: null };
  }

  private metadata(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private optionalMetadataString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async verifyPat(orgSlug: string, pat: string, project?: string) {
    const headers = {
      Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
    };

    const orgUrl = azureProjectsUrl(orgSlug);
    const orgRes = await fetch(orgUrl, { headers });
    if (!orgRes.ok) {
      const text = await orgRes.text().catch(() => '');
      throw new BadRequestException(
        formatAzureAuthError(orgRes.status, orgSlug, project, text),
      );
    }

    if (project) {
      const projectUrl = azureProjectUrl(orgSlug, project);
      const projectRes = await fetch(projectUrl, { headers });
      if (!projectRes.ok) {
        const text = await projectRes.text().catch(() => '');
        throw new BadRequestException(
          `Azure DevOps project "${project}" was not found or your PAT cannot access it (${projectRes.status}). Check the project name and PAT scopes (Project & Team: Read).${text ? ` ${text.slice(0, 120)}` : ''}`,
        );
      }
    }
  }
}

function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join('; ');
}

function formatAzureAuthError(
  status: number,
  orgSlug: string,
  project: string | undefined,
  body: string,
): string {
  const hint =
    status === 401 || status === 203
      ? 'Check that the PAT is valid and has not expired.'
      : status === 404
        ? `Organization "${orgSlug}" was not found. Use only the slug (e.g. my-org), not the full URL.`
        : 'Check org slug, PAT scopes (Project & Team: Read, Code: Read), and network access.';
  const projectHint = project ? ` Project: "${project}".` : '';
  return `Azure DevOps authentication failed (${status}) for org "${orgSlug}".${projectHint} ${hint}${body ? ` ${body.slice(0, 120)}` : ''}`;
}
