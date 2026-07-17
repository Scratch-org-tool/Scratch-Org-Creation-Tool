import { z } from 'zod';

/**
 * Release lifecycle. A release is a versioned unit that groups deployments
 * and work items:
 *
 *   draft -> in_review -> approved -> released
 *     ^          |            |
 *     +----------+------------+   (reject / reopen return to draft)
 */
export const RELEASE_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'released',
  'cancelled',
] as const;

export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  released: 'Released',
  cancelled: 'Cancelled',
};

export const RELEASE_ITEM_KINDS = ['deployment', 'work_item'] as const;
export type ReleaseItemKind = (typeof RELEASE_ITEM_KINDS)[number];

const releaseNameSchema = z.string().trim().min(1).max(120);
const releaseVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Version may contain letters, numbers, dots, dashes');

export const releaseCreateSchema = z
  .object({
    name: releaseNameSchema,
    version: releaseVersionSchema,
    description: z.string().trim().max(2000).optional(),
    targetOrgId: z.string().uuid().optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .strict();

export type ReleaseCreateInput = z.infer<typeof releaseCreateSchema>;

export const releaseUpdateSchema = z
  .object({
    name: releaseNameSchema.optional(),
    version: releaseVersionSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    targetOrgId: z.string().uuid().nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    releaseNotes: z.string().max(20000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type ReleaseUpdateInput = z.infer<typeof releaseUpdateSchema>;

export const releaseItemAddSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('deployment'),
        deploymentId: z.string().uuid(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('work_item'),
        provider: z.string().trim().min(1).max(40),
        projectId: z.string().trim().min(1).max(200),
        externalId: z.string().trim().min(1).max(100),
        title: z.string().trim().max(400).optional(),
      })
      .strict(),
  ]);

export type ReleaseItemAddInput = z.infer<typeof releaseItemAddSchema>;

export const releaseDecisionSchema = z
  .object({
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

export type ReleaseDecisionInput = z.infer<typeof releaseDecisionSchema>;

/** Allowed status transitions (action -> from -> to). */
export const RELEASE_TRANSITIONS: Record<
  'submit' | 'approve' | 'reject' | 'release' | 'reopen' | 'cancel',
  { from: ReleaseStatus[]; to: ReleaseStatus }
> = {
  submit: { from: ['draft'], to: 'in_review' },
  approve: { from: ['in_review'], to: 'approved' },
  reject: { from: ['in_review'], to: 'draft' },
  release: { from: ['approved'], to: 'released' },
  reopen: { from: ['in_review', 'approved'], to: 'draft' },
  cancel: { from: ['draft', 'in_review', 'approved'], to: 'cancelled' },
};

export function canTransitionRelease(
  action: keyof typeof RELEASE_TRANSITIONS,
  from: ReleaseStatus,
): boolean {
  return RELEASE_TRANSITIONS[action].from.includes(from);
}

export interface ReleaseItemRecord {
  id: string;
  kind: ReleaseItemKind;
  deploymentId?: string | null;
  workItemProvider?: string | null;
  workItemProjectId?: string | null;
  workItemExternalId?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  addedBy: string;
  createdAt: string;
  /** Live deployment summary when kind === 'deployment'. */
  deployment?: {
    id: string;
    repo: string;
    branch: string;
    status: string;
    targetOrgAlias?: string | null;
  } | null;
}

export interface ReleaseApprovalRecord {
  id: string;
  actorId: string;
  actorName?: string | null;
  decision: 'approved' | 'rejected';
  comment?: string | null;
  createdAt: string;
}

export interface ReleaseRecord {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  status: ReleaseStatus;
  targetOrgId?: string | null;
  targetOrgAlias?: string | null;
  releaseNotes?: string | null;
  notesGeneratedAt?: string | null;
  scheduledAt?: string | null;
  releasedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  items?: ReleaseItemRecord[];
  approvals?: ReleaseApprovalRecord[];
}
