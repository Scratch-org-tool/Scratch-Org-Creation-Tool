import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  scratchPipelineTemplateConfigSchema,
  type ScratchPipelineTemplateConfig,
} from './sfdmu-export.js';
import {
  migrateTemplateConfigToV2,
} from './template-config-migration.js';

describe('ScratchPipelineTemplateConfig V2 compatibility', () => {
  it('continues to parse an unversioned legacy custom template', () => {
    const parsed = scratchPipelineTemplateConfigSchema.parse({
      customSettings: { mode: 'custom', enabled: true },
      dataSeed: {
        mode: 'hybrid',
        datasets: ['Accounts'],
      },
      userProvisioning: {
        users: [{
          firstName: '',
          lastName: '',
          email: 'legacy@example.com',
          role: '',
          bottler: '',
        }],
      },
    });
    assert.equal(parsed.version, undefined);
    assert.equal(parsed.customSettings?.mode, 'custom');
  });

  it('requires exportConfig for V2 custom mode only', () => {
    assert.throws(
      () =>
        scratchPipelineTemplateConfigSchema.parse({
          version: 2,
          customSettings: { mode: 'custom' },
        }),
      /requires exportConfig/,
    );
    const parsed = scratchPipelineTemplateConfigSchema.parse({
      version: 2,
      customSettings: {
        mode: 'custom',
        exportConfig: {
          objects: [{
            query: 'SELECT Name FROM Example__c',
            operation: 'Upsert',
            externalId: 'Name',
          }],
        },
      },
    });
    assert.equal(parsed.version, 2);
  });

  it('requires query sections and account partner plans for V2 selector modes', () => {
    assert.throws(
      () =>
        scratchPipelineTemplateConfigSchema.parse({
          version: 2,
          dataSeed: { mode: 'query_section' },
        }),
      /requires querySection/,
    );
    assert.throws(
      () =>
        scratchPipelineTemplateConfigSchema.parse({
          version: 2,
          dataSeed: {
            mode: 'query_section',
            querySection: {
              name: 'Accounts',
              queries: [{
                id: 'accounts',
                name: 'Accounts',
                enabled: true,
                order: 0,
                stage: 0,
                category: 'account',
                object: 'Account',
                soql: 'SELECT Name FROM Account',
                limit: 10,
                operation: 'upsert',
              }],
            },
          },
          partnerImport: { mode: 'query_section' },
        }),
      /accountPartnerPlan/,
    );
  });
});

describe('migrateTemplateConfigToV2', () => {
  function legacyConfig(): ScratchPipelineTemplateConfig {
    return scratchPipelineTemplateConfigSchema.parse({
      sourceOrgId: 'c9111cc6-1f69-4789-97f7-b4ed736fdeca',
      dataSeed: {
        mode: 'query_json',
        querySet: {
          version: 1,
          defaultLimit: 75,
          source: 'upload',
          queries: [{
            id: 'onboarding',
            label: 'Onboarding',
            object: 'cfs_ob__Onboarding_Config__c',
            soql: 'SELECT Name FROM cfs_ob__Onboarding_Config__c',
            limit: 75,
          }],
          accountRules: [{
            id: 'z001-rule',
            label: 'Z001 rule',
            accountGroup: 'Z001',
            bottler: '5000',
            distributionChannel: 'Z1',
            perOfficeLimit: 20,
          }],
        },
      },
      accountSeedRows: [{
        accountGroup: 'Z003',
        bottler: '4900',
        distributionChannel: 'Z3',
        limit: 30,
      }],
      userProvisioning: {
        users: [{
          firstName: 'Legacy',
          lastName: 'Concrete',
          email: 'legacy@example.com',
          role: 'Rep',
          bottler: '5000',
        }],
        templates: [{
          id: 'rep',
          label: 'Rep',
          bottler: '5000',
          role: 'Rep',
          modules: ['Sales'],
          locations: ['North'],
        }],
        slots: [{
          templateId: 'rep',
          firstName: 'Legacy',
          lastName: 'Slot',
          email: 'slot@example.com',
        }],
      },
    });
  }

  it('adds V2 sections without removing legacy fields', () => {
    const legacy = legacyConfig();
    const migrated = migrateTemplateConfigToV2(legacy);

    assert.equal(migrated.version, 2);
    assert.equal(migrated.dataDeploymentOrgId, legacy.sourceOrgId);
    assert.equal(migrated.customSettingsOrgId, legacy.sourceOrgId);
    assert.deepEqual(migrated.dataSeed?.querySet, legacy.dataSeed?.querySet);
    assert.deepEqual(migrated.accountSeedRows, legacy.accountSeedRows);
    assert.deepEqual(migrated.userProvisioning?.templates, legacy.userProvisioning?.templates);
    assert.deepEqual(migrated.userProvisioning?.slots, legacy.userProvisioning?.slots);
    assert.deepEqual(migrated.userProvisioning?.users, legacy.userProvisioning?.users);
    assert.equal(migrated.dataSeed?.mode, 'query_section');
    assert.deepEqual(
      migrated.dataSeed?.querySection?.queries.map((query) => query.id),
      ['onboarding', 'z001-rule', 'account-z003-4900-z3'],
    );
    assert.equal(migrated.userProvisioning?.roleBottlerMappings?.[0].role, 'Rep');
    assert.equal(migrated.userProvisioning?.execution?.concurrency, 1);
    assert.equal(scratchPipelineTemplateConfigSchema.parse(migrated).version, 2);
  });

  it('resolves legacy slots into concrete users when users are absent', () => {
    const legacy = legacyConfig();
    const migrated = migrateTemplateConfigToV2({
      ...legacy,
      userProvisioning: {
        templates: legacy.userProvisioning!.templates,
        slots: legacy.userProvisioning!.slots,
      },
    });
    assert.deepEqual(migrated.userProvisioning?.users, [{
      firstName: 'Legacy',
      lastName: 'Slot',
      email: 'slot@example.com',
      role: 'Rep',
      bottler: '5000',
      modules: ['Sales'],
      locations: ['North'],
    }]);
  });

  it('refuses to invent a missing V2 custom export config', () => {
    const legacy = scratchPipelineTemplateConfigSchema.parse({
      customSettings: { mode: 'custom' },
    });
    assert.throws(() => migrateTemplateConfigToV2(legacy), /without exportConfig/);
  });
});
