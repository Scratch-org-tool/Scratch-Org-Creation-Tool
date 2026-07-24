import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichSfdmuExportForRecordTypes,
  ensureRecordTypeDeveloperNameInSoql,
  normalizeSfdmuExport,
} from './sfdmu-export.js';

describe('SFDMU RecordType enrichment', () => {
  it('adds RecordType.DeveloperName next to RecordTypeId', () => {
    const soql = 'SELECT IsDeleted, RecordTypeId, Name FROM cfs_ob__Onboarding_Config__c';
    assert.equal(
      ensureRecordTypeDeveloperNameInSoql(soql),
      'SELECT IsDeleted, RecordTypeId, RecordType.DeveloperName, Name FROM cfs_ob__Onboarding_Config__c',
    );
  });

  it('injects a Readonly RecordType lookup object when RecordTypeId is used', () => {
    const enriched = enrichSfdmuExportForRecordTypes({
      objects: [
        {
          query: 'SELECT RecordTypeId, Name FROM cfs_ob__Onboarding_Config__c',
          operation: 'Upsert',
        },
      ],
    });
    assert.equal(enriched.objects.length, 2);
    assert.equal(enriched.objects[0]?.name, 'RecordType');
    assert.equal(enriched.objects[0]?.operation, 'Readonly');
    assert.match(enriched.objects[1]!.query, /RecordType\.DeveloperName/);

    const normalized = normalizeSfdmuExport({
      objects: [
        {
          query: 'SELECT RecordTypeId, Name FROM cfs_ob__Onboarding_Config__c',
          operation: 'Upsert',
        },
      ],
    });
    const recordType = normalized.objects.find((object) => object.name === 'RecordType');
    assert.ok(recordType);
    assert.equal(recordType.operation, 'Readonly');
    assert.equal(recordType.externalId, 'DeveloperName;NamespacePrefix;SobjectType');
    const onboarding = normalized.objects.find((object) => object.name === 'cfs_ob__Onboarding_Config__c');
    assert.match(onboarding!.query, /RecordType\.DeveloperName/);
  });
});
