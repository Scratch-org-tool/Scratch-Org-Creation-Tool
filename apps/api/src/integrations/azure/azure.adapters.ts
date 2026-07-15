import { Injectable } from '@nestjs/common';
import type {
  GitSourceConfig,
  Namespace,
  Repository,
  ScmConnectionStatus,
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
import { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import {
  type AdapterContext,
  type AttachmentContent,
  type RepositoryQuery,
  type ScmAdapter,
  type WorkItemAdapter,
  type WorkItemQuery,
} from '../foundation/adapter.contracts';
import { IntegrationError } from '../foundation/adapter.errors';
import { AzureService, type AzurePipelineVariables } from './azure.service';
import { AzureWorkItemsService } from './azure-work-items.service';

const AZURE_SCM_CAPABILITIES = {
  repositories: true,
  branches: true,
  checkout: true,
  pipelines: true,
  pullRequests: false,
  webhooks: false,
} as const;

const AZURE_WORK_ITEM_CAPABILITIES = {
  read: true,
  write: true,
  webhooks: false,
  attachments: true,
  history: true,
  stateTransitions: true,
} as const;

@Injectable()
export class AzureScmAdapter implements ScmAdapter {
  readonly provider = 'azure_devops' as const;
  readonly capabilities = AZURE_SCM_CAPABILITIES;

  constructor(
    private readonly azure: AzureService,
    private readonly integration: AzureIntegrationService,
  ) {}

  async getConnectionStatus(_context?: AdapterContext): Promise<ScmConnectionStatus> {
    const status = await this.integration.getStatus();
    return {
      provider: this.provider,
      state: status.connected ? 'connected' : 'disconnected',
      connected: status.connected,
      source: status.source,
      displayName: status.orgSlug,
      namespace: status.orgSlug,
      error: null,
      connectedAt: 'connectedAt' in status ? status.connectedAt : undefined,
      capabilities: this.capabilities,
    };
  }

  async listNamespaces(_context?: AdapterContext): Promise<Namespace[]> {
    const repositories = await this.azure.listRepos();
    const projects = [...new Set(repositories.map((repository) => repository.project).filter(Boolean))];
    return projects.map((project) => ({
      id: project,
      name: project,
      slug: project,
      url: null,
    }));
  }

  async listRepositories(query: RepositoryQuery = {}): Promise<Repository[]> {
    const project = query.project ?? query.namespace;
    const repositories = await this.azure.listRepos(project);
    return repositories.map((repository) => ({
      id: repository.id,
      name: repository.name,
      fullName: repository.project
        ? `${repository.project}/${repository.name}`
        : repository.name,
      namespace: repository.project,
      defaultBranch: null,
      url: repository.url || null,
      isPrivate: true,
    }));
  }

  listBranches(source: GitSourceConfig): Promise<string[]> {
    this.assertAzureSource(source);
    return this.azure.listBranches(source.project ?? source.namespace, source.repositoryId ?? source.repo);
  }

  checkout(source: GitSourceConfig) {
    this.assertAzureSource(source);
    const project = source.project ?? source.namespace;
    if (!project) {
      throw new IntegrationError('invalid_request', 'Azure DevOps project is required', {
        provider: this.provider,
      });
    }
    return this.azure.checkoutRepo(project, source.repositoryId ?? source.repo, source.branch);
  }

  triggerPipeline(source: GitSourceConfig, variables?: Record<string, string>) {
    this.assertAzureSource(source);
    const azureVariables: AzurePipelineVariables | undefined =
      variables?.targetOrgAlias && variables.targetOrgUsername && variables.instanceUrl
        ? {
            targetOrgAlias: variables.targetOrgAlias,
            targetOrgUsername: variables.targetOrgUsername,
            instanceUrl: variables.instanceUrl,
          }
        : undefined;
    return this.azure.triggerPipeline(
      source.project ?? source.namespace ?? '',
      source.repositoryId ?? source.repo,
      source.branch,
      azureVariables,
    );
  }

  private assertAzureSource(source: GitSourceConfig): void {
    if (source.provider !== this.provider) {
      throw new IntegrationError(
        'invalid_request',
        `Azure adapter cannot handle provider "${source.provider}"`,
        { provider: this.provider },
      );
    }
  }
}

@Injectable()
export class AzureWorkItemAdapter implements WorkItemAdapter {
  readonly provider = 'azure_boards' as const;
  readonly capabilities = AZURE_WORK_ITEM_CAPABILITIES;

  constructor(private readonly azure: AzureWorkItemsService) {}

  async getConnectionStatus(_context?: AdapterContext): Promise<WorkItemConnectionStatus> {
    const info = await this.azure.getConnectionInfo();
    return {
      provider: this.provider,
      state: info ? 'connected' : 'disconnected',
      connected: Boolean(info),
      // AzureWorkItemsService intentionally exposes no credential-source detail.
      source: null,
      displayName: info?.orgSlug ?? null,
      namespace: info?.orgSlug ?? null,
      error: null,
      capabilities: this.capabilities,
    };
  }

  async listProjects(_context?: AdapterContext): Promise<WorkItemProject[]> {
    const projects = await this.azure.listProjects();
    return projects.map((project) => ({
      id: project.id,
      key: project.name,
      name: project.name,
      description: project.description,
      url: null,
    }));
  }

  async queryWorkItems(query: WorkItemQuery): Promise<WorkItemSummary[]> {
    const items = await this.azure.queryWorkItems({
      project: query.project,
      assigneeEmail: query.assigneeEmail,
      types: query.types,
    });
    return items
      .filter((item) => !query.state || item.state.toLowerCase() === query.state.toLowerCase())
      .filter((item) => !query.text || item.title.toLowerCase().includes(query.text.toLowerCase()))
      .map((item) => this.toSummary(item));
  }

  async getWorkItem(id: string, project?: string): Promise<WorkItemDetail> {
    return this.toDetail(await this.azure.getWorkItem(this.numericId(id), project));
  }

  async getComments(id: string, project?: string): Promise<WorkItemComment[]> {
    const comments = await this.azure.getComments(this.numericId(id), project);
    return comments.map((comment) => ({
      id: String(comment.id),
      body: comment.text,
      author: this.user(comment.author),
      createdAt: comment.createdDate,
      updatedAt: comment.modifiedDate,
    }));
  }

  async getStateOptions(id: string, project?: string): Promise<WorkItemState[]> {
    const item = await this.azure.getWorkItem(this.numericId(id), project);
    const states = await this.azure.getStateOptions(item.type, item.project);
    return states.map((state) => this.state(state.name, state.category));
  }

  async getHistory(id: string, project?: string): Promise<WorkItemHistoryEvent[]> {
    const history = await this.azure.getHistory(this.numericId(id), project);
    return history.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      version: event.rev,
      actor: this.user(event.revisedBy),
      occurredAt: event.revisedDate,
      summary: event.summary,
      changes: event.changes.map((change) => ({
        field: change.field,
        fieldRef: change.fieldRef,
        oldValue: change.oldValue,
        newValue: change.newValue,
      })),
      body: event.body,
    }));
  }

  async listAttachments(id: string, project?: string): Promise<WorkItemAttachment[]> {
    const attachments = await this.azure.listAttachments(this.numericId(id), project);
    return attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      sizeBytes: attachment.sizeBytes,
      url: attachment.url,
      contentType: attachment.contentType,
      createdAt: null,
      author: null,
    }));
  }

  async getAttachmentContent(
    id: string,
    attachmentId: string,
    project?: string,
  ): Promise<AttachmentContent> {
    const context = await this.azure.resolveProject(project);
    // Resolve the item first to preserve the legacy route's project/access semantics.
    await this.azure.getWorkItem(this.numericId(id), context.project);
    return this.azure.getAttachmentContent(context.orgSlug, attachmentId, context.pat);
  }

  async updateState(id: string, state: string, project?: string): Promise<WorkItemDetail> {
    return this.toDetail(await this.azure.updateState(this.numericId(id), state, project));
  }

  private numericId(id: string): number {
    const parsed = Number(id);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new IntegrationError('invalid_request', `Invalid Azure Boards work item id "${id}"`, {
        provider: this.provider,
      });
    }
    return parsed;
  }

  private project(name: string): WorkItemProject {
    return { id: name, key: name, name, description: null, url: null };
  }

  private user(value: string): WorkItemUser {
    const email = value.match(/<([^>]+)>/)?.[1] ?? null;
    const displayName = value.replace(/\s*<[^>]+>\s*$/, '').trim() || value || 'Unknown';
    return { id: email, displayName, email, avatarUrl: null };
  }

  private state(name: string, providerCategory?: string): WorkItemState {
    const normalized = (providerCategory ?? name).toLowerCase();
    const category =
      normalized.includes('progress') || normalized.includes('active')
        ? 'in_progress'
        : normalized.includes('resolve') || normalized.includes('complete')
          ? 'resolved'
          : normalized.includes('close') || normalized.includes('done')
            ? 'closed'
            : normalized.includes('remove')
              ? 'removed'
              : normalized.includes('new') || normalized.includes('proposed')
                ? 'new'
                : 'unknown';
    return { id: name, name, category, color: null };
  }

  private toSummary(item: {
    id: number;
    title: string;
    type: string;
    state: string;
    priority: number | null;
    assignedTo: string | null;
    changedDate: string;
    createdDate: string;
    tags: string[];
    webUrl: string;
    project: string;
  }): WorkItemSummary {
    return {
      id: String(item.id),
      provider: this.provider,
      project: this.project(item.project),
      title: item.title,
      type: item.type,
      state: this.state(item.state),
      priority: item.priority,
      assignee: item.assignedTo ? this.user(item.assignedTo) : null,
      author: null,
      labels: item.tags,
      createdAt: item.createdDate,
      updatedAt: item.changedDate,
      url: item.webUrl,
    };
  }

  private toDetail(item: Awaited<ReturnType<AzureWorkItemsService['getWorkItem']>>): WorkItemDetail {
    return {
      ...this.toSummary(item),
      description: item.description,
      acceptanceCriteria: item.acceptanceCriteria,
      reproSteps: item.reproSteps,
      severity: item.severity,
      areaPath: item.areaPath,
      iterationPath: item.iterationPath,
      relations: item.relations,
      customFields: {},
    };
  }
}
