import { z } from 'zod';
import { metadataSelectionSchema } from './org-to-org-metadata.js';

/**
 * Deterministic deployment risk model. The score is a weighted sum of
 * triggered factors, capped at 100. An optional AI narrative can be layered on
 * top by the API, but the score itself never depends on the LLM.
 */

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface RiskFactor {
  id: string;
  label: string;
  detail: string;
  weight: number;
  triggered: boolean;
}

export interface DeploymentRiskInput {
  componentCount: number;
  metadataTypes: string[];
  destructiveCount: number;
  testLevel?: string | null;
  targetOrgType?: 'prod' | 'sandbox' | 'scratch' | null;
  /** 0..1 failure ratio across recent deployments to the same target. */
  recentFailureRate?: number | null;
  /** Latest org-wide Apex coverage percentage, when known. */
  orgWideCoverage?: number | null;
}

export interface DeploymentRiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

/** Types whose changes have a wide blast radius. */
const HIGH_IMPACT_TYPES = new Set([
  'CustomObject',
  'CustomField',
  'Flow',
  'ApexTrigger',
  'Workflow',
  'ValidationRule',
  'GlobalValueSet',
  'RecordType',
]);

const ACCESS_TYPES = new Set(['Profile', 'PermissionSet', 'PermissionSetGroup', 'MutingPermissionSet']);

export function riskLevelForScore(score: number): RiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}

export function computeDeploymentRisk(input: DeploymentRiskInput): DeploymentRiskResult {
  const typeSet = new Set(input.metadataTypes);
  const accessTouched = [...typeSet].filter((type) => ACCESS_TYPES.has(type));
  const highImpactTouched = [...typeSet].filter((type) => HIGH_IMPACT_TYPES.has(type));
  const failureRate = input.recentFailureRate ?? null;
  const coverage = input.orgWideCoverage ?? null;

  const factors: RiskFactor[] = [
    {
      id: 'large_package',
      label: 'Large change set',
      detail: `${input.componentCount} components in this deployment`,
      weight: input.componentCount > 200 ? 20 : 10,
      triggered: input.componentCount > 50,
    },
    {
      id: 'access_metadata',
      label: 'Profiles / permission sets touched',
      detail: accessTouched.length > 0
        ? `Access-control metadata included: ${accessTouched.join(', ')}`
        : 'No access-control metadata in this package',
      weight: 15,
      triggered: accessTouched.length > 0,
    },
    {
      id: 'destructive_changes',
      label: 'Destructive changes',
      detail: input.destructiveCount > 0
        ? `${input.destructiveCount} component${input.destructiveCount === 1 ? '' : 's'} will be deleted on the target`
        : 'Nothing is deleted on the target',
      weight: input.destructiveCount > 10 ? 30 : 25,
      triggered: input.destructiveCount > 0,
    },
    {
      id: 'high_impact_types',
      label: 'High blast-radius types',
      detail: highImpactTouched.length > 0
        ? `Schema/automation types included: ${highImpactTouched.join(', ')}`
        : 'No schema or automation types included',
      weight: 10,
      triggered: highImpactTouched.length > 0,
    },
    {
      id: 'no_tests',
      label: 'Tests skipped',
      detail: input.testLevel === 'NoTestRun'
        ? 'Deployment will run without Apex tests'
        : `Test level: ${input.testLevel ?? 'default'}`,
      weight: 15,
      triggered: input.testLevel === 'NoTestRun',
    },
    {
      id: 'production_target',
      label: 'Production target',
      detail: input.targetOrgType === 'prod'
        ? 'The target is a production org'
        : `Target org type: ${input.targetOrgType ?? 'unknown'}`,
      weight: 20,
      triggered: input.targetOrgType === 'prod',
    },
    {
      id: 'failure_history',
      label: 'Recent failure history',
      detail: failureRate !== null
        ? `${Math.round(failureRate * 100)}% of recent deployments to this target failed`
        : 'No deployment history for this target yet',
      weight: 15,
      triggered: failureRate !== null && failureRate >= 0.3,
    },
    {
      id: 'low_coverage',
      label: 'Low org-wide coverage',
      detail: coverage !== null
        ? `Org-wide Apex coverage is ${coverage.toFixed(1)}%`
        : 'Org-wide coverage has not been captured',
      weight: 10,
      triggered: coverage !== null && coverage < 75,
    },
  ];

  const score = Math.min(
    100,
    factors.reduce((sum, factor) => sum + (factor.triggered ? factor.weight : 0), 0),
  );
  return { score, level: riskLevelForScore(score), factors };
}

export const deploymentRiskRequestSchema = z
  .object({
    sourceOrgId: z.string().uuid().optional(),
    targetOrgId: z.string().uuid(),
    selections: z.array(metadataSelectionSchema).default([]),
    destructiveSelections: z.array(metadataSelectionSchema).optional(),
    testLevel: z.string().optional(),
    /** Ask the server for an AI-written narrative (falls back silently). */
    narrative: z.boolean().default(false),
  })
  .strict();

export type DeploymentRiskRequest = z.infer<typeof deploymentRiskRequestSchema>;
