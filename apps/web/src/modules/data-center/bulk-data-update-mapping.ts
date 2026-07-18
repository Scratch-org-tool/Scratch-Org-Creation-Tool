export interface BulkUpdateMappableField {
  name: string;
  label: string;
}

function normalizedName(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/^cfs_ob__/, '')
    .replace(/__(c|r)$/, '')
    .replace(/[^a-z0-9]/g, '');
}

export function fieldAliases(field: BulkUpdateMappableField): string[] {
  const aliases = [field.name, field.label];
  const apiName = field.name.toLocaleLowerCase();
  if (apiName === 'cfs_ob__employeeno__c') {
    aliases.push(
      'Employee Number',
      'Employee No',
      'Employee Master Number',
      'Employee Master No',
      'Emp No',
    );
  } else if (apiName === 'name') {
    aliases.push('Employee Name', 'Full Name');
  } else if (apiName === 'cfs_ob__bottler__c') {
    aliases.push('Bottler', 'Bottler Number', 'Bottler No');
  } else if (apiName === 'cfs_ob__external_id__c') {
    aliases.push('External ID', 'External Id');
  }
  return aliases;
}

export function equivalentBulkUpdateHeading(left: string, right: string): boolean {
  return normalizedName(left) === normalizedName(right);
}

export function suggestTargetField(
  header: string,
  fields: BulkUpdateMappableField[],
): string {
  return fields.find((field) =>
    fieldAliases(field).some((alias) => equivalentBulkUpdateHeading(alias, header)))?.name ?? '';
}
