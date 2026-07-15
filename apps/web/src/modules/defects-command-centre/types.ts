import type {
  IntegrationCapabilities,
  WorkItemAttachment,
  WorkItemComment,
  WorkItemDetail,
  WorkItemHistoryEvent,
  WorkItemProject,
  WorkItemProvider,
  WorkItemState,
  WorkItemSummary,
  WorkItemUser,
} from '@sfcc/shared';

export type DefectStatusFilter = 'all' | 'open' | 'active' | 'resolved';

export type OptimisticWorkItemComment = WorkItemComment & {
  optimisticState?: 'pending';
};

export type {
  IntegrationCapabilities,
  WorkItemAttachment,
  WorkItemComment,
  WorkItemDetail,
  WorkItemHistoryEvent,
  WorkItemProject,
  WorkItemProvider,
  WorkItemState,
  WorkItemSummary,
  WorkItemUser,
};

export interface DefectsOverview {
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  total: number;
  provider: WorkItemProvider;
  capabilities: IntegrationCapabilities;
  bindingId: string | null;
  connectionId: string | null;
  project: string | null;
  assigneeExternalId: string | null;
  isAdminView: boolean;
}

export interface DefectsProjectsResponse {
  projects: WorkItemProject[];
  defaultProject: string | null;
  connected: boolean;
  provider: WorkItemProvider;
  capabilities: IntegrationCapabilities;
  bindingId: string | null;
  connectionId: string | null;
}

export interface DefectsWorkItemsResponse {
  items: WorkItemSummary[];
  total: number;
  page: number;
  pageSize: number;
  provider: WorkItemProvider;
  capabilities: IntegrationCapabilities;
  bindingId: string | null;
  connectionId: string | null;
}

export interface WorkItemConnectionOption {
  id: string | null;
  provider: WorkItemProvider;
  displayName: string;
  namespace: string | null;
  baseUrl: string | null;
  status: string;
  capabilities: IntegrationCapabilities;
  identityBound: boolean;
}

export interface ProjectBindingOption {
  id: string;
  connectionId: string;
  provider: WorkItemProvider;
  externalProjectId: string;
  projectKey: string | null;
  repositoryName: string | null;
}

export interface DefectsContextsResponse {
  connections: WorkItemConnectionOption[];
  bindings: ProjectBindingOption[];
  isAdmin: boolean;
}

export interface WorkItemMutationInput {
  title?: string;
  description?: string | null;
  type?: string | null;
  assigneeId?: string | null;
  assigneeLogins?: string[];
  priority?: string | number | null;
  severity?: string | null;
  area?: string | null;
  iteration?: string | null;
  components?: string[];
  labels?: string[];
}

export interface DefectInvestigationResult {
  workItemId: string;
  content: string;
  reasoning?: string;
  action?: { type: string; query: string; evidenceCount: number };
}
