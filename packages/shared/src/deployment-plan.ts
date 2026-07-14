import { z } from 'zod';
import { metadataSelectionSchema } from './org-to-org-metadata.js';
import { orgToOrgObjectDeployConfigSchema } from './org-to-org-data.js';

/**
 * DeploymentPlan — a saved, reusable org-to-org deployment definition.
 *
 * Today plans are executed manually (`POST /plans/:id/execute`); the model is
 * the seam where future automation (schedules, webhooks, multi-org fan-out,
 * approval gates) plugs in without rework.
 */

export const DEPLOYMENT_PLAN_TYPES = ['metadata', 'data', 'combined'] as const;
export type DeploymentPlanType = (typeof DEPLOYMENT_PLAN_TYPES)[number];

export const deploymentPlanMetadataConfigSchema = z
  .object({
    selections: z.array(metadataSelectionSchema).optional(),
    packageXml: z.string().min(1).optional(),
    testLevel: z
      .enum(['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'])
      .optional(),
    tests: z.array(z.string().min(1)).optional(),
    validateOnly: z.boolean().optional(),
    destructiveSelections: z.array(metadataSelectionSchema).optional(),
    apiVersion: z.string().optional(),
    intelligentDeployEnabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.selections?.length && !data.packageXml?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'metadataConfig requires selections or packageXml',
        path: ['selections'],
      });
    }
    if (data.testLevel === 'RunSpecifiedTests' && !data.tests?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one test class for RunSpecifiedTests',
        path: ['tests'],
      });
    }
  });

export const deploymentPlanDataConfigSchema = z.object({
  strategy: z.enum(['insert', 'upsert']).default('upsert'),
  objects: z.array(orgToOrgObjectDeployConfigSchema).min(1),
});

const deploymentPlanBaseSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  planType: z.enum(DEPLOYMENT_PLAN_TYPES).default('combined'),
  metadataConfig: deploymentPlanMetadataConfigSchema.optional(),
  dataConfig: deploymentPlanDataConfigSchema.optional(),
  enabled: z.boolean().default(true),
});

function validatePlanShape(
  data: {
    sourceOrgId?: string;
    targetOrgId?: string;
    planType?: DeploymentPlanType;
    metadataConfig?: unknown;
    dataConfig?: unknown;
  },
  ctx: z.RefinementCtx,
) {
  if (data.sourceOrgId && data.targetOrgId && data.sourceOrgId === data.targetOrgId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and target org must differ',
      path: ['targetOrgId'],
    });
  }
  const planType = data.planType ?? 'combined';
  if ((planType === 'metadata' || planType === 'combined') && !data.metadataConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadataConfig is required for ${planType} plans`,
      path: ['metadataConfig'],
    });
  }
  if ((planType === 'data' || planType === 'combined') && !data.dataConfig) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `dataConfig is required for ${planType} plans`,
      path: ['dataConfig'],
    });
  }
}

export const deploymentPlanCreateSchema = deploymentPlanBaseSchema.superRefine(validatePlanShape);

export const deploymentPlanUpdateSchema = deploymentPlanBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.sourceOrgId && data.targetOrgId && data.sourceOrgId === data.targetOrgId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source and target org must differ',
        path: ['targetOrgId'],
      });
    }
  });

export type DeploymentPlanMetadataConfig = z.infer<typeof deploymentPlanMetadataConfigSchema>;
export type DeploymentPlanDataConfig = z.infer<typeof deploymentPlanDataConfigSchema>;
export type DeploymentPlanCreateInput = z.infer<typeof deploymentPlanCreateSchema>;
export type DeploymentPlanUpdateInput = z.infer<typeof deploymentPlanUpdateSchema>;
