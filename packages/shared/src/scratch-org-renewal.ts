import { z } from 'zod';

/**
 * Scratch org renewal automation — shared contract between the Environment
 * Center automation panel and the API scheduler.
 *
 * A renewal rule tracks one scratch org. `daysBeforeExpiry` days before that
 * org expires the original creation pipeline is replayed with a fresh alias,
 * so a fully configured replacement (metadata, custom settings, data seed,
 * partners, users) is ready before the old org goes away. After a successful
 * renewal the rule rolls forward to track the replacement org.
 */

/** Salesforce scratch orgs live at most 30 days, so the lead time must leave at least one day of life. */
export const RENEWAL_MAX_DAYS_BEFORE_EXPIRY = 29;

export const scratchOrgRenewalCreateSchema = z.object({
  scratchOrgAlias: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(120).optional(),
  daysBeforeExpiry: z
    .number()
    .int()
    .min(1)
    .max(RENEWAL_MAX_DAYS_BEFORE_EXPIRY)
    .default(2),
  enabled: z.boolean().default(true),
  /** Replay this specific pipeline run instead of the latest successful one. */
  sourceAutomationRunId: z.string().uuid().optional(),
});

export const scratchOrgRenewalUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  daysBeforeExpiry: z
    .number()
    .int()
    .min(1)
    .max(RENEWAL_MAX_DAYS_BEFORE_EXPIRY)
    .optional(),
  enabled: z.boolean().optional(),
});

export const scratchOrgRenewalPreviewSchema = z.object({
  scratchOrgAlias: z.string().trim().min(1).max(255),
  sourceAutomationRunId: z.string().uuid().optional(),
});

export type ScratchOrgRenewalCreateInput = z.infer<typeof scratchOrgRenewalCreateSchema>;
export type ScratchOrgRenewalUpdateInput = z.infer<typeof scratchOrgRenewalUpdateSchema>;
export type ScratchOrgRenewalPreviewInput = z.infer<typeof scratchOrgRenewalPreviewSchema>;

export type ScratchOrgRenewalRunStatus = 'started' | 'succeeded' | 'partial' | 'failed';

/** Summary of the pipeline steps a renewal will replay, shown in the panel. */
export interface ScratchOrgRenewalConfigSummary {
  duration: number;
  devHubAlias: string | null;
  metadataSource: string | null;
  customSettings: boolean;
  dataSeed: boolean;
  accountPartners: boolean;
  userProvisioning: boolean;
}

/**
 * Renewal fire time: `expirationDate` minus the lead time. A past result is
 * valid — the rule is simply already inside its renewal window and fires on
 * the next scheduler tick.
 */
export function computeRenewalRunAt(expirationDate: Date, daysBeforeExpiry: number): Date {
  return new Date(expirationDate.getTime() - daysBeforeExpiry * 24 * 60 * 60 * 1000);
}
