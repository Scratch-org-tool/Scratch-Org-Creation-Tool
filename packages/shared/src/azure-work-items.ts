import { z } from 'zod';

/** Default work item types shown in the defects command centre. */
export const AZURE_DEFECT_WORK_ITEM_TYPES = [
  'Bug',
  'Defect',
  'User Story',
  'Issue',
  'Product Backlog Item',
] as const;

export type AzureDefectWorkItemType = (typeof AZURE_DEFECT_WORK_ITEM_TYPES)[number];

export interface AzureWorkItemSummary {
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
}

export interface AzureWorkItemDetail extends AzureWorkItemSummary {
  description: string | null;
  reproSteps: string | null;
  acceptanceCriteria: string | null;
  areaPath: string | null;
  iterationPath: string | null;
  severity: string | null;
  relations: Array<{ type: string; title: string; url: string }>;
}

export interface AzureWorkItemComment {
  id: number;
  text: string;
  author: string;
  createdDate: string;
  modifiedDate: string;
}

export interface AzureWorkItemStateOption {
  name: string;
  category: string;
}

export interface AzureWorkItemHistoryChange {
  field: string;
  fieldRef: string;
  oldValue: string | null;
  newValue: string | null;
}

export type AzureWorkItemHistoryKind =
  | 'created'
  | 'updated'
  | 'comment'
  | 'attachment_added'
  | 'attachment_removed';

export interface AzureWorkItemHistoryEvent {
  id: string;
  kind: AzureWorkItemHistoryKind;
  rev: number;
  revisedBy: string;
  revisedDate: string;
  summary: string;
  changes: AzureWorkItemHistoryChange[];
  /** Comment HTML/text or attachment file name for detail popup. */
  body?: string | null;
}

export interface AzureWorkItemHistoryResponse {
  events: AzureWorkItemHistoryEvent[];
}

export interface AzureWorkItemAttachment {
  id: string;
  name: string;
  sizeBytes: number | null;
  url: string;
  contentType: string | null;
}

export interface AzureWorkItemAttachmentsResponse {
  attachments: AzureWorkItemAttachment[];
}

export interface DefectsOverview {
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  total: number;
  connected: boolean;
  orgSlug: string | null;
  project: string | null;
  assigneeEmail: string | null;
  isAdminView: boolean;
}

export interface AzureDevOpsProjectOption {
  id: string;
  name: string;
  description: string | null;
}

export interface DefectsProjectsResponse {
  projects: AzureDevOpsProjectOption[];
  defaultProject: string | null;
  connected: boolean;
  orgSlug: string | null;
}

export interface DefectsWorkItemsResponse {
  items: AzureWorkItemSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const defectsWorkItemsQuerySchema = z.object({
  project: z.string().optional(),
  state: z.string().optional(),
  type: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const defectsProjectQuerySchema = z.object({
  project: z.string().optional(),
});

export const updateWorkItemStateSchema = z.object({
  state: z.string().min(1).max(100),
});

export type DefectsWorkItemsQuery = z.infer<typeof defectsWorkItemsQuerySchema>;
export type DefectsProjectQuery = z.infer<typeof defectsProjectQuerySchema>;
export type UpdateWorkItemStateInput = z.infer<typeof updateWorkItemStateSchema>;
