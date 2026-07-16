import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function source(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
}

describe('Data Center async and recovery controls', () => {
  it('guards previews and polling with abortable generations', () => {
    const generic = source('./generic-deploy-panel.tsx');
    const replication = source('./replication-panel.tsx');
    const orgToOrg = source('./use-org-to-org-deploy.ts');
    const batch = source('./data-deploy-batch-progress.tsx');
    for (const value of [generic, replication]) {
      expect(value).toContain('new AbortController()');
      expect(value).toContain('setTimeout(() => void poll(), 2000)');
      expect(value).not.toContain('setInterval(async () =>');
    }
    expect(orgToOrg).toContain('jobPollGenerationRef');
    expect(orgToOrg).toContain('generation !== orgGenerationRef.current');
    expect(batch).toContain('loadAbort.current?.abort()');
  });

  it('guards preflight success, error, and finalization by request generation and configuration key', () => {
    for (const value of [
      source('./generic-deploy-panel.tsx'),
      source('./replication-panel.tsx'),
    ]) {
      expect(value.match(/isCurrentConfigurationRequest\(/g)).toHaveLength(3);
      expect(value).toContain('previous');
      expect(value).toContain('preflightRequestRef.current += 1');
    }
  });

  it('offers server-authorized movement controls and explicit inserted-record deletion', () => {
    const controls = source('./data-movement-controls.tsx');
    const batch = source('./data-deploy-batch-progress.tsx');
    expect(controls).toContain('movement.canCancel');
    expect(controls).toContain('movement.canRollback');
    expect(controls).toContain("['completed', 'failed', 'partial'].includes(movement.status)");
    expect(controls).toContain("confirm === 'delete-inserted'");
    expect(controls).toContain("void run('rollback', true)");
    expect(batch).toContain('rollback-delete-inserted');
    expect(batch).toContain('{ deleteInserted: true }');
  });
});
