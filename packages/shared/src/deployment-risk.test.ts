import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeDeploymentRisk, riskLevelForScore } from './deployment-risk.js';

describe('computeDeploymentRisk', () => {
  it('scores a small sandbox deploy as low risk', () => {
    const result = computeDeploymentRisk({
      componentCount: 5,
      metadataTypes: ['ApexClass'],
      destructiveCount: 0,
      testLevel: 'RunLocalTests',
      targetOrgType: 'sandbox',
      recentFailureRate: 0,
      orgWideCoverage: 90,
    });
    assert.equal(result.level, 'low');
    assert.equal(result.score, 0);
  });

  it('stacks factors for a risky production deploy', () => {
    const result = computeDeploymentRisk({
      componentCount: 250,
      metadataTypes: ['Profile', 'CustomObject', 'ApexTrigger'],
      destructiveCount: 12,
      testLevel: 'NoTestRun',
      targetOrgType: 'prod',
      recentFailureRate: 0.5,
      orgWideCoverage: 60,
    });
    assert.equal(result.score, 100);
    assert.equal(result.level, 'critical');
    const triggered = result.factors.filter((factor) => factor.triggered).map((f) => f.id);
    assert.ok(triggered.includes('large_package'));
    assert.ok(triggered.includes('access_metadata'));
    assert.ok(triggered.includes('destructive_changes'));
    assert.ok(triggered.includes('no_tests'));
    assert.ok(triggered.includes('production_target'));
    assert.ok(triggered.includes('failure_history'));
    assert.ok(triggered.includes('low_coverage'));
  });

  it('does not trigger history/coverage factors without data', () => {
    const result = computeDeploymentRisk({
      componentCount: 10,
      metadataTypes: ['ApexClass'],
      destructiveCount: 0,
      targetOrgType: 'prod',
      recentFailureRate: null,
      orgWideCoverage: null,
    });
    const byId = new Map(result.factors.map((factor) => [factor.id, factor]));
    assert.equal(byId.get('failure_history')?.triggered, false);
    assert.equal(byId.get('low_coverage')?.triggered, false);
    assert.equal(byId.get('production_target')?.triggered, true);
  });

  it('maps scores onto levels', () => {
    assert.equal(riskLevelForScore(0), 'low');
    assert.equal(riskLevelForScore(30), 'medium');
    assert.equal(riskLevelForScore(60), 'high');
    assert.equal(riskLevelForScore(90), 'critical');
  });
});
