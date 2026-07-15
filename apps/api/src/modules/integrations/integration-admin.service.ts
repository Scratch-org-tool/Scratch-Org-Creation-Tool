import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import {
  normalizeCredential,
  type AtlassianConnectInput,
  type BitbucketConnectionConfig,
  type JiraConnectionConfig,
} from '../../integrations/atlassian/atlassian.types';
import { BitbucketScmAdapter } from '../../integrations/bitbucket/bitbucket.adapter';
import { JiraWorkItemAdapter } from '../../integrations/jira/jira.adapter';
import { GitHubIntegrationService } from '../../integrations/github/github-integration.service';
import {
  AZURE_ENV_SCM_CONNECTION_ID,
  AZURE_ENV_WORK_ITEM_CONNECTION_ID,
  AzureIntegrationService,
} from './azure-integration.service';

const BITBUCKET_API = 'https://api.bitbucket.org/2.0';
const BITBUCKET_GIT = 'https://bitbucket.org';
const ATLASSIAN_GATEWAY = 'https://api.atlassian.com';
const ATLASSIAN_AUTH = 'https://auth.atlassian.com';

@Injectable()
export class IntegrationAdminService {
  constructor(
    private readonly store: AtlassianConnectionStore,
    private readonly bitbucket: BitbucketScmAdapter,
    private readonly jira: JiraWorkItemAdapter,
    private readonly azure: AzureIntegrationService,
    @Optional() private readonly github?: GitHubIntegrationService,
  ) {}

  async listConnections() {
    const [connections, azure] = await Promise.all([
      this.store.listPublicConnections(),
      this.azure.getStatus(),
    ]);
    if (azure.connected && azure.source === 'environment') {
      const base = {
        id: AZURE_ENV_SCM_CONNECTION_ID,
        externalAccountId: azure.orgSlug,
        displayName: azure.orgSlug ?? 'Azure DevOps',
        namespace: azure.orgSlug,
        baseUrl: azure.orgSlug ? `https://dev.azure.com/${azure.orgSlug}` : null,
        source: 'environment' as const,
        status: 'connected' as const,
        connectedAt: null,
        lastVerifiedAt: null,
      };
      if (!connections.scm.some((connection) => connection.provider === 'azure_devops')) {
        connections.scm.unshift({
          ...base,
          provider: 'azure_devops',
          capabilities: {
            repositories: true,
            branches: true,
            checkout: true,
            pipelines: true,
            pullRequests: false,
            webhooks: false,
          },
        });
      }
      if (!connections.workItems.some((connection) => connection.provider === 'azure_boards')) {
        connections.workItems.unshift({
          ...base,
          id: AZURE_ENV_WORK_ITEM_CONNECTION_ID,
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
        });
      }
    }
    return connections;
  }

  async connectScm(provider: string, body: unknown, connectedBy?: string) {
    if (provider === 'azure_devops') {
      return this.azure.connect(body, connectedBy);
    }
    if (provider === 'github') {
      if (!this.github) throw new BadRequestException('GitHub integration is unavailable');
      return this.github.connect(body, connectedBy);
    }
    if (provider !== 'bitbucket') {
      throw new BadRequestException(`SCM provider "${provider}" cannot be connected by this route`);
    }
    const input = this.input(body);
    let credential;
    try {
      credential = await this.resolveCredential('bitbucket', input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid credential');
    }
    const config: BitbucketConnectionConfig = {
      deployment: input.deployment ?? 'cloud',
      apiBaseUrl: this.secureUrl(input.apiBaseUrl ?? BITBUCKET_API, 'apiBaseUrl'),
      gitBaseUrl: this.secureUrl(input.gitBaseUrl ?? BITBUCKET_GIT, 'gitBaseUrl'),
      oauthBaseUrl: this.secureUrl(input.oauthBaseUrl ?? BITBUCKET_GIT, 'oauthBaseUrl'),
      workspace: input.workspace?.trim() || undefined,
      webhookSecret: input.webhookSecret?.trim() || undefined,
    };
    let verified;
    try {
      verified = await this.bitbucket.verifyConnection(credential, config);
    } catch (error) {
      throw this.badProviderRequest(error);
    }
    const record = await this.store.saveBitbucket({
      externalAccountId: verified.account.uuid,
      displayName: verified.account.display_name,
      namespace: verified.workspace?.slug ?? config.workspace ?? null,
      baseUrl: config.apiBaseUrl,
      credential,
      config,
      connectedBy,
      metadata: {
        deployment: config.deployment,
        workspaceId: verified.workspace?.uuid ?? null,
      },
    });
    return {
      connected: true,
      id: record.id,
      provider: record.provider,
      displayName: record.displayName,
      namespace: record.namespace,
      lastVerifiedAt: record.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  async connectWorkItems(provider: string, body: unknown, connectedBy?: string) {
    if (provider === 'azure_boards') {
      return this.azure.connect(body, connectedBy);
    }
    if (provider === 'github_issues') {
      if (!this.github) throw new BadRequestException('GitHub integration is unavailable');
      return this.github.connect(body, connectedBy);
    }
    if (provider !== 'jira') {
      throw new BadRequestException(
        `Work-item provider "${provider}" cannot be connected by this route`,
      );
    }
    const input = this.input(body);
    let credential;
    try {
      credential = await this.resolveCredential('jira', input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid credential');
    }
    const config: JiraConnectionConfig = {
      deployment: input.deployment ?? 'cloud',
      siteUrl: input.siteUrl
        ? this.secureUrl(input.siteUrl, 'siteUrl')
        : undefined,
      cloudId: input.cloudId?.trim() || undefined,
      apiGatewayBaseUrl: this.secureUrl(
        input.apiGatewayBaseUrl ?? ATLASSIAN_GATEWAY,
        'apiGatewayBaseUrl',
      ),
      authBaseUrl: this.secureUrl(input.authBaseUrl ?? ATLASSIAN_AUTH, 'authBaseUrl'),
      fieldMappings: input.fieldMappings,
      webhookSecret: input.webhookSecret?.trim() || undefined,
    };
    let verified;
    try {
      verified = await this.jira.verifyConnection(credential, config);
    } catch (error) {
      throw this.badProviderRequest(error);
    }
    config.cloudId = verified.site.id;
    config.siteUrl = verified.site.url;
    const record = await this.store.saveJira({
      externalAccountId: verified.site.id,
      displayName: verified.site.name,
      namespace: verified.site.url,
      baseUrl: verified.site.url,
      credential,
      config,
      connectedBy,
      metadata: {
        deployment: config.deployment,
        accountId: verified.user.accountId ?? null,
      },
    });
    return {
      connected: true,
      id: record.id,
      provider: record.provider,
      displayName: record.displayName,
      namespace: record.namespace,
      lastVerifiedAt: record.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  async verifyScm(provider: string, connectionId: string) {
    if (provider === 'azure_devops') return this.azure.verify(connectionId);
    if (provider === 'github') {
      if (!this.github) throw new BadRequestException('GitHub integration is unavailable');
      return this.github.verify(connectionId);
    }
    if (provider !== 'bitbucket') throw new BadRequestException('Unsupported SCM provider');
    const connection = await this.store.getBitbucket(connectionId);
    if (!connection) throw new NotFoundException('Bitbucket connection not found');
    const verified = await this.bitbucket.verifyConnection(connection.credential, connection.config);
    await this.store.markScmVerified(connection.id);
    return {
      verified: true,
      id: connection.id,
      provider,
      displayName: verified.account.display_name,
      workspace: verified.workspace?.slug ?? null,
    };
  }

  async verifyWorkItems(provider: string, connectionId: string) {
    if (provider === 'azure_boards') return this.azure.verify(connectionId);
    if (provider === 'github_issues') {
      if (!this.github) throw new BadRequestException('GitHub integration is unavailable');
      return this.github.verifyWorkItem(connectionId);
    }
    if (provider !== 'jira') throw new BadRequestException('Unsupported work-item provider');
    const connection = await this.store.getJira(connectionId);
    if (!connection) throw new NotFoundException('Jira connection not found');
    const verified = await this.jira.verifyConnection(connection.credential, connection.config);
    await this.store.markWorkItemsVerified(connection.id);
    return {
      verified: true,
      id: connection.id,
      provider,
      displayName: verified.site.name,
      accountId: verified.user.accountId ?? null,
    };
  }

  async disconnectScm(provider: string, connectionId: string) {
    if (provider === 'azure_devops') return this.azure.disconnect(connectionId);
    if (provider === 'github') {
      if (!this.github) throw new BadRequestException('GitHub integration is unavailable');
      return this.github.disconnect(connectionId);
    }
    const disconnected = await this.store.disconnectScm(connectionId, this.scmProvider(provider));
    if (!disconnected) throw new NotFoundException('SCM connection not found');
    return { disconnected: true, id: connectionId, provider };
  }

  async disconnectWorkItems(provider: string, connectionId: string) {
    if (provider === 'azure_boards') return this.azure.disconnect(connectionId);
    if (provider === 'github_issues') {
      if (!this.github) throw new BadRequestException('GitHub integration is unavailable');
      return this.github.disconnectWorkItem(connectionId);
    }
    const disconnected = await this.store.disconnectWorkItems(
      connectionId,
      this.workItemProvider(provider),
    );
    if (!disconnected) throw new NotFoundException('Work-item connection not found');
    return { disconnected: true, id: connectionId, provider };
  }

  listBindings(connectionId?: string) {
    return prisma.projectBinding.findMany({
      where: connectionId
        ? {
            OR: [
              { scmConnectionId: connectionId },
              { workItemConnectionId: connectionId },
            ],
          }
        : {},
      include: {
        scmConnection: {
          select: { id: true, provider: true, displayName: true, status: true },
        },
        workItemConnection: {
          select: { id: true, provider: true, displayName: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveBinding(body: unknown, createdBy: string) {
    const input = this.record(body);
    const scmConnectionId = this.optionalString(input.scmConnectionId);
    const workItemConnectionId = this.optionalString(input.workItemConnectionId);
    const externalProjectId = this.requiredString(input.externalProjectId, 'externalProjectId');
    const projectKey = this.optionalString(input.projectKey);
    const repositoryId = this.optionalString(input.repositoryId);
    const repositoryName = this.optionalString(input.repositoryName);
    if (!scmConnectionId && !workItemConnectionId) {
      throw new BadRequestException('scmConnectionId or workItemConnectionId is required');
    }
    const [scm, workItems] = await Promise.all([
      scmConnectionId
        ? prisma.scmConnection.findUnique({ where: { id: scmConnectionId } })
        : null,
      workItemConnectionId
        ? prisma.workItemConnection.findUnique({ where: { id: workItemConnectionId } })
        : null,
    ]);
    if (scmConnectionId && !scm) {
      throw new BadRequestException('Binding SCM connection was not found');
    }
    if (workItemConnectionId && !workItems) {
      throw new BadRequestException('Binding work-item connection was not found');
    }
    const compatibleScm = {
      azure_boards: 'azure_devops',
      github_issues: 'github',
      jira: 'bitbucket',
    } as const;
    if (scm && workItems && scm.provider !== compatibleScm[workItems.provider]) {
      throw new BadRequestException(
        `${workItems.provider} bindings require ${compatibleScm[workItems.provider]} SCM`,
      );
    }
    if (scm && scm.status !== 'connected') {
      throw new BadRequestException('Binding SCM connection is not active');
    }
    if (workItems && workItems.status !== 'connected') {
      throw new BadRequestException('Binding work-item connection is not active');
    }
    const metadata = {
      workspace: this.optionalString(input.workspace) ?? scm?.namespace ?? null,
      jiraSiteId: this.optionalString(input.jiraSiteId) ?? workItems?.externalAccountId ?? null,
      fieldMappings: this.jsonObject(input.fieldMappings),
      fieldMapping: this.jsonObject(input.fieldMapping),
      workflowMappings: this.jsonObject(input.workflowMappings),
      ...this.jsonObject(input.metadata),
    };
    const existing = await prisma.projectBinding.findFirst({
      where: {
        scmConnectionId: scmConnectionId ?? null,
        workItemConnectionId: workItemConnectionId ?? null,
        externalProjectId,
        repositoryId,
      },
    });
    if (existing) {
      return prisma.projectBinding.update({
        where: { id: existing.id },
        data: {
          projectKey,
          repositoryName,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    }
    return prisma.projectBinding.create({
      data: {
        scmConnectionId: scmConnectionId ?? null,
        workItemConnectionId: workItemConnectionId ?? null,
        externalProjectId,
        projectKey,
        repositoryId,
        repositoryName,
        createdBy,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async deleteBinding(id: string) {
    const deleted = await prisma.projectBinding.deleteMany({ where: { id } });
    if (!deleted.count) throw new NotFoundException('Project binding not found');
    return { deleted: true, id };
  }

  listIdentityBindings(connectionId?: string) {
    return prisma.externalIdentityBinding.findMany({
      where: connectionId ? { workItemConnectionId: connectionId } : {},
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveIdentityBinding(body: unknown) {
    const input = this.record(body);
    const workItemConnectionId = this.requiredString(
      input.workItemConnectionId,
      'workItemConnectionId',
    );
    const externalUserId = this.requiredString(input.externalUserId, 'externalUserId');
    const connection = await prisma.workItemConnection.findUnique({
      where: { id: workItemConnectionId },
    });
    if (!connection || !['jira', 'github_issues'].includes(connection.provider)) {
      throw new BadRequestException('Identity mapping connection must be Jira or GitHub Issues');
    }
    const displayName = this.optionalString(input.displayName);
    const externalLogin =
      this.optionalString(input.externalLogin) ??
      (connection.provider === 'github_issues' ? displayName : null);
    if (connection.provider === 'github_issues' && !externalLogin) {
      throw new BadRequestException('externalLogin is required for GitHub identity mappings');
    }
    return prisma.externalIdentityBinding.upsert({
      where: {
        workItemConnectionId_externalUserId: { workItemConnectionId, externalUserId },
      },
      create: {
        workItemConnectionId,
        externalUserId,
        appUserId: this.optionalString(input.appUserId),
        externalLogin,
        externalEmail: this.optionalString(input.externalEmail),
        displayName,
      },
      update: {
        appUserId: this.optionalString(input.appUserId),
        externalLogin,
        externalEmail: this.optionalString(input.externalEmail),
        displayName,
      },
    });
  }

  async deleteIdentityBinding(id: string) {
    const deleted = await prisma.externalIdentityBinding.deleteMany({ where: { id } });
    if (!deleted.count) throw new NotFoundException('Identity mapping not found');
    return { deleted: true, id };
  }

  private input(body: unknown): AtlassianConnectInput {
    const record = this.record(body);
    return record as unknown as AtlassianConnectInput;
  }

  private async resolveCredential(
    provider: 'bitbucket' | 'jira',
    input: AtlassianConnectInput,
  ) {
    if (input.authType !== 'oauth2' || !input.authorizationCode) {
      return normalizeCredential(input);
    }
    if (!input.clientId?.trim() || !input.clientSecret?.trim()) {
      throw new Error('OAuth clientId and clientSecret are required for authorization-code exchange');
    }
    const tokenUrl =
      provider === 'jira'
        ? `${(input.authBaseUrl ?? ATLASSIAN_AUTH).replace(/\/+$/, '')}/oauth/token`
        : 'https://bitbucket.org/site/oauth2/access_token';
    const headers: Record<string, string> = {};
    let body: string;
    if (provider === 'jira') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        grant_type: 'authorization_code',
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.authorizationCode,
        redirect_uri: input.redirectUri,
      });
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers.Authorization = `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64')}`;
      body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.authorizationCode,
        ...(input.redirectUri ? { redirect_uri: input.redirectUri } : {}),
      }).toString();
    }
    const response = await fetch(tokenUrl, { method: 'POST', headers, body });
    if (!response.ok) {
      throw new Error(`${provider} OAuth authorization-code exchange failed (${response.status})`);
    }
    const token = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) throw new Error(`${provider} OAuth response did not contain an access token`);
    return normalizeCredential({
      ...input,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt:
        typeof token.expires_in === 'number'
          ? new Date(Date.now() + token.expires_in * 1_000).toISOString()
          : input.expiresAt,
    });
  }

  private record(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Request body must be an object');
    }
    return body as Record<string, unknown>;
  }

  private secureUrl(value: string, name: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(`${name} must be a valid URL`);
    }
    if (url.protocol !== 'https:') throw new BadRequestException(`${name} must use HTTPS`);
    if (url.username || url.password) {
      throw new BadRequestException(`${name} must not contain credentials`);
    }
    return url.toString().replace(/\/+$/, '');
  }

  private badProviderRequest(error: unknown): BadRequestException {
    return new BadRequestException(
      error instanceof Error ? error.message : 'Provider verification failed',
    );
  }

  private scmProvider(provider: string): 'azure_devops' | 'github' | 'bitbucket' {
    if (!['azure_devops', 'github', 'bitbucket'].includes(provider)) {
      throw new BadRequestException('Unsupported SCM provider');
    }
    return provider as 'azure_devops' | 'github' | 'bitbucket';
  }

  private workItemProvider(provider: string): 'azure_boards' | 'github_issues' | 'jira' {
    if (!['azure_boards', 'github_issues', 'jira'].includes(provider)) {
      throw new BadRequestException('Unsupported work-item provider');
    }
    return provider as 'azure_boards' | 'github_issues' | 'jira';
  }

  private requiredString(value: unknown, name: string): string {
    const result = this.optionalString(value);
    if (!result) throw new BadRequestException(`${name} is required`);
    return result;
  }

  private optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private jsonObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}
