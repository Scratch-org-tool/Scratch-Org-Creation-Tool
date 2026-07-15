import { Inject, Injectable } from '@nestjs/common';
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
import {
  type AdapterContext,
  type AttachmentContent,
  type WorkItemAdapter,
  type WorkItemCreateInput,
  type WorkItemMutationResult,
  type WorkItemOverview,
  type WorkItemQuery,
  type WorkItemUpdateInput,
  type WorkItemUpload,
} from '../foundation/adapter.contracts';
import { IntegrationError } from '../foundation/adapter.errors';
import { GitHubApiClient } from './github-api.client';
import {
  GITHUB_ATTACHMENT_STORE,
  type GitHubAttachmentScope,
  type GitHubAttachmentStore,
} from './github-attachment.store';
import { GitHubIntegrationService } from './github-integration.service';
import {
  githubIssueId,
  parseGitHubIssueRef,
  type GitHubCredentials,
  type GitHubIssueRef,
  type GitHubProjectBindingRecord,
  type GitHubProjectFieldMapping,
} from './github.types';

const CAPABILITIES = {
  read: true,
  write: true,
  create: true,
  update: true,
  comments: true,
  webhooks: true,
  attachments: true,
  attachmentUploads: true,
  attachmentDeletes: true,
  history: true,
  stateTransitions: true,
  issueTypes: true,
  users: true,
  labels: true,
  subIssues: true,
} as const;

interface GitHubUser {
  id: number | string;
  login: string;
  avatar_url?: string | null;
}

interface GitHubLabel {
  id?: number;
  name: string;
  color?: string;
}

interface GitHubIssue {
  id: number;
  node_id?: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: string | null;
  html_url: string;
  user: GitHubUser;
  assignee?: GitHubUser | null;
  assignees?: GitHubUser[];
  labels: Array<GitHubLabel | string>;
  type?: { id?: string; name?: string } | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  pull_request?: unknown;
  repository_url?: string;
}

interface ProjectFieldValue {
  fieldId: string;
  fieldName: string;
  value: string | number | null;
  optionId?: string;
}

interface ProjectIssueNode {
  itemId: string;
  issue: GitHubIssue;
  repository: { nameWithOwner: string };
  fields: ProjectFieldValue[];
}

interface ProjectField {
  id: string;
  name: string;
  dataType?: string;
  options?: Array<{ id: string; name: string }>;
}

@Injectable()
export class GitHubWorkItemAdapter implements WorkItemAdapter {
  readonly provider = 'github_issues' as const;
  get capabilities() {
    const available = this.attachments.available;
    return {
      ...CAPABILITIES,
      attachments: available,
      attachmentUploads: available && typeof this.uploadAttachment === 'function',
      attachmentDeletes: available && typeof this.deleteAttachment === 'function',
    };
  }

  constructor(
    private readonly integration: GitHubIntegrationService,
    private readonly api: GitHubApiClient,
    @Inject(GITHUB_ATTACHMENT_STORE) private readonly attachments: GitHubAttachmentStore,
  ) {}

  async getConnectionStatus(context: AdapterContext = {}): Promise<WorkItemConnectionStatus> {
    const row = await this.integration.getWorkItemConnection(context.connectionId);
    return {
      id: row?.id,
      provider: this.provider,
      state:
        !row
          ? 'disconnected'
          : row.status === 'degraded'
            ? 'degraded'
            : row.status === 'error'
              ? 'error'
              : row.status === 'disconnected'
                ? 'disconnected'
                : 'connected',
      connected: Boolean(row && (row.status === 'connected' || row.status === 'degraded')),
      source: row ? 'database' : null,
      displayName: row?.displayName ?? null,
      namespace: row?.namespace ?? null,
      error: null,
      connectedAt: row?.createdAt.toISOString(),
      lastVerifiedAt: row?.lastVerifiedAt?.toISOString(),
      capabilities: this.capabilities,
    };
  }

  async listProjects(context: AdapterContext = {}): Promise<WorkItemProject[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const bindings = await this.integration.listProjectBindings(context.connectionId);
    const repositories = await this.api.paginate<{
      id: number;
      full_name: string;
      description?: string | null;
      html_url: string;
    }>(credentials, '/installation/repositories');
    const projects: WorkItemProject[] = [];
    // A Projects v2 node can only be queried safely when its owner/repository
    // context is persisted in a binding. Do not expose arbitrary owner projects
    // that later metadata calls cannot resolve.
    projects.push(
      ...bindings.filter((binding) => binding.repository).map((binding) => ({
        id: binding.projectId,
        key: binding.projectId,
        name: binding.repository
          ? `${binding.owner}/${binding.repository} Project`
          : `${binding.owner} Project`,
        description: 'GitHub Projects v2',
        url: `${credentials.baseUrl}/${binding.owner}?tab=projects`,
      })),
    );
    for (const repository of repositories) {
      projects.push({
        id: repository.full_name,
        key: repository.full_name,
        name: repository.full_name,
        description: repository.description ?? null,
        url: repository.html_url,
      });
    }
    return this.uniqueProjects(projects);
  }

  async getProjectOverview(
    project: string,
    context: AdapterContext = {},
  ): Promise<WorkItemOverview> {
    const items = await this.queryWorkItems({ project, ...context });
    const selected =
      (await this.listProjects(context)).find((candidate) => candidate.id === project) ??
      this.repositoryProject(project);
    return {
      project: selected,
      total: items.length,
      byState: this.countBy(items.map((item) => item.state.name)),
      byType: this.countBy(items.map((item) => item.type)),
      byPriority: this.countBy(items.map((item) => String(item.priority ?? 'none'))),
    };
  }

  getOverview(project: string, context?: AdapterContext): Promise<WorkItemOverview> {
    return this.getProjectOverview(project, context);
  }

  async queryWorkItems(query: WorkItemQuery): Promise<WorkItemSummary[]> {
    const credentials = await this.requireCredentials(query.connectionId);
    const bindings = await this.integration.listProjectBindings(query.connectionId);
    let items: WorkItemSummary[] = [];
    const binding = query.project
      ? bindings.find((candidate) => candidate.projectId === query.project)
      : undefined;
    if (binding) {
      items = (await this.projectItems(credentials, binding)).map((item) =>
        this.toSummary(item.issue, item.repository.nameWithOwner, item.fields, binding.fieldMapping),
      );
    } else {
      let repositories = query.project
        ? [query.project]
        : bindings
            .filter((candidate) => candidate.repository)
            .map((candidate) => `${candidate.owner}/${candidate.repository}`);
      if (!query.project && repositories.length === 0) {
        repositories = (
          await this.api.paginate<{ full_name: string }>(
            credentials,
            '/installation/repositories',
          )
        ).map((repository) => repository.full_name);
      }
      for (const repository of [...new Set(repositories)]) {
        const ref = this.repositoryRef(repository);
        const queryParams = new URLSearchParams({ state: 'all', sort: 'updated', direction: 'desc' });
        if (query.assigneeLogin) queryParams.set('assignee', query.assigneeLogin);
        const issues = await this.api.paginate<GitHubIssue>(
          credentials,
          `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues?${queryParams}`,
        );
        items.push(
          ...issues
            .filter((issue) => !issue.pull_request)
            .map((issue) => this.toSummary(issue, repository)),
        );
      }
    }
    return items
      .filter(
        (item) =>
          !query.assigneeId ||
          item.assignee?.id === query.assigneeId,
      )
      .filter(
        (item) =>
          !query.assigneeLogin ||
          item.assignee?.displayName.toLowerCase() === query.assigneeLogin.toLowerCase(),
      )
      .filter(
        (item) =>
          !query.types?.length ||
          query.types.some((type) => type.toLowerCase() === item.type.toLowerCase()),
      )
      .filter(
        (item) =>
          !query.state ||
          item.state.name.toLowerCase() === query.state.toLowerCase() ||
          item.state.category === query.state.toLowerCase(),
      )
      .filter(
        (item) =>
          !query.text ||
          item.title.toLowerCase().includes(query.text.toLowerCase()),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getWorkItem(
    id: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemDetail> {
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = this.issueRef(id, project);
    const issue = await this.api.request<GitHubIssue>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`,
    );
    const binding = await this.bindingForRepository(ref, project, context.connectionId);
    let fields: ProjectFieldValue[] = [];
    if (binding) {
      const item = (await this.projectItems(credentials, binding)).find(
        (candidate) => candidate.issue.number === ref.number &&
          candidate.repository.nameWithOwner.toLowerCase() === `${ref.owner}/${ref.repo}`.toLowerCase(),
      );
      fields = item?.fields ?? [];
    }
    return this.toDetail(issue, `${ref.owner}/${ref.repo}`, fields, binding?.fieldMapping);
  }

  async createWorkItem(input: WorkItemCreateInput): Promise<WorkItemDetail> {
    const credentials = await this.requireCredentials(input.connectionId);
    const bindings = await this.integration.listProjectBindings(input.connectionId);
    const projectBinding = bindings.find((binding) => binding.projectId === input.project);
    const repository = projectBinding?.repository
      ? `${projectBinding.owner}/${projectBinding.repository}`
      : this.repositoryForInput(input.project);
    const ref = this.repositoryRef(repository);
    const issue = await this.api.request<GitHubIssue>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          body: input.description ?? '',
          assignees: input.assigneeLogins ?? [],
          labels: input.labels ?? [],
          ...(input.type ? { type: input.type } : {}),
        }),
      },
    );
    const binding =
      projectBinding ??
      (await this.bindingForRepository({
        ...ref,
        number: issue.number,
      }, input.project, input.connectionId));
    if (binding && issue.node_id) {
      await this.addIssueToProject(credentials, binding.projectId, issue.node_id);
      await this.updateProjectFields(
        credentials,
        binding,
        issue.node_id,
        {
          ...(input.customFields ?? {}),
          ...(input.severity !== undefined ? { Severity: input.severity } : {}),
          ...(input.priority !== undefined ? { Priority: input.priority } : {}),
          ...(input.area !== undefined ? { Area: input.area } : {}),
          ...(input.iteration !== undefined ? { Iteration: input.iteration } : {}),
          ...(input.state ? { Status: input.state } : {}),
        },
      );
    }
    return this.getWorkItem(
      githubIssueId({ ...ref, number: issue.number }),
      input.project,
      { connectionId: input.connectionId },
    );
  }

  async updateWorkItem(
    id: string,
    input: WorkItemUpdateInput,
  ): Promise<WorkItemDetail> {
    const credentials = await this.requireCredentials(input.connectionId);
    const ref = this.issueRef(id, input.project);
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.body = input.description ?? '';
    if (input.assigneeLogins !== undefined) patch.assignees = input.assigneeLogins;
    if (input.labels !== undefined) patch.labels = input.labels;
    if (input.type !== undefined) patch.type = input.type;
    if (input.state && ['open', 'closed'].includes(input.state.toLowerCase())) {
      patch.state = input.state.toLowerCase();
    }
    const issue = await this.api.request<GitHubIssue>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
    const binding = await this.bindingForRepository(ref, input.project, input.connectionId);
    if (binding && issue.node_id) {
      await this.updateProjectFields(credentials, binding, issue.node_id, {
        ...(input.customFields ?? {}),
        ...(input.severity !== undefined ? { Severity: input.severity } : {}),
        ...(input.priority !== undefined ? { Priority: input.priority } : {}),
        ...(input.area !== undefined ? { Area: input.area } : {}),
        ...(input.iteration !== undefined ? { Iteration: input.iteration } : {}),
        ...(input.state ? { Status: input.state } : {}),
      });
    }
    return this.getWorkItem(
      githubIssueId(ref),
      input.project,
      { connectionId: input.connectionId },
    );
  }

  async updateState(
    id: string,
    state: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemDetail> {
    return this.updateWorkItem(id, { project, state, connectionId: context.connectionId });
  }

  async getComments(
    id: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemComment[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = this.issueRef(id, project);
    const comments = await this.api.paginate<{
      id: number;
      body: string | null;
      user: GitHubUser;
      created_at: string;
      updated_at: string;
    }>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/comments`,
    );
    return comments.map((comment) => ({
      id: String(comment.id),
      body: comment.body ?? '',
      author: this.user(comment.user),
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }));
  }

  async addComment(
    id: string,
    body: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemComment> {
    if (!body.trim()) {
      throw new IntegrationError('invalid_request', 'Comment body is required', {
        provider: this.provider,
      });
    }
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = this.issueRef(id, project);
    const comment = await this.api.request<{
      id: number;
      body: string | null;
      user: GitHubUser;
      created_at: string;
      updated_at: string;
    }>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
    );
    return {
      id: String(comment.id),
      body: comment.body ?? '',
      author: this.user(comment.user),
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }

  async getStateOptions(
    id: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemState[]> {
    const ref = this.issueRef(id, project);
    const binding = await this.bindingForRepository(ref, project, context.connectionId);
    const base = [this.state('open'), this.state('closed')];
    if (!binding) return base;
    const credentials = await this.requireCredentials(context.connectionId);
    const fields = await this.projectFields(credentials, binding.projectId);
    const statusRef = binding.fieldMapping.Status ?? 'Status';
    const status = fields.find((field) => field.id === statusRef || field.name === statusRef);
    return [
      ...base,
      ...(status?.options ?? []).map((option) => this.state(option.name, option.id)),
    ].filter(
      (candidate, index, values) =>
        values.findIndex((value) => value.name.toLowerCase() === candidate.name.toLowerCase()) === index,
    );
  }

  async listIssueTypes(project: string, context: AdapterContext = {}): Promise<string[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const owner = (await this.metadataRepository(project, context.connectionId)).owner;
    const data = await this.api.graphql<{
      organization: { issueTypes?: { nodes?: Array<{ name: string }> } } | null;
    }>(
      credentials,
      `query IssueTypes($owner: String!) {
        organization(login: $owner) { issueTypes(first: 100) { nodes { name } } }
      }`,
      { owner },
    );
    return (data.organization?.issueTypes?.nodes ?? []).map((type) => type.name);
  }

  async listAssignees(project: string, context: AdapterContext = {}): Promise<WorkItemUser[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = await this.metadataRepository(project, context.connectionId);
    const users = await this.api.paginate<GitHubUser>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/assignees`,
    );
    return users.map((user) => this.user(user));
  }

  async listLabels(project: string, context: AdapterContext = {}): Promise<string[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = await this.metadataRepository(project, context.connectionId);
    const labels = await this.api.paginate<GitHubLabel>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/labels`,
    );
    return labels.map((label) => label.name);
  }

  async getHistory(
    id: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemHistoryEvent[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = this.issueRef(id, project);
    const events = await this.api.paginate<Record<string, unknown>>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/timeline`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    return events.map((event, index) => this.historyEvent(event, index));
  }

  async listSubIssues(
    id: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemSummary[]> {
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = this.issueRef(id, project);
    const issues = await this.api.paginate<GitHubIssue>(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/sub_issues`,
    );
    return issues.map((issue) => this.toSummary(issue, `${ref.owner}/${ref.repo}`));
  }

  async addSubIssue(
    id: string,
    subIssueId: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemMutationResult> {
    const credentials = await this.requireCredentials(context.connectionId);
    const parent = this.issueRef(id, project);
    const child = this.issueRef(subIssueId, project);
    const childIssue = await this.api.request<GitHubIssue>(
      credentials,
      `/repos/${encodeURIComponent(child.owner)}/${encodeURIComponent(child.repo)}/issues/${child.number}`,
    );
    await this.api.request(
      credentials,
      `/repos/${encodeURIComponent(parent.owner)}/${encodeURIComponent(parent.repo)}/issues/${parent.number}/sub_issues`,
      { method: 'POST', body: JSON.stringify({ sub_issue_id: childIssue.id }) },
    );
    return { id: githubIssueId(child), updated: true };
  }

  async listAttachments(
    id: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemAttachment[]> {
    const ref = this.issueRef(id, project);
    return this.attachments.list(await this.attachmentScope(ref, context.connectionId));
  }

  async getAttachmentContent(
    id: string,
    attachmentId: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<AttachmentContent> {
    const ref = this.issueRef(id, project);
    const result = await this.attachments.get(
      await this.attachmentScope(ref, context.connectionId),
      attachmentId,
    );
    return {
      buffer: result.buffer,
      contentType: result.attachment.contentType ?? 'application/octet-stream',
      fileName: result.attachment.name,
    };
  }

  async uploadAttachment(
    id: string,
    upload: WorkItemUpload,
    project?: string,
    context: AdapterContext = {},
  ): Promise<WorkItemAttachment> {
    if (!context.actorId) {
      throw new IntegrationError('authorization_failed', 'Authenticated attachment actor is required', {
        provider: this.provider,
      });
    }
    const credentials = await this.requireCredentials(context.connectionId);
    const ref = this.issueRef(id, project);
    // Verifies the issue is visible to this installation before persisting bytes.
    await this.api.request(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`,
    );
    const scope = await this.attachmentScope(ref, context.connectionId);
    const attachment = await this.attachments.put({
      scope,
      name: upload.fileName,
      contentType: upload.contentType,
      content: upload.buffer,
      authorId: context.actorId,
    });
    const url = this.attachmentUrl(githubIssueId(ref), attachment.id, scope.workItemConnectionId);
    const safeName = attachment.name.replace(/([\\[\]])/g, '\\$1');
    await this.api.request(
      credentials,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({
          body: `Attachment uploaded to the authenticated application store: [${safeName}](${url})`,
        }),
      },
    );
    return { ...attachment, url };
  }

  async deleteAttachment(
    id: string,
    attachmentId: string,
    project?: string,
    context: AdapterContext = {},
  ): Promise<void> {
    if (!context.actorId) {
      throw new IntegrationError('authorization_failed', 'Authenticated attachment actor is required', {
        provider: this.provider,
      });
    }
    const ref = this.issueRef(id, project);
    await this.attachments.delete(
      await this.attachmentScope(ref, context.connectionId),
      attachmentId,
      context.actorId,
      context.isAdmin === true,
    );
  }

  private async projectItems(
    credentials: GitHubCredentials,
    binding: GitHubProjectBindingRecord,
  ): Promise<ProjectIssueNode[]> {
    const result: ProjectIssueNode[] = [];
    let cursor: string | null = null;
    do {
      const data: {
        node: {
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
              id: string;
              content: null | (GitHubIssue & {
                repository?: { nameWithOwner: string };
              });
              fieldValues: {
                nodes: Array<{
                  text?: string | null;
                  number?: number | null;
                  name?: string | null;
                  title?: string | null;
                  optionId?: string | null;
                  field?: { id?: string; name?: string };
                }>;
              };
            }>;
          };
        } | null;
      } = await this.api.graphql(
        credentials,
        `query ProjectItems($id: ID!, $after: String) {
          node(id: $id) {
            ... on ProjectV2 {
              items(first: 100, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content {
                    ... on Issue {
                      id databaseId number title body state stateReason url createdAt updatedAt
                      author { login avatarUrl ... on User { databaseId } }
                      assignees(first: 20) { nodes { login avatarUrl databaseId } }
                      labels(first: 50) { nodes { name color } }
                      issueType { name }
                      repository { nameWithOwner }
                    }
                  }
                  fieldValues(first: 100) {
                    nodes {
                      ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { id name } } }
                      ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id name } } }
                      ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2FieldCommon { id name } } }
                      ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2FieldCommon { id name } } }
                    }
                  }
                }
              }
            }
          }
        }`,
        { id: binding.projectId, after: cursor },
      );
      const page = data.node?.items;
      if (!page) break;
      for (const node of page.nodes) {
        if (!node.content?.repository) continue;
        result.push({
          itemId: node.id,
          issue: this.graphqlIssue(node.content),
          repository: node.content.repository,
          fields: node.fieldValues.nodes
            .filter((field) => field.field?.id && field.field.name)
            .map((field) => ({
              fieldId: field.field!.id!,
              fieldName: field.field!.name!,
              value: field.text ?? field.number ?? field.name ?? field.title ?? null,
              ...(field.optionId ? { optionId: field.optionId } : {}),
            })),
        });
      }
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return result;
  }

  private async ownerProjects(
    credentials: GitHubCredentials,
    owner: string,
  ): Promise<WorkItemProject[]> {
    const projects: WorkItemProject[] = [];
    let cursor: string | null = null;
    do {
      const data: {
        organization: {
          projectsV2: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
              id: string;
              title: string;
              shortDescription?: string | null;
              url: string;
            }>;
          };
        } | null;
        user: {
          projectsV2: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
              id: string;
              title: string;
              shortDescription?: string | null;
              url: string;
            }>;
          };
        } | null;
      } = await this.api.graphql(
        credentials,
        `query OwnerProjects($owner: String!, $after: String) {
          organization(login: $owner) {
            projectsV2(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { id title shortDescription url }
            }
          }
          user(login: $owner) {
            projectsV2(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { id title shortDescription url }
            }
          }
        }`,
        { owner, after: cursor },
      );
      const page = data.organization?.projectsV2 ?? data.user?.projectsV2;
      if (!page) break;
      projects.push(
        ...page.nodes.map((project) => ({
          id: project.id,
          key: project.id,
          name: project.title,
          description: project.shortDescription ?? null,
          url: project.url,
        })),
      );
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return projects;
  }

  private graphqlIssue(value: GitHubIssue & {
    databaseId?: number;
    url?: string;
    stateReason?: string | null;
    author?: unknown;
    assignees?: unknown;
    issueType?: unknown;
    createdAt?: string;
    updatedAt?: string;
  }): GitHubIssue {
    const author = value.author as { login?: string; avatarUrl?: string; databaseId?: number } | undefined;
    const assigneeNodes = (value.assignees as { nodes?: Array<{ login: string; avatarUrl?: string; databaseId?: number }> } | undefined)?.nodes ?? [];
    const labelNodes = (value.labels as { nodes?: GitHubLabel[] } | undefined)?.nodes ?? [];
    const issueType = value.issueType as { name?: string } | undefined;
    return {
      id: Number(value.databaseId ?? value.id),
      node_id: String(value.id),
      number: value.number,
      title: value.title,
      body: value.body,
      state: String(value.state).toLowerCase() as 'open' | 'closed',
      state_reason: (value.stateReason as string | null) ?? null,
      html_url: String(value.url),
      user: {
        id: author?.databaseId ?? author?.login ?? '',
        login: author?.login ?? 'ghost',
        avatar_url: author?.avatarUrl,
      },
      assignee: assigneeNodes[0]
        ? {
            id: assigneeNodes[0].databaseId ?? assigneeNodes[0].login,
            login: assigneeNodes[0].login,
            avatar_url: assigneeNodes[0].avatarUrl,
          }
        : null,
      labels: labelNodes,
      type: issueType?.name ? { name: issueType.name } : null,
      created_at: String(value.createdAt),
      updated_at: String(value.updatedAt),
    };
  }

  private async projectFields(
    credentials: GitHubCredentials,
    projectId: string,
  ): Promise<ProjectField[]> {
    const data = await this.api.graphql<{
      node: {
        fields: {
          nodes: Array<{
            id: string;
            name: string;
            dataType?: string;
            options?: Array<{ id: string; name: string }>;
          }>;
        };
      } | null;
    }>(
      credentials,
      `query ProjectFields($id: ID!) {
        node(id: $id) {
          ... on ProjectV2 {
            fields(first: 100) {
              nodes {
                ... on ProjectV2Field { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType options { id name } }
                ... on ProjectV2IterationField { id name dataType }
              }
            }
          }
        }
      }`,
      { id: projectId },
    );
    return data.node?.fields.nodes ?? [];
  }

  private async addIssueToProject(
    credentials: GitHubCredentials,
    projectId: string,
    contentId: string,
  ): Promise<string> {
    const data = await this.api.graphql<{
      addProjectV2ItemById: { item: { id: string } };
    }>(
      credentials,
      `mutation AddProjectItem($project: ID!, $content: ID!) {
        addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
      }`,
      { project: projectId, content: contentId },
    );
    return data.addProjectV2ItemById.item.id;
  }

  private async updateProjectFields(
    credentials: GitHubCredentials,
    binding: GitHubProjectBindingRecord,
    issueNodeId: string,
    values: Record<string, string | number | null>,
  ): Promise<void> {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;
    const items = await this.projectItems(credentials, binding);
    let item = items.find((candidate) => candidate.issue.node_id === issueNodeId);
    let itemId = item?.itemId;
    if (!itemId) itemId = await this.addIssueToProject(credentials, binding.projectId, issueNodeId);
    const fields = await this.projectFields(credentials, binding.projectId);
    for (const [canonicalName, rawValue] of entries) {
      const mapped = binding.fieldMapping[canonicalName] ?? canonicalName;
      const field = fields.find((candidate) => candidate.id === mapped || candidate.name === mapped);
      if (!field) continue;
      const option = field.options?.find(
        (candidate) => candidate.name.toLowerCase() === String(rawValue).toLowerCase(),
      );
      const value =
        rawValue === null
          ? {}
          : option
            ? { singleSelectOptionId: option.id }
            : typeof rawValue === 'number'
              ? { number: rawValue }
              : { text: String(rawValue) };
      await this.api.graphql(
        credentials,
        `mutation UpdateProjectField($project: ID!, $item: ID!, $field: ID!, $value: ProjectV2FieldValue!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $project, itemId: $item, fieldId: $field, value: $value
          }) { projectV2Item { id } }
        }`,
        { project: binding.projectId, item: itemId, field: field.id, value },
      );
    }
  }

  private toSummary(
    issue: GitHubIssue,
    repository: string,
    fields: ProjectFieldValue[] = [],
    mapping: GitHubProjectFieldMapping = {},
  ): WorkItemSummary {
    const values = this.canonicalFields(fields, mapping);
    const status = values.Status == null ? issue.state : String(values.Status);
    const priorityValue = values.Priority == null ? null : Number.parseInt(String(values.Priority), 10);
    return {
      id: githubIssueId({
        ...this.repositoryRef(repository),
        number: issue.number,
      }),
      provider: this.provider,
      project: this.repositoryProject(repository),
      title: issue.title,
      type: String(values['Issue Type'] ?? issue.type?.name ?? 'Issue'),
      state: this.state(status),
      priority: Number.isFinite(priorityValue) ? priorityValue : null,
      assignee: issue.assignee ? this.user(issue.assignee) : null,
      author: this.user(issue.user),
      labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name)),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
    };
  }

  private toDetail(
    issue: GitHubIssue,
    repository: string,
    fields: ProjectFieldValue[] = [],
    mapping: GitHubProjectFieldMapping = {},
  ): WorkItemDetail {
    const values = this.canonicalFields(fields, mapping);
    return {
      ...this.toSummary(issue, repository, fields, mapping),
      description: issue.body,
      acceptanceCriteria: null,
      reproSteps: null,
      severity: values.Severity == null ? null : String(values.Severity),
      areaPath: values.Area == null ? null : String(values.Area),
      iterationPath: values.Iteration == null ? null : String(values.Iteration),
      relations: [],
      customFields: values,
    };
  }

  private canonicalFields(
    fields: ProjectFieldValue[],
    mapping: GitHubProjectFieldMapping,
  ): Record<string, string | number | null> {
    const output: Record<string, string | number | null> = {};
    for (const field of fields) output[field.fieldName] = field.value;
    for (const [canonical, providerField] of Object.entries(mapping)) {
      if (!providerField) continue;
      const field = fields.find(
        (candidate) =>
          candidate.fieldId === providerField || candidate.fieldName === providerField,
      );
      if (field) output[canonical] = field.value;
    }
    return output;
  }

  private historyEvent(event: Record<string, unknown>, index: number): WorkItemHistoryEvent {
    const actor = (event.actor ?? event.user) as GitHubUser | undefined;
    const kind = String(event.event ?? (event.body !== undefined ? 'comment' : 'updated'));
    const createdAt = String(event.created_at ?? event.submitted_at ?? '');
    const label = (event.label as { name?: string } | undefined)?.name;
    const assignee = (event.assignee as GitHubUser | undefined)?.login;
    const commitId = typeof event.commit_id === 'string' ? event.commit_id : null;
    const summary =
      kind === 'comment'
        ? 'Added a comment'
        : kind === 'closed'
          ? 'Closed the issue'
          : kind === 'reopened'
            ? 'Reopened the issue'
            : kind === 'labeled' || kind === 'unlabeled'
              ? `${kind === 'labeled' ? 'Added' : 'Removed'} label ${label ?? ''}`.trim()
              : kind === 'assigned' || kind === 'unassigned'
                ? `${kind === 'assigned' ? 'Assigned' : 'Unassigned'} ${assignee ?? ''}`.trim()
                : kind.replace(/_/g, ' ');
    return {
      id: String(event.id ?? event.node_id ?? `${createdAt}-${index}`),
      kind: kind === 'comment' ? 'comment' : 'updated',
      version: index,
      actor: actor ? this.user(actor) : this.unknownUser(),
      occurredAt: createdAt,
      summary,
      changes: [
        ...(kind === 'closed' || kind === 'reopened'
          ? [{
              field: 'Status',
              fieldRef: 'state',
              oldValue: kind === 'closed' ? 'open' : 'closed',
              newValue: kind === 'closed' ? 'closed' : 'open',
            }]
          : []),
      ],
      body:
        typeof event.body === 'string'
          ? event.body
          : commitId,
    };
  }

  private state(name: string, id = name): WorkItemState {
    const normalized = name.toLowerCase();
    const category =
      normalized === 'open' || normalized.includes('backlog') || normalized.includes('todo')
        ? 'new'
        : normalized.includes('progress') || normalized.includes('doing')
          ? 'in_progress'
          : normalized.includes('resolve') || normalized.includes('complete')
            ? 'resolved'
            : normalized === 'closed' || normalized.includes('done')
              ? 'closed'
              : 'unknown';
    return { id, name, category, color: null };
  }

  private user(user: GitHubUser): WorkItemUser {
    return {
      id: String(user.id),
      displayName: user.login,
      // GitHub identity matching is strictly by immutable user id or exact login, never email.
      email: null,
      avatarUrl: user.avatar_url ?? null,
    };
  }

  private unknownUser(): WorkItemUser {
    return { id: null, displayName: 'Unknown', email: null, avatarUrl: null };
  }

  private repositoryProject(repository: string): WorkItemProject {
    return {
      id: repository,
      key: repository,
      name: repository,
      description: null,
      url: null,
    };
  }

  private repositoryRef(repository: string): { owner: string; repo: string } {
    const match = repository.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (!match) {
      throw new IntegrationError(
        'invalid_request',
        'GitHub repository must be "owner/repository"',
        { provider: this.provider },
      );
    }
    return { owner: match[1], repo: match[2] };
  }

  private issueRef(id: string, project?: string): GitHubIssueRef {
    try {
      return parseGitHubIssueRef(id, project);
    } catch (cause) {
      throw new IntegrationError('invalid_request', 'Invalid GitHub issue identifier', {
        provider: this.provider,
        cause,
      });
    }
  }

  private async bindingForRepository(
    ref: GitHubIssueRef,
    projectId?: string,
    connectionId?: string,
  ): Promise<GitHubProjectBindingRecord | undefined> {
    const bindings = await this.integration.listProjectBindings(connectionId);
    return bindings.find(
      (binding) =>
        (projectId ? binding.projectId === projectId : true) &&
        binding.owner.toLowerCase() === ref.owner.toLowerCase() &&
        (!binding.repository || binding.repository.toLowerCase() === ref.repo.toLowerCase()),
    );
  }

  private repositoryForInput(project: string): string {
    if (/^[^/\s]+\/[^/\s]+$/.test(project)) return project;
    throw new IntegrationError(
      'invalid_request',
      'Creating a GitHub issue requires an owner/repository project',
      { provider: this.provider },
    );
  }

  private async metadataRepository(
    project: string,
    connectionId?: string,
  ): Promise<{ owner: string; repo: string }> {
    if (/^[^/\s]+\/[^/\s]+$/.test(project)) return this.repositoryRef(project);
    const binding = (await this.integration.listProjectBindings(connectionId)).find(
      (candidate) => candidate.projectId === project,
    );
    if (!binding?.repository) {
      throw new IntegrationError(
        'invalid_request',
        'GitHub Projects v2 metadata requires a bound owner/repository',
        { provider: this.provider },
      );
    }
    return { owner: binding.owner, repo: binding.repository };
  }

  private async attachmentScope(
    ref: GitHubIssueRef,
    connectionId?: string,
  ): Promise<GitHubAttachmentScope> {
    const connection = await this.integration.getWorkItemConnection(connectionId);
    if (!connection) {
      throw new IntegrationError('not_connected', 'GitHub Issues is not connected', {
        provider: this.provider,
      });
    }
    const repository = `${ref.owner}/${ref.repo}`;
    return {
      workItemConnectionId: connection.id,
      externalProjectId: repository,
      workItemId: githubIssueId(ref),
    };
  }

  private attachmentUrl(workItemId: string, attachmentId: string, connectionId: string): string {
    const configured =
      process.env.INTEGRATION_PUBLIC_ORIGIN ??
      process.env.WEB_ORIGIN ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:8080';
    const origin = new URL(configured).origin;
    const url = new URL(
      `/api/defects/providers/github_issues/work-items/${encodeURIComponent(workItemId)}/attachments/${encodeURIComponent(attachmentId)}/content`,
      `${origin}/`,
    );
    url.searchParams.set('connectionId', connectionId);
    return url.toString();
  }

  private async requireCredentials(connectionId?: string): Promise<GitHubCredentials> {
    const credentials = await this.integration.getWorkItemCredentials(connectionId);
    if (!credentials) {
      throw new IntegrationError('not_connected', 'GitHub Issues is not connected', {
        provider: this.provider,
      });
    }
    return credentials;
  }

  private uniqueProjects(projects: WorkItemProject[]): WorkItemProject[] {
    return projects.filter(
      (project, index) => projects.findIndex((candidate) => candidate.id === project.id) === index,
    );
  }

  private countBy(values: string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});
  }
}
