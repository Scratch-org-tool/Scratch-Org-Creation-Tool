import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./deployment-workbench-workspace.tsx', import.meta.url)),
  'utf8',
);

describe('deployment workbench component semantics', () => {
  it('provides keyboard-native selection and labeled controls', () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('aria-selected={active}');
    expect(source).toContain('role="radio"');
    expect(source).toContain('aria-checked={checked}');
    expect(source).toContain('<Label htmlFor={htmlFor}>{label}</Label>');
  });

  it('announces execution updates and provides a dependency table fallback', () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('Accessible list and table fallback');
    expect(source).toContain('<table className="w-full text-sm">');
  });

  it('displays locked production controls and separates blockers from warnings', () => {
    expect(source).toContain('Production policy locked');
    expect(source).toContain('title="Plan blocker"');
    expect(source).toContain('variant="warning"');
    expect(source).toContain('disabled={production}');
  });
});
