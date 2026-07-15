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

@Injectable()
export class AzureIntegrationService {
  async getStatus() {
    const row = await prisma.azureDevOpsConnection.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) {
      const envOrg = process.env.AZURE_DEVOPS_ORG;
      const envPat = process.env.AZURE_DEVOPS_PAT;
      if (envOrg && envPat) {
        return {
          connected: true,
          source: 'environment' as const,
          orgSlug: envOrg,
          project: process.env.AZURE_DEFAULT_PROJECT ?? null,
          status: 'active',
        };
      }
      return { connected: false, source: null, orgSlug: null, project: null, status: null };
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

  async getCredentials(): Promise<AzureCredentials | null> {
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
    const orgSlug = process.env.AZURE_DEVOPS_ORG;
    const pat = process.env.AZURE_DEVOPS_PAT;
    if (orgSlug && pat) {
      return {
        orgSlug,
        pat,
        project: process.env.AZURE_DEFAULT_PROJECT ?? undefined,
      };
    }
    return null;
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
              webhooks: false,
              attachments: true,
              history: true,
              stateTransitions: true,
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

  async verify() {
    const creds = await this.getCredentials();
    if (!creds) throw new NotFoundException('No Azure DevOps connection configured');
    await this.verifyPat(creds.orgSlug, creds.pat, creds.project);
    return { verified: true, orgSlug: creds.orgSlug, project: creds.project ?? null };
  }

  async disconnect() {
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
