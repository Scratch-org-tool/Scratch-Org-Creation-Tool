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
  } else if (apiName === 'cfs_ob__u_sales_office__c') {
    aliases.push('Sales Office', 'Sales Office Number', 'SalesOffice', 'Office');
  } else if (apiName === 'cfs_ob__external_id__c') {
    aliases.push('External ID', 'External Id');
  }
  return aliases;
}

export function equivalentBulkUpdateHeading(left: string, right: string): boolean {
  if (left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()) return true;
  return normalizedName(left) === normalizedName(right);
}

export function suggestMatchColumn(
  headers: string[],
  field?: BulkUpdateMappableField,
): string {
  if (!field) return '';
  const exact = headers.find(
    (header) => header.toLocaleLowerCase() === field.name.toLocaleLowerCase(),
  );
  if (exact) return exact;
  return headers.find((header) =>
    fieldAliases(field).some((alias) => equivalentBulkUpdateHeading(alias, header))) ?? '';
}

export function suggestTargetField(
  header: string,
  fields: BulkUpdateMappableField[],
): string {
  const exact = fields.find(
    (field) => field.name.toLocaleLowerCase() === header.toLocaleLowerCase()
      || field.label.toLocaleLowerCase() === header.toLocaleLowerCase(),
  );
  if (exact) return exact.name;
  return fields.find((field) =>
    fieldAliases(field).some((alias) => equivalentBulkUpdateHeading(alias, header)))?.name ?? '';
}

/** Suggest mappings without assigning the same Salesforce field to multiple columns. */
export function buildSuggestedMappings(
  headers: string[],
  fields: BulkUpdateMappableField[],
  excludedTargetFields: string[],
): Record<string, string> {
  const usedTargets = new Set(excludedTargetFields.filter(Boolean));
  const mappings: Record<string, string> = {};
  for (const header of headers) {
    const target = suggestTargetField(header, fields);
    if (!target || usedTargets.has(target)) {
      mappings[header] = '';
      continue;
    }
    usedTargets.add(target);
    mappings[header] = target;
  }
  return mappings;
}
