import type {
  GitSourceConfig,
  IntegrationCapabilities,
  Namespace,
  Repository,
  ScmCapabilities,
  ScmConnectionStatus,
  ScmProvider,
  WorkItemAttachment,
  WorkItemComment,
  WorkItemConnectionStatus,
  WorkItemDetail,
  WorkItemHistoryEvent,
  WorkItemProject,
  WorkItemProvider,
  WorkItemState,
  WorkItemSummary,
} from '@sfcc/shared';

export const SCM_ADAPTERS = Symbol('SCM_ADAPTERS');
export const WORK_ITEM_ADAPTERS = Symbol('WORK_ITEM_ADAPTERS');

export interface AdapterContext {
  connectionId?: string;
  /** Authenticated app actor, used only for app-managed ownership/audit metadata. */
  actorId?: string;
}

export interface RepositoryQuery extends AdapterContext {
  namespace?: string;
  project?: string;
}

export interface CheckoutResult {
  workspaceDir: string;
  cleanup: () => Promise<void>;
}

export interface ScmAdapter {
  readonly provider: ScmProvider;
  readonly capabilities: ScmCapabilities;
  getConnectionStatus(context?: AdapterContext): Promise<ScmConnectionStatus>;
  listNamespaces(context?: AdapterContext): Promise<Namespace[]>;
  listRepositories(query?: RepositoryQuery): Promise<Repository[]>;
  listBranches(source: GitSourceConfig): Promise<string[]>;
  checkout(source: GitSourceConfig): Promise<CheckoutResult>;
  triggerPipeline?(
    source: GitSourceConfig,
    variables?: Record<string, string>,
  ): Promise<Record<string, unknown>>;
}

export interface WorkItemQuery extends AdapterContext {
  project?: string;
  assigneeEmail?: string;
  /** Canonical provider identity. Prefer this over email-based matching. */
  assigneeId?: string;
  assigneeLogin?: string;
  types?: readonly string[];
  state?: string;
  text?: string;
  /** Provider-native filter. Jira uses JQL; adapters must still parameterize app filters. */
  jql?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface WorkItemCreateInput extends AdapterContext {
  project: string;
  title: string;
  description?: string;
  type?: string;
  assigneeLogins?: readonly string[];
  assigneeId?: string | null;
  priority?: string | number | null;
  severity?: string | null;
  area?: string | null;
  iteration?: string | null;
  components?: readonly string[];
  labels?: readonly string[];
  state?: string;
  customFields?: Record<string, string | number | null>;
}

export interface WorkItemUpdateInput extends AdapterContext {
  project?: string;
  title?: string;
  description?: string | null;
  type?: string | null;
  assigneeLogins?: readonly string[];
  assigneeId?: string | null;
  priority?: string | number | null;
  severity?: string | null;
  area?: string | null;
  iteration?: string | null;
  components?: readonly string[];
  labels?: readonly string[];
  state?: string;
  customFields?: Record<string, string | number | null>;
}

export interface WorkItemMutationResult {
  id: string;
  updated: boolean;
}

export interface WorkItemOverview {
  project: WorkItemProject;
  total: number;
  byState: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface AttachmentContent {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

export interface WorkItemUpload {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

export interface WorkItemAdapter {
  readonly provider: WorkItemProvider;
  readonly capabilities: IntegrationCapabilities;
  getConnectionStatus(context?: AdapterContext): Promise<WorkItemConnectionStatus>;
  listProjects(context?: AdapterContext): Promise<WorkItemProject[]>;
  getOverview?(project: string, context?: AdapterContext): Promise<WorkItemOverview>;
  queryWorkItems(query: WorkItemQuery): Promise<WorkItemSummary[]>;
  getWorkItem(id: string, project?: string, context?: AdapterContext): Promise<WorkItemDetail>;
  getComments(id: string, project?: string, context?: AdapterContext): Promise<WorkItemComment[]>;
  getStateOptions(id: string, project?: string, context?: AdapterContext): Promise<WorkItemState[]>;
  getHistory(id: string, project?: string, context?: AdapterContext): Promise<WorkItemHistoryEvent[]>;
  listAttachments(id: string, project?: string, context?: AdapterContext): Promise<WorkItemAttachment[]>;
  getAttachmentContent?(
    id: string,
    attachmentId: string,
    project?: string,
    context?: AdapterContext,
  ): Promise<AttachmentContent>;
  createWorkItem?(input: WorkItemCreateInput): Promise<WorkItemDetail>;
  updateWorkItem?(id: string, input: WorkItemUpdateInput): Promise<WorkItemDetail>;
  addComment?(id: string, body: string, project?: string, context?: AdapterContext): Promise<WorkItemComment>;
  listIssueTypes?(project: string, context?: AdapterContext): Promise<string[]>;
  listAssignees?(project: string, context?: AdapterContext): Promise<import('@sfcc/shared').WorkItemUser[]>;
  listUsers?(project?: string, query?: string, context?: AdapterContext): Promise<import('@sfcc/shared').WorkItemUser[]>;
  uploadAttachment?(
    id: string,
    upload: WorkItemUpload,
    project?: string,
    context?: AdapterContext,
  ): Promise<WorkItemAttachment>;
  listLabels?(project: string, context?: AdapterContext): Promise<string[]>;
  listSubIssues?(id: string, project?: string, context?: AdapterContext): Promise<WorkItemSummary[]>;
  addSubIssue?(id: string, subIssueId: string, project?: string, context?: AdapterContext): Promise<WorkItemMutationResult>;
  updateState?(id: string, state: string, project?: string, context?: AdapterContext): Promise<WorkItemDetail>;
}

export const DEFAULT_SCM_CAPABILITIES: ScmCapabilities = {
  repositories: true,
  branches: true,
  checkout: true,
  pipelines: false,
  pullRequests: false,
  webhooks: false,
};

export const DEFAULT_WORK_ITEM_CAPABILITIES: IntegrationCapabilities = {
  read: true,
  write: false,
  create: false,
  update: false,
  comments: false,
  webhooks: false,
  attachments: false,
  attachmentUploads: false,
  history: false,
  stateTransitions: false,
  issueTypes: false,
  users: false,
  labels: false,
  subIssues: false,
};
