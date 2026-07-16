import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./deployment-workbench-workspace.tsx', import.meta.url)),
  'utf8',
);
const hookSource = readFileSync(
  fileURLToPath(new URL('./use-deployment-workbench.ts', import.meta.url)),
  'utf8',
);

describe('deployment workbench component semantics', () => {
  it('provides keyboard-native selection and labeled controls', () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('aria-controls={controls}');
    expect(source).toContain('aria-selected={active}');
    expect(source).toContain('type="radio"');
    expect(source).toContain('name={name}');
    expect(source).toContain("'ArrowLeft', 'ArrowRight', 'Home', 'End'");
    expect(source).toContain('<Label htmlFor={htmlFor}>{label}</Label>');
  });

  it('announces execution updates and provides a dependency table fallback', () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('Accessible dependency graph fallback');
    expect(source).toContain('<table className="w-full text-sm">');
  });

  it('binds destructive acknowledgement to a manifest hash and uses server action flags', () => {
    expect(source).toContain('destructiveAcknowledgedHash === w.destructiveReview.manifestHash');
    expect(source).toContain('Manifest SHA-256');
    expect(source).toContain('const actions = serverRunActions(w.status)');
    expect(source).toContain('{actions.canApprove && (');
    expect(hookSource).toContain('`/deployment-workbench/${id}/destructive-review`');
    expect(hookSource).toContain('digest: destructiveReview.manifestHash');
    expect(hookSource).toContain('approved: true');
  });

  it('displays locked production controls and separates blockers from warnings', () => {
    expect(source).toContain('Production policy locked');
    expect(source).toContain('title="Plan blocker"');
    expect(source).toContain('variant="warning"');
    expect(source).toContain('disabled={production}');
  });

  it('starts org comparison on Components entry and retains it after execution', () => {
    expect(hookSource).toContain('step !== 1');
    expect(hookSource).toContain("form.sourceMode !== 'org_compare'");
    expect(hookSource).toContain('void startComparison()');
    expect(source).toContain("['passed', 'failed', 'cancelled', 'rejected'].includes(w.status.status)");
    expect(source).toContain('<ComponentsStep w={w} />');
  });
});
