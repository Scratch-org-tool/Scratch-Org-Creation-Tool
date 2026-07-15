const SOQL_IDENTIFIER_RE =
  /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;

/** Escape a string for inclusion inside a single-quoted SOQL literal. */
export function escapeSoqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Quote and escape a value as a complete SOQL string literal. */
export function toSoqlLiteral(value: string): string {
  return `'${escapeSoqlLiteral(value)}'`;
}

/** Validate an sObject, field, or relationship API name before interpolation. */
export function assertSoqlIdentifier(name: string, label = 'identifier'): string {
  const trimmed = name?.trim();
  if (!trimmed || !SOQL_IDENTIFIER_RE.test(trimmed)) {
    throw new Error(`Invalid SOQL ${label}: ${JSON.stringify(name)}`);
  }
  return trimmed;
}

/** Backward-compatible name for callers that need escaped literal contents. */
export const escapeSoqlValue = escapeSoqlLiteral;
