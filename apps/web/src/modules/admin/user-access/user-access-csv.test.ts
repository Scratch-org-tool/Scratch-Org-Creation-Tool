import { describe, expect, it } from 'vitest';
import { usersToCsv } from './user-access-csv';
import type { UserAccessRow } from './types';

function row(overrides: Partial<UserAccessRow> = {}): UserAccessRow {
  return {
    id: 'DPT_1',
    email: 'ada@example.test',
    displayName: 'Ada Lovelace',
    role: 'user',
    grantedModules: [],
    learningFeatures: [],
    effectiveModules: ['dashboard', 'data'],
    displayRole: 'Viewer',
    status: 'active',
    lastActiveAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('usersToCsv', () => {
  it('emits a header row and one line per user', () => {
    const csv = usersToCsv([row(), row({ id: 'DPT_2', displayName: 'Grace' })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Name,Email,Role,Status,Modules,Last Active,Added On');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Ada Lovelace');
    expect(lines[1]).toContain('dashboard; data');
  });

  it('quotes fields containing commas or quotes', () => {
    const csv = usersToCsv([row({ displayName: 'Doe, Jane "JD"' })]);
    expect(csv.split('\r\n')[1]).toContain('"Doe, Jane ""JD"""');
  });

  it('neutralises spreadsheet formula injection', () => {
    const csv = usersToCsv([row({ displayName: '=SUM(A1:A9)' })]);
    // Prefixed with a single quote so it cannot execute as a formula.
    expect(csv.split('\r\n')[1].startsWith("'=SUM(A1:A9)")).toBe(true);
  });
});
