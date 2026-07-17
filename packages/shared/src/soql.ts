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

/**
 * SOQL is whitespace-insensitive: collapse newlines/indentation into single
 * spaces so multi-line editor input never breaks CLI argument handling.
 */
export function flattenSoql(soql: string): string {
  return soql.replace(/\s+/g, ' ').trim();
}

function isWordChar(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z0-9_]/.test(char));
}

/**
 * Find a keyword (e.g. `FROM`, `WHERE`, `ORDER BY`) at the TOP LEVEL of a
 * SOQL statement — ignoring matches inside parenthesized subqueries (related
 * object queries) and single-quoted string literals. Returns -1 when absent.
 */
export function findTopLevelKeyword(soql: string, keyword: string, fromIndex = 0): number {
  const phrase = keyword
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const matcher = new RegExp(`^(?:${phrase})(?![A-Za-z0-9_])`, 'i');
  let depth = 0;
  let inString = false;
  for (let index = fromIndex; index < soql.length; index += 1) {
    const char = soql[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === "'") inString = false;
      continue;
    }
    if (char === "'") {
      inString = true;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    if (isWordChar(soql[index - 1])) continue;
    if (matcher.test(soql.slice(index))) return index;
  }
  return -1;
}

/**
 * Split a SOQL SELECT field list on top-level commas, keeping parenthesized
 * relationship subqueries intact as single entries.
 */
export function splitTopLevelFields(fieldList: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (let index = 0; index < fieldList.length; index += 1) {
    const char = fieldList[index]!;
    if (inString) {
      current += char;
      if (char === '\\') {
        current += fieldList[index + 1] ?? '';
        index += 1;
      } else if (char === "'") {
        inString = false;
      }
      continue;
    }
    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) fields.push(current.trim());
  return fields.filter(Boolean);
}
