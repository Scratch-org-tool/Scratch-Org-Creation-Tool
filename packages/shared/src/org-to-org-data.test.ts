import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  orgToOrgCompareSchema,
  orgToOrgDeploySchema,
  orgToOrgDeployBatchSchema,
  orgToOrgPreviewFilterSchema,
  computeKeyDiff,
  applySoqlPagination,
  buildKeySoql,
  buildListSoql,
  buildDeploySoql,
  buildFilterSoql,
  normalizeSObjectList,
  resolveSoql,
  defaultDeployFieldSelection,
  resolveFieldsForDeploy,
  resolveFilterFieldName,
  normalizeOrgToOrgFilters,
  parseOrgToOrgSoql,
  validateSoqlForObject,
  deployFieldsFromSoqlSelect,
  resolveOrgToOrgPreviewSoql,
  resolveOrgToOrgDeploySoql,
  OrgToOrgSoqlParseError,
  type OrgToOrgDeployableField,
} from './org-to-org-data';

const SAMPLE_SOQL = `select id,AccountNumber,Name,cfs_ob__u_CustomerNumber__c,cfs_ob__u_ActiveCustomer__c from Account where cfs_ob__u_CustomerAccountGroup__c ='Z001'and cfs_ob__Bottler__c ='5000'`;

const SOURCE = '00000000-0000-4000-8000-000000000001';
const TARGET = '00000000-0000-4000-8000-000000000002';
const RECORD_ID = '001000000000001AA';

describe('orgToOrgCompareSchema', () => {
  it('parses valid compare input with soql', () => {
    const parsed = orgToOrgCompareSchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      objectName: 'Account',
      soql: 'SELECT Name FROM Account',
    });
    assert.equal(parsed.matchField, 'Name');
    assert.equal(parsed.page, 1);
    assert.equal(parsed.pageSize, 50);
  });

  it('parses compare input with selectedRecordIds', () => {
    const parsed = orgToOrgCompareSchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      objectName: 'Account',
      selectedRecordIds: [RECORD_ID],
    });
    assert.deepEqual(parsed.selectedRecordIds, [RECORD_ID]);
  });

  it('rejects compare input without soql or selectedRecordIds', () => {
    assert.throws(() =>
      orgToOrgCompareSchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: TARGET,
        objectName: 'Account',
      }),
    );
  });

  it('rejects the same source and target org', () => {
    assert.throws(() =>
      orgToOrgCompareSchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: SOURCE,
        objectName: 'Account',
        soql: 'SELECT Name FROM Account',
      }),
    );
  });
});

describe('orgToOrgDeploySchema', () => {
  it('requires strategy insert or upsert with soql', () => {
    const parsed = orgToOrgDeploySchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      objectName: 'Account',
      soql: 'SELECT Name FROM Account',
      strategy: 'upsert',
    });
    assert.equal(parsed.strategy, 'upsert');
  });

  it('parses deploy input with selectedRecordIds', () => {
    const parsed = orgToOrgDeploySchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      objectName: 'Account',
      selectedRecordIds: [RECORD_ID],
      strategy: 'insert',
    });
    assert.equal(parsed.strategy, 'insert');
  });

  it('rejects deploy without soql or selectedRecordIds', () => {
    assert.throws(() =>
      orgToOrgDeploySchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: TARGET,
        objectName: 'Account',
        strategy: 'insert',
      }),
    );
  });

  it('rejects the same source and target org', () => {
    assert.throws(() =>
      orgToOrgDeploySchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: SOURCE,
        objectName: 'Account',
        soql: 'SELECT Name FROM Account',
        strategy: 'upsert',
      }),
    );
  });
});

describe('computeKeyDiff', () => {
  it('computes only-in-source, only-in-target, and in-both', () => {
    const diff = computeKeyDiff(['A', 'B', 'C'], ['B', 'C', 'D']);
    assert.equal(diff.summary.sourceTotal, 3);
    assert.equal(diff.summary.targetTotal, 3);
    assert.equal(diff.summary.onlyInSource, 1);
    assert.equal(diff.summary.onlyInTarget, 1);
    assert.equal(diff.summary.inBoth, 2);
    assert.deepEqual(diff.onlyInSourceKeys, ['A']);
    assert.deepEqual(diff.onlyInTargetKeys, ['D']);
    assert.deepEqual(diff.inBothKeys, ['B', 'C']);
  });
});

describe('SOQL helpers', () => {
  it('applies pagination with OFFSET', () => {
    const q = applySoqlPagination('SELECT Name FROM Account LIMIT 100', 2, 50);
    assert.match(q, /LIMIT 50 OFFSET 50/);
  });

  it('rejects pagination beyond the Salesforce OFFSET cap', () => {
    assert.throws(
      () => applySoqlPagination('SELECT Name FROM Account', 42, 50),
      /OFFSET only up to 2,000/,
    );
  });

  it('builds key SOQL with WHERE clause', () => {
    const q = buildKeySoql(
      'SELECT Id, Name FROM Account WHERE Industry = \'Tech\' LIMIT 200',
      'Account',
      'Name',
      5000,
    );
    assert.match(q, /SELECT Name FROM Account WHERE Industry = 'Tech'/);
    assert.match(q, /LIMIT 5000/);
  });

  it('builds list SOQL with pagination', () => {
    const q = buildListSoql({
      objectName: 'Account',
      fields: ['Id', 'Name'],
      limit: 50,
      page: 2,
    });
    assert.match(q, /SELECT Id, Name FROM Account/);
    assert.match(q, /LIMIT 50 OFFSET 50/);
  });

  it('builds deploy SOQL with selected ids', () => {
    const q = buildDeploySoql({
      objectName: 'Account',
      fields: ['Id', 'Name'],
      selectedIds: [RECORD_ID],
    });
    assert.match(q, /WHERE Id IN \('001000000000001AA'\)/);
  });

  it('resolveSoql prefers explicit soql', () => {
    const q = resolveSoql({
      soql: 'SELECT Name FROM Account LIMIT 10',
      objectName: 'Account',
      selectedRecordIds: [RECORD_ID],
    });
    assert.equal(q, 'SELECT Name FROM Account LIMIT 10');
  });

  it('resolveSoql builds deploy soql from selected ids', () => {
    const q = resolveSoql({
      objectName: 'Account',
      selectedRecordIds: [RECORD_ID],
      displayFields: ['Id', 'Name'],
    });
    assert.match(q, /WHERE Id IN/);
  });
});

describe('normalizeSObjectList', () => {
  it('normalizes string array from SF CLI', () => {
    const list = normalizeSObjectList(['Account', 'Contact']);
    assert.equal(list.length, 2);
    assert.equal(list[0]?.name, 'Account');
    assert.equal(list[0]?.custom, false);
  });

  it('normalizes object array legacy format', () => {
    const list = normalizeSObjectList([
      { name: 'MyObj__c', label: 'My Obj', custom: true, queryable: true },
    ]);
    assert.equal(list[0]?.name, 'MyObj__c');
    assert.equal(list[0]?.label, 'My Obj');
  });
});

describe('buildFilterSoql', () => {
  it('builds SOQL with filter and limit', () => {
    const q = buildFilterSoql({
      objectName: 'Contact',
      fields: ['Id', 'Name', 'AccountId'],
      recordLimit: 100,
      filters: [{ field: 'AccountId', operator: 'not_empty', value: '' }],
    });
    assert.match(q, /FROM Contact WHERE AccountId != null/);
    assert.match(q, /LIMIT 100/);
  });

  it('builds SOQL with eq filter', () => {
    const q = buildFilterSoql({
      objectName: 'Account',
      fields: ['Id', 'Name'],
      recordLimit: 50,
      filters: [{ field: 'Industry', operator: 'eq', value: 'Tech' }],
    });
    assert.match(q, /Industry = 'Tech'/);
  });

  it('resolves filter labels to API names in SOQL', () => {
    const q = buildFilterSoql({
      objectName: 'Account',
      fields: ['Id', 'Name'],
      recordLimit: 50,
      filters: [{ field: 'Bottler', operator: 'eq', value: 'Acme' }],
      filterableFields: [{ name: 'Bottler__c', label: 'Bottler' }],
    });
    assert.match(q, /Bottler__c = 'Acme'/);
  });
});

describe('orgToOrgDeployBatchSchema', () => {
  it('parses batch deploy with multiple objects', () => {
    const parsed = orgToOrgDeployBatchSchema.parse({
      sourceOrgId: SOURCE,
      targetOrgId: TARGET,
      strategy: 'upsert',
      objects: [
        {
          objectName: 'Account',
          recordLimit: 200,
          filters: [],
        },
        {
          objectName: 'Contact',
          recordLimit: 100,
          filters: [{ field: 'AccountId', operator: 'not_empty' }],
        },
      ],
    });
    assert.equal(parsed.objects.length, 2);
  });

  it('rejects empty objects array', () => {
    assert.throws(() =>
      orgToOrgDeployBatchSchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: TARGET,
        strategy: 'insert',
        objects: [],
      }),
    );
  });

  it('rejects the same source and target org', () => {
    assert.throws(() =>
      orgToOrgDeployBatchSchema.parse({
        sourceOrgId: SOURCE,
        targetOrgId: SOURCE,
        strategy: 'upsert',
        objects: [{ objectName: 'Account', filters: [] }],
      }),
    );
  });
});

describe('defaultDeployFieldSelection', () => {
  const fields: OrgToOrgDeployableField[] = [
    {
      name: 'Name',
      label: 'Name',
      type: 'string',
      required: false,
      createable: true,
      reference: false,
      custom: false,
      selected: true,
    },
    {
      name: 'Required__c',
      label: 'Required',
      type: 'string',
      required: true,
      createable: true,
      reference: false,
      custom: true,
      selected: true,
    },
    {
      name: 'Optional__c',
      label: 'Optional',
      type: 'string',
      required: false,
      createable: true,
      reference: false,
      custom: true,
      selected: false,
    },
    {
      name: 'Id',
      label: 'Record ID',
      type: 'id',
      required: false,
      createable: false,
      reference: false,
      custom: false,
      selected: false,
    },
  ];

  it('selects required fields and match field, excludes Id', () => {
    const selected = defaultDeployFieldSelection(fields, 'Name');
    assert.ok(selected.includes('Name'));
    assert.ok(selected.includes('Required__c'));
    assert.ok(!selected.includes('Id'));
    assert.ok(!selected.includes('Optional__c'));
  });
});

describe('resolveFieldsForDeploy', () => {
  it('prefers selectedDeployFields over display and reference fields', () => {
    const fields = resolveFieldsForDeploy(
      ['Id', 'Name'],
      ['AccountId'],
      ['Name', 'Industry', 'Required__c'],
      false,
    );
    assert.deepEqual(fields, ['Name', 'Industry', 'Required__c']);
  });

  it('adds Id for preview queries', () => {
    const fields = resolveFieldsForDeploy(
      ['Name'],
      [],
      ['Name', 'Industry'],
      true,
    );
    assert.ok(fields.includes('Id'));
    assert.ok(fields.includes('Name'));
    assert.ok(fields.includes('Industry'));
  });
});

describe('orgToOrgPreviewFilterSchema', () => {
  it('accepts selectedDeployFields', () => {
    const parsed = orgToOrgPreviewFilterSchema.parse({
      sourceOrgId: SOURCE,
      objectName: 'Account',
      selectedDeployFields: ['Name', 'Industry'],
    });
    assert.deepEqual(parsed.selectedDeployFields, ['Name', 'Industry']);
  });
});

describe('resolveFilterFieldName', () => {
  const fields = [
    { name: 'Bottler__c', label: 'Bottler' },
    { name: 'Name', label: 'Account Name' },
  ];

  it('returns API name when already provided', () => {
    assert.equal(resolveFilterFieldName('Bottler__c', fields), 'Bottler__c');
  });

  it('resolves label to API name', () => {
    assert.equal(resolveFilterFieldName('Bottler', fields), 'Bottler__c');
  });

  it('normalizes filters before SOQL build', () => {
    const normalized = normalizeOrgToOrgFilters(
      [{ field: 'Bottler', operator: 'eq', value: 'Acme' }],
      fields,
    );
    assert.equal(normalized[0]?.field, 'Bottler__c');
  });
});

describe('parseOrgToOrgSoql', () => {
  it('parses sample Account query with fields and eq filters', () => {
    const parsed = parseOrgToOrgSoql(SAMPLE_SOQL);
    assert.equal(parsed.objectName, 'Account');
    assert.deepEqual(parsed.fields, [
      'Id',
      'AccountNumber',
      'Name',
      'cfs_ob__u_CustomerNumber__c',
      'cfs_ob__u_ActiveCustomer__c',
    ]);
    assert.equal(parsed.filters.length, 2);
    assert.equal(parsed.filters[0]?.field, 'cfs_ob__u_CustomerAccountGroup__c');
    assert.equal(parsed.filters[0]?.value, 'Z001');
    assert.equal(parsed.filters[1]?.field, 'cfs_ob__Bottler__c');
    assert.equal(parsed.filters[1]?.value, '5000');
  });

  it('validateSoqlForObject rejects wrong object', () => {
    assert.throws(
      () => validateSoqlForObject(SAMPLE_SOQL, 'Contact'),
      OrgToOrgSoqlParseError,
    );
  });

  it('deployFieldsFromSoqlSelect excludes Id', () => {
    const deployFields = deployFieldsFromSoqlSelect(['Id', 'Name', 'Industry']);
    assert.deepEqual(deployFields, ['Name', 'Industry']);
  });

  it('resolveOrgToOrgDeploySoql strips embedded LIMIT and applies cap', () => {
    const q = resolveOrgToOrgDeploySoql({
      soql: 'SELECT Id FROM Account LIMIT 5',
      recordLimit: 200,
    });
    assert.match(q, /LIMIT 200$/);
    assert.doesNotMatch(q, /LIMIT 5/);
  });

  it('resolveOrgToOrgPreviewSoql paginates', () => {
    const q = resolveOrgToOrgPreviewSoql({
      soql: SAMPLE_SOQL,
      page: 2,
      pageSize: 50,
    });
    assert.match(q, /LIMIT 50 OFFSET 50/);
  });

  it('preview schema accepts soql', () => {
    const parsed = orgToOrgPreviewFilterSchema.parse({
      sourceOrgId: SOURCE,
      objectName: 'Account',
      soql: SAMPLE_SOQL,
    });
    assert.equal(parsed.soql, SAMPLE_SOQL);
  });
});
