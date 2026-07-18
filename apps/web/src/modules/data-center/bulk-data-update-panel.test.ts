import { describe, expect, it } from 'vitest';
import { suggestTargetField } from './bulk-data-update-panel';

const fields = [
  {
    name: 'cfs_ob__EmployeeNo__c',
    label: 'Employee No',
    type: 'string',
    externalId: true,
    idLookup: false,
  },
  {
    name: 'Name',
    label: 'Employee Master Name',
    type: 'string',
    externalId: false,
    idLookup: true,
  },
  {
    name: 'cfs_ob__Bottler__c',
    label: 'Bottler',
    type: 'string',
    externalId: false,
    idLookup: false,
  },
];

describe('bulk data update mapping suggestions', () => {
  it('recognizes common Employee Master workbook headings', () => {
    expect(suggestTargetField('Employee Master Number', fields)).toBe(
      'cfs_ob__EmployeeNo__c',
    );
    expect(suggestTargetField('Employee Name', fields)).toBe('Name');
    expect(suggestTargetField('Bottler Number', fields)).toBe('cfs_ob__Bottler__c');
  });

  it('leaves unknown columns unmapped', () => {
    expect(suggestTargetField('Do Not Import', fields)).toBe('');
  });
});
