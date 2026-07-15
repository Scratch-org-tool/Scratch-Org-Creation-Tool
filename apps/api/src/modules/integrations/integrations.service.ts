import { BadRequestException, Injectable } from '@nestjs/common';
import type { GitSourceConfig, ScmProvider, WorkItemProvider } from '@sfcc/shared';
import type {
  WorkItemCreateInput,
  WorkItemQuery,
  WorkItemUpdateInput,
} from '../../integrations/foundation/adapter.contracts';
import {
  ScmAdapterRegistry,
  WorkItemAdapterRegistry,
} from '../../integrations/foundation/adapter.registry';
import { AtlassianConnectionStore } from '../../integrations/atlassian/atlassian-connection.store';
import { JiraWorkItemAdapter } from '../../integrations/jira/jira.adapter';
import { ScmSourceService } from '../../integrations/foundation/scm-source.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly scm: ScmAdapterRegistry,
    private readonly scmSources: ScmSourceService,
    private readonly workItems: WorkItemAdapterRegistry,
    private readonly store: AtlassianConnectionStore,
    private readonly jira: JiraWorkItemAdapter,
  ) {}

  scmStatus(provider: string, connectionId?: string) {
    return this.scm.get(provider as ScmProvider).getConnectionStatus({ connectionId });
  }

  async scmDefaults(provider: string, connectionId?: string) {
    const status = await this.scmStatus(provider, connectionId);
    return {
      provider: status.provider,
      connectionId: status.id ?? connectionId ?? null,
      namespace: status.namespace,
      connected: status.connected,
    };
  }

  namespaces(provider: string, connectionId?: string) {
    return this.scm.get(provider as ScmProvider).listNamespaces({ connectionId });
  }

  repositories(
    provider: string,
    query: { connectionId?: string; namespace?: string; project?: string },
  ) {
    return this.scm.get(provider as ScmProvider).listRepositories(query);
  }

  async branches(provider: string, source: Omit<GitSourceConfig, 'provider'>) {
    const resolved = await this.scmSources.resolve({
      ...source,
      provider: provider as ScmProvider,
    });
    return this.scm.get(provider as ScmProvider).listBranches(resolved);
  }

  workItemStatus(provider: string, connectionId?: string) {
    return this.workItems
      .get(provider as WorkItemProvider)
      .getConnectionStatus({ connectionId });
  }

  projects(provider: string, connectionId?: string) {
    return this.workItems.get(provider as WorkItemProvider).listProjects({ connectionId });
  }

  async sites(provider: string, connectionId?: string) {
    if (provider !== 'jira') throw new BadRequestException('Sites are supported by Jira only');
    const connection = await this.store.getJira(connectionId);
    if (!connection) throw new BadRequestException('No Jira connection is configured');
    return this.jira.listSites(connection.credential, connection.config);
  }

  overview(provider: string, project: string, connectionId?: string) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.getOverview) throw new BadRequestException('Overview is not supported');
    return adapter.getOverview(project, { connectionId });
  }

  query(provider: string, query: WorkItemQuery) {
    return this.workItems.get(provider as WorkItemProvider).queryWorkItems(query);
  }

  detail(provider: string, id: string, project?: string, connectionId?: string) {
    return this.workItems
      .get(provider as WorkItemProvider)
      .getWorkItem(id, project, { connectionId });
  }

  create(provider: string, input: WorkItemCreateInput) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.createWorkItem) throw new BadRequestException('Create is not supported');
    return adapter.createWorkItem(input);
  }

  update(provider: string, id: string, input: WorkItemUpdateInput) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.updateWorkItem) throw new BadRequestException('Update is not supported');
    return adapter.updateWorkItem(id, input);
  }

  comments(provider: string, id: string, project?: string, connectionId?: string) {
    return this.workItems
      .get(provider as WorkItemProvider)
      .getComments(id, project, { connectionId });
  }

  addComment(
    provider: string,
    id: string,
    body: string,
    project?: string,
    connectionId?: string,
  ) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.addComment) throw new BadRequestException('Comments are not writable');
    return adapter.addComment(id, body, project, { connectionId });
  }

  states(provider: string, id: string, project?: string, connectionId?: string) {
    return this.workItems
      .get(provider as WorkItemProvider)
      .getStateOptions(id, project, { connectionId });
  }

  updateState(
    provider: string,
    id: string,
    state: string,
    project?: string,
    connectionId?: string,
  ) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.updateState) throw new BadRequestException('State transitions are not supported');
    return adapter.updateState(id, state, project, { connectionId });
  }

  issueTypes(provider: string, project: string, connectionId?: string) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.listIssueTypes) throw new BadRequestException('Issue types are not supported');
    return adapter.listIssueTypes(project, { connectionId });
  }

  labels(provider: string, project: string, connectionId?: string) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.listLabels) throw new BadRequestException('Labels are not supported');
    return adapter.listLabels(project, { connectionId });
  }

  users(provider: string, project?: string, query?: string, connectionId?: string) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (adapter.listUsers) return adapter.listUsers(project, query, { connectionId });
    if (adapter.listAssignees && project) {
      return adapter.listAssignees(project, { connectionId });
    }
    throw new BadRequestException('Users are not supported');
  }

  history(provider: string, id: string, project?: string, connectionId?: string) {
    return this.workItems
      .get(provider as WorkItemProvider)
      .getHistory(id, project, { connectionId });
  }

  subIssues(provider: string, id: string, project?: string, connectionId?: string) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.listSubIssues) throw new BadRequestException('Subissues are not supported');
    return adapter.listSubIssues(id, project, { connectionId });
  }

  addSubIssue(
    provider: string,
    id: string,
    subIssueId: string,
    project?: string,
    connectionId?: string,
  ) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.addSubIssue) throw new BadRequestException('Subissues are not writable');
    return adapter.addSubIssue(id, subIssueId, project, { connectionId });
  }

  attachments(provider: string, id: string, project?: string, connectionId?: string) {
    return this.workItems
      .get(provider as WorkItemProvider)
      .listAttachments(id, project, { connectionId });
  }

  attachmentContent(
    provider: string,
    id: string,
    attachmentId: string,
    project?: string,
    connectionId?: string,
  ) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.getAttachmentContent) {
      throw new BadRequestException('Attachment downloads are not supported');
    }
    return adapter.getAttachmentContent(id, attachmentId, project, { connectionId });
  }

  uploadAttachment(
    actorId: string,
    provider: string,
    id: string,
    input: { fileName: string; contentType: string; base64: string },
    project?: string,
    connectionId?: string,
  ) {
    const adapter = this.workItems.get(provider as WorkItemProvider);
    if (!adapter.uploadAttachment) {
      throw new BadRequestException('Attachment uploads are not supported');
    }
    if (!input.fileName || !input.contentType || !input.base64) {
      throw new BadRequestException('fileName, contentType, and base64 are required');
    }
    const buffer = Buffer.from(input.base64, 'base64');
    if (!buffer.length || buffer.length > 25 * 1024 * 1024) {
      throw new BadRequestException('Attachment must be between 1 byte and 25 MB');
    }
    return adapter.uploadAttachment(
      id,
      { fileName: input.fileName, contentType: input.contentType, buffer },
      project,
      { connectionId, actorId, isAdmin: true },
    );
  }
}
