import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  defectsProjectQuerySchema,
  defectsWorkItemsQuerySchema,
  updateWorkItemStateSchema,
  type DefectsOverview,
  type DefectsProjectsResponse,
  type DefectsWorkItemsResponse,
} from '@sfcc/shared';
import { AzureWorkItemsService } from '../../integrations/azure/azure-work-items.service';
import { getAppUser } from '../auth/app-user.service';
import { DefectInvestigationAgent } from '../agents/defect-investigation.agent';
import { resolveCopilotTiers } from '@sfcc/shared';

const RESOLVED_STATES = new Set(['Done', 'Closed', 'Resolved', 'Completed', 'Removed']);
const IN_PROGRESS_STATES = new Set([
  'Active',
  'In Progress',
  'Committed',
  'In Review',
  'In Test',
  'Testing',
]);

@Injectable()
export class DefectsService {
  // FUTURE: Email alerts when assigned work items change — see docs/developer-board-email-alerts.md
  // Planned: ADO service hook or polling + NotificationService; not wired in v1.

  constructor(
    private readonly azureWorkItems: AzureWorkItemsService,
    private readonly defectInvestigationAgent: DefectInvestigationAgent,
  ) {}

  async listProjects(): Promise<DefectsProjectsResponse> {
    try {
      const creds = await this.azureWorkItems.getConnectionInfo();
      if (!creds) {
        return { projects: [], defaultProject: null, connected: false, orgSlug: null };
      }

      const [projects, defaultProject] = await Promise.all([
        this.azureWorkItems.listProjects(),
        this.azureWorkItems.resolveDefaultProject(),
      ]);

      return {
        projects,
        defaultProject: defaultProject ?? projects[0]?.name ?? null,
        connected: true,
        orgSlug: creds.orgSlug,
      };
    } catch (err) {
      if (this.isAzureNotConnected(err)) {
        return { projects: [], defaultProject: null, connected: false, orgSlug: null };
      }
      if (err instanceof ForbiddenException || err instanceof UnprocessableEntityException) {
        const creds = await this.azureWorkItems.getConnectionInfo().catch(() => null);
        return {
          projects: [],
          defaultProject: null,
          connected: Boolean(creds),
          orgSlug: creds?.orgSlug ?? null,
        };
      }
      throw err;
    }
  }

  async getOverview(userId: string, isAdmin: boolean, projectQuery?: unknown): Promise<DefectsOverview> {
    const user = await this.requireUser(userId);
    const { project: projectParam } = defectsProjectQuerySchema.parse(projectQuery ?? {});
    let connected = true;
    let orgSlug: string | null = null;
    let project: string | null = null;
    let items: Awaited<ReturnType<AzureWorkItemsService['queryWorkItems']>> = [];

    try {
      const ctx = await this.azureWorkItems.resolveProject(projectParam);
      orgSlug = ctx.orgSlug;
      project = ctx.project;
      items = await this.azureWorkItems.queryWorkItems({
        project: projectParam,
        assigneeEmail: isAdmin ? undefined : user.email,
      });
    } catch (err) {
      if (this.isAzureNotConnected(err) || this.isProjectRequired(err)) {
        connected = !this.isAzureNotConnected(err);
      } else {
        throw err;
      }
    }

    return {
      open: items.filter((i) => !RESOLVED_STATES.has(i.state) && !IN_PROGRESS_STATES.has(i.state)).length,
      inProgress: items.filter((i) => IN_PROGRESS_STATES.has(i.state)).length,
      resolved: items.filter((i) => RESOLVED_STATES.has(i.state)).length,
      critical: items.filter((i) => (i.priority ?? 99) <= 1).length,
      total: items.length,
      connected,
      orgSlug,
      project,
      assigneeEmail: user.email,
      isAdminView: isAdmin,
    };
  }

  async listWorkItems(
    userId: string,
    isAdmin: boolean,
    query: unknown,
  ): Promise<DefectsWorkItemsResponse> {
    const user = await this.requireUser(userId);
    const parsed = defectsWorkItemsQuerySchema.parse(query);

    let items = await this.azureWorkItems.queryWorkItems({
      project: parsed.project,
      assigneeEmail: isAdmin ? undefined : user.email,
      types: parsed.type ? [parsed.type] : undefined,
    });

    if (parsed.state && parsed.state !== 'all') {
      if (parsed.state === 'resolved') {
        items = items.filter((i) => RESOLVED_STATES.has(i.state));
      } else if (parsed.state === 'active') {
        items = items.filter((i) => IN_PROGRESS_STATES.has(i.state));
      } else if (parsed.state === 'open') {
        items = items.filter(
          (i) => !RESOLVED_STATES.has(i.state) && !IN_PROGRESS_STATES.has(i.state),
        );
      } else {
        items = items.filter((i) => i.state.toLowerCase() === parsed.state!.toLowerCase());
      }
    }

    if (parsed.q?.trim()) {
      const q = parsed.q.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          String(i.id).includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    const total = items.length;
    const start = (parsed.page - 1) * parsed.pageSize;
    const pageItems = items.slice(start, start + parsed.pageSize);

    return {
      items: pageItems,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  async getWorkItem(userId: string, isAdmin: boolean, id: number, project?: string) {
    const user = await this.requireUser(userId);
    const item = await this.azureWorkItems.getWorkItem(id, project);
    this.assertCanAccess(user.email, isAdmin, item.assignedTo);
    return item;
  }

  async getComments(userId: string, isAdmin: boolean, id: number, project?: string) {
    const item = await this.getWorkItem(userId, isAdmin, id, project);
    return this.azureWorkItems.getComments(id, item.project);
  }

  async getStates(userId: string, isAdmin: boolean, id: number, project?: string) {
    const item = await this.getWorkItem(userId, isAdmin, id, project);
    return this.azureWorkItems.getStateOptions(item.type, item.project);
  }

  async getHistory(userId: string, isAdmin: boolean, id: number, project?: string) {
    const item = await this.getWorkItem(userId, isAdmin, id, project);
    return this.azureWorkItems.getHistory(id, item.project);
  }

  async getAttachments(userId: string, isAdmin: boolean, id: number, project?: string) {
    const item = await this.getWorkItem(userId, isAdmin, id, project);
    const attachments = await this.azureWorkItems.listAttachments(id, item.project);
    return { attachments };
  }

  async getAttachmentContent(
    userId: string,
    isAdmin: boolean,
    id: number,
    attachmentId: string,
    project?: string,
  ) {
    const item = await this.getWorkItem(userId, isAdmin, id, project);
    const { orgSlug, pat } = await this.azureWorkItems.resolveProject(item.project);
    return this.azureWorkItems.getAttachmentContent(orgSlug, attachmentId, pat);
  }

  async updateState(userId: string, isAdmin: boolean, id: number, body: unknown, project?: string) {
    const user = await this.requireUser(userId);
    const parsed = updateWorkItemStateSchema.parse(body);
    const item = await this.azureWorkItems.getWorkItem(id, project);
    this.assertCanAccess(user.email, isAdmin, item.assignedTo);
    return this.azureWorkItems.updateState(id, parsed.state, item.project);
  }

  async investigate(userId: string, isAdmin: boolean, id: number, project?: string) {
    const user = await this.requireUser(userId);
    const profile = await getAppUser(userId);
    const item = await this.azureWorkItems.getWorkItem(id, project);
    this.assertCanAccess(user.email, isAdmin, item.assignedTo);

    const query = [
      `Defect #${item.id}: ${item.title}`,
      item.description ? `Description: ${this.stripHtml(item.description)}` : '',
      item.reproSteps ? `Repro steps: ${this.stripHtml(item.reproSteps)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const tiers = resolveCopilotTiers(profile ?? { role: 'user', grantedModules: [] });
    const result = await this.defectInvestigationAgent.run(
      query,
      {
        workItemId: item.id,
        type: item.type,
        state: item.state,
        severity: item.severity,
        project: item.project,
      },
      { tiers, mode: 'action' },
    );

    return {
      workItemId: item.id,
      content: result.content,
      reasoning: result.reasoning,
      action: result.action,
    };
  }

  private async requireUser(userId: string) {
    const user = await getAppUser(userId);
    if (!user) throw new NotFoundException('User profile not found');
    return user;
  }

  private assertCanAccess(email: string, isAdmin: boolean, assignedTo: string | null) {
    if (isAdmin) return;
    if (!this.azureWorkItems.isAssignedToEmail(assignedTo, email)) {
      throw new ForbiddenException('You can only access work items assigned to you.');
    }
  }

  private isAzureNotConnected(err: unknown): boolean {
    if (err instanceof NotFoundException) {
      const response = err.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        return (response as { code: string }).code === 'AZURE_NOT_CONNECTED';
      }
    }
    return false;
  }

  private isProjectRequired(err: unknown): boolean {
    if (err instanceof UnprocessableEntityException) {
      const response = err.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        return (response as { code: string }).code === 'AZURE_PROJECT_REQUIRED';
      }
    }
    return false;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
