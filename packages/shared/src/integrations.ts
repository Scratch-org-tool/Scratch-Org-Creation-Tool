import { z } from 'zod';

export const scmProviderSchema = z.enum(['azure_devops', 'github', 'bitbucket']);
export const workItemProviderSchema = z.enum(['azure_boards', 'github_issues', 'jira']);
export const connectionStateSchema = z.enum(['connected', 'degraded', 'disconnected', 'error']);

export type ScmProvider = z.infer<typeof scmProviderSchema>;
export type WorkItemProvider = z.infer<typeof workItemProviderSchema>;
export type ConnectionState = z.infer<typeof connectionStateSchema>;

const nullableString = z.string().nullable().default(null);

export const integrationCapabilitiesSchema = z.object({
  read: z.boolean(),
  write: z.boolean().default(false),
  create: z.boolean().default(false),
  update: z.boolean().default(false),
  comments: z.boolean().default(false),
  webhooks: z.boolean().default(false),
  attachments: z.boolean().default(false),
  attachmentUploads: z.boolean().default(false),
  attachmentDeletes: z.boolean().default(false),
  history: z.boolean().default(false),
  stateTransitions: z.boolean().default(false),
  issueTypes: z.boolean().default(false),
  users: z.boolean().default(false),
  labels: z.boolean().default(false),
  subIssues: z.boolean().default(false),
});

export const scmCapabilitiesSchema = z.object({
  repositories: z.boolean().default(true),
  branches: z.boolean().default(true),
  checkout: z.boolean().default(true),
  pipelines: z.boolean().default(false),
  pullRequests: z.boolean().default(false),
  webhooks: z.boolean().default(false),
});

/**
 * Public connection DTO. Credential material is deliberately not represented,
 * so parsing a persistence object strips encrypted and plaintext secrets.
 */
export const scmConnectionStatusSchema = z.object({
  id: z.string().optional(),
  provider: scmProviderSchema,
  state: connectionStateSchema,
  connected: z.boolean(),
  source: z.enum(['database', 'environment']).nullable().default(null),
  displayName: nullableString,
  namespace: nullableString,
  error: nullableString,
  connectedAt: z.string().nullable().optional(),
  lastVerifiedAt: z.string().nullable().optional(),
  capabilities: scmCapabilitiesSchema,
});

export const workItemConnectionStatusSchema = z.object({
  id: z.string().optional(),
  provider: workItemProviderSchema,
  state: connectionStateSchema,
  connected: z.boolean(),
  source: z.enum(['database', 'environment']).nullable().default(null),
  displayName: nullableString,
  namespace: nullableString,
  error: nullableString,
  connectedAt: z.string().nullable().optional(),
  lastVerifiedAt: z.string().nullable().optional(),
  capabilities: integrationCapabilitiesSchema,
});

export const namespaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  url: z.string().nullable().default(null),
});

export const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(),
  namespace: z.string(),
  defaultBranch: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  isPrivate: z.boolean().default(true),
});

export const gitSourceConfigSchema = z.object({
  provider: scmProviderSchema,
  connectionId: z.string().optional(),
  bindingId: z.string().optional(),
  namespace: z.string().optional(),
  project: z.string().optional(),
  repositoryId: z.string().optional(),
  repo: z.string().min(1),
  branch: z.string().min(1),
  manifestPath: z.string().optional(),
});

export const workItemUserSchema = z.object({
  id: z.string().nullable().default(null),
  displayName: z.string(),
  email: z.string().nullable().default(null),
  avatarUrl: z.string().nullable().default(null),
});

export const workItemProjectSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  externalUrl: z.string().nullable().optional(),
  provider: workItemProviderSchema.optional(),
  capabilities: integrationCapabilitiesSchema.optional(),
});

export const workItemStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['new', 'in_progress', 'resolved', 'closed', 'removed', 'unknown']),
  color: z.string().nullable().default(null),
});

export const workItemSummarySchema = z.object({
  id: z.string(),
  provider: workItemProviderSchema,
  capabilities: integrationCapabilitiesSchema.optional(),
  project: workItemProjectSchema,
  title: z.string(),
  type: z.string(),
  state: workItemStateSchema,
  priority: z.number().nullable().default(null),
  assignee: workItemUserSchema.nullable().default(null),
  author: workItemUserSchema.nullable().default(null),
  labels: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string(),
  externalUrl: z.string().optional(),
});

export const workItemRelationSchema = z.object({
  type: z.string(),
  title: z.string(),
  url: z.string(),
});

export const workItemDetailSchema = workItemSummarySchema.extend({
  description: z.string().nullable().default(null),
  acceptanceCriteria: z.string().nullable().default(null),
  reproSteps: z.string().nullable().default(null),
  severity: z.string().nullable().default(null),
  areaPath: z.string().nullable().default(null),
  iterationPath: z.string().nullable().default(null),
  relations: z.array(workItemRelationSchema).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const workItemCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: workItemUserSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workItemHistoryChangeSchema = z.object({
  field: z.string(),
  fieldRef: z.string().nullable().default(null),
  oldValue: z.string().nullable().default(null),
  newValue: z.string().nullable().default(null),
});

export const workItemHistoryEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['created', 'updated', 'comment', 'attachment_added', 'attachment_removed']),
  version: z.number().int().nonnegative().default(0),
  actor: workItemUserSchema,
  occurredAt: z.string(),
  summary: z.string(),
  changes: z.array(workItemHistoryChangeSchema).default([]),
  body: z.string().nullable().optional(),
});

export const workItemAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative().nullable().default(null),
  url: z.string(),
  contentType: z.string().nullable().default(null),
  createdAt: z.string().nullable().default(null),
  author: workItemUserSchema.nullable().default(null),
});

export type IntegrationCapabilities = z.infer<typeof integrationCapabilitiesSchema>;
export type ScmCapabilities = z.infer<typeof scmCapabilitiesSchema>;
export type ScmConnectionStatus = z.infer<typeof scmConnectionStatusSchema>;
export type WorkItemConnectionStatus = z.infer<typeof workItemConnectionStatusSchema>;
export type Namespace = z.infer<typeof namespaceSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type GitSourceConfig = z.infer<typeof gitSourceConfigSchema>;
export type WorkItemUser = z.infer<typeof workItemUserSchema>;
export type WorkItemProject = z.infer<typeof workItemProjectSchema>;
export type WorkItemState = z.infer<typeof workItemStateSchema>;
export type WorkItemSummary = z.infer<typeof workItemSummarySchema>;
export type WorkItemDetail = z.infer<typeof workItemDetailSchema>;
export type WorkItemComment = z.infer<typeof workItemCommentSchema>;
export type WorkItemHistoryChange = z.infer<typeof workItemHistoryChangeSchema>;
export type WorkItemHistoryEvent = z.infer<typeof workItemHistoryEventSchema>;
export type WorkItemAttachment = z.infer<typeof workItemAttachmentSchema>;

export interface LegacyAzureDeployConfig {
  project?: string;
  repo: string;
  branch: string;
  manifestPath?: string;
}

/** Adds the canonical key while preserving the legacy key consumed by Azure routes. */
export function normalizeGitSourceConfig<T extends {
  gitSource?: GitSourceConfig;
  azureDeploy?: LegacyAzureDeployConfig;
}>(value: T): T & { gitSource?: GitSourceConfig } {
  if (value.gitSource) {
    return {
      ...value,
      gitSource: gitSourceConfigSchema.parse(value.gitSource),
    };
  }
  if (!value.azureDeploy) return value;
  return {
    ...value,
    gitSource: {
      provider: 'azure_devops',
      project: value.azureDeploy.project,
      namespace: value.azureDeploy.project,
      repo: value.azureDeploy.repo,
      branch: value.azureDeploy.branch,
      manifestPath: value.azureDeploy.manifestPath,
    },
  };
}

export const PIPELINE_CHECKPOINT_ALIASES = {
  azure_metadata_deploy: 'git_metadata_deploy',
} as const;

export function canonicalPipelineStep(step: string): string {
  return PIPELINE_CHECKPOINT_ALIASES[step as LegacyPipelineStep] ?? step;
}

type LegacyPipelineStep = keyof typeof PIPELINE_CHECKPOINT_ALIASES;
export type CanonicalPipelineStep =
  | (typeof PIPELINE_CHECKPOINT_ALIASES)[LegacyPipelineStep]
  | string;

/** Reads old persisted checkpoints without mutating or dropping their legacy fields. */
export function normalizePipelineCheckpointAliases<T extends {
  completedSteps?: readonly string[];
  resumeFrom?: string;
}>(checkpoint: T): T & {
  completedSteps?: string[];
  resumeFrom?: string;
  legacyResumeFrom?: string;
} {
  return {
    ...checkpoint,
    ...(checkpoint.completedSteps
      ? { completedSteps: [...new Set(checkpoint.completedSteps.map(canonicalPipelineStep))] }
      : {}),
    ...(checkpoint.resumeFrom
      ? {
          resumeFrom: canonicalPipelineStep(checkpoint.resumeFrom),
          ...(canonicalPipelineStep(checkpoint.resumeFrom) !== checkpoint.resumeFrom
            ? { legacyResumeFrom: checkpoint.resumeFrom }
            : {}),
        }
      : {}),
  };
}
