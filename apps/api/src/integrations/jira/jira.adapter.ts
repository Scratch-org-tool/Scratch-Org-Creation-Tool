import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  WorkItemAttachment,
  WorkItemComment,
  WorkItemConnectionStatus,
  WorkItemDetail,
  WorkItemHistoryEvent,
  WorkItemProject,
  WorkItemState,
  WorkItemSummary,
  WorkItemUser,
} from '@sfcc/shared';
import type {
  AdapterContext,
  AttachmentContent,
  WorkItemAdapter,
  WorkItemCreateInput,
  WorkItemOverview,
  WorkItemQuery,
  WorkItemUpdateInput,
  WorkItemUpload,
} from '../foundation/adapter.contracts';
import { IntegrationError } from '../foundation/adapter.errors';
import { AtlassianConnectionStore } from '../atlassian/atlassian-connection.store';
import {
  ATLASSIAN_FETCH,
  AtlassianHttpClient,
  type FetchLike,
} from '../atlassian/atlassian-http.client';
import {
  assertCloud,
  type AtlassianCredential,
  type JiraConnectionConfig,
  type JiraFieldMappings,
  type StoredAtlassianConnection,
} from '../atlassian/atlassian.types';

const JIRA_CAPABILITIES = {
  read: true,
  write: true,
  webhooks: true,
  attachments: true,
  history: true,
  stateTransitions: true,
} as const;

export interface JiraSite {
  id: string;
  name: string;
  url: string;
  scopes?: string[];
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  self?: string;
}

interface JiraUser {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
}

interface JiraStatus {
  id?: string;
  name?: string;
  statusCategory?: { key?: string; colorName?: string };
}

interface JiraIssue {
  id: string;
  key: string;
  self?: string;
  fields: Record<string, unknown> & {
    summary?: string;
    description?: unknown;
    issuetype?: { id?: string; name?: string; subtask?: boolean };
    status?: JiraStatus;
    priority?: { id?: string; name?: string } | null;
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
    creator?: JiraUser | null;
    labels?: string[];
    created?: string;
    updated?: string;
    components?: Array<{ id?: string; name?: string }>;
    attachment?: JiraAttachment[];
    issuelinks?: Array<{
      type?: { name?: string; inward?: string; outward?: string };
      inwardIssue?: { key?: string; fields?: { summary?: string } };
      outwardIssue?: { key?: string; fields?: { summary?: string } };
    }>;
  };
  changelog?: { histories?: JiraHistory[] };
}

interface JiraAttachment {
  id: string;
  filename: string;
  size?: number;
  mimeType?: string;
  created?: string;
  author?: JiraUser;
  content?: string;
}

interface JiraHistory {
  id: string;
  created?: string;
  author?: JiraUser;
  items?: Array<{
    field?: string;
    fieldId?: string;
    fromString?: string | null;
    toString?: string | null;
  }>;
}

@Injectable()
export class JiraWorkItemAdapter implements WorkItemAdapter {
  readonly provider = 'jira' as const;
  readonly capabilities = JIRA_CAPABILITIES;

  constructor(
    private readonly store: AtlassianConnectionStore,
    @Optional() @Inject(ATLASSIAN_FETCH) fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private readonly fetchImpl: FetchLike;

  async listSites(
    credential: AtlassianCredential,
    config: JiraConnectionConfig,
  ): Promise<JiraSite[]> {
    assertCloud(config.deployment);
    if (credential.authType === 'api_token') {
      if (!config.siteUrl) {
        throw new IntegrationError('invalid_request', 'Jira siteUrl is required for API-token auth', {
          provider: this.provider,
        });
      }
      const myself = await this.client(credential, config).json<JiraUser>('myself');
      return [{
        id: config.cloudId ?? new URL(config.siteUrl).hostname,
        name: myself.displayName ?? new URL(config.siteUrl).hostname,
        url: config.siteUrl,
      }];
    }
    const auth = new AtlassianHttpClient({
      provider: this.provider,
      baseUrl: config.apiGatewayBaseUrl,
      credential,
      fetch: this.fetchImpl,
    });
    return auth.json<JiraSite[]>('oauth/token/accessible-resources');
  }

  async verifyConnection(
    credential: AtlassianCredential,
    config: JiraConnectionConfig,
  ): Promise<{ site: JiraSite; user: JiraUser }> {
    const sites = await this.listSites(credential, config);
    const site =
      sites.find((candidate) => candidate.id === config.cloudId) ??
      sites.find((candidate) => candidate.url.replace(/\/+$/, '') === config.siteUrl?.replace(/\/+$/, '')) ??
      sites[0];
    if (!site) {
      throw new IntegrationError(
        'authorization_failed',
        'The Jira credential cannot access any Jira Cloud sites',
        { provider: this.provider },
      );
    }
    const resolved = {
      ...config,
      cloudId: site.id,
      siteUrl: config.siteUrl ?? site.url,
    };
    const user = await this.client(credential, resolved).json<JiraUser>('myself');
    return { site, user };
  }

  async getConnectionStatus(
    context: AdapterContext = {},
  ): Promise<WorkItemConnectionStatus> {
    const stored = await this.store.getJira(context.connectionId);
    const connection = stored ? await this.refreshConnection(stored) : null;
    if (!connection) {
      return {
        provider: this.provider,
        state: 'disconnected',
        connected: false,
        source: null,
        displayName: null,
        namespace: null,
        error: null,
        capabilities: this.capabilities,
      };
    }
    try {
      await this.verifyConnection(connection.credential, connection.config);
      return this.status(connection, 'connected', null);
    } catch (error) {
      return this.status(
        connection,
        'degraded',
        error instanceof Error ? error.message : 'Verification failed',
      );
    }
  }

  async listProjects(context: AdapterContext = {}): Promise<WorkItemProject[]> {
    const connection = await this.requireConnection(context.connectionId);
    const client = this.connectionClient(connection);
    const projects: JiraProject[] = [];
    let startAt = 0;
    for (;;) {
      const page = await client.json<{
        values?: JiraProject[];
        total?: number;
        isLast?: boolean;
      }>(`project/search?startAt=${startAt}&maxResults=100&orderBy=name`);
      const values = page.values ?? [];
      projects.push(...values);
      startAt += values.length;
      if (page.isLast || values.length === 0 || startAt >= (page.total ?? Number.MAX_SAFE_INTEGER)) break;
    }
    return projects.map((project) => this.project(project, connection.config));
  }

  async getProjectOverview(projectKey: string): Promise<WorkItemOverview> {
    const connection = await this.requireConnection();
    const client = this.connectionClient(connection);
    const project = await client.json<JiraProject>(`project/${encodeURIComponent(projectKey)}`);
    const items = await this.queryWorkItems({ project: projectKey });
    return {
      project: this.project(project, connection.config),
      total: items.length,
      byState: this.countBy(items, (item) => item.state.name),
      byType: this.countBy(items, (item) => item.type),
      byPriority: this.countBy(items, (item) => String(item.priority ?? 'none')),
    };
  }

  getOverview(project: string): Promise<WorkItemOverview> {
    return this.getProjectOverview(project);
  }

  async queryWorkItems(query: WorkItemQuery): Promise<WorkItemSummary[]> {
    const connection = await this.requireConnection(query.connectionId);
    const client = this.connectionClient(connection);
    const clauses: string[] = [];
    if (query.project) clauses.push(`project = ${this.jqlString(query.project)}`);
    if (query.assigneeId) clauses.push(`assignee = ${this.jqlString(query.assigneeId)}`);
    else if (query.assigneeEmail) clauses.push(`assignee = ${this.jqlString(query.assigneeEmail)}`);
    if (query.types?.length) {
      clauses.push(`issuetype in (${query.types.map((value) => this.jqlString(value)).join(', ')})`);
    }
    if (query.state) clauses.push(`status = ${this.jqlString(query.state)}`);
    if (query.text) clauses.push(`text ~ ${this.jqlString(query.text)}`);
    const generated = clauses.length ? clauses.join(' AND ') : '';
    const jql = [query.jql ? `(${query.jql})` : '', generated]
      .filter(Boolean)
      .join(' AND ') || 'ORDER BY updated DESC';
    const issues: JiraIssue[] = [];
    let nextPageToken = query.pageToken;
    do {
      const page = await client.json<{
        issues?: JiraIssue[];
        nextPageToken?: string;
        isLast?: boolean;
      }>('search/jql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jql,
          maxResults: Math.min(100, Math.max(1, query.pageSize ?? 100)),
          nextPageToken,
          fields: this.issueFields(),
        }),
      });
      issues.push(...(page.issues ?? []));
      nextPageToken = page.isLast ? undefined : page.nextPageToken;
    } while (nextPageToken);
    const mappings = await this.fieldMappings(connection.id, query.project);
    return issues.map((issue) => this.toSummary(issue, connection.config, mappings));
  }

  async getWorkItem(id: string, project?: string): Promise<WorkItemDetail> {
    return this.getWorkItemForConnection(id, project);
  }

  async getWorkItemForConnection(
    id: string,
    project?: string,
    connectionId?: string,
  ): Promise<WorkItemDetail> {
    const connection = await this.requireConnection(connectionId);
    const issue = await this.connectionClient(connection).json<JiraIssue>(
      `issue/${encodeURIComponent(id)}?fields=${encodeURIComponent(this.issueFields().join(','))}`,
    );
    const mappings = await this.fieldMappings(connection.id, project ?? this.issueProject(issue));
    return this.toDetail(issue, connection.config, mappings);
  }

  async createWorkItem(input: WorkItemCreateInput): Promise<WorkItemDetail> {
    const connection = await this.requireConnection(input.connectionId);
    const mappings = await this.fieldMappings(connection.id, input.project);
    const fields = this.mutationFields(input, mappings, true);
    const created = await this.connectionClient(connection).json<{ id: string; key: string }>('issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (input.state) await this.transition(created.key, input.state, input.project, connection, mappings);
    return this.getWorkItem(created.key, input.project);
  }

  async updateWorkItem(
    id: string,
    input: WorkItemUpdateInput,
  ): Promise<WorkItemDetail> {
    const connection = await this.requireConnection(input.connectionId);
    const project = input.project ?? id.split('-')[0];
    const mappings = await this.fieldMappings(connection.id, project);
    const fields = this.mutationFields(input, mappings, false);
    if (Object.keys(fields).length) {
      await this.connectionClient(connection).request(`issue/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
    }
    if (input.state) await this.transition(id, input.state, project, connection, mappings);
    return this.getWorkItem(id, project);
  }

  async listIssueTypes(project: string): Promise<string[]> {
    const connection = await this.requireConnection();
    const result = await this.connectionClient(connection).json<Array<{
      id?: string;
      name?: string;
    }>>(`issuetype/project?projectId=${encodeURIComponent(await this.projectId(project, connection))}`);
    return result.map((type) => type.name ?? type.id ?? '').filter(Boolean);
  }

  async getComments(id: string): Promise<WorkItemComment[]> {
    const connection = await this.requireConnection();
    const comments: WorkItemComment[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.connectionClient(connection).json<{
        comments?: Array<{
          id: string;
          body?: unknown;
          author?: JiraUser;
          created?: string;
          updated?: string;
        }>;
        total?: number;
      }>(`issue/${encodeURIComponent(id)}/comment?startAt=${startAt}&maxResults=100`);
      const values = page.comments ?? [];
      comments.push(...values.map((comment) => ({
        id: comment.id,
        body: this.adfText(comment.body),
        author: this.user(comment.author),
        createdAt: comment.created ?? new Date(0).toISOString(),
        updatedAt: comment.updated ?? comment.created ?? new Date(0).toISOString(),
      })));
      startAt += values.length;
      if (!values.length || startAt >= (page.total ?? 0)) break;
    }
    return comments;
  }

  async addComment(id: string, body: string): Promise<WorkItemComment> {
    const connection = await this.requireConnection();
    const comment = await this.connectionClient(connection).json<{
      id: string;
      body?: unknown;
      author?: JiraUser;
      created?: string;
      updated?: string;
    }>(`issue/${encodeURIComponent(id)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: this.toAdf(body) }),
    });
    return {
      id: comment.id,
      body: this.adfText(comment.body),
      author: this.user(comment.author),
      createdAt: comment.created ?? new Date().toISOString(),
      updatedAt: comment.updated ?? comment.created ?? new Date().toISOString(),
    };
  }

  async getStateOptions(id: string, project?: string): Promise<WorkItemState[]> {
    const connection = await this.requireConnection();
    const mappings = await this.fieldMappings(connection.id, project ?? id.split('-')[0]);
    const result = await this.connectionClient(connection).json<{
      transitions?: Array<{ id: string; name: string; to?: JiraStatus }>;
    }>(`issue/${encodeURIComponent(id)}/transitions?expand=transitions.fields`);
    return (result.transitions ?? []).map((transition) => ({
      ...this.state(transition.to ?? { id: transition.id, name: transition.name }),
      id: transition.id,
      name: this.reverseWorkflowName(transition.name, mappings),
    }));
  }

  async updateState(id: string, state: string, project?: string): Promise<WorkItemDetail> {
    const connection = await this.requireConnection();
    const mappings = await this.fieldMappings(connection.id, project ?? id.split('-')[0]);
    await this.transition(id, state, project, connection, mappings);
    return this.getWorkItem(id, project);
  }

  async getHistory(id: string): Promise<WorkItemHistoryEvent[]> {
    const connection = await this.requireConnection();
    const histories: JiraHistory[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.connectionClient(connection).json<{
        values?: JiraHistory[];
        total?: number;
      }>(`issue/${encodeURIComponent(id)}/changelog?startAt=${startAt}&maxResults=100`);
      const values = page.values ?? [];
      histories.push(...values);
      startAt += values.length;
      if (!values.length || startAt >= (page.total ?? 0)) break;
    }
    return histories.map((history, index) => {
      const changes = (history.items ?? []).map((item) => ({
        field: item.field ?? item.fieldId ?? 'Unknown',
        fieldRef: item.fieldId ?? null,
        oldValue: item.fromString ?? null,
        newValue: item.toString ?? null,
      }));
      return {
        id: history.id,
        kind: 'updated' as const,
        version: index + 1,
        actor: this.user(history.author),
        occurredAt: history.created ?? new Date(0).toISOString(),
        summary: changes.map((change) => change.field).join(', ') || 'Issue updated',
        changes,
      };
    });
  }

  async listAttachments(id: string): Promise<WorkItemAttachment[]> {
    const connection = await this.requireConnection();
    const issue = await this.connectionClient(connection).json<JiraIssue>(
      `issue/${encodeURIComponent(id)}?fields=attachment`,
    );
    return (issue.fields.attachment ?? []).map((attachment) => this.attachment(attachment));
  }

  async getAttachmentContent(
    id: string,
    attachmentId: string,
  ): Promise<AttachmentContent> {
    const connection = await this.requireConnection();
    const attachments = await this.listAttachments(id);
    const attachment = attachments.find((candidate) => candidate.id === attachmentId);
    if (!attachment) {
      throw new IntegrationError('not_found', `Attachment "${attachmentId}" does not belong to "${id}"`, {
        provider: this.provider,
      });
    }
    const response = await this.connectionClient(connection).buffer(
      `attachment/content/${encodeURIComponent(attachmentId)}?redirect=false`,
      { headers: { Accept: '*/*' } },
    );
    return {
      buffer: response.buffer,
      contentType: response.contentType,
      fileName: attachment.name,
    };
  }

  async uploadAttachment(
    id: string,
    upload: WorkItemUpload,
  ): Promise<WorkItemAttachment> {
    const connection = await this.requireConnection();
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(upload.buffer)], { type: upload.contentType }),
      upload.fileName,
    );
    const attachments = await this.connectionClient(connection).json<JiraAttachment[]>(
      `issue/${encodeURIComponent(id)}/attachments`,
      {
        method: 'POST',
        headers: { 'X-Atlassian-Token': 'no-check' },
        body: form,
      },
    );
    const attachment = attachments[0];
    if (!attachment) {
      throw new IntegrationError('provider_unavailable', 'Jira returned no uploaded attachment', {
        provider: this.provider,
      });
    }
    return this.attachment(attachment);
  }

  async listAssignees(project: string): Promise<WorkItemUser[]> {
    return this.listUsers(project);
  }

  async listUsers(project?: string, query = ''): Promise<WorkItemUser[]> {
    const connection = await this.requireConnection();
    if (!project) {
      throw new IntegrationError('invalid_request', 'Jira project is required when listing users', {
        provider: this.provider,
      });
    }
    const users: JiraUser[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.connectionClient(connection).json<JiraUser[]>(
        `user/assignable/search?project=${encodeURIComponent(project)}&query=${encodeURIComponent(query)}&startAt=${startAt}&maxResults=100`,
      );
      users.push(...page);
      startAt += page.length;
      if (page.length < 100) break;
    }
    return users.map((user) => this.user(user));
  }

  private async transition(
    id: string,
    requested: string,
    project: string | undefined,
    connection: StoredAtlassianConnection<JiraConnectionConfig>,
    mappings: JiraFieldMappings,
  ): Promise<void> {
    const target = mappings.workflow?.[requested] ?? requested;
    const result = await this.connectionClient(connection).json<{
      transitions?: Array<{ id: string; name: string; to?: JiraStatus }>;
    }>(`issue/${encodeURIComponent(id)}/transitions`);
    const transition = (result.transitions ?? []).find((candidate) =>
      candidate.id === target ||
      candidate.name.toLowerCase() === target.toLowerCase() ||
      candidate.to?.name?.toLowerCase() === target.toLowerCase(),
    );
    if (!transition) {
      throw new IntegrationError(
        'invalid_request',
        `Jira transition "${requested}" is not available${project ? ` in ${project}` : ''}`,
        { provider: this.provider },
      );
    }
    await this.connectionClient(connection).request(`issue/${encodeURIComponent(id)}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: transition.id } }),
    });
  }

  private mutationFields(
    input: WorkItemCreateInput | WorkItemUpdateInput,
    mappings: JiraFieldMappings,
    create: boolean,
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (create) {
      const createInput = input as WorkItemCreateInput;
      fields.project = { key: createInput.project };
      fields.summary = createInput.title;
      fields.issuetype = { name: createInput.type ?? 'Task' };
    } else {
      if (input.title !== undefined) fields.summary = input.title;
      if (input.type !== undefined) fields.issuetype = input.type ? { name: input.type } : null;
    }
    if (input.description !== undefined) {
      fields.description = input.description === null ? null : this.toAdf(input.description);
    }
    const assigneeId =
      input.assigneeId !== undefined
        ? input.assigneeId
        : 'assigneeLogins' in input
          ? input.assigneeLogins?.[0]
          : undefined;
    if (assigneeId !== undefined) fields.assignee = assigneeId ? { accountId: assigneeId } : null;
    if (input.labels !== undefined) fields.labels = [...input.labels];
    if (input.components !== undefined) {
      fields.components = input.components.map((name) => ({ name }));
    }
    if (input.priority !== undefined) {
      const mapped = mappings.priority?.[String(input.priority)] ?? input.priority;
      fields.priority =
        mapped === null ? null : /^\d+$/.test(String(mapped)) ? { id: String(mapped) } : { name: String(mapped) };
    }
    this.setMapped(fields, mappings.severity, input.severity);
    this.setMapped(fields, mappings.area, input.area);
    this.setMapped(fields, mappings.iteration ?? mappings.sprint, input.iteration);
    for (const [key, value] of Object.entries(input.customFields ?? {})) {
      fields[mappings.custom?.[key] ?? key] = value;
    }
    return fields;
  }

  private setMapped(
    fields: Record<string, unknown>,
    fieldId: string | undefined,
    value: unknown,
  ): void {
    if (fieldId && value !== undefined) fields[fieldId] = value;
  }

  private async fieldMappings(connectionId: string, project?: string): Promise<JiraFieldMappings> {
    const connection = await this.store.getJira(connectionId);
    const base = connection?.config.fieldMappings ?? {};
    if (!project) return base;
    const metadata = await this.store.getJiraBindingMetadata(connectionId, project);
    const fieldMappings = (metadata.fieldMappings ?? {}) as JiraFieldMappings;
    const workflow = (metadata.workflowMappings ?? {}) as Record<string, string>;
    return {
      ...base,
      ...fieldMappings,
      custom: { ...base.custom, ...fieldMappings.custom },
      priority: { ...base.priority, ...fieldMappings.priority },
      workflow: { ...base.workflow, ...fieldMappings.workflow, ...workflow },
    };
  }

  private async projectId(
    project: string,
    connection: StoredAtlassianConnection<JiraConnectionConfig>,
  ): Promise<string> {
    const result = await this.connectionClient(connection).json<JiraProject>(
      `project/${encodeURIComponent(project)}`,
    );
    return result.id;
  }

  private async requireConnection(
    connectionId?: string,
  ): Promise<StoredAtlassianConnection<JiraConnectionConfig>> {
    const connection = await this.store.getJira(connectionId);
    if (!connection) {
      throw new IntegrationError('not_connected', 'No Jira connection is configured', {
        provider: this.provider,
      });
    }
    assertCloud(connection.config.deployment);
    return this.refreshConnection(connection);
  }

  private async refreshConnection(
    connection: StoredAtlassianConnection<JiraConnectionConfig>,
  ): Promise<StoredAtlassianConnection<JiraConnectionConfig>> {
    const credential = connection.credential;
    if (
      credential.authType !== 'oauth2' ||
      !credential.expiresAt ||
      Date.parse(credential.expiresAt) > Date.now() + 60_000
    ) {
      return connection;
    }
    if (!credential.refreshToken || !credential.clientId || !credential.clientSecret) {
      throw new IntegrationError(
        'authentication_failed',
        'Jira OAuth token expired and cannot be refreshed',
        { provider: this.provider, retryable: false },
      );
    }
    const response = await this.fetchImpl(
      `${connection.config.authBaseUrl.replace(/\/+$/, '')}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: credential.clientId,
          client_secret: credential.clientSecret,
          refresh_token: credential.refreshToken,
        }),
      },
    );
    if (!response.ok) {
      throw new IntegrationError(
        'authentication_failed',
        `Jira OAuth refresh failed (${response.status})`,
        { provider: this.provider, statusCode: response.status, retryable: false },
      );
    }
    const token = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) {
      throw new IntegrationError('authentication_failed', 'Jira OAuth refresh returned no token', {
        provider: this.provider,
      });
    }
    const refreshed: AtlassianCredential = {
      ...credential,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? credential.refreshToken,
      expiresAt:
        typeof token.expires_in === 'number'
          ? new Date(Date.now() + token.expires_in * 1_000).toISOString()
          : undefined,
    };
    await this.store.updateJiraCredential(connection.id, refreshed, connection.config);
    return { ...connection, credential: refreshed };
  }

  private connectionClient(connection: StoredAtlassianConnection<JiraConnectionConfig>) {
    return this.client(connection.credential, connection.config);
  }

  private client(credential: AtlassianCredential, config: JiraConnectionConfig) {
    let baseUrl: string;
    if (credential.authType === 'oauth2') {
      if (!config.cloudId) {
        throw new IntegrationError('invalid_request', 'Jira cloudId is required for OAuth 2.0', {
          provider: this.provider,
        });
      }
      baseUrl = `${config.apiGatewayBaseUrl.replace(/\/+$/, '')}/ex/jira/${encodeURIComponent(config.cloudId)}/rest/api/3`;
    } else {
      if (!config.siteUrl) {
        throw new IntegrationError('invalid_request', 'Jira siteUrl is required for API-token auth', {
          provider: this.provider,
        });
      }
      baseUrl = `${config.siteUrl.replace(/\/+$/, '')}/rest/api/3`;
    }
    return new AtlassianHttpClient({
      provider: this.provider,
      baseUrl,
      credential,
      fetch: this.fetchImpl,
    });
  }

  private toSummary(
    issue: JiraIssue,
    config: JiraConnectionConfig,
    mappings: JiraFieldMappings,
  ): WorkItemSummary {
    const projectKey = this.issueProject(issue);
    const priority = issue.fields.priority;
    const configured = priority?.name ? mappings.priority?.[priority.name] : undefined;
    const numericPriority =
      typeof configured === 'number'
        ? configured
        : Number.isFinite(Number(configured ?? priority?.id))
          ? Number(configured ?? priority?.id)
          : null;
    return {
      id: issue.key,
      provider: this.provider,
      project: {
        id: projectKey,
        key: projectKey,
        name: projectKey,
        description: null,
        url: config.siteUrl ? `${config.siteUrl.replace(/\/+$/, '')}/browse/${issue.key}` : null,
      },
      title: issue.fields.summary ?? '',
      type: issue.fields.issuetype?.name ?? 'Unknown',
      state: this.state(issue.fields.status),
      priority: numericPriority,
      assignee: issue.fields.assignee ? this.user(issue.fields.assignee) : null,
      author: issue.fields.reporter || issue.fields.creator
        ? this.user(issue.fields.reporter ?? issue.fields.creator)
        : null,
      labels: issue.fields.labels ?? [],
      createdAt: issue.fields.created ?? new Date(0).toISOString(),
      updatedAt: issue.fields.updated ?? issue.fields.created ?? new Date(0).toISOString(),
      url: config.siteUrl
        ? `${config.siteUrl.replace(/\/+$/, '')}/browse/${issue.key}`
        : issue.self ?? '',
    };
  }

  private toDetail(
    issue: JiraIssue,
    config: JiraConnectionConfig,
    mappings: JiraFieldMappings,
  ): WorkItemDetail {
    const components = issue.fields.components?.map((component) => component.name).filter(Boolean) ?? [];
    const customFields = Object.fromEntries(
      Object.entries(issue.fields).filter(([key]) => key.startsWith('customfield_')),
    );
    return {
      ...this.toSummary(issue, config, mappings),
      description: this.adfText(issue.fields.description) || null,
      acceptanceCriteria: null,
      reproSteps: null,
      severity: this.fieldString(issue.fields[mappings.severity ?? '']),
      areaPath:
        this.fieldString(issue.fields[mappings.area ?? '']) ??
        (components.length ? components.join(', ') : null),
      iterationPath: this.sprintName(
        issue.fields[mappings.iteration ?? mappings.sprint ?? ''],
      ),
      relations: (issue.fields.issuelinks ?? []).flatMap((link) => {
        const related = link.outwardIssue ?? link.inwardIssue;
        if (!related?.key) return [];
        return [{
          type: link.outwardIssue ? link.type?.outward ?? link.type?.name ?? 'relates to' : link.type?.inward ?? link.type?.name ?? 'relates to',
          title: related.fields?.summary ?? related.key,
          url: config.siteUrl
            ? `${config.siteUrl.replace(/\/+$/, '')}/browse/${related.key}`
            : related.key,
        }];
      }),
      customFields,
    };
  }

  private project(project: JiraProject, config: JiraConnectionConfig): WorkItemProject {
    return {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description ?? null,
      url: config.siteUrl
        ? `${config.siteUrl.replace(/\/+$/, '')}/plugins/servlet/project-config/${project.key}/summary`
        : project.self ?? null,
    };
  }

  private user(value?: JiraUser | null): WorkItemUser {
    return {
      id: value?.accountId ?? null,
      displayName: value?.displayName ?? 'Unknown',
      email: value?.emailAddress ?? null,
      avatarUrl:
        value?.avatarUrls?.['48x48'] ??
        value?.avatarUrls?.['32x32'] ??
        null,
    };
  }

  private state(value?: JiraStatus | null): WorkItemState {
    const key = value?.statusCategory?.key?.toLowerCase();
    const category =
      key === 'new'
        ? 'new'
        : key === 'indeterminate'
          ? 'in_progress'
          : key === 'done'
            ? 'closed'
            : 'unknown';
    return {
      id: value?.id ?? value?.name ?? 'unknown',
      name: value?.name ?? 'Unknown',
      category,
      color: value?.statusCategory?.colorName ?? null,
    };
  }

  private attachment(value: JiraAttachment): WorkItemAttachment {
    return {
      id: value.id,
      name: value.filename,
      sizeBytes: value.size ?? null,
      url: value.content ?? '',
      contentType: value.mimeType ?? null,
      createdAt: value.created ?? null,
      author: value.author ? this.user(value.author) : null,
    };
  }

  private issueProject(issue: JiraIssue): string {
    return issue.key.includes('-') ? issue.key.slice(0, issue.key.lastIndexOf('-')) : '';
  }

  private issueFields(): string[] {
    return [
      'summary',
      'description',
      'issuetype',
      'status',
      'priority',
      'assignee',
      'reporter',
      'creator',
      'labels',
      'created',
      'updated',
      'components',
      'attachment',
      'issuelinks',
      '*navigable',
    ];
  }

  private jqlString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  private toAdf(text: string): Record<string, unknown> {
    return {
      type: 'doc',
      version: 1,
      content: text.split(/\r?\n/).map((line) => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      })),
    };
  }

  private adfText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const node = value as { text?: unknown; type?: unknown; content?: unknown[] };
    if (typeof node.text === 'string') return node.text;
    const content = Array.isArray(node.content)
      ? node.content.map((child) => this.adfText(child)).join('')
      : '';
    return node.type === 'paragraph' || node.type === 'heading' ? `${content}\n` : content;
  }

  private fieldString(value: unknown): string | null {
    if (typeof value === 'string') return value || null;
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const candidate = record.value ?? record.name ?? record.displayName;
      return candidate == null ? null : String(candidate);
    }
    return null;
  }

  private sprintName(value: unknown): string | null {
    const candidate = Array.isArray(value) ? value.at(-1) : value;
    return this.fieldString(candidate);
  }

  private reverseWorkflowName(name: string, mappings: JiraFieldMappings): string {
    return Object.entries(mappings.workflow ?? {}).find(([, target]) => target === name)?.[0] ?? name;
  }

  private countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
    return values.reduce<Record<string, number>>((result, value) => {
      const group = key(value);
      result[group] = (result[group] ?? 0) + 1;
      return result;
    }, {});
  }

  private status(
    connection: StoredAtlassianConnection<JiraConnectionConfig>,
    state: 'connected' | 'degraded',
    error: string | null,
  ): WorkItemConnectionStatus {
    return {
      id: connection.id,
      provider: this.provider,
      state,
      connected: state === 'connected',
      source: 'database',
      displayName: connection.displayName,
      namespace: connection.namespace,
      error,
      connectedAt: connection.connectedAt,
      lastVerifiedAt: connection.lastVerifiedAt,
      capabilities: this.capabilities,
    };
  }
}
