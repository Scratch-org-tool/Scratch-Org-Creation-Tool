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
  types?: readonly string[];
  state?: string;
  text?: string;
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
