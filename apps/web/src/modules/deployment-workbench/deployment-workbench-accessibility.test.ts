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
    // The comparison stays available from the full report after a run finishes.
    expect(source).toContain('Deployed selection & source-versus-target XML');
    expect(source).toContain('<ComponentsStep w={w} />');
  });

<<<<<<< cursor/workbench-ux-overhaul-cef8
  it('shows a dedicated success screen instead of stacking every section', () => {
    // A passed run renders ONLY the success panel until the report is opened.
    expect(source).toContain('if (terminal && succeeded && !showReport)');
    expect(source).toContain('Deployment successful');
    expect(source).toContain('Start new deployment');
    expect(source).toContain('View full report');
    expect(hookSource).toContain('const resetPlan = useCallback(');
  });

  it('runs static analysis automatically without user configuration', () => {
    expect(source).toContain('AutomaticStaticAnalysisCard');
    expect(source).not.toContain('id="static-enabled"');
    expect(source).not.toContain('id="severity-threshold"');
    expect(hookSource).toContain('withAutoStaticAnalysis');
  });

  it('surfaces background work with loaders instead of text-only states', () => {
    expect(source).toContain('<LoadingOverlay');
    expect(source).toContain('Building the deployment plan…');
    expect(source).toContain('Creating the deployment run…');
    expect(source).toContain('<BusyRow');
    expect(source).toContain('is running in the background');
  });

  it('lets each wizard step behave like its own page', () => {
    expect(source).toContain('onStepSelect={goToStep}');
    expect(source).toContain('isStepEnabled={stepEnabled}');
    expect(source).toContain("window.scrollTo({ top: 0, behavior: 'smooth' })");
=======
  it('presents static analysis engines with availability and install guidance', () => {
    expect(source).toContain('staticAnalysisEngineOptions(w.capabilities)');
    expect(source).toContain('defaultStaticAnalysisEngines(w.capabilities)');
    expect(source).toContain('Not installed');
    expect(source).toContain('{engine.requires}');
    expect(source).toContain('disabled={!engine.available}');
    expect(hookSource).toContain('policyForEnvironment(profile, capabilities)');
>>>>>>> main
  });
});
