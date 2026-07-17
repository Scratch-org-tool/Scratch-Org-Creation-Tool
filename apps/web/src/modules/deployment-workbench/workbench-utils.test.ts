import { describe, expect, it } from 'vitest';
import {
  applyProductionLocks,
  buildCompareKey,
  compareTypeSummaries,
  componentCount,
  createInitialForm,
  autoStaticAnalysisEngines,
  defaultStaticAnalysisEngines,
  filterCompareItems,
  groupQualityResults,
  invalidateSourceState,
  layoutDependencyGraph,
  payloadFromForm,
  policyForEnvironment,
  profileForOrgType,
  runCanResume,
  serverRunActions,
  selectionsFromCompareItems,
  splitCompareKey,
  stageRisk,
  staticAnalysisEngineOptions,
  validateWorkbenchForm,
  withAutoStaticAnalysis,
} from './workbench-utils';
import type { WorkbenchCapabilities } from './types';

function capabilitiesWith(overrides: Partial<WorkbenchCapabilities>): WorkbenchCapabilities {
  return {
    executionAvailable: true,
    strategies: ['direct'],
    sourceTypes: ['org_compare'],
    environments: ['scratch', 'sandbox', 'production'],
    testLevels: ['NoTestRun'],
    staticAnalysisEngines: ['built-in', 'code-analyzer', 'pmd', 'eslint'],
    supports: {
      dependencies: true,
      includeOptional: false,
      destructiveChanges: true,
      snapshots: true,
      rollback: true,
      approvals: true,
      chainedData: true,
    },
    ...overrides,
  };
}

describe('deployment workbench utilities', () => {
  it('maps connected org types to backend environment profiles', () => {
    expect(profileForOrgType('prod')).toBe('production');
    expect(profileForOrgType('sandbox')).toBe('sandbox');
    expect(profileForOrgType('scratch')).toBe('scratch');
  });

  it('groups deployable and destructive comparison selections separately', () => {
    const items = [
      { metadataType: 'ApexClass', fullName: 'B', diffType: 'new' as const },
      { metadataType: 'ApexClass', fullName: 'A', diffType: 'changed' as const },
      { metadataType: 'CustomObject', fullName: 'Old__c', diffType: 'deleted' as const },
      { metadataType: 'ApexClass', fullName: 'Same', diffType: 'same' as const },
    ];
    expect(selectionsFromCompareItems(items)).toEqual([
      { metadataType: 'ApexClass', members: ['A', 'B'] },
    ]);
    expect(selectionsFromCompareItems(items, true)).toEqual([
      { metadataType: 'CustomObject', members: ['Old__c'] },
    ]);
  });

  it('cannot weaken production policy in client state', () => {
    const unlocked = policyForEnvironment('scratch');
    const locked = applyProductionLocks(unlocked);
    expect(locked.validation.required).toBe(true);
    expect(locked.approval.required).toBe(true);
    expect(locked.tests.level).toBe('RunLocalTests');
    expect(locked.tests.minimumCoverage).toBe(75);
  });

  it('normalizes engine options from the server catalog with local fallback', () => {
    const fromServer = staticAnalysisEngineOptions(capabilitiesWith({
      staticAnalysisEngineInfo: [{
        id: 'built-in',
        label: 'Built-in Salesforce rules',
        description: 'Bundled analyzer',
        available: true,
        requires: null,
      }],
    }));
    expect(fromServer).toHaveLength(1);
    expect(fromServer[0]).toMatchObject({ id: 'built-in', available: true });

    const fallback = staticAnalysisEngineOptions(capabilitiesWith({
      staticAnalysisAvailability: { 'code-analyzer': false, pmd: false, eslint: true },
    }));
    expect(fallback.map((engine) => engine.id)).toEqual([
      'built-in',
      'code-analyzer',
      'pmd',
      'eslint',
    ]);
    expect(fallback.find((engine) => engine.id === 'built-in')).toMatchObject({
      available: true,
      label: expect.stringContaining('Built-in'),
    });
    expect(fallback.find((engine) => engine.id === 'code-analyzer')).toMatchObject({
      available: false,
      requires: expect.stringContaining('Salesforce CLI'),
    });
  });

  it('defaults static analysis to an engine that is actually available', () => {
    expect(defaultStaticAnalysisEngines(capabilitiesWith({
      staticAnalysisAvailability: { 'code-analyzer': true },
    }))).toEqual(['code-analyzer']);
    expect(defaultStaticAnalysisEngines(capabilitiesWith({
      staticAnalysisAvailability: { 'code-analyzer': false, pmd: false, eslint: false },
    }))).toEqual(['built-in']);
    expect(defaultStaticAnalysisEngines(null)).toEqual(['code-analyzer']);

    const unavailable = capabilitiesWith({
      staticAnalysisAvailability: { 'code-analyzer': false, pmd: false, eslint: false },
    });
    const production = policyForEnvironment('production', unavailable);
    expect(production.staticAnalysis.enabled).toBe(true);
    expect(production.staticAnalysis.engines).toEqual(['code-analyzer', 'pmd', 'eslint']);
    expect(autoStaticAnalysisEngines(unavailable)).toEqual(['built-in']);
    expect(withAutoStaticAnalysis(production, unavailable).staticAnalysis.engines).toEqual(['built-in']);
  });

  it('reports blockers separately from review warnings', () => {
    const form = createInitialForm();
    form.sourceOrgId = 'source';
    form.targetOrgId = 'target';
    form.components = [{ metadataType: 'ApexClass', members: ['Example'] }];
    form.dependencyPolicy.mode = 'selected_only';
    form.policy.snapshot.required = false;
    const result = validateWorkbenchForm(form, false);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toContain('Selected-only mode may omit required transitive dependencies.');
    expect(result.warnings).toContain('No target snapshot will be captured before mutation.');
  });

  it('builds a normalized SCM payload and validates chained data JSON', () => {
    const form = createInitialForm('scm');
    form.targetOrgId = '00000000-0000-4000-8000-000000000001';
    form.sourceOrgId = 'must-not-leak';
    form.components = [{ metadataType: 'ApexClass', members: ['Stale'] }];
    form.destructiveSelections = [{ metadataType: 'ApexClass', members: ['Old'] }];
    form.chainedDataEnabled = true;
    form.chainedDataJson = '[{"objectName":"Account","strategy":"upsert","matchField":"ExternalId__c"}]';
    const source = {
      type: 'scm' as const,
      provider: 'github' as const,
      repo: 'example/repo',
      branch: 'main',
      manifestPath: 'manifest/package.xml',
    };
    const payload = payloadFromForm(form, source);
    expect(payload.source).toEqual(source);
    expect(payload.components).toEqual([]);
    expect(payload.destructiveSelections).toEqual([]);
    expect(payload.chainedData?.config).toEqual([{
      objectName: 'Account',
      strategy: 'upsert',
      matchField: 'ExternalId__c',
    }]);
    form.chainedDataJson = '{}';
    expect(() => payloadFromForm(form, source)).toThrow(/non-empty JSON array/);
    form.chainedDataJson = '[{"objectName":';
    expect(() => payloadFromForm(form, source)).toThrow(/not valid JSON/);
  });

  it('invalidates every source-specific selection when mode or org changes', () => {
    const form = createInitialForm();
    form.comparisonId = 'comparison';
    form.components = [{ metadataType: 'ApexClass', members: ['Current'] }];
    form.destructiveSelections = [{ metadataType: 'ApexClass', members: ['Old'] }];
    const switched = invalidateSourceState(form, { sourceMode: 'scm', sourceOrgId: '' });
    expect(switched).toMatchObject({
      sourceMode: 'scm',
      sourceOrgId: '',
      components: [],
      destructiveSelections: [],
    });
    expect(switched.comparisonId).toBeUndefined();
    const retargeted = invalidateSourceState(form, { targetOrgId: 'new-target' });
    expect(retargeted.components).toEqual([]);
    expect(retargeted.destructiveSelections).toEqual([]);
    expect(retargeted.comparisonId).toBeUndefined();
  });

  it('uses only explicit server action flags and never infers approval', () => {
    const status = {
      id: 'run',
      status: 'awaiting_approval',
      currentStage: 'approval',
      validationId: 'validation',
      approvalRequired: true,
      approvedAt: null,
      rejectedAt: null,
      createdAt: '',
      updatedAt: '',
      canCancel: true,
    };
    expect(serverRunActions(status)).toEqual({
      canApprove: false,
      canReject: false,
      canQuickDeploy: false,
      canCancel: true,
      canResume: false,
      canRollback: false,
    });
    expect(serverRunActions({ ...status, canApprove: true }).canApprove).toBe(true);
  });

  it('separates validation failures, Apex failures, static issues, and coverage', () => {
    const grouped = groupQualityResults({
      id: 'run',
      status: 'failed',
      stages: [{
        id: 'validation-stage',
        key: 'validation',
        ordinal: 1,
        required: true,
        status: 'failed',
        summary: { coverage: 72 },
        artifacts: {
          raw: { result: { details: { componentFailures: [{ fullName: 'Broken' }] } } },
        },
      }, {
        id: 'apex-stage',
        key: 'apex_tests',
        ordinal: 2,
        required: true,
        status: 'failed',
      }, {
        id: 'static-stage',
        key: 'static_analysis',
        ordinal: 3,
        required: true,
        status: 'passed',
      }],
      issues: [{
        id: 'issue',
        stageId: 'static-stage',
        engine: 'pmd',
        ruleId: 'Rule',
        severity: 'error',
        message: 'Static issue',
      }, {
        id: 'validation-warning',
        stageId: 'validation-stage',
        engine: 'custom-validator',
        ruleId: 'VALIDATION',
        severity: 'warning',
        message: 'Must remain in validation',
      }],
      testResults: [{
        id: 'test',
        className: 'ExampleTest',
        methodName: 'fails',
        status: 'failed',
      }],
      audits: [],
    });
    expect(grouped.staticIssues).toHaveLength(1);
    expect(grouped.validationComponentFailures).toEqual([{ fullName: 'Broken' }]);
    expect(grouped.apexTestFailures).toHaveLength(1);
    expect(grouped.coverage).toBe(72);
  });

  it('counts grouped components and classifies execution risk', () => {
    expect(componentCount([
      { metadataType: 'ApexClass', members: ['A', 'B'] },
      { metadataType: 'Flow', members: ['C'] },
    ])).toBe(3);
    expect(stageRisk({ key: 'deploy' })).toBe('high');
    expect(stageRisk({ key: 'validation' })).toBe('medium');
    expect(stageRisk({ key: 'source' })).toBe('low');
    expect(runCanResume('failed', { resumable: true })).toBe(true);
    expect(runCanResume('running', { resumable: true })).toBe(false);
  });

  it('lays out a bounded dependency graph while preserving visible edges', () => {
    const layout = layoutDependencyGraph({
      nodes: [
        { id: 'A', selected: true },
        { id: 'B' },
        { id: 'C' },
      ],
      edges: [
        { from: 'A', to: 'B', explanation: 'A references B' },
        { from: 'B', to: 'C' },
      ],
    }, 2);
    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]?.explanation).toBe('A references B');
    expect(layout.truncated).toBe(true);
  });

  it('summarizes comparison items by metadata type with per-state counts', () => {
    const items = [
      { metadataType: 'ApexClass', fullName: 'A', diffType: 'new' as const },
      { metadataType: 'ApexClass', fullName: 'B', diffType: 'changed' as const },
      { metadataType: 'ApexClass', fullName: 'C', diffType: 'same' as const },
      { metadataType: 'CustomObject', fullName: 'Obj__c', diffType: 'new' as const },
      { metadataType: 'CustomObject', fullName: 'Old__c', diffType: 'deleted' as const },
      { metadataType: 'CustomField', fullName: 'Obj__c.Field__c', diffType: 'changed' as const },
      { metadataType: 'CustomField', fullName: 'Obj__c.Other__c', diffType: 'unknown' as const },
    ];
    const summaries = compareTypeSummaries(items);
    expect(summaries).toHaveLength(3);
    const apex = summaries.find((summary) => summary.metadataType === 'ApexClass')!;
    expect(apex).toMatchObject({ total: 3, new: 1, changed: 1, same: 1, deleted: 0, unknown: 0 });
    const customObject = summaries.find((summary) => summary.metadataType === 'CustomObject')!;
    expect(customObject).toMatchObject({ total: 2, new: 1, deleted: 1 });
    expect(summaries[0].metadataType).toBe('ApexClass');
  });

  it('filters comparison items by type, state, and search', () => {
    const items = [
      { metadataType: 'ApexClass', fullName: 'AccountController', diffType: 'new' as const },
      { metadataType: 'ApexClass', fullName: 'ContactController', diffType: 'changed' as const },
      { metadataType: 'CustomObject', fullName: 'Account', diffType: 'changed' as const },
      { metadataType: 'ApexClass', fullName: 'OldJob', diffType: 'deleted' as const },
    ];
    expect(filterCompareItems(items, { metadataType: 'ApexClass' })).toHaveLength(3);
    expect(filterCompareItems(items, { diffTypes: ['new', 'deleted'] })).toHaveLength(2);
    expect(filterCompareItems(items, { search: 'controller' })).toHaveLength(2);
    expect(filterCompareItems(items, { metadataType: 'ApexClass', diffTypes: ['changed'], search: 'contact' })).toHaveLength(1);
  });

  it('builds and splits stable compare keys', () => {
    expect(buildCompareKey('ApexClass', 'MyClass')).toBe('ApexClass::MyClass');
    expect(splitCompareKey('ApexClass::MyClass')).toEqual({ metadataType: 'ApexClass', fullName: 'MyClass' });
    expect(splitCompareKey('invalid')).toEqual({ metadataType: 'invalid', fullName: 'invalid' });
  });
});
