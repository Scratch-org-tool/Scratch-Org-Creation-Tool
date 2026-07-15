import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SfCliClient, SfCommandResult } from '@sfcc/sf-cli';
import { CheckpointStore } from '../checkpoint/checkpoint-store';
import { MetadataRepository } from '../repository/metadata-repository';
import type { DeployCheckpoint } from '../types/checkpoint';
import type { DeploySourceContext } from '../types/deploy-source';
import type { DeploymentPlan } from '../types/plan';
import { ExecutionEngine } from './execution-engine';
import { ManifestBuilder } from './manifest-builder';

const source: DeploySourceContext = {
  mode: 'local_workspace',
  projectRoot: '/project',
  manifestPath: 'manifest/package.xml',
  manifestAbsolutePath: '/project/manifest/package.xml',
  targetOrgAlias: 'target',
};

function plan(runId: string, batches: string[][]): DeploymentPlan {
  return {
    runId,
    totalNodes: batches.flat().length,
    batches: batches.map((nodeIds, index) => ({
      batchNumber: index + 1,
      nodeIds,
      tempManifestPath: '',
      estimatedWeight: nodeIds.length,
      status: 'pending',
    })),
    estimatedDurationMs: 0,
    criticalPath: [],
    sccGroups: [],
    metrics: {
      totalNodes: batches.flat().length,
      readyCount: batches.flat().length,
      deployedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      batchCount: batches.length,
      estimatedDurationMs: 0,
    },
  };
}

function mockCli(results: SfCommandResult[]): {
  cli: SfCliClient;
  calls: () => number;
  arguments: () => unknown[][];
} {
  let callCount = 0;
  const argumentsSeen: unknown[][] = [];
  const cli = {
    deployManifestCancellable: (...args: unknown[]) => {
      argumentsSeen.push(args);
      const result = results[callCount++];
      if (!result) throw new Error('Unexpected deploy call');
      return { promise: Promise.resolve(result), kill: () => undefined };
    },
  } as unknown as SfCliClient;
  return { cli, calls: () => callCount, arguments: () => argumentsSeen };
}

function successfulResult(): SfCommandResult {
  return {
    success: true,
    data: { result: { success: true, status: 'Succeeded' } },
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
}

function failedResult(problem: string): SfCommandResult {
  return {
    success: false,
    data: {
      result: {
        success: false,
        details: {
          componentFailures: [{
            componentType: 'ApexClass',
            fullName: 'RetryMe',
            problem,
          }],
        },
      },
    },
    stdout: '',
    stderr: problem,
    exitCode: 1,
  };
}

describe('ExecutionEngine', () => {
  it('executes a bounded retry for transient failures', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-retry-test-'));
    try {
      const repo = new MetadataRepository();
      repo.getOrCreate('ApexClass', 'RetryMe');
      const mock = mockCli([failedResult('Connection timeout'), successfulResult()]);
      const engine = new ExecutionEngine(
        mock.cli,
        new ManifestBuilder(workDir),
        new CheckpointStore(),
      );

      const result = await engine.executePlan(plan('retry-run', [['ApexClass:RetryMe']]), repo, source, {}, {
        maxRetries: 2,
      });

      assert.equal(result.success, true);
      assert.equal(mock.calls(), 2);
      assert.equal(repo.getNode('ApexClass:RetryMe')?.retryCount, 1);
      assert.equal(repo.getNode('ApexClass:RetryMe')?.deploymentState, 'DEPLOYED');
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('resumes the rebuilt plan at its failed pending batch', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-resume-test-'));
    const savedCheckpoints: DeployCheckpoint[] = [];
    const checkpointStore = new CheckpointStore({
      save: async (checkpoint) => {
        savedCheckpoints.push(checkpoint);
      },
      load: async () => savedCheckpoints.at(-1) ?? null,
    });
    try {
      const firstRepo = new MetadataRepository();
      firstRepo.getOrCreate('CustomObject', 'Done__c');
      firstRepo.getOrCreate('ApexClass', 'RetryMe');
      const firstCli = mockCli([successfulResult(), failedResult('Compile error')]);
      const firstEngine = new ExecutionEngine(
        firstCli.cli,
        new ManifestBuilder(workDir),
        checkpointStore,
      );

      const first = await firstEngine.executePlan(
        plan('resume-run', [['CustomObject:Done__c'], ['ApexClass:RetryMe']]),
        firstRepo,
        source,
        {},
      );
      assert.equal(first.success, false);
      const savedCheckpoint = savedCheckpoints.at(-1);
      assert.ok(savedCheckpoint);
      assert.equal(savedCheckpoint.lastCompletedBatch, 1);
      assert.deepEqual(savedCheckpoint.pendingNodeIds, ['ApexClass:RetryMe']);

      const resumedRepo = new MetadataRepository();
      resumedRepo.getOrCreate('CustomObject', 'Done__c');
      resumedRepo.getOrCreate('ApexClass', 'RetryMe');
      checkpointStore.applyToRepository(savedCheckpoint, resumedRepo);
      const resumedCli = mockCli([successfulResult()]);
      const resumedEngine = new ExecutionEngine(
        resumedCli.cli,
        new ManifestBuilder(workDir),
        checkpointStore,
      );
      const rebuiltPlan = plan('resume-run', [['ApexClass:RetryMe']]);

      const resumed = await resumedEngine.executePlan(
        rebuiltPlan,
        resumedRepo,
        source,
        {},
        { startBatch: checkpointStore.getResumeBatchNumber(savedCheckpoint) },
      );

      assert.equal(resumed.success, true);
      assert.equal(resumedCli.calls(), 1);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('passes every RunSpecifiedTests class to intelligent batch deploys', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-tests-test-'));
    try {
      const repo = new MetadataRepository();
      repo.getOrCreate('ApexClass', 'DeployMe');
      const mock = mockCli([successfulResult()]);
      const engine = new ExecutionEngine(
        mock.cli,
        new ManifestBuilder(workDir, '62.0'),
        new CheckpointStore(),
      );

      const result = await engine.executePlan(
        plan('tests-run', [['ApexClass:DeployMe']]),
        repo,
        { ...source, testLevel: 'RunSpecifiedTests' },
        {},
        { tests: ['FirstTest', 'SecondTest'] },
      );

      assert.equal(result.success, true);
      assert.deepEqual(mock.arguments()[0]?.[3], {
        tests: ['FirstTest', 'SecondTest'],
      });
      const manifest = fs.readFileSync(mock.arguments()[0]?.[1] as string, 'utf8');
      assert.match(manifest, /<version>62\.0<\/version>/);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });
});
