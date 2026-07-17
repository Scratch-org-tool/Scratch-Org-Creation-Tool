import type {
  DeploymentEnvironment,
  DeploymentPolicy,
  DeploymentWorkbenchInput,
  MetadataSelection,
} from '@sfcc/shared';
import type {
  CompareItem,
  CompareTypeSummary,
  DependencyGraph,
  WorkbenchCapabilities,
  WorkbenchForm,
  WorkbenchResults,
  WorkbenchStage,
  WorkbenchStatus,
} from './types';

export const WORKBENCH_STEPS = [
  'Source',
  'Components',
  'Dependencies',
  'Quality Policy',
  'Plan Review',
  'Execute / Results',
] as const;

export const TERMINAL_RUN_STATUSES = ['passed', 'failed', 'cancelled', 'rejected'] as const;

/**
 * Every analyzer the platform knows about. Static analysis is fully automatic:
 * all engines are requested on every deployment and the server silently skips
 * any analyzer that is not installed on the host.
 */
export const AUTO_STATIC_ANALYSIS_ENGINES = ['code-analyzer', 'pmd', 'eslint'] as const;

/** Engines to request, preferring what the server reports as installed. */
export function autoStaticAnalysisEngines(capabilities: WorkbenchCapabilities | null): string[] {
  const known = capabilities?.staticAnalysisEngines?.length
    ? capabilities.staticAnalysisEngines
    : [...AUTO_STATIC_ANALYSIS_ENGINES];
  const availability = capabilities?.staticAnalysisAvailability;
  if (availability) {
    const available = known.filter((engine) => availability[engine] !== false);
    if (available.length > 0) return available;
  }
  return [...known];
}

/**
 * Static analysis is never user-configured: it is always enabled with every
 * engine, and only production keeps a blocking threshold (error/critical = 0).
 * Everywhere else it runs in the background and reports findings.
 */
export function withAutoStaticAnalysis(
  policy: DeploymentPolicy,
  capabilities: WorkbenchCapabilities | null,
): DeploymentPolicy {
  return {
    ...policy,
    staticAnalysis: {
      ...policy.staticAnalysis,
      enabled: true,
      engines: autoStaticAnalysisEngines(capabilities),
    },
  };
}

export function profileForOrgType(type?: string): DeploymentEnvironment {
  if (type === 'prod' || type === 'production') return 'production';
  if (type === 'sandbox') return 'sandbox';
  return 'scratch';
}

export function policyForEnvironment(profile: DeploymentEnvironment): DeploymentPolicy {
  if (profile === 'production') {
    return {
      tests: { level: 'RunLocalTests', tests: [], minimumCoverage: 75 },
      staticAnalysis: {
        enabled: true,
        engines: [...AUTO_STATIC_ANALYSIS_ENGINES],
        severityThreshold: 'error',
        maxCounts: { info: null, warning: null, error: 0, critical: 0 },
        blockMode: 'threshold',
      },
      validation: { required: true },
      snapshot: { required: true, rollbackRequired: true },
      approval: { required: true, approverType: 'admin', minimumApprovals: 1 },
    };
  }
  if (profile === 'sandbox') {
    return {
      tests: { level: 'RunLocalTests', tests: [], minimumCoverage: 75 },
      staticAnalysis: {
        enabled: true,
        engines: [...AUTO_STATIC_ANALYSIS_ENGINES],
        severityThreshold: 'error',
        maxCounts: { info: null, warning: null, error: 0, critical: 0 },
        // Analysis always runs in the background; outside production it
        // reports findings without blocking the deployment.
        blockMode: 'never',
      },
      validation: { required: true },
      snapshot: { required: true, rollbackRequired: true },
      approval: { required: false, approverType: 'owner', minimumApprovals: 1 },
    };
  }
  return {
    tests: { level: 'NoTestRun', tests: [], minimumCoverage: 0 },
    staticAnalysis: {
      enabled: true,
      engines: [...AUTO_STATIC_ANALYSIS_ENGINES],
      severityThreshold: 'error',
      maxCounts: { info: null, warning: null, error: 0, critical: 0 },
      blockMode: 'never',
    },
    validation: { required: false },
    snapshot: { required: false, rollbackRequired: false },
    approval: { required: false, approverType: 'owner', minimumApprovals: 1 },
  };
}

export function applyProductionLocks(policy: DeploymentPolicy): DeploymentPolicy {
  return {
    ...policy,
    tests: {
      ...policy.tests,
      level: policy.tests.level === 'NoTestRun' ? 'RunLocalTests' : policy.tests.level,
      minimumCoverage: Math.max(75, policy.tests.minimumCoverage),
    },
    validation: { required: true },
    approval: { ...policy.approval, required: true },
  };
}

export function createInitialForm(sourceMode: WorkbenchForm['sourceMode'] = 'org_compare'): WorkbenchForm {
  return {
    name: '',
    description: '',
    sourceMode,
    sourceOrgId: '',
    targetOrgId: '',
    targetProfile: 'scratch',
    strategy: 'direct',
    components: [],
    destructiveSelections: [],
    dependencyPolicy: {
      mode: 'include_required',
      maxDepth: 10,
      includeOptional: false,
      failOnMissing: true,
      allowCycles: false,
    },
    policy: policyForEnvironment('scratch'),
    chainedDataEnabled: false,
    chainedDataStopOnError: true,
    chainedDataJson: '[]',
  };
}

export function invalidateSourceState(
  form: WorkbenchForm,
  patch: Partial<Pick<WorkbenchForm, 'sourceMode' | 'sourceOrgId' | 'targetOrgId'>>,
): WorkbenchForm {
  return {
    ...form,
    ...patch,
    comparisonId: undefined,
    components: [],
    destructiveSelections: [],
  };
}

export function selectionsFromCompareItems(
  items: CompareItem[],
  destructive = false,
): MetadataSelection[] {
  const grouped = new Map<string, Set<string>>();
  for (const item of items) {
    if (destructive ? item.diffType !== 'deleted' : !['new', 'changed'].includes(item.diffType)) continue;
    const members = grouped.get(item.metadataType) ?? new Set<string>();
    members.add(item.fullName);
    grouped.set(item.metadataType, members);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([metadataType, members]) => ({
      metadataType,
      members: [...members].sort(),
    }));
}

export function componentCount(selections: MetadataSelection[]): number {
  return selections.reduce((total, selection) => total + selection.members.length, 0);
}

export function compareTypeSummaries(items: CompareItem[]): CompareTypeSummary[] {
  const grouped = new Map<string, CompareTypeSummary>();
  for (const item of items) {
    const existing = grouped.get(item.metadataType) ?? {
      metadataType: item.metadataType,
      total: 0,
      new: 0,
      changed: 0,
      deleted: 0,
      same: 0,
      unknown: 0,
    };
    existing.total += 1;
    existing[item.diffType] += 1;
    grouped.set(item.metadataType, existing);
  }
  return [...grouped.values()].sort((left, right) => left.metadataType.localeCompare(right.metadataType));
}

export function filterCompareItems(
  items: CompareItem[],
  filters: { metadataType?: string; diffTypes?: CompareItem['diffType'][]; search?: string },
): CompareItem[] {
  const query = filters.search?.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.metadataType && item.metadataType !== filters.metadataType) return false;
    if (filters.diffTypes?.length && !filters.diffTypes.includes(item.diffType)) return false;
    if (query && !item.fullName.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function buildCompareKey(metadataType: string, fullName: string): string {
  return `${metadataType}::${fullName}`;
}

export function splitCompareKey(key: string): { metadataType: string; fullName: string } {
  const separator = key.indexOf('::');
  if (separator <= 0 || separator === key.length - 2) {
    return { metadataType: key, fullName: key };
  }
  return { metadataType: key.slice(0, separator), fullName: key.slice(separator + 2) };
}

export function validateWorkbenchForm(
  form: WorkbenchForm,
  scmReady: boolean,
): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!form.targetOrgId) blockers.push('Select a target org.');
  if (form.sourceMode === 'org_compare') {
    if (!form.sourceOrgId) blockers.push('Select a source org.');
    if (form.sourceOrgId && form.sourceOrgId === form.targetOrgId) {
      blockers.push('Source and target orgs must differ.');
    }
    if (!componentCount(form.components) && !componentCount(form.destructiveSelections)) {
      blockers.push('Select at least one changed, new, or deleted component.');
    }
  } else if (!scmReady) {
    blockers.push('Select a connected provider, repository, branch, and manifest.');
  }
  if (form.policy.staticAnalysis.enabled && !form.policy.staticAnalysis.engines.length) {
    blockers.push('Select at least one static analysis engine.');
  }
  if (
    form.policy.tests.level === 'RunSpecifiedTests'
    && !form.policy.tests.tests.length
  ) {
    blockers.push('Select at least one Apex test class.');
  }
  if (form.strategy === 'validate_then_quick' && !form.policy.validation.required) {
    blockers.push('Validate then quick deploy requires validation.');
  }
  if (form.targetProfile === 'production') {
    if (!form.policy.validation.required) blockers.push('Production validation is required.');
    if (form.policy.tests.level === 'NoTestRun') blockers.push('Production Apex tests are required.');
    if (form.policy.tests.minimumCoverage < 75) blockers.push('Production coverage must be at least 75%.');
    if (!form.policy.approval.required) blockers.push('Production approval is required.');
  }
  if (componentCount(form.destructiveSelections)) {
    warnings.push('Destructive changes are irreversible and require explicit review.');
  }
  if (form.dependencyPolicy.mode === 'selected_only') {
    warnings.push('Selected-only mode may omit required transitive dependencies.');
  }
  if (form.dependencyPolicy.allowCycles) {
    warnings.push('Dependency cycles will be allowed and may make deployment ordering unsafe.');
  }
  if (!form.policy.snapshot.required) {
    warnings.push('No target snapshot will be captured before mutation.');
  }
  return { blockers, warnings };
}

export function payloadFromForm(
  form: WorkbenchForm,
  scmSource: DeploymentWorkbenchInput['source'] | null,
): DeploymentWorkbenchInput {
  let chainedData: DeploymentWorkbenchInput['chainedData'];
  if (form.chainedDataEnabled) {
    const parsed = JSON.parse(form.chainedDataJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Chained data configuration must be a non-empty JSON array.');
    }
    chainedData = {
      enabled: true,
      stopOnError: form.chainedDataStopOnError,
      sequential: true,
      config: parsed,
    } as unknown as DeploymentWorkbenchInput['chainedData'];
  }
  const policy = form.targetProfile === 'production'
    ? applyProductionLocks(form.policy)
    : form.policy;
  const source: DeploymentWorkbenchInput['source'] = form.sourceMode === 'org_compare'
    ? {
        type: 'org_compare',
        sourceOrgId: form.sourceOrgId,
        ...(form.comparisonId ? { comparisonId: form.comparisonId } : {}),
      }
    : (scmSource as DeploymentWorkbenchInput['source']);
  return {
    ...(form.name.trim() ? { name: form.name.trim() } : {}),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    source,
    target: { orgId: form.targetOrgId, profile: form.targetProfile },
    strategy: form.strategy,
    components: form.sourceMode === 'scm' ? [] : form.components,
    destructiveSelections: form.sourceMode === 'scm' ? [] : form.destructiveSelections,
    dependencyPolicy: form.dependencyPolicy,
    policy,
    ...(chainedData ? { chainedData } : {}),
  };
}

export function stageRisk(stage: Pick<WorkbenchStage, 'key'>): 'low' | 'medium' | 'high' {
  if (['deploy', 'quick_deploy', 'chained_data'].includes(stage.key)) return 'high';
  if (['static_analysis', 'validation', 'apex_tests', 'approval'].includes(stage.key)) return 'medium';
  return 'low';
}

export function readableStage(key: string): string {
  return key.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function runCanResume(status: string, progress?: { resumable: boolean }): boolean {
  return Boolean(progress?.resumable) && !['running', 'planned', 'approved', 'awaiting_approval'].includes(status);
}

export function supportsOptionalDependencies(capabilities: WorkbenchCapabilities | null): boolean {
  return capabilities?.supports.includeOptional === true
    || capabilities?.supports.optionalDependencies === true;
}

export function supportsDestructiveAcknowledgement(
  capabilities: WorkbenchCapabilities | null,
): boolean {
  return capabilities?.supports.destructiveAcknowledgement === true
    || capabilities?.supports.destructiveReview === true;
}

export function serverRunActions(status: WorkbenchStatus | null) {
  return {
    canApprove: status?.canApprove === true,
    canReject: status?.canReject === true,
    canQuickDeploy: status?.canQuickDeploy === true,
    canCancel: status?.canCancel === true,
    canResume: status?.canResume === true,
    canRollback: status?.canRollback === true,
  };
}

export interface GroupedQualityResults {
  staticIssues: WorkbenchResults['issues'];
  validationComponentFailures: Array<Record<string, unknown>>;
  apexTestFailures: Array<Record<string, unknown>>;
  coverage: number | null;
}

export function groupQualityResults(
  results: WorkbenchResults | null,
  status?: WorkbenchStatus | null,
): GroupedQualityResults {
  if (!results) {
    return {
      staticIssues: [],
      validationComponentFailures: [],
      apexTestFailures: [],
      coverage: null,
    };
  }
  const staticStage = results.stages.find((stage) => stage.key === 'static_analysis');
  const validation = results.stages.find((stage) => stage.key === 'validation');
  const apex = results.stages.find((stage) => stage.key === 'apex_tests');
  const validationRaw = asRecord(validation?.artifacts?.raw);
  const validationRoot = asRecord(validationRaw?.result) ?? validationRaw;
  const details = asRecord(validationRoot?.details);
  const apexRaw = asRecord(apex?.artifacts?.raw);
  const apexRoot = asRecord(apexRaw?.result) ?? apexRaw;
  const apexDetails = asRecord(apexRoot?.details);
  const validationFailures = results.componentFailures
    ?? recordArray(validation?.artifacts?.componentFailures)
    ?? recordArray(details?.componentFailures)
    ?? [];
  const artifactTestFailures =
    recordArray(apex?.artifacts?.testFailures)
    ?? recordArray(apexDetails?.runTestResult)
    ?? recordArray(details?.runTestResult)
    ?? [];
  const persistedTestFailures = results.testResults
    .filter((test) => test.status.toLowerCase() === 'failed')
    .map((test) => ({ ...test }));
  const coverageCandidates = [
    status?.results?.coverage?.percentage,
    results.coverage,
    validation?.summary?.coverage,
    apex?.summary?.coverage,
    details?.coverage,
    apexDetails?.coverage,
  ];
  const coverage = coverageCandidates.find(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  ) ?? null;
  return {
    staticIssues: staticStage?.id
      ? results.issues.filter((issue) => issue.stageId === staticStage.id)
      : status?.results?.staticAnalysis?.issues ?? results.issues.filter(
        (issue) => issue.engine !== 'salesforce',
      ),
    validationComponentFailures: status?.results?.validation?.issues?.map(
      (issue) => ({ ...issue }),
    ) ?? validationFailures,
    apexTestFailures: results.apexTestFailures
      ?? (
        status?.results?.tests?.results
          .filter((test) => test.status.toLowerCase() === 'failed')
          .map((test) => ({ ...test }))
        ?? (persistedTestFailures.length ? persistedTestFailures : artifactTestFailures)
      ),
    coverage,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function recordArray(value: unknown): Array<Record<string, unknown>> | undefined {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
    );
  }
  const record = asRecord(value);
  return record ? [record] : undefined;
}

export function layoutDependencyGraph(graph: DependencyGraph, limit = 24) {
  const nodes = graph.nodes.slice(0, limit);
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const positions = new Map(nodes.map((node, index) => [
    node.id,
    {
      x: 90 + (index % columns) * 180,
      y: 45 + Math.floor(index / columns) * 90,
    },
  ]));
  const rows = Math.max(1, Math.ceil(nodes.length / columns));
  return {
    nodes: nodes.map((node) => ({ ...node, ...positions.get(node.id)! })),
    edges: graph.edges.flatMap((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      return from && to ? [{ ...edge, fromPosition: from, toPosition: to }] : [];
    }),
    width: columns * 180,
    height: rows * 90,
    truncated: graph.nodes.length > nodes.length,
  };
}
