import { describe, expect, it } from 'vitest';
import { buildSuggestedMappings, suggestMatchColumn, suggestTargetField } from './bulk-data-update-mapping';

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

  it('maps each Salesforce field at most once', () => {
    expect(buildSuggestedMappings(
      ['Employee Name', 'Full Name', 'Name', 'Bottler Number', 'cfs_ob__FullName__c'],
      [
        ...fields,
        { name: 'cfs_ob__FullName__c', label: 'Full Name' },
      ],
      ['cfs_ob__EmployeeNo__c'],
    )).toEqual({
      'Employee Name': 'Name',
      'Full Name': 'cfs_ob__FullName__c',
      Name: '',
      'Bottler Number': 'cfs_ob__Bottler__c',
      'cfs_ob__FullName__c': '',
    });
  });

  it('prefers exact API-name headers for match columns', () => {
    expect(suggestMatchColumn(
      ['_', 'cfs_ob__EmployeeNo__c', 'cfs_ob__u_Sales_Office__c'],
      { name: 'cfs_ob__EmployeeNo__c', label: 'Employee No' },
    )).toBe('cfs_ob__EmployeeNo__c');
    expect(suggestMatchColumn(
      ['_', 'cfs_ob__EmployeeNo__c', 'cfs_ob__u_Sales_Office__c'],
      { name: 'cfs_ob__u_Sales_Office__c', label: 'Sales Office' },
    )).toBe('cfs_ob__u_Sales_Office__c');
  });
});
