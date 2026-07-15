import { z } from 'zod';
import { gitSourceConfigSchema } from './integrations.js';
import { metadataSelectionSchema, parsePackageXml } from './org-to-org-metadata.js';

const workbenchMetadataSelectionSchema = metadataSelectionSchema.strict();
const manifestXmlSchema = z.string().trim().min(1).refine((xml) => {
  try {
    parsePackageXml(xml);
    return true;
  } catch {
    return false;
  }
}, 'Invalid package.xml manifest');

export const deploymentEnvironmentSchema = z.enum(['scratch', 'sandbox', 'production']);
export const workbenchStrategySchema = z.enum(['direct', 'intelligent', 'validate_then_quick']);
export const apexTestLevelSchema = z.enum([
  'NoTestRun',
  'RunSpecifiedTests',
  'RunLocalTests',
  'RunAllTestsInOrg',
]);
export const qualityStageStatusSchema = z.enum([
  'pending',
  'ready',
  'running',
  'passed',
  'failed',
  'blocked',
  'skipped',
  'cancelled',
]);
export const qualityRunStatusSchema = z.enum([
  'planned',
  'awaiting_approval',
  'approved',
  'rejected',
  'running',
  'passed',
  'failed',
  'cancelled',
]);

export const deploymentSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('org_compare'),
    sourceOrgId: z.string().uuid(),
    comparisonId: z.string().uuid().optional(),
  }).strict(),
  z.object({
    type: z.literal('scm'),
    provider: z.enum(['azure_devops', 'github', 'bitbucket']),
    connectionId: z.string().uuid().optional(),
    bindingId: z.string().uuid().optional(),
    namespace: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
    repositoryId: z.string().min(1).optional(),
    repo: z.string().min(1),
    branch: z.string().min(1),
    manifestPath: z.string().min(1).optional(),
  }).strict(),
]);

export const deploymentTargetSchema = z.object({
  orgId: z.string().uuid(),
  profile: deploymentEnvironmentSchema,
}).strict();

export const dependencyPolicySchema = z.object({
  mode: z.enum(['selected_only', 'include_required', 'include_all']).default('include_required'),
  maxDepth: z.number().int().min(0).max(25).default(10),
  includeOptional: z.boolean().default(false),
  failOnMissing: z.boolean().default(true),
  allowCycles: z.boolean().default(false),
}).strict();

export const apexTestPolicySchema = z.object({
  level: apexTestLevelSchema.default('RunLocalTests'),
  tests: z.array(z.string().trim().min(1).max(255)).max(500).default([]),
  minimumCoverage: z.number().min(0).max(100).default(75),
}).strict().superRefine((policy, ctx) => {
  if (policy.level === 'RunSpecifiedTests' && policy.tests.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tests'],
      message: 'At least one test class is required for RunSpecifiedTests',
    });
  }
  if (policy.level !== 'RunSpecifiedTests' && policy.tests.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tests'],
      message: 'Explicit tests are only valid with RunSpecifiedTests',
    });
  }
});

export const staticSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);
export const staticAnalysisPolicySchema = z.object({
  enabled: z.boolean().default(false),
  engines: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  severityThreshold: staticSeveritySchema.default('error'),
  maxCounts: z.object({
    info: z.number().int().min(0).nullable().default(null),
    warning: z.number().int().min(0).nullable().default(null),
    error: z.number().int().min(0).nullable().default(0),
    critical: z.number().int().min(0).nullable().default(0),
  }).strict().default({}),
  blockMode: z.enum(['never', 'threshold', 'any']).default('threshold'),
}).strict().superRefine((policy, ctx) => {
  if (policy.enabled && policy.engines.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['engines'],
      message: 'At least one static analysis engine is required when enabled',
    });
  }
});

export const approvalPolicySchema = z.object({
  required: z.boolean().default(false),
  approverType: z.enum(['owner', 'admin', 'distinct_user']).default('owner'),
  minimumApprovals: z.number().int().min(1).max(10).default(1),
}).strict();

export const validationPolicySchema = z.object({
  required: z.boolean().default(true),
}).strict();

export const snapshotPolicySchema = z.object({
  required: z.boolean().default(true),
  rollbackRequired: z.boolean().default(true),
}).strict().superRefine((policy, ctx) => {
  if (policy.rollbackRequired && !policy.required) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['required'],
      message: 'A target snapshot is required when rollback is required',
    });
  }
});

export const chainedDataConfigItemSchema = z.object({
  objectName: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Invalid Salesforce object API name'),
  soql: z.string().trim().min(1).max(20_000).optional(),
  strategy: z.enum(['insert', 'upsert']).default('upsert'),
  matchField: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Invalid match field API name').default('Name'),
}).strict().superRefine((item, ctx) => {
  if (item.strategy === 'upsert' && !item.matchField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['matchField'],
      message: 'matchField is required for upsert',
    });
  }
  if (item.soql) {
    const from = /\bFROM\s+([A-Za-z][A-Za-z0-9_]*)\b/i.exec(item.soql)?.[1];
    if (!from || from.toLowerCase() !== item.objectName.toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['soql'],
        message: 'SOQL FROM object must match objectName',
      });
    }
  }
});

export const chainedDataSchema = z.object({
  enabled: z.boolean().default(true),
  stopOnError: z.boolean().default(true),
  sequential: z.boolean().default(true),
  config: z.array(chainedDataConfigItemSchema).min(1).max(200),
}).strict();

export const deploymentPolicySchema = z.object({
  tests: apexTestPolicySchema,
  staticAnalysis: staticAnalysisPolicySchema,
  validation: validationPolicySchema,
  snapshot: snapshotPolicySchema,
  approval: approvalPolicySchema,
}).strict();

const legacyInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  source: deploymentSourceSchema.optional(),
  target: deploymentTargetSchema.optional(),
  strategy: z.union([workbenchStrategySchema, z.enum(['azure', 'jenkins'])]).optional(),
  components: z.array(workbenchMetadataSelectionSchema).max(10_000).optional(),
  manifestXml: manifestXmlSchema.optional(),
  apiVersion: z.string().trim().min(1).optional(),
  destructiveSelections: z.array(workbenchMetadataSelectionSchema).max(10_000).optional(),
  dependencyPolicy: dependencyPolicySchema.optional(),
  policy: z.object({
    tests: apexTestPolicySchema.optional(),
    staticAnalysis: staticAnalysisPolicySchema.optional(),
    validation: validationPolicySchema.optional(),
    snapshot: snapshotPolicySchema.optional(),
    approval: approvalPolicySchema.optional(),
  }).strict().optional(),
  chainedData: chainedDataSchema.optional(),

  // Compatibility input accepted from current org-to-org and SCM deploy APIs.
  sourceOrgId: z.string().uuid().optional(),
  targetOrgId: z.string().uuid().optional(),
  targetProfile: deploymentEnvironmentSchema.optional(),
  environment: deploymentEnvironmentSchema.optional(),
  comparisonId: z.string().uuid().optional(),
  selections: z.array(workbenchMetadataSelectionSchema).max(10_000).optional(),
  packageXml: manifestXmlSchema.optional(),
  testLevel: apexTestLevelSchema.optional(),
  tests: z.array(z.string().trim().min(1)).optional(),
  minimumCoverage: z.number().min(0).max(100).optional(),
  validateOnly: z.boolean().optional(),
  validationRequired: z.boolean().optional(),
  snapshotRequired: z.boolean().optional(),
  rollbackRequired: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  intelligentDeployEnabled: z.boolean().optional(),
  deploymentName: z.string().trim().min(1).max(120).optional(),
  deploymentNotes: z.string().trim().max(2000).optional(),
  chainDataDeploy: z.boolean().optional(),
  dataDeployConfig: z.array(z.record(z.unknown())).optional(),
  gitSource: gitSourceConfigSchema.optional(),
  azureDeploy: z.object({
    project: z.string().optional(),
    repo: z.string().min(1),
    branch: z.string().min(1),
    manifestPath: z.string().optional(),
  }).strict().optional(),
  provider: z.enum(['azure_devops', 'github', 'bitbucket']).optional(),
  connectionId: z.string().uuid().optional(),
  bindingId: z.string().uuid().optional(),
  namespace: z.string().optional(),
  project: z.string().optional(),
  repositoryId: z.string().optional(),
  repo: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  manifestPath: z.string().optional(),
}).strict();

type LegacyInput = z.infer<typeof legacyInputSchema>;

function environmentDefaults(profile: z.infer<typeof deploymentEnvironmentSchema>) {
  if (profile === 'production') {
    return {
      tests: { level: 'RunLocalTests' as const, tests: [], minimumCoverage: 75 },
      validation: { required: true },
      snapshot: { required: true, rollbackRequired: true },
      approval: { required: true, approverType: 'admin' as const, minimumApprovals: 1 },
    };
  }
  if (profile === 'sandbox') {
    return {
      tests: { level: 'RunLocalTests' as const, tests: [], minimumCoverage: 75 },
      validation: { required: true },
      snapshot: { required: true, rollbackRequired: true },
      approval: { required: false, approverType: 'owner' as const, minimumApprovals: 1 },
    };
  }
  return {
    tests: { level: 'NoTestRun' as const, tests: [], minimumCoverage: 0 },
    validation: { required: false },
    snapshot: { required: false, rollbackRequired: false },
    approval: { required: false, approverType: 'owner' as const, minimumApprovals: 1 },
  };
}

function sourceFromLegacy(input: LegacyInput): z.input<typeof deploymentSourceSchema> | undefined {
  if (input.source) return input.source;
  if (input.sourceOrgId) {
    return {
      type: 'org_compare',
      sourceOrgId: input.sourceOrgId,
      ...(input.comparisonId ? { comparisonId: input.comparisonId } : {}),
    };
  }
  const git = input.gitSource;
  const azure = input.azureDeploy;
  const repo = git?.repo ?? azure?.repo ?? input.repo;
  const branch = git?.branch ?? azure?.branch ?? input.branch;
  if (!repo || !branch) return undefined;
  return {
    type: 'scm',
    provider: git?.provider ?? input.provider ?? 'azure_devops',
    ...((git?.connectionId ?? input.connectionId)
      ? { connectionId: git?.connectionId ?? input.connectionId }
      : {}),
    ...((git?.bindingId ?? input.bindingId)
      ? { bindingId: git?.bindingId ?? input.bindingId }
      : {}),
    ...((git?.namespace ?? input.namespace)
      ? { namespace: git?.namespace ?? input.namespace }
      : {}),
    ...((git?.project ?? azure?.project ?? input.project)
      ? { project: git?.project ?? azure?.project ?? input.project }
      : {}),
    ...((git?.repositoryId ?? input.repositoryId)
      ? { repositoryId: git?.repositoryId ?? input.repositoryId }
      : {}),
    repo,
    branch,
    ...((git?.manifestPath ?? azure?.manifestPath ?? input.manifestPath)
      ? { manifestPath: git?.manifestPath ?? azure?.manifestPath ?? input.manifestPath }
      : {}),
  };
}

function normalizeInput(raw: unknown) {
  const input = legacyInputSchema.parse(raw);
  const profile = input.target?.profile ?? input.targetProfile ?? input.environment ?? 'scratch';
  const defaults = environmentDefaults(profile);
  const source = sourceFromLegacy(input);
  const target = input.target ?? (input.targetOrgId ? { orgId: input.targetOrgId, profile } : undefined);
  const strategy = (input.strategy === 'azure' || input.strategy === 'jenkins' ? 'direct' : input.strategy)
    ?? (input.intelligentDeployEnabled ? 'intelligent' : undefined)
    ?? (input.validateOnly ? 'validate_then_quick' : 'direct');
  const testCandidate = input.policy?.tests ?? {
    level: input.testLevel ?? defaults.tests.level,
    tests: input.tests ?? [],
    minimumCoverage: input.minimumCoverage ?? defaults.tests.minimumCoverage,
  };
  const validation = input.policy?.validation ?? {
    required: input.validationRequired ?? input.validateOnly ?? defaults.validation.required,
  };
  const snapshot = input.policy?.snapshot ?? {
    required: input.snapshotRequired ?? defaults.snapshot.required,
    rollbackRequired: input.rollbackRequired ?? defaults.snapshot.rollbackRequired,
  };
  const approval = input.policy?.approval ?? {
    required: input.approvalRequired ?? defaults.approval.required,
    approverType: defaults.approval.approverType,
    minimumApprovals: defaults.approval.minimumApprovals,
  };
  const chainedData = input.chainedData ?? (
    input.chainDataDeploy && input.dataDeployConfig?.length
      ? { enabled: true, stopOnError: true, config: input.dataDeployConfig }
      : undefined
  );
  return {
    name: input.name ?? input.deploymentName,
    description: input.description ?? input.deploymentNotes,
    source,
    target,
    strategy,
    components: input.components ?? input.selections ?? [],
    manifestXml: input.manifestXml ?? input.packageXml,
    apiVersion: input.apiVersion,
    destructiveSelections: input.destructiveSelections ?? [],
    dependencyPolicy: input.dependencyPolicy ?? {},
    policy: {
      tests: testCandidate,
      staticAnalysis: input.policy?.staticAnalysis ?? {},
      validation,
      snapshot,
      approval,
    },
    chainedData,
  };
}

const normalizedWorkbenchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  source: deploymentSourceSchema,
  target: deploymentTargetSchema,
  strategy: workbenchStrategySchema,
  components: z.array(workbenchMetadataSelectionSchema).max(10_000),
  manifestXml: manifestXmlSchema.optional(),
  apiVersion: z.string().trim().min(1).optional(),
  destructiveSelections: z.array(workbenchMetadataSelectionSchema).max(10_000),
  dependencyPolicy: dependencyPolicySchema,
  policy: deploymentPolicySchema,
  chainedData: chainedDataSchema.optional(),
}).strict().superRefine((input, ctx) => {
  if (
    input.source.type === 'org_compare'
    && input.components.length === 0
    && !input.manifestXml
    && input.destructiveSelections.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['components'],
      message: 'Org comparison deployments require selected components or manifestXml',
    });
  }
  if (input.source.type === 'org_compare' && input.source.sourceOrgId === input.target.orgId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['target', 'orgId'],
      message: 'Source and target org must differ',
    });
  }
  if (input.chainedData?.enabled && input.source.type !== 'org_compare') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chainedData'],
      message: 'Chained data deployment requires an org comparison source',
    });
  }
  if (input.strategy === 'validate_then_quick' && !input.policy.validation.required) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['policy', 'validation', 'required'],
      message: 'validate_then_quick requires validation',
    });
  }
  if (input.target.profile === 'production') {
    if (!input.policy.validation.required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policy', 'validation', 'required'],
        message: 'Production deployments require validation',
      });
    }
    if (input.policy.tests.level === 'NoTestRun') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policy', 'tests', 'level'],
        message: 'Production deployments require Apex tests',
      });
    }
    if (input.policy.tests.minimumCoverage < 75) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policy', 'tests', 'minimumCoverage'],
        message: 'Production deployments require at least 75% Apex coverage',
      });
    }
    if (!input.policy.approval.required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policy', 'approval', 'required'],
        message: 'Production deployments require approval',
      });
    }
  }
});

export const deploymentWorkbenchInputSchema = z.preprocess(normalizeInput, normalizedWorkbenchSchema);
export const deploymentWorkbenchPreviewSchema = deploymentWorkbenchInputSchema;
export const deploymentWorkbenchCreateSchema = deploymentWorkbenchInputSchema;

export type DeploymentWorkbenchInput = z.infer<typeof deploymentWorkbenchInputSchema>;
export type DeploymentSource = z.infer<typeof deploymentSourceSchema>;
export type DeploymentPolicy = z.infer<typeof deploymentPolicySchema>;
export type DeploymentEnvironment = z.infer<typeof deploymentEnvironmentSchema>;
export type WorkbenchStrategy = z.infer<typeof workbenchStrategySchema>;

export function normalizeLegacyDeploymentPayload(raw: unknown): DeploymentWorkbenchInput {
  return deploymentWorkbenchInputSchema.parse(raw);
}

export const qualityStageKeySchema = z.enum([
  'source',
  'dependencies',
  'snapshot',
  'static_analysis',
  'validation',
  'apex_tests',
  'intelligent_plan',
  'approval',
  'deploy',
  'quick_deploy',
  'chained_data',
  'rollback_ready',
]);

export const qualityStagePlanItemSchema = z.object({
  key: qualityStageKeySchema,
  ordinal: z.number().int().nonnegative(),
  required: z.boolean(),
  status: qualityStageStatusSchema.default('pending'),
}).strict();
export type QualityStagePlanItem = z.infer<typeof qualityStagePlanItemSchema>;

export function buildDeploymentStagePlan(input: DeploymentWorkbenchInput): QualityStagePlanItem[] {
  const stages: Array<Omit<QualityStagePlanItem, 'ordinal' | 'status'>> = [
    { key: 'source', required: true },
  ];
  if (input.dependencyPolicy.mode !== 'selected_only') {
    stages.push({ key: 'dependencies', required: true });
  }
  if (input.policy.snapshot.required) stages.push({ key: 'snapshot', required: true });
  if (input.policy.staticAnalysis.enabled) stages.push({ key: 'static_analysis', required: true });
  if (
    input.policy.validation.required
    || input.strategy === 'validate_then_quick'
    || input.policy.tests.level !== 'NoTestRun'
  ) {
    stages.push({ key: 'validation', required: true });
  }
  if (input.policy.tests.level !== 'NoTestRun') stages.push({ key: 'apex_tests', required: true });
  if (input.strategy === 'intelligent') stages.push({ key: 'intelligent_plan', required: true });
  if (input.policy.approval.required) stages.push({ key: 'approval', required: true });
  stages.push({
    key: input.strategy === 'validate_then_quick' ? 'quick_deploy' : 'deploy',
    required: true,
  });
  if (input.chainedData?.enabled) stages.push({ key: 'chained_data', required: true });
  if (input.policy.snapshot.rollbackRequired) stages.push({ key: 'rollback_ready', required: true });
  return stages.map((stage, ordinal) => ({ ...stage, ordinal, status: 'pending' }));
}

export const dependencySelectionResultSchema = z.object({
  requested: z.array(workbenchMetadataSelectionSchema),
  resolved: z.array(workbenchMetadataSelectionSchema),
  added: z.array(z.object({
    component: z.object({
      metadataType: z.string().min(1),
      member: z.string().min(1),
    }).strict(),
    requiredBy: z.array(z.string().min(1)).min(1),
    depth: z.number().int().nonnegative(),
    optional: z.boolean().default(false),
  }).strict()),
  missing: z.array(z.object({
    metadataType: z.string().min(1),
    member: z.string().min(1),
    requiredBy: z.array(z.string().min(1)),
  }).strict()),
  cycles: z.array(z.array(z.string().min(1)).min(2)),
  truncated: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
}).strict();
export type DependencySelectionResult = z.infer<typeof dependencySelectionResultSchema>;

export const apexDiagnosticSchema = z.object({
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string().min(1),
  code: z.string().optional(),
  component: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
}).strict();

export const apexCoverageSchema = z.object({
  component: z.string().min(1),
  componentType: z.enum(['class', 'trigger']).default('class'),
  coveredLines: z.number().int().nonnegative(),
  uncoveredLines: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
  uncoveredLineNumbers: z.array(z.number().int().positive()).default([]),
}).strict();

export const apexTestResultSchema = z.object({
  className: z.string().min(1),
  methodName: z.string().min(1),
  status: z.enum(['passed', 'failed', 'skipped']),
  durationMs: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
  stackTrace: z.string().optional(),
  diagnostics: z.array(apexDiagnosticSchema).default([]),
}).strict();

export const staticAnalysisIssueSchema = z.object({
  engine: z.string().min(1),
  ruleId: z.string().min(1),
  severity: staticSeveritySchema,
  message: z.string().min(1),
  component: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  fingerprint: z.string().optional(),
  helpUrl: z.string().url().optional(),
}).strict();

export type ApexDiagnostic = z.infer<typeof apexDiagnosticSchema>;
export type ApexCoverage = z.infer<typeof apexCoverageSchema>;
export type ApexTestResult = z.infer<typeof apexTestResultSchema>;
export type StaticAnalysisIssue = z.infer<typeof staticAnalysisIssueSchema>;

export const qualityGateInputSchema = z.object({
  validationPassed: z.boolean().optional(),
  testsRun: z.number().int().nonnegative().default(0),
  testsFailed: z.number().int().nonnegative().default(0),
  coverage: z.number().min(0).max(100).optional(),
  staticCounts: z.object({
    info: z.number().int().nonnegative().default(0),
    warning: z.number().int().nonnegative().default(0),
    error: z.number().int().nonnegative().default(0),
    critical: z.number().int().nonnegative().default(0),
  }).strict().default({}),
  approved: z.boolean().optional(),
  snapshotCreated: z.boolean().optional(),
}).strict();

export interface QualityGateResult {
  passed: boolean;
  blockedBy: Array<{
    gate: 'validation' | 'tests' | 'coverage' | 'static_analysis' | 'approval' | 'snapshot';
    message: string;
    actual?: number | boolean;
    expected?: number | boolean;
  }>;
}

const SEVERITY_RANK: Record<z.infer<typeof staticSeveritySchema>, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

export function evaluateDeploymentQualityGate(
  policy: DeploymentPolicy,
  raw: z.input<typeof qualityGateInputSchema>,
): QualityGateResult {
  const input = qualityGateInputSchema.parse(raw);
  const blockedBy: QualityGateResult['blockedBy'] = [];
  if (policy.validation.required && input.validationPassed !== true) {
    blockedBy.push({
      gate: 'validation',
      message: 'Required validation has not passed',
      actual: input.validationPassed ?? false,
      expected: true,
    });
  }
  if (policy.tests.level !== 'NoTestRun') {
    if (input.testsRun === 0 || input.testsFailed > 0) {
      blockedBy.push({
        gate: 'tests',
        message: input.testsRun === 0 ? 'Required Apex tests have not run' : 'One or more Apex tests failed',
        actual: input.testsFailed,
        expected: 0,
      });
    }
    if (input.coverage === undefined || input.coverage < policy.tests.minimumCoverage) {
      blockedBy.push({
        gate: 'coverage',
        message: 'Apex coverage is below the required minimum',
        actual: input.coverage ?? 0,
        expected: policy.tests.minimumCoverage,
      });
    }
  }
  const staticPolicy = policy.staticAnalysis;
  if (staticPolicy.enabled && staticPolicy.blockMode !== 'never') {
    const severities = (Object.keys(input.staticCounts) as Array<keyof typeof input.staticCounts>)
      .filter((severity) => SEVERITY_RANK[severity] >= SEVERITY_RANK[staticPolicy.severityThreshold]);
    const exceeded = severities.some((severity) => {
      const count = input.staticCounts[severity];
      if (staticPolicy.blockMode === 'any') return count > 0;
      const maximum = staticPolicy.maxCounts[severity];
      return maximum !== null && count > maximum;
    });
    if (exceeded) {
      blockedBy.push({ gate: 'static_analysis', message: 'Static analysis threshold exceeded' });
    }
  }
  if (policy.approval.required && input.approved !== true) {
    blockedBy.push({
      gate: 'approval',
      message: 'Required approval has not been granted',
      actual: input.approved ?? false,
      expected: true,
    });
  }
  if (policy.snapshot.required && input.snapshotCreated !== true) {
    blockedBy.push({
      gate: 'snapshot',
      message: 'Required target snapshot has not been created',
      actual: input.snapshotCreated ?? false,
      expected: true,
    });
  }
  return { passed: blockedBy.length === 0, blockedBy };
}

export const deploymentWorkbenchCapabilitiesSchema = z.object({
  executionAvailable: z.boolean(),
  strategies: z.array(workbenchStrategySchema),
  sourceTypes: z.array(z.enum(['org_compare', 'scm'])),
  environments: z.array(deploymentEnvironmentSchema),
  testLevels: z.array(apexTestLevelSchema),
  staticAnalysisEngines: z.array(z.string()),
  supports: z.object({
    dependencies: z.boolean(),
    includeOptional: z.boolean(),
    destructiveChanges: z.boolean(),
    snapshots: z.boolean(),
    rollback: z.boolean(),
    approvals: z.boolean(),
    chainedData: z.boolean(),
  }).strict(),
}).strict();

export const deploymentWorkbenchStatusSchema = z.object({
  id: z.string().uuid(),
  status: qualityRunStatusSchema,
  currentStage: qualityStageKeySchema.nullable(),
  validationId: z.string().nullable(),
  approvalRequired: z.boolean(),
  approvedAt: z.coerce.date().nullable(),
  rejectedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  canApprove: z.boolean(),
  canReject: z.boolean(),
  canQuickDeploy: z.boolean(),
  canCancel: z.boolean(),
  canResume: z.boolean(),
  canRollback: z.boolean(),
  destructiveReviewRequired: z.boolean(),
  destructiveReviewed: z.boolean(),
  approvalCount: z.number().int().nonnegative(),
  minimumApprovals: z.number().int().positive(),
  job: z.unknown().nullable(),
  results: z.object({
    staticAnalysis: z.object({
      status: z.string(),
      summary: z.unknown().nullable(),
      artifacts: z.unknown().nullable(),
      issues: z.array(z.unknown()),
    }).strict(),
    validation: z.object({
      status: z.string(),
      id: z.string().nullable(),
      summary: z.unknown().nullable(),
      issues: z.array(z.unknown()),
    }).strict(),
    tests: z.object({
      status: z.string(),
      summary: z.unknown().nullable(),
      results: z.array(z.unknown()),
    }).strict(),
    coverage: z.object({
      status: z.string(),
      percentage: z.number().nullable(),
      minimum: z.number(),
    }).strict(),
  }).strict(),
}).strict();

export type DeploymentWorkbenchCapabilities = z.infer<typeof deploymentWorkbenchCapabilitiesSchema>;
export type DeploymentWorkbenchStatus = z.infer<typeof deploymentWorkbenchStatusSchema>;
