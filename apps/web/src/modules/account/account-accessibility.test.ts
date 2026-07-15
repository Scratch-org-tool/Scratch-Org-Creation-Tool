import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspaceSource = readFileSync(
  fileURLToPath(new URL('./account-workspace.tsx', import.meta.url)),
  'utf8',
);
const sidebarSource = readFileSync(
  fileURLToPath(new URL('../../components/layout/app-sidebar.tsx', import.meta.url)),
  'utf8',
);

describe('account keyboard and accessibility semantics', () => {
  it('associates its label and error and uses a native toggle button', () => {
    expect(workspaceSource).toContain('<Label htmlFor={id}>{label}</Label>');
    expect(workspaceSource).toContain('aria-describedby={error ? errorId : undefined}');
    expect(workspaceSource).toContain('aria-invalid={Boolean(error)}');
    expect(workspaceSource).toContain('<InputGroupButton');
    expect(workspaceSource).toContain('type="button"');
    expect(workspaceSource).toContain("aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}");
    expect(workspaceSource).toContain('aria-pressed={visible}');
  });

  it('uses new-password autocomplete for both new secret fields', () => {
    expect(workspaceSource).toContain('id="currentPassword"');
    expect(workspaceSource).toContain('autoComplete="current-password"');
    expect(workspaceSource).toContain('id="newPassword"');
    expect(workspaceSource).toContain('id="confirmPassword"');
    expect(workspaceSource.match(/autoComplete="new-password"/g)).toHaveLength(2);
  });

  it('makes the sidebar Account destination a keyboard-native active control', () => {
    expect(sidebarSource).toContain("onClick={() => navigate('/account')}");
    expect(sidebarSource).toContain('aria-label="Account"');
    expect(sidebarSource).toContain("aria-current={pathname === '/account' ? 'page' : undefined}");
    expect(sidebarSource).toContain('focus-visible:ring-2');
    expect(sidebarSource).toContain('active:scale-[0.98]');
  });
});
