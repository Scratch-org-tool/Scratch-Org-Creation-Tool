import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPackageXml,
  parsePackageXml,
  compareMetadataLists,
  membersToSelections,
  resolveManifestXml,
  countProfileSelections,
  orgToOrgMetadataDeploySchema,
  isFolderMetadataType,
  buildComparisonItems,
  summarizeComparisonItems,
  classifyMetadataPair,
} from './org-to-org-metadata';

const SOURCE = '00000000-0000-4000-8000-000000000001';
const TARGET = '00000000-0000-4000-8000-000000000002';

describe('buildPackageXml', () => {
  it('builds valid package.xml from selections', () => {
    const xml = buildPackageXml([
      { metadataType: 'CustomObject', members: ['Account__c', 'Contact__c'] },
      { metadataType: 'ApexClass', members: ['MyClass'] },
    ]);
    assert.match(xml, /<name>CustomObject<\/name>/);
    assert.match(xml, /<members>Account__c<\/members>/);
    assert.match(xml, /<members>MyClass<\/members>/);
    assert.match(xml, /<version>62.0<\/version>/);
  });

  it('escapes XML special characters in member names', () => {
    const xml = buildPackageXml([{ metadataType: 'CustomLabel', members: ['A&B'] }]);
    assert.match(xml, /<members>A&amp;B<\/members>/);
  });
});

describe('parsePackageXml', () => {
  it('parses package.xml into members and selections', () => {
    const xml = buildPackageXml([
      { metadataType: 'Flow', members: ['My_Flow'] },
    ]);
    const parsed = parsePackageXml(xml);
    assert.equal(parsed.apiVersion, '62.0');
    assert.equal(parsed.members.length, 1);
    assert.equal(parsed.members[0].apiName, 'My_Flow');
    assert.deepEqual(parsed.selections[0].members, ['My_Flow']);
  });

  it('rejects invalid xml', () => {
    assert.throws(() => parsePackageXml('not xml'), /Invalid package\.xml/);
  });
});

describe('compareMetadataLists', () => {
  it('diffs source and target member lists', () => {
    const diff = compareMetadataLists(['A', 'B', 'C'], ['B', 'C', 'D']);
    assert.deepEqual(diff.onlyInSource, ['A']);
    assert.deepEqual(diff.onlyInTarget, ['D']);
    assert.deepEqual(diff.inBoth, ['B', 'C']);
  });
});

describe('resolveManifestXml', () => {
  it('prefers explicit packageXml when no selections', () => {
    const xml = buildPackageXml([{ metadataType: 'Profile', members: ['Admin'] }]);
    assert.equal(resolveManifestXml({ packageXml: xml }).trim(), xml.trim());
  });

  it('builds from selections', () => {
    const xml = resolveManifestXml({
      selections: [{ metadataType: 'CustomTab', members: ['MyTab'] }],
    });
    assert.match(xml, /<members>MyTab<\/members>/);
  });
});

describe('orgToOrgMetadataDeploySchema', () => {
  it('accepts valid deploy input with selections', () => {
    const parsed = orgToOrgMetadataDeploySchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      selections: [{ metadataType: 'CustomObject', members: ['Foo__c'] }],
    });
    assert.equal(parsed.testLevel, undefined);
  });

  it('rejects same source and target', () => {
    assert.throws(() =>
      orgToOrgMetadataDeploySchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: SOURCE,
        selections: [{ metadataType: 'CustomObject', members: ['Foo__c'] }],
      }),
    );
  });
});

describe('helpers', () => {
  it('countProfileSelections counts profile members', () => {
    assert.equal(
      countProfileSelections([
        { metadataType: 'Profile', members: ['Admin', 'Standard'] },
        { metadataType: 'ApexClass', members: ['X'] },
      ]),
      2,
    );
  });

  it('isFolderMetadataType identifies folder types', () => {
    assert.equal(isFolderMetadataType('Dashboard'), true);
    assert.equal(isFolderMetadataType('CustomObject'), false);
  });

  it('membersToSelections groups by type', () => {
    const selections = membersToSelections([
      { metadataType: 'ApexClass', apiName: 'A', isWildcard: false },
      { metadataType: 'ApexClass', apiName: 'B', isWildcard: false },
    ]);
    assert.deepEqual(selections, [{ metadataType: 'ApexClass', members: ['A', 'B'] }]);
  });
});

describe('buildComparisonItems', () => {
  it('classifies new, deleted, and uninspected pairs', () => {
    const items = buildComparisonItems(
      'CustomObject',
      [
        { fullName: 'A__c', lastModifiedDate: '2024-01-02' },
        { fullName: 'C__c', lastModifiedDate: '2024-01-01' },
      ],
      [
        { fullName: 'B__c', lastModifiedDate: '2024-01-01' },
        { fullName: 'C__c', lastModifiedDate: '2024-01-01' },
      ],
    );
    const byName = Object.fromEntries(items.map((i) => [i.fullName, i.diffType]));
    assert.equal(byName['A__c'], 'new');
    assert.equal(byName['B__c'], 'deleted');
    assert.equal(byName['C__c'], 'unknown');
    const summary = summarizeComparisonItems(items);
    assert.equal(summary.new, 1);
    assert.equal(summary.deleted, 1);
    assert.equal(summary.unknown, 1);
  });

  it('classifyMetadataPair keeps in-both items unknown until content diff', () => {
    assert.equal(
      classifyMetadataPair(
        { fullName: 'X', lastModifiedDate: '2024-01-01' },
        { fullName: 'X', lastModifiedDate: '2024-02-01' },
      ),
      'unknown',
    );
  });
});
