import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError } from 'zod';
import {
  STATIC_ANALYSIS_ENGINES,
  buildDeploymentStagePlan,
  deploymentWorkbenchInputSchema,
  evaluateDeploymentQualityGate,
  formatZodIssues,
  normalizeLegacyDeploymentPayload,
} from './deployment-workbench.js';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';

function input(profile: 'scratch' | 'sandbox' | 'production') {
  return {
    source: { type: 'org_compare' as const, sourceOrgId: SOURCE_ID },
    target: { orgId: TARGET_ID, profile },
    components: [{ metadataType: 'ApexClass', members: ['Example'] }],
  };
}

describe('deployment workbench policy defaults', () => {
  it('applies production-safe validation, tests, snapshot, and admin approval defaults', () => {
    const parsed = deploymentWorkbenchInputSchema.parse(input('production'));

    assert.equal(parsed.policy.validation.required, true);
    assert.equal(parsed.policy.tests.level, 'RunLocalTests');
    assert.equal(parsed.policy.tests.minimumCoverage, 75);
    assert.equal(parsed.policy.snapshot.required, true);
    assert.equal(parsed.policy.snapshot.rollbackRequired, true);
    assert.deepEqual(parsed.policy.approval, {
      required: true,
      approverType: 'admin',
      minimumApprovals: 1,
    });
  });

  it('keeps scratch safety controls explicitly configurable', () => {
    const parsed = deploymentWorkbenchInputSchema.parse({
      ...input('scratch'),
      policy: {
        tests: { level: 'RunSpecifiedTests', tests: ['ExampleTest'], minimumCoverage: 82 },
        validation: { required: true },
        snapshot: { required: true, rollbackRequired: false },
        approval: { required: true, approverType: 'distinct_user', minimumApprovals: 1 },
      },
    });

    assert.equal(parsed.policy.tests.level, 'RunSpecifiedTests');
    assert.equal(parsed.policy.validation.required, true);
    assert.equal(parsed.policy.approval.approverType, 'distinct_user');
  });

  it('rejects unsafe production overrides', () => {
    assert.throws(() => deploymentWorkbenchInputSchema.parse({
      ...input('production'),
      policy: {
        tests: { level: 'NoTestRun', tests: [], minimumCoverage: 0 },
        validation: { required: false },
        approval: { required: false },
      },
    }), /Production deployments require/);
  });

  it('formats schema failures as readable path-scoped sentences', () => {
    let error: unknown;
    try {
      deploymentWorkbenchInputSchema.parse({
        ...input('scratch'),
        policy: { staticAnalysis: { enabled: true, engines: [] } },
      });
    } catch (cause) {
      error = cause;
    }
    assert.ok(error instanceof ZodError);
    const message = formatZodIssues(error);
    assert.match(message, /policy\.staticAnalysis\.engines: At least one static analysis engine is required/);
  });

  it('publishes a static analysis engine catalog led by the built-in engine', () => {
    assert.equal(STATIC_ANALYSIS_ENGINES[0].id, 'built-in');
    assert.equal(STATIC_ANALYSIS_ENGINES[0].requires, null);
    const ids = STATIC_ANALYSIS_ENGINES.map((engine) => engine.id);
    assert.deepEqual(ids, ['built-in', 'code-analyzer', 'pmd', 'eslint']);
  });
});

describe('deployment workbench compatibility and planning', () => {
  it('normalizes an existing org-to-org deploy payload', () => {
    const parsed = normalizeLegacyDeploymentPayload({
      sourceOrgId: SOURCE_ID,
      targetOrgId: TARGET_ID,
      targetProfile: 'sandbox',
      selections: [{ metadataType: 'Flow', members: ['Order_Flow'] }],
      testLevel: 'RunSpecifiedTests',
      tests: ['OrderFlowTest'],
      validateOnly: true,
      intelligentDeployEnabled: true,
      chainDataDeploy: true,
      dataDeployConfig: [{ objectName: 'Account', strategy: 'upsert' }],
    });

    assert.deepEqual(parsed.source, { type: 'org_compare', sourceOrgId: SOURCE_ID });
    assert.equal(parsed.strategy, 'intelligent');
    assert.equal(parsed.policy.tests.level, 'RunSpecifiedTests');
    assert.equal(parsed.policy.validation.required, true);
    assert.equal(parsed.chainedData?.config[0]?.objectName, 'Account');
  });

  it('normalizes an existing Azure SCM payload provider-neutrally', () => {
    const parsed = normalizeLegacyDeploymentPayload({
      targetOrgId: TARGET_ID,
      targetProfile: 'scratch',
      repo: 'metadata',
      branch: 'main',
      project: 'platform',
      manifestPath: 'manifest/package.xml',
      selections: [{ metadataType: 'ApexClass', members: ['Example'] }],
    });

    assert.deepEqual(parsed.source, {
      type: 'scm',
      provider: 'azure_devops',
      repo: 'metadata',
      branch: 'main',
      project: 'platform',
      manifestPath: 'manifest/package.xml',
    });
  });

  it('preserves a legacy raw manifest when selections were not supplied', () => {
    const manifestXml = '<Package><types><members>*</members><name>ApexClass</name></types></Package>';
    const parsed = normalizeLegacyDeploymentPayload({
      sourceOrgId: SOURCE_ID,
      targetOrgId: TARGET_ID,
      targetProfile: 'scratch',
      packageXml: manifestXml,
      apiVersion: '65.0',
    });

    assert.equal(parsed.manifestXml, manifestXml);
    assert.equal(parsed.apiVersion, '65.0');
    assert.deepEqual(parsed.components, []);
  });

  it('orders quality stages before approval and deployment', () => {
    const parsed = deploymentWorkbenchInputSchema.parse({
      ...input('production'),
      strategy: 'validate_then_quick',
      policy: {
        staticAnalysis: {
          enabled: true,
          engines: ['pmd'],
          severityThreshold: 'error',
          maxCounts: { error: 0, critical: 0 },
          blockMode: 'threshold',
        },
      },
    });

    assert.deepEqual(buildDeploymentStagePlan(parsed).map((stage) => stage.key), [
      'source',
      'dependencies',
      'snapshot',
      'static_analysis',
      'validation',
      'apex_tests',
      'approval',
      'quick_deploy',
      'rollback_ready',
    ]);
  });

  it('supports destructive-only plans with an empty package selection', () => {
    const parsed = deploymentWorkbenchInputSchema.parse({
      source: { type: 'org_compare', sourceOrgId: SOURCE_ID },
      target: { orgId: TARGET_ID, profile: 'scratch' },
      components: [],
      destructiveSelections: [{ metadataType: 'ApexClass', members: ['LegacyClass'] }],
    });
    assert.deepEqual(parsed.components, []);
    assert.equal(parsed.destructiveSelections[0]?.members[0], 'LegacyClass');
  });

  it('rejects malformed or source-incompatible chained data before execution', () => {
    assert.throws(() => deploymentWorkbenchInputSchema.parse({
      source: {
        type: 'scm',
        provider: 'github',
        repo: 'metadata',
        branch: 'main',
      },
      target: { orgId: TARGET_ID, profile: 'scratch' },
      components: [{ metadataType: 'ApexClass', members: ['Example'] }],
      chainedData: {
        enabled: true,
        config: [{ objectName: 'Account', soql: 'SELECT Id FROM Contact', unexpected: true }],
      },
    }), /Unrecognized key|requires an org comparison source/);
  });
});

describe('deployment workbench quality gates', () => {
  it('blocks failed tests, low coverage, static thresholds, and missing controls', () => {
    const parsed = deploymentWorkbenchInputSchema.parse({
      ...input('production'),
      policy: {
        staticAnalysis: {
          enabled: true,
          engines: ['pmd'],
          severityThreshold: 'error',
          maxCounts: { error: 1, critical: 0 },
          blockMode: 'threshold',
        },
      },
    });
    const result = evaluateDeploymentQualityGate(parsed.policy, {
      validationPassed: false,
      testsRun: 2,
      testsFailed: 1,
      coverage: 70,
      staticCounts: { error: 2, critical: 0 },
      approved: false,
      snapshotCreated: false,
    });

    assert.equal(result.passed, false);
    assert.deepEqual(result.blockedBy.map((failure) => failure.gate), [
      'validation',
      'tests',
      'coverage',
      'static_analysis',
      'approval',
      'snapshot',
    ]);
  });

  it('passes when every configured gate meets its threshold', () => {
    const parsed = deploymentWorkbenchInputSchema.parse(input('production'));
    const result = evaluateDeploymentQualityGate(parsed.policy, {
      validationPassed: true,
      testsRun: 10,
      testsFailed: 0,
      coverage: 80,
      approved: true,
      snapshotCreated: true,
    });

    assert.deepEqual(result, { passed: true, blockedBy: [] });
  });
});
