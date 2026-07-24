import { extractObjectFromSoql } from '@sfcc/shared';

export type SfdmuObjectEntry = {
  query: string;
  operation: string;
  name?: string;
  externalId?: string;
};

export function parseSfdmuExportJson(json: string): SfdmuObjectEntry[] {
  const parsed = JSON.parse(json) as { objects?: SfdmuObjectEntry[] };
  if (!Array.isArray(parsed.objects)) {
    throw new Error('SFDMU export must include an objects array');
  }
  return parsed.objects;
}

export function serializeSfdmuExportJson(objects: SfdmuObjectEntry[]): string {
  return JSON.stringify({ objects }, null, 2);
}

export function objectLabel(entry: SfdmuObjectEntry, index: number): string {
  return entry.name ?? extractObjectFromSoql(entry.query) ?? `Object ${index + 1}`;
}

export function addFieldToSoql(soql: string, fieldName: string): string {
  const trimmedField = fieldName.trim();
  if (!trimmedField) return soql;
  const match = soql.match(/^(\s*SELECT\s+)([\s\S]+?)(\s+FROM\s+)/i);
  if (!match) return soql;
  const fields = match[2].split(',').map((field) => field.trim()).filter(Boolean);
  if (fields.some((field) => field.toLowerCase() === trimmedField.toLowerCase())) {
    return soql;
  }
  return `${match[1]}${[...fields, trimmedField].join(', ')}${match[3]}${soql.slice(match[0].length)}`;
}

export function updateObjectQuery(
  objects: SfdmuObjectEntry[],
  index: number,
  query: string,
): SfdmuObjectEntry[] {
  return objects.map((entry, i) => (i === index ? { ...entry, query } : entry));
}

export function removeObject(objects: SfdmuObjectEntry[], index: number): SfdmuObjectEntry[] {
  return objects.filter((_, i) => i !== index);
}
