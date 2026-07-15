import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@sfcc/db';
import {
  resolveCopilotTiers,
  workItemProviderSchema,
  type IntegrationCapabilities,
  type WorkItemComment,
  type WorkItemDetail,
  type WorkItemHistoryEvent,
  type WorkItemProject,
  type WorkItemProvider,
  type WorkItemSummary,
} from '@sfcc/shared';
import type {
  AdapterContext,
  WorkItemAdapter,
  WorkItemCreateInput,
  WorkItemUpload,
  WorkItemUpdateInput,
} from '../../integrations/foundation/adapter.contracts';
import { IntegrationError } from '../../integrations/foundation/adapter.errors';
import { WorkItemAdapterRegistry } from '../../integrations/foundation/adapter.registry';
import { getAppUser } from '../auth/app-user.service';
import { DefectInvestigationAgent } from '../agents/defect-investigation.agent';

type Query = Record<string, string | undefined>;

interface ResolvedProvider {
  provider: WorkItemProvider;
  adapter: WorkItemAdapter;
  bindingId: string | null;
  connectionId: string | null;
  project: string | undefined;
  legacy: boolean;
}

interface AccessIdentity {
  externalUserId: string;
  externalLogin: string | null;
  email: string | null;
}

interface BindingRow {
  id: string;
  externalProjectId: string;
  projectKey: string | null;
  repositoryName?: string | null;
  workItemConnectionId: string | null;
  workItemConnection: { provider: WorkItemProvider } | null;
}

@Injectable()
export class DefectsService {
  constructor(
    private readonly adapters: WorkItemAdapterRegistry,
    private readonly defectInvestigationAgent: DefectInvestigationAgent,
  ) {}

  async listContexts(userId: string, isAdmin: boolean) {
    const user = await this.requireUser(userId);
    const [connections, bindings, identities] = await Promise.all([
      prisma.workItemConnection.findMany({
        select: {
          id: true,
          provider: true,
          displayName: true,
          namespace: true,
          baseUrl: true,
          status: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.projectBinding.findMany({
        where: { workItemConnectionId: { not: null } },
        select: {
          id: true,
          workItemConnectionId: true,
          externalProjectId: true,
          projectKey: true,
          repositoryName: true,
          workItemConnection: { select: { provider: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      isAdmin
        ? Promise.resolve([])
        : prisma.externalIdentityBinding.findMany({
            where: { appUserId: user.id },
            select: { workItemConnectionId: true },
          }),
    ]);
    const identityConnections = new Set(
      identities.map((identity) => identity.workItemConnectionId),
    );
    const options = await Promise.all(connections.map(async (connection) => {
      const adapter = this.adapters.get(connection.provider);
      const status = await adapter.getConnectionStatus({ connectionId: connection.id })
        .catch(() => null);
      return {
        id: connection.id,
        provider: connection.provider,
        displayName: connection.displayName,
        namespace: connection.namespace,
        baseUrl: connection.baseUrl,
        status: status?.state ?? connection.status,
        capabilities: status?.capabilities ?? adapter.capabilities,
        identityBound:
          isAdmin ||
          connection.provider === 'azure_boards' ||
          identityConnections.has(connection.id),
      };
    }));
    return {
      connections: options,
      bindings: bindings.flatMap((binding) =>
        binding.workItemConnectionId &&
        binding.workItemConnection &&
        (isAdmin ||
          binding.workItemConnection.provider === 'azure_boards' ||
          identityConnections.has(binding.workItemConnectionId))
          ? [{
              id: binding.id,
              connectionId: binding.workItemConnectionId,
              provider: binding.workItemConnection.provider,
              externalProjectId: binding.externalProjectId,
              projectKey: binding.projectKey,
              repositoryName: binding.repositoryName,
            }]
          : []),
      isAdmin,
    };
  }

  async listProjects(userId: string, isAdmin: boolean, query: Query = {}) {
    const user = await this.requireUser(userId);
    const resolved = await this.resolveProvider(query);
    await this.identityFor(user.id, user.email, isAdmin, resolved);
    const context = this.context(resolved);
    const status = await resolved.adapter.getConnectionStatus(context);
    const projects = status.connected || status.state === 'degraded'
      ? await resolved.adapter.listProjects(context)
      : [];
    const canonicalProjects = projects.map((project) => this.projectDto(project, resolved));
    if (resolved.legacy) {
      return {
        projects: projects.map(({ id, name, description }) => ({ id, name, description })),
        defaultProject: resolved.project ?? projects[0]?.name ?? null,
        connected: status.connected,
        orgSlug: status.namespace,
      };
    }
    return {
      projects: canonicalProjects,
      defaultProject: resolved.project ?? projects[0]?.key ?? projects[0]?.id ?? null,
      connected: status.connected,
      provider: resolved.provider,
      capabilities: resolved.adapter.capabilities,
      bindingId: resolved.bindingId,
      connectionId: resolved.connectionId,
    };
  }

  async getOverview(userId: string, isAdmin: boolean, query: Query = {}) {
    const user = await this.requireUser(userId);
    const resolved = await this.resolveProvider(query);
    const identity = await this.identityFor(user.id, user.email, isAdmin, resolved);
    const status = await resolved.adapter.getConnectionStatus(this.context(resolved));
    const items = status.connected || status.state === 'degraded'
      ? await this.authorizedQuery(resolved, identity, isAdmin, query)
      : [];
    const counts = this.overviewCounts(items);
    if (resolved.legacy) {
      return {
        ...counts,
        connected: status.connected,
        orgSlug: status.namespace,
        project: resolved.project ?? items[0]?.project.name ?? null,
        assigneeEmail: user.email,
        isAdminView: isAdmin,
      };
    }
    return {
      ...counts,
      provider: resolved.provider,
      capabilities: resolved.adapter.capabilities,
      bindingId: resolved.bindingId,
      connectionId: resolved.connectionId,
      project: resolved.project ?? null,
      assigneeExternalId: identity?.externalUserId ?? null,
      isAdminView: isAdmin,
    };
  }

  async listWorkItems(userId: string, isAdmin: boolean, query: Query) {
    const user = await this.requireUser(userId);
    const resolved = await this.resolveProvider(query);
    const identity = await this.identityFor(user.id, user.email, isAdmin, resolved);
    let items = await this.authorizedQuery(resolved, identity, isAdmin, query);

    const state = query.state?.trim().toLowerCase();
    if (state && state !== 'all') {
      const categories =
        state === 'open'
          ? ['new', 'unknown']
          : state === 'active'
            ? ['in_progress']
            : state === 'resolved'
              ? ['resolved', 'closed']
              : [state];
      items = items.filter((item) =>
        item.state.name.toLowerCase() === state || categories.includes(item.state.category));
    }
    const text = (query.q ?? query.text)?.trim().toLowerCase();
    if (text) {
      items = items.filter((item) =>
        item.title.toLowerCase().includes(text) ||
        item.id.toLowerCase().includes(text) ||
        item.labels.some((label) => label.toLowerCase().includes(text)));
    }

    const page = this.positiveInt(query.page, 1);
    const pageSize = Math.min(100, this.positiveInt(query.pageSize, 20));
    const total = items.length;
    items = items.slice((page - 1) * pageSize, page * pageSize);
    return {
      items: resolved.legacy
        ? items.map((item) => this.legacySummary(item))
        : items.map((item) => this.itemDto(item, resolved)),
      total,
      page,
      pageSize,
      ...(resolved.legacy
        ? {}
        : {
            provider: resolved.provider,
            capabilities: resolved.adapter.capabilities,
            bindingId: resolved.bindingId,
            connectionId: resolved.connectionId,
          }),
    };
  }

  async getWorkItem(
    userId: string,
    isAdmin: boolean,
    id: string,
    query: Query = {},
  ) {
    const { item, resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    return resolved.legacy ? this.legacyDetail(item) : this.itemDto(item, resolved);
  }

  async createWorkItem(userId: string, isAdmin: boolean, body: unknown, query: Query = {}) {
    const user = await this.requireUser(userId);
    const input = this.object(body);
    const resolved = await this.resolveProvider({ ...query, project: query.project ?? this.string(input.project) });
    this.capability(resolved, 'create', resolved.adapter.createWorkItem, 'Creating work items');
    const identity = await this.identityFor(user.id, user.email, isAdmin, resolved);
    const title = this.string(input.title);
    const project = resolved.project ?? this.string(input.project);
    if (!title || !project) throw new BadRequestException('title and project are required');
    const createInput: WorkItemCreateInput = {
      ...(input as unknown as WorkItemCreateInput),
      title,
      project,
      connectionId: resolved.connectionId ?? undefined,
    };
    if (!isAdmin && identity) {
      createInput.assigneeId = identity.externalUserId;
      if (identity.externalLogin) createInput.assigneeLogins = [identity.externalLogin];
    }
    const item = await resolved.adapter.createWorkItem!(createInput);
    this.assertAccess(item, identity, isAdmin, resolved);
    await this.captureSnapshot(item, resolved);
    return resolved.legacy ? this.legacyDetail(item) : this.itemDto(item, resolved);
  }

  async updateWorkItem(
    userId: string,
    isAdmin: boolean,
    id: string,
    body: unknown,
    query: Query = {},
  ) {
    const authorized = await this.authorizedItem(userId, isAdmin, id, query);
    const { resolved, identity } = authorized;
    this.capability(resolved, 'update', resolved.adapter.updateWorkItem, 'Updating work items');
    const input = this.object(body) as unknown as WorkItemUpdateInput;
    if (!isAdmin && identity) {
      const requestedId = input.assigneeId;
      const requestedLogin = input.assigneeLogins?.[0];
      if (
        (requestedId !== undefined && requestedId !== identity.externalUserId) ||
        (requestedLogin !== undefined &&
          requestedLogin.toLowerCase() !== identity.externalLogin?.toLowerCase())
      ) {
        throw new ForbiddenException('You cannot assign a work item to another provider identity.');
      }
    }
    const item = await resolved.adapter.updateWorkItem!(id, {
      ...input,
      project: resolved.project,
      connectionId: resolved.connectionId ?? undefined,
    });
    this.assertAccess(item, identity, isAdmin, resolved);
    await this.captureSnapshot(item, resolved);
    return resolved.legacy ? this.legacyDetail(item) : this.itemDto(item, resolved);
  }

  async getComments(userId: string, isAdmin: boolean, id: string, query: Query = {}) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    const comments = await resolved.adapter.getComments(
      id,
      resolved.project,
      this.context(resolved),
    );
    return resolved.legacy
      ? comments.map((comment) => this.legacyComment(comment))
      : comments;
  }

  async addComment(
    userId: string,
    isAdmin: boolean,
    id: string,
    body: unknown,
    query: Query = {},
  ) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(resolved, 'comments', resolved.adapter.addComment, 'Adding comments');
    const text = this.string(this.object(body).body);
    if (!text) throw new BadRequestException('body is required');
    const comment = await resolved.adapter.addComment!(
      id,
      text,
      resolved.project,
      this.context(resolved),
    );
    await this.refreshSnapshot(id, resolved);
    return comment;
  }

  async getStates(userId: string, isAdmin: boolean, id: string, query: Query = {}) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    return resolved.adapter.getStateOptions(id, resolved.project, this.context(resolved));
  }

  async updateState(
    userId: string,
    isAdmin: boolean,
    id: string,
    body: unknown,
    query: Query = {},
  ) {
    const { resolved, identity } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(resolved, 'stateTransitions', resolved.adapter.updateState, 'State transitions');
    const state = this.string(this.object(body).state);
    if (!state) throw new BadRequestException('state is required');
    const item = await resolved.adapter.updateState!(
      id,
      state,
      resolved.project,
      this.context(resolved),
    );
    this.assertAccess(item, identity, isAdmin, resolved);
    await this.captureSnapshot(item, resolved);
    return resolved.legacy ? this.legacyDetail(item) : this.itemDto(item, resolved);
  }

  async getHistory(userId: string, isAdmin: boolean, id: string, query: Query = {}) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(resolved, 'history', true, 'History');
    const events = await resolved.adapter.getHistory(id, resolved.project, this.context(resolved));
    return resolved.legacy ? { events: events.map((event) => this.legacyHistory(event)) } : events;
  }

  async getAttachments(userId: string, isAdmin: boolean, id: string, query: Query = {}) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(resolved, 'attachments', true, 'Attachments');
    const attachments = await resolved.adapter.listAttachments(
      id,
      resolved.project,
      this.context(resolved),
    );
    return {
      attachments,
      ...(resolved.legacy
        ? {}
        : { provider: resolved.provider, capabilities: resolved.adapter.capabilities }),
    };
  }

  async getAttachmentContent(
    userId: string,
    isAdmin: boolean,
    id: string,
    attachmentId: string,
    query: Query = {},
  ) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(
      resolved,
      'attachments',
      resolved.adapter.getAttachmentContent,
      'Attachment downloads',
    );
    const attachments = await resolved.adapter.listAttachments(
      id,
      resolved.project,
      this.context(resolved),
    );
    if (!attachments.some((attachment) => attachment.id === attachmentId)) {
      throw new NotFoundException('Attachment does not belong to this work item');
    }
    return resolved.adapter.getAttachmentContent!(
      id,
      attachmentId,
      resolved.project,
      this.context(resolved),
    );
  }

  async uploadAttachment(
    userId: string,
    isAdmin: boolean,
    id: string,
    upload: WorkItemUpload,
    query: Query = {},
  ) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(
      resolved,
      'attachmentUploads',
      resolved.adapter.uploadAttachment,
      'Attachment uploads',
    );
    if (!upload.fileName || !upload.contentType || !upload.buffer.length) {
      throw new BadRequestException('A non-empty multipart file is required');
    }
    const attachment = await resolved.adapter.uploadAttachment!(
      id,
      upload,
      resolved.project,
      this.context(resolved, userId),
    );
    await this.refreshSnapshot(id, resolved);
    return attachment;
  }

  async deleteAttachment(
    userId: string,
    isAdmin: boolean,
    id: string,
    attachmentId: string,
    query: Query = {},
  ) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(
      resolved,
      'attachments',
      resolved.adapter.deleteAttachment,
      'Attachment deletion',
    );
    await resolved.adapter.deleteAttachment!(
      id,
      attachmentId,
      resolved.project,
      this.context(resolved, userId, isAdmin),
    );
    await this.refreshSnapshot(id, resolved);
    return { deleted: true, id: attachmentId };
  }

  async listTypes(userId: string, isAdmin: boolean, query: Query = {}) {
    const { resolved } = await this.authorizedProject(userId, isAdmin, query);
    this.capability(resolved, 'issueTypes', resolved.adapter.listIssueTypes, 'Issue types');
    const types = await resolved.adapter.listIssueTypes!(
      resolved.project!,
      this.context(resolved),
    );
    return { types, provider: resolved.provider, capabilities: resolved.adapter.capabilities };
  }

  async listUsers(userId: string, isAdmin: boolean, query: Query = {}) {
    const { resolved } = await this.authorizedProject(userId, isAdmin, query);
    this.capability(
      resolved,
      'users',
      resolved.adapter.listUsers ?? resolved.adapter.listAssignees,
      'Users',
    );
    const context = this.context(resolved);
    const users = resolved.adapter.listUsers
      ? await resolved.adapter.listUsers(resolved.project, query.q ?? query.query, context)
      : resolved.adapter.listAssignees
        ? await resolved.adapter.listAssignees(resolved.project!, context)
        : this.unsupported(resolved, 'Users');
    return { users, provider: resolved.provider, capabilities: resolved.adapter.capabilities };
  }

  async listSubIssues(userId: string, isAdmin: boolean, id: string, query: Query = {}) {
    const { resolved, identity } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(resolved, 'subIssues', resolved.adapter.listSubIssues, 'Subissues');
    const items = await resolved.adapter.listSubIssues!(
      id,
      resolved.project,
      this.context(resolved),
    );
    const authorized = isAdmin
      ? items
      : items.filter((item) => this.canAccess(item, identity, resolved));
    return {
      items: authorized.map((item) => this.itemDto(item, resolved)),
      provider: resolved.provider,
      capabilities: resolved.adapter.capabilities,
    };
  }

  async addSubIssue(
    userId: string,
    isAdmin: boolean,
    id: string,
    body: unknown,
    query: Query = {},
  ) {
    const { resolved } = await this.authorizedItem(userId, isAdmin, id, query);
    this.capability(resolved, 'subIssues', resolved.adapter.addSubIssue, 'Subissues');
    const subIssueId = this.string(this.object(body).subIssueId);
    if (!subIssueId) throw new BadRequestException('subIssueId is required');
    await this.authorizedItem(userId, isAdmin, subIssueId, {
      ...query,
      provider: resolved.provider,
      bindingId: resolved.bindingId ?? undefined,
      project: resolved.project,
    });
    const result = await resolved.adapter.addSubIssue!(
      id,
      subIssueId,
      resolved.project,
      this.context(resolved),
    );
    await this.refreshSnapshot(id, resolved);
    return result;
  }

  async investigate(userId: string, isAdmin: boolean, id: string, query: Query = {}) {
    const profile = await getAppUser(userId);
    const { item } = await this.authorizedItem(userId, isAdmin, id, query);
    const prompt = [
      `${item.type} ${item.id}: ${item.title}`,
      item.description ? `Description: ${this.stripHtml(item.description)}` : '',
      item.reproSteps ? `Repro steps: ${this.stripHtml(item.reproSteps)}` : '',
    ].filter(Boolean).join('\n\n');
    const tiers = resolveCopilotTiers(profile ?? { role: 'user', grantedModules: [] });
    const result = await this.defectInvestigationAgent.run(
      prompt,
      {
        workItemId: item.id,
        type: item.type,
        state: item.state.name,
        severity: item.severity,
        project: item.project.key,
      },
      { tiers, mode: 'action' },
    );
    return { workItemId: item.id, ...result };
  }

  private async authorizedProject(userId: string, isAdmin: boolean, query: Query) {
    const user = await this.requireUser(userId);
    const resolved = await this.resolveProvider(query);
    if (!resolved.project) throw new BadRequestException('project or bindingId is required');
    const identity = await this.identityFor(user.id, user.email, isAdmin, resolved);
    return { user, resolved, identity };
  }

  private async authorizedItem(userId: string, isAdmin: boolean, id: string, query: Query) {
    const user = await this.requireUser(userId);
    const resolved = await this.resolveProvider(query);
    const identity = await this.identityFor(user.id, user.email, isAdmin, resolved);
    const liveItem = await resolved.adapter.getWorkItem(
      id,
      resolved.project,
      this.context(resolved),
    );
    this.assertAccess(liveItem, identity, isAdmin, resolved);
    const cached = query.cache === 'true' ? await this.cachedItem(id, resolved) : null;
    const item = cached ?? liveItem;
    await this.captureSnapshot(liveItem, resolved);
    return { user, item, resolved, identity };
  }

  private async authorizedQuery(
    resolved: ResolvedProvider,
    identity: AccessIdentity | null,
    isAdmin: boolean,
    query: Query,
  ): Promise<WorkItemSummary[]> {
    const type = query.type?.trim();
    const items = await resolved.adapter.queryWorkItems({
      connectionId: resolved.connectionId ?? undefined,
      project: resolved.project,
      assigneeEmail:
        !isAdmin && resolved.provider === 'azure_boards' ? identity?.email ?? undefined : undefined,
      assigneeId:
        !isAdmin && resolved.provider !== 'azure_boards'
          ? identity?.externalUserId
          : undefined,
      assigneeLogin:
        !isAdmin && resolved.provider === 'github_issues'
          ? identity?.externalLogin ?? undefined
          : undefined,
      types: type ? [type] : undefined,
      text: query.q ?? query.text,
      pageSize: 100,
    });
    return isAdmin
      ? items
      : items.filter((item) => this.canAccess(item, identity, resolved));
  }

  private async resolveProvider(query: Query): Promise<ResolvedProvider> {
    const bindingId = query.bindingId?.trim();
    let binding: BindingRow | null = null;
    if (bindingId) {
      binding = await prisma.projectBinding.findUnique({
        where: { id: bindingId },
        include: { workItemConnection: { select: { provider: true } } },
      }) as BindingRow | null;
      if (!binding?.workItemConnectionId || !binding.workItemConnection) {
        throw new NotFoundException('Work-item project binding not found');
      }
      if (
        query.connectionId?.trim() &&
        query.connectionId.trim() !== binding.workItemConnectionId
      ) {
        throw new BadRequestException('connectionId does not match bindingId');
      }
    }

    const requested = query.provider?.trim();
    const inferred = binding?.workItemConnection?.provider;
    const parsed = workItemProviderSchema.safeParse(requested || inferred || 'azure_boards');
    if (!parsed.success) throw new BadRequestException(`Unsupported work-item provider "${requested}"`);
    if (inferred && requested && inferred !== parsed.data) {
      throw new BadRequestException('provider does not match bindingId');
    }
    const provider = parsed.data;
    const requestedProject = query.project?.trim();
    const boundProject =
      provider === 'github_issues'
        ? binding?.externalProjectId
        : binding?.projectKey || binding?.externalProjectId;
    if (binding && requestedProject && requestedProject !== boundProject) {
      throw new BadRequestException('project does not match bindingId');
    }
    let connectionId = binding?.workItemConnectionId ?? query.connectionId?.trim() ?? null;
    let project =
      requestedProject ||
      boundProject ||
      undefined;

    if (provider !== 'azure_boards' && !binding && project) {
      const found = await prisma.projectBinding.findFirst({
        where: {
          OR: [{ externalProjectId: project }, { projectKey: project }],
          ...(connectionId ? { workItemConnectionId: connectionId } : {}),
          workItemConnection: { provider },
        },
        include: { workItemConnection: { select: { provider: true } } },
        orderBy: { updatedAt: 'desc' },
      }) as BindingRow | null;
      if (found) {
        binding = found;
        connectionId = found.workItemConnectionId;
        project = provider === 'github_issues'
          ? found.externalProjectId
          : found.projectKey || found.externalProjectId;
      }
    }
    if (provider !== 'azure_boards' && !connectionId) {
      const connection = await prisma.workItemConnection.findFirst({
        where: { provider, status: { in: ['connected', 'degraded'] } },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      });
      connectionId = connection?.id ?? null;
    }
    if (provider !== 'azure_boards' && !connectionId) {
      throw new UnprocessableEntityException({
        code: 'WORK_ITEM_BINDING_REQUIRED',
        message: `A connected ${provider} ProjectBinding or connectionId is required`,
        provider,
      });
    }
    return {
      provider,
      adapter: this.adapters.get(provider),
      bindingId: binding?.id ?? null,
      connectionId,
      project,
      legacy: provider === 'azure_boards' && (query.legacy === 'true' || !requested),
    };
  }

  private async identityFor(
    userId: string,
    email: string,
    isAdmin: boolean,
    resolved: ResolvedProvider,
  ): Promise<AccessIdentity | null> {
    if (isAdmin) return null;
    if (resolved.provider === 'azure_boards') {
      return { externalUserId: email, externalLogin: null, email };
    }
    const binding = await prisma.externalIdentityBinding.findFirst({
      where: {
        workItemConnectionId: resolved.connectionId!,
        appUserId: userId,
      },
      select: { externalUserId: true, externalLogin: true, externalEmail: true },
    });
    if (!binding) {
      throw new ForbiddenException({
        code: 'EXTERNAL_IDENTITY_NOT_BOUND',
        message: `Your account is not bound to a ${resolved.provider} identity`,
        provider: resolved.provider,
      });
    }
    if (resolved.provider === 'github_issues' && !binding.externalLogin) {
      throw new ForbiddenException({
        code: 'EXTERNAL_IDENTITY_LOGIN_MISSING',
        message: 'Your GitHub identity mapping is missing its login',
        provider: resolved.provider,
      });
    }
    return {
      externalUserId: binding.externalUserId,
      externalLogin: binding.externalLogin,
      email: binding.externalEmail,
    };
  }

  private assertAccess(
    item: WorkItemSummary,
    identity: AccessIdentity | null,
    isAdmin: boolean,
    resolved: ResolvedProvider,
  ): void {
    if (!isAdmin && !this.canAccess(item, identity, resolved)) {
      throw new ForbiddenException('You can only access work items assigned to your bound identity.');
    }
  }

  private canAccess(
    item: WorkItemSummary,
    identity: AccessIdentity | null,
    resolved: ResolvedProvider,
  ): boolean {
    if (!identity || !item.assignee) return false;
    if (resolved.provider === 'azure_boards') {
      const email = identity.email?.toLowerCase();
      return Boolean(
        email &&
        (item.assignee.email?.toLowerCase() === email ||
          item.assignee.displayName.toLowerCase().includes(`<${email}>`)),
      );
    }
    return item.assignee.id === identity.externalUserId;
  }

  private capability(
    resolved: ResolvedProvider,
    capability: keyof IntegrationCapabilities,
    implemented: unknown,
    operation: string,
  ): void {
    if (!resolved.adapter.capabilities[capability] || !implemented) {
      this.unsupported(resolved, operation);
    }
  }

  private unsupported(resolved: ResolvedProvider, operation: string): never {
    throw new IntegrationError(
      'unsupported_capability',
      `${operation} are not supported by ${resolved.provider}`,
      { provider: resolved.provider, retryable: false },
    );
  }

  private context(
    resolved: ResolvedProvider,
    actorId?: string,
    isAdmin?: boolean,
  ): AdapterContext {
    return { connectionId: resolved.connectionId ?? undefined, actorId, isAdmin };
  }

  private itemDto<T extends WorkItemSummary>(item: T, resolved: ResolvedProvider): T & {
    externalUrl: string;
    capabilities: IntegrationCapabilities;
  } {
    return {
      ...item,
      provider: resolved.provider,
      capabilities: resolved.adapter.capabilities,
      externalUrl: item.url,
      project: this.projectDto(item.project, resolved),
    };
  }

  private projectDto(project: WorkItemProject, resolved: ResolvedProvider) {
    return {
      ...project,
      provider: resolved.provider,
      capabilities: resolved.adapter.capabilities,
      externalUrl: project.url,
    };
  }

  private async captureSnapshot(item: WorkItemSummary, resolved: ResolvedProvider): Promise<void> {
    if (!resolved.connectionId) return;
    await prisma.workItemSnapshot.upsert({
      where: {
        workItemConnectionId_externalProjectId_externalItemId: {
          workItemConnectionId: resolved.connectionId,
          externalProjectId: item.project.id,
          externalItemId: item.id,
        },
      },
      create: {
        workItemConnectionId: resolved.connectionId,
        externalProjectId: item.project.id,
        externalItemId: item.id,
        version: item.updatedAt,
        state: item.state.name,
        payload: JSON.parse(JSON.stringify(item)) as Prisma.InputJsonValue,
        providerUpdatedAt: this.date(item.updatedAt),
      },
      update: {
        version: item.updatedAt,
        state: item.state.name,
        payload: JSON.parse(JSON.stringify(item)) as Prisma.InputJsonValue,
        providerUpdatedAt: this.date(item.updatedAt),
        capturedAt: new Date(),
      },
    });
  }

  private async refreshSnapshot(id: string, resolved: ResolvedProvider): Promise<void> {
    if (!resolved.connectionId) return;
    const item = await resolved.adapter.getWorkItem(
      id,
      resolved.project,
      this.context(resolved),
    );
    await this.captureSnapshot(item, resolved);
  }

  private async cachedItem(id: string, resolved: ResolvedProvider): Promise<WorkItemDetail | null> {
    if (!resolved.connectionId) return null;
    const snapshot = await prisma.workItemSnapshot.findFirst({
      where: {
        workItemConnectionId: resolved.connectionId,
        externalItemId: id,
      },
      orderBy: { capturedAt: 'desc' },
      select: { payload: true },
    });
    if (!snapshot?.payload || typeof snapshot.payload !== 'object' || Array.isArray(snapshot.payload)) {
      return null;
    }
    const payload = snapshot.payload as Record<string, unknown>;
    return typeof payload.id === 'string' &&
      typeof payload.title === 'string' &&
      payload.state !== null &&
      typeof payload.state === 'object' &&
      payload.project !== null &&
      typeof payload.project === 'object'
      ? payload as unknown as WorkItemDetail
      : null;
  }

  private overviewCounts(items: WorkItemSummary[]) {
    return {
      open: items.filter((item) => item.state.category === 'new' || item.state.category === 'unknown').length,
      inProgress: items.filter((item) => item.state.category === 'in_progress').length,
      resolved: items.filter((item) =>
        ['resolved', 'closed', 'removed'].includes(item.state.category)).length,
      critical: items.filter((item) => (item.priority ?? 99) <= 1).length,
      total: items.length,
    };
  }

  private legacySummary(item: WorkItemSummary) {
    return {
      id: Number(item.id),
      title: item.title,
      type: item.type,
      state: item.state.name,
      priority: item.priority,
      assignedTo: item.assignee
        ? item.assignee.email
          ? `${item.assignee.displayName} <${item.assignee.email}>`
          : item.assignee.displayName
        : null,
      changedDate: item.updatedAt,
      createdDate: item.createdAt,
      tags: item.labels,
      webUrl: item.url,
      project: item.project.name,
    };
  }

  private legacyDetail(item: WorkItemDetail) {
    const { project: _project, state: _state, ...detail } = item;
    return {
      ...this.legacySummary(item),
      description: detail.description,
      reproSteps: detail.reproSteps,
      acceptanceCriteria: detail.acceptanceCriteria,
      areaPath: detail.areaPath,
      iterationPath: detail.iterationPath,
      severity: detail.severity,
      relations: detail.relations,
    };
  }

  private legacyHistory(event: WorkItemHistoryEvent) {
    return {
      id: event.id,
      kind: event.kind,
      rev: event.version,
      revisedBy: event.actor.email
        ? `${event.actor.displayName} <${event.actor.email}>`
        : event.actor.displayName,
      revisedDate: event.occurredAt,
      summary: event.summary,
      changes: event.changes,
      body: event.body,
    };
  }

  private legacyComment(comment: WorkItemComment) {
    return {
      id: Number(comment.id),
      text: comment.body,
      author: comment.author.email
        ? `${comment.author.displayName} <${comment.author.email}>`
        : comment.author.displayName,
      createdDate: comment.createdAt,
      modifiedDate: comment.updatedAt,
    };
  }

  private async requireUser(userId: string) {
    const user = await getAppUser(userId);
    if (!user) throw new NotFoundException('User profile not found');
    return user;
  }

  private object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Request body must be an object');
    }
    return value as Record<string, unknown>;
  }

  private string(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private positiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private date(value: string): Date | null {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
