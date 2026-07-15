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
}

export interface WorkItemCreateInput extends AdapterContext {
  project: string;
  title: string;
  description?: string;
  type?: string;
  assigneeLogins?: readonly string[];
  priority?: string | number | null;
  severity?: string | null;
  area?: string | null;
  iteration?: string | null;
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
  priority?: string | number | null;
  severity?: string | null;
  area?: string | null;
  iteration?: string | null;
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

export interface WorkItemAdapter {
  readonly provider: WorkItemProvider;
  readonly capabilities: IntegrationCapabilities;
  getConnectionStatus(context?: AdapterContext): Promise<WorkItemConnectionStatus>;
  listProjects(context?: AdapterContext): Promise<WorkItemProject[]>;
  getOverview?(project: string): Promise<WorkItemOverview>;
  queryWorkItems(query: WorkItemQuery): Promise<WorkItemSummary[]>;
  getWorkItem(id: string, project?: string): Promise<WorkItemDetail>;
  getComments(id: string, project?: string): Promise<WorkItemComment[]>;
  getStateOptions(id: string, project?: string): Promise<WorkItemState[]>;
  getHistory(id: string, project?: string): Promise<WorkItemHistoryEvent[]>;
  listAttachments(id: string, project?: string): Promise<WorkItemAttachment[]>;
  getAttachmentContent?(
    id: string,
    attachmentId: string,
    project?: string,
  ): Promise<AttachmentContent>;
  createWorkItem?(input: WorkItemCreateInput): Promise<WorkItemDetail>;
  updateWorkItem?(id: string, input: WorkItemUpdateInput): Promise<WorkItemDetail>;
  addComment?(id: string, body: string, project?: string): Promise<WorkItemComment>;
  listIssueTypes?(project: string): Promise<string[]>;
  listAssignees?(project: string): Promise<import('@sfcc/shared').WorkItemUser[]>;
  listLabels?(project: string): Promise<string[]>;
  listSubIssues?(id: string, project?: string): Promise<WorkItemSummary[]>;
  addSubIssue?(id: string, subIssueId: string, project?: string): Promise<WorkItemMutationResult>;
  updateState?(id: string, state: string, project?: string): Promise<WorkItemDetail>;
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
  webhooks: false,
  attachments: false,
  history: false,
  stateTransitions: false,
};
