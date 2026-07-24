import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateSfdmuConfig,
  generateSfdmuConfigFromSoql,
  loadBundledMasterExport,
  resolveCustomSettingsExportConfig,
} from './sfdmu-config.generator';

const created: string[] = [];

afterEach(async () => {
  delete process.env.SFDMU_RUNS_DIR;
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('SFDMU runtime config', () => {
  it('preserves ordered multi-query external IDs and filters', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sfdmu-config-test-'));
    created.push(root);
    process.env.SFDMU_RUNS_DIR = root;
    const generated = generateSfdmuConfig({
      runId: 'multi',
      sourceOrgAlias: 'source',
      targetOrgAlias: 'target',
      querySet: {
        version: 1,
        source: 'upload',
        defaultLimit: 100,
        queries: [
          {
            id: 'parents',
            label: 'Parents',
            object: 'Parent__c',
            soql: "SELECT Key__c FROM Parent__c WHERE Active__c = true LIMIT 100",
            operation: 'upsert',
            externalIdField: 'Key__c',
            dependsOn: [],
          },
          {
            id: 'children',
            label: 'Children',
            object: 'Child__c',
            soql: "SELECT External__c FROM Child__c WHERE Parent__c != null LIMIT 100",
            operation: 'upsert',
            externalIdField: 'External__c',
            dependsOn: ['parents'],
          },
        ],
      },
    });
    const config = JSON.parse(await readFile(generated.exportJsonPath, 'utf8'));
    expect(config.objects.map((object: { name: string }) => object.name)).toEqual([
      'Parent__c',
      'Child__c',
    ]);
    expect(config.objects.map((object: { externalId: string }) => object.externalId)).toEqual([
      'Key__c',
      'External__c',
    ]);
    expect(config.objects[1].query).toContain('WHERE Parent__c != null');
  });

  it('never silently falls back to Name for upsert', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sfdmu-config-test-'));
    created.push(root);
    process.env.SFDMU_RUNS_DIR = root;
    expect(() => generateSfdmuConfigFromSoql({
      runId: 'bad',
      sourceOrgAlias: 'source',
      targetOrgAlias: 'target',
      objectName: 'Account',
      soql: 'SELECT Name FROM Account',
      operation: 'upsert',
    })).toThrow(/requires externalIdField/);

    const insert = generateSfdmuConfigFromSoql({
      runId: 'insert',
      sourceOrgAlias: 'source',
      targetOrgAlias: 'target',
      objectName: 'Account',
      soql: 'SELECT Name FROM Account',
      operation: 'insert',
    });
    const config = JSON.parse(await readFile(insert.exportJsonPath, 'utf8'));
    expect(config.objects[0]).toMatchObject({ operation: 'Insert' });
    expect(config.objects[0]).not.toHaveProperty('externalId');
  });

  it('loads the master bundled export with RecordType mapping for Onboarding Config', () => {
    const master = loadBundledMasterExport();
    const names = master.objects.map((object) => object.name);
    expect(names).toContain('RecordType');
    expect(names).toContain('cfs_ob__NortheastDsdLWCComponent__c');
    expect(names).toContain('Account');
    const onboarding = master.objects.find((object) => object.name === 'cfs_ob__Onboarding_Config__c');
    expect(onboarding?.query).toMatch(/RecordType\.DeveloperName/i);
    expect(onboarding?.query).toMatch(/RecordTypeId/i);
    const recordType = master.objects.find((object) => object.name === 'RecordType');
    expect(recordType?.operation.toLowerCase()).toBe('readonly');
    expect(recordType?.externalId).toContain('DeveloperName');
    expect(master.objects.length).toBeGreaterThanOrEqual(42);
  });

  it('resolves master mode to the master bundled export', () => {
    const custom = { objects: [{ query: 'SELECT Name FROM Account', operation: 'Upsert' as const }] };
    const master = resolveCustomSettingsExportConfig('master');
    expect(resolveCustomSettingsExportConfig('custom', custom)).toEqual(custom);
    expect(master.objects.length).toBeGreaterThan(1);
  });
});
