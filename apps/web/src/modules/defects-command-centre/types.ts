import type {
  AzureWorkItemAttachment,
  AzureWorkItemComment,
  AzureWorkItemDetail,
  AzureWorkItemHistoryEvent,
  AzureWorkItemStateOption,
  AzureWorkItemSummary,
  AzureDevOpsProjectOption,
  DefectsOverview,
  DefectsProjectsResponse,
  DefectsWorkItemsResponse,
} from '@sfcc/shared';

export type DefectStatusFilter = 'all' | 'open' | 'active' | 'resolved';

export type {
  AzureWorkItemAttachment,
  AzureWorkItemComment,
  AzureWorkItemDetail,
  AzureWorkItemHistoryEvent,
  AzureWorkItemHistoryKind,
  AzureWorkItemStateOption,
  AzureWorkItemSummary,
  AzureDevOpsProjectOption,
  DefectsOverview,
  DefectsProjectsResponse,
  DefectsWorkItemsResponse,
};

export interface DefectInvestigationResult {
  workItemId: number;
  content: string;
  reasoning?: string;
  action?: { type: string; query: string; evidenceCount: number };
}
