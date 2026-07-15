import { describe, expect, it } from 'vitest';
import {
  applyProductionLocks,
  componentCount,
  createInitialForm,
  layoutDependencyGraph,
  payloadFromForm,
  policyForEnvironment,
  profileForOrgType,
  runCanResume,
  selectionsFromCompareItems,
  stageRisk,
  validateWorkbenchForm,
} from './workbench-utils';

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
    form.chainedDataEnabled = true;
    form.chainedDataJson = '[{"object":"Account"}]';
    const source = {
      type: 'scm' as const,
      provider: 'github' as const,
      repo: 'example/repo',
      branch: 'main',
      manifestPath: 'manifest/package.xml',
    };
    const payload = payloadFromForm(form, source);
    expect(payload.source).toEqual(source);
    expect(payload.chainedData?.config).toEqual([{ object: 'Account' }]);
    form.chainedDataJson = '{}';
    expect(() => payloadFromForm(form, source)).toThrow(/non-empty JSON array/);
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
});
