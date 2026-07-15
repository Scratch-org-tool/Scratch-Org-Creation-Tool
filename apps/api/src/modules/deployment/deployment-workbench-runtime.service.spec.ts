import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildDependencyPreview,
  parseDeployPayload,
} from './deployment-workbench-runtime.service';
import { buildPackageXml } from '@sfcc/shared';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('Deployment Workbench Salesforce result normalization', () => {
  it('persists validation id, Apex tests, failures, and aggregate coverage', () => {
    const parsed = parseDeployPayload({
      result: {
        id: '0Af-validation',
        status: 'Succeeded',
        details: {
          componentFailures: [{
            componentType: 'ApexClass',
            fullName: 'Broken',
            problemType: 'Error',
            problem: 'Compile error',
          }],
          runTestResult: {
            successes: [{ name: 'GoodTest', methodName: 'works', time: 12 }],
            failures: [{
              name: 'BadTest',
              methodName: 'fails',
              message: 'Expected true',
              stackTrace: 'Class.BadTest: line 3',
            }],
            codeCoverage: [
              { name: 'One', numLocations: 80, numLocationsNotCovered: 20 },
              { name: 'Two', numLocations: 20, numLocationsNotCovered: 5 },
            ],
          },
        },
      },
    });

    expect(parsed.id).toBe('0Af-validation');
    expect(parsed.success).toBe(false);
    expect(parsed.componentFailures).toHaveLength(1);
    expect(parsed.tests).toEqual([
      expect.objectContaining({ className: 'GoodTest', methodName: 'works', status: 'passed' }),
      expect.objectContaining({ className: 'BadTest', methodName: 'fails', status: 'failed' }),
    ]);
    expect(parsed.coverage).toBe(75);
  });

  it('accepts singleton Salesforce result objects without dropping tests', () => {
    const parsed = parseDeployPayload({
      success: true,
      id: '0Af-one',
      details: {
        runTestResult: {
          successes: { name: 'OnlyTest', methodName: 'onlyMethod' },
          codeCoveragePercentage: 92,
        },
      },
    });
    expect(parsed.tests).toHaveLength(1);
    expect(parsed.coverage).toBe(92);
  });

  it('normalizes deploy JSON embedded after CLI preamble text', () => {
    const parsed = parseDeployPayload(`warning before json
{"result":{"status":"Succeeded","id":"0Af-text","details":{"runTestResult":{"failures":[]}}}}`);
    expect(parsed).toEqual(expect.objectContaining({ success: true, id: '0Af-text' }));
  });

  it('fails closed for malformed analyzer or deploy output', () => {
    const parsed = parseDeployPayload('not-json');
    expect(parsed.success).toBe(false);
    expect(parsed.tests).toEqual([]);
    expect(parsed.componentFailures).toEqual([]);
  });
});

describe('Deployment Workbench dependency preview', () => {
  it('expands discovered source dependencies with nodes, edges, decisions, and explanations', () => {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'dependency-preview-test-'));
    tempRoots.push(root);
    const classes = path.join(root, 'force-app', 'main', 'default', 'classes');
    const objects = path.join(root, 'force-app', 'main', 'default', 'objects', 'Invoice__c');
    const manifestDir = path.join(root, 'manifest');
    fs.mkdirSync(classes, { recursive: true });
    fs.mkdirSync(objects, { recursive: true });
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(
      path.join(classes, 'InvoiceService.cls'),
      'public class InvoiceService { List<Invoice__c> rows = [FROM Invoice__c]; }',
    );
    fs.writeFileSync(
      path.join(classes, 'InvoiceService.cls-meta.xml'),
      '<ApexClass><apiVersion>62.0</apiVersion></ApexClass>',
    );
    fs.writeFileSync(
      path.join(objects, 'Invoice__c.object-meta.xml'),
      '<CustomObject><label>Invoice</label></CustomObject>',
    );
    const manifestPath = path.join(manifestDir, 'package.xml');
    fs.writeFileSync(manifestPath, `<?xml version="1.0"?>
<Package><types><members>InvoiceService</members><name>ApexClass</name></types><version>62.0</version></Package>`);

    const preview = buildDependencyPreview(
      'run-1',
      {
        projectRoot: root,
        manifestRelative: 'manifest/package.xml',
        manifestAbsolutePath: manifestPath,
        mode: 'local_workspace',
      },
      {
        mode: 'include_required',
        maxDepth: 10,
        failOnMissing: true,
        allowCycles: false,
      },
    );

    expect(preview.graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ApexClass:InvoiceService', selected: true }),
      expect.objectContaining({ id: 'CustomObject:Invoice__c', selected: false }),
    ]));
    expect(preview.graph.edges).toContainEqual(expect.objectContaining({
      from: 'ApexClass:InvoiceService',
      to: 'CustomObject:Invoice__c',
    }));
    expect(preview.decisions).toContainEqual(expect.objectContaining({
      nodeId: 'CustomObject:Invoice__c',
      decision: 'included',
    }));
    expect(preview.blocking).toEqual([]);
  });

  it('blocks absent required dependencies with a required-by explanation', () => {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'dependency-missing-test-'));
    tempRoots.push(root);
    const classes = path.join(root, 'force-app', 'main', 'default', 'classes');
    const manifestDir = path.join(root, 'manifest');
    fs.mkdirSync(classes, { recursive: true });
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(
      path.join(classes, 'MissingRef.cls'),
      'class MissingRef { void load() { [SELECT Id FROM Missing__c]; } }',
    );
    const manifestPath = path.join(manifestDir, 'package.xml');
    fs.writeFileSync(
      manifestPath,
      '<Package><types><members>MissingRef</members><name>ApexClass</name></types><version>62.0</version></Package>',
    );
    const preview = buildDependencyPreview(
      'run-2',
      {
        projectRoot: root,
        manifestRelative: 'manifest/package.xml',
        manifestAbsolutePath: manifestPath,
        mode: 'local_workspace',
      },
      { mode: 'include_required', maxDepth: 10, failOnMissing: true, allowCycles: false },
    );
    expect(preview.missing).toEqual([
      expect.objectContaining({
        nodeId: 'CustomObject:Missing__c',
        requiredBy: ['ApexClass:MissingRef'],
        explanation: expect.stringContaining('ApexClass:MissingRef'),
      }),
    ]);
    expect(preview.blocking[0]).toContain('required dependencies are missing');
  });

  it('keeps selected-only plans exact and produces identical approved execution batches', () => {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'dependency-selected-test-'));
    tempRoots.push(root);
    const classes = path.join(root, 'force-app', 'main', 'default', 'classes');
    const objects = path.join(root, 'force-app', 'main', 'default', 'objects', 'Invoice__c');
    const manifestDir = path.join(root, 'manifest');
    fs.mkdirSync(classes, { recursive: true });
    fs.mkdirSync(objects, { recursive: true });
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(classes, 'InvoiceService.cls'), 'class InvoiceService { Invoice__c row; }');
    fs.writeFileSync(
      path.join(objects, 'Invoice__c.object-meta.xml'),
      '<CustomObject><label>Invoice</label></CustomObject>',
    );
    const manifestPath = path.join(manifestDir, 'package.xml');
    fs.writeFileSync(
      manifestPath,
      '<Package><types><members>InvoiceService</members><name>ApexClass</name></types><version>62.0</version></Package>',
    );
    const workspace = {
      projectRoot: root,
      manifestRelative: 'manifest/package.xml',
      manifestAbsolutePath: manifestPath,
      mode: 'local_workspace' as const,
    };
    const selectedOnly = buildDependencyPreview('selected', workspace, {
      mode: 'selected_only',
      maxDepth: 10,
      failOnMissing: true,
      allowCycles: false,
    });
    expect(selectedOnly.resolvedSelections).toEqual([
      { metadataType: 'ApexClass', members: ['InvoiceService'] },
    ]);
    expect(selectedOnly.plan.batches.flatMap((batch) => batch.nodeIds)).toEqual([
      'ApexClass:InvoiceService',
    ]);

    const approved = buildDependencyPreview('approved', workspace, {
      mode: 'include_required',
      maxDepth: 10,
      failOnMissing: true,
      allowCycles: false,
    });
    fs.writeFileSync(manifestPath, buildPackageXml(approved.resolvedSelections, '62.0'));
    const execution = buildDependencyPreview('execution', workspace, {
      mode: 'include_required',
      maxDepth: 10,
      failOnMissing: true,
      allowCycles: false,
    });
    expect(execution.plan.batches.map((batch) => batch.nodeIds))
      .toEqual(approved.plan.batches.map((batch) => batch.nodeIds));
  });

  it('honors includeOptional by adding otherwise unrelated pinned components', () => {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'dependency-optional-test-'));
    tempRoots.push(root);
    const classes = path.join(root, 'force-app', 'main', 'default', 'classes');
    const manifestDir = path.join(root, 'manifest');
    fs.mkdirSync(classes, { recursive: true });
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(classes, 'Selected.cls'), 'class Selected {}');
    fs.writeFileSync(path.join(classes, 'Optional.cls'), 'class Optional {}');
    const manifestPath = path.join(manifestDir, 'package.xml');
    fs.writeFileSync(
      manifestPath,
      '<Package><types><members>Selected</members><name>ApexClass</name></types><version>62.0</version></Package>',
    );
    const preview = buildDependencyPreview('optional', {
      projectRoot: root,
      manifestRelative: 'manifest/package.xml',
      manifestAbsolutePath: manifestPath,
      mode: 'local_workspace',
    }, {
      mode: 'include_required',
      includeOptional: true,
      maxDepth: 10,
      failOnMissing: true,
      allowCycles: false,
    });
    expect(preview.resolvedSelections[0]?.members).toEqual(['Optional', 'Selected']);
    expect(preview.summary.optionalIncluded).toBe(1);
  });
});
