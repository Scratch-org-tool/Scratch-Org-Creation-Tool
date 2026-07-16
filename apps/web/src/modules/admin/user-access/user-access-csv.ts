import type { UserAccessRow } from './types';

const HEADERS = [
  'Name',
  'Email',
  'Role',
  'Status',
  'Modules',
  'Last Active',
  'Added On',
] as const;

/**
 * CSV-encode a single cell. Also neutralises spreadsheet formula injection
 * (values beginning with =, +, -, @, tab, or CR) by prefixing a quote, so an
 * exported user field can never execute as a formula in Excel/Sheets.
 */
function escapeCsv(value: string): string {
  let out = value;
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  if (/[",\n\r]/.test(out)) out = `"${out.replace(/"/g, '""')}"`;
  return out;
}

export function usersToCsv(users: UserAccessRow[]): string {
  const rows = users.map((u) => [
    u.displayName,
    u.email,
    u.displayRole,
    u.status,
    u.effectiveModules.join('; '),
    u.lastActiveAt ?? '',
    u.createdAt ?? '',
  ]);
  return [HEADERS as readonly string[], ...rows]
    .map((cols) => cols.map((c) => escapeCsv(String(c))).join(','))
    .join('\r\n');
}
