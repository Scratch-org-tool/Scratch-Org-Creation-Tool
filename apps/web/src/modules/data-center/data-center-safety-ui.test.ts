import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function source(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
}

describe('Data Center async and recovery controls', () => {
  it('guards previews and polling with abortable generations', () => {
    const replication = source('./replication-panel.tsx');
    const orgToOrg = source('./use-org-to-org-deploy.ts');
    const batch = source('./data-deploy-batch-progress.tsx');
    expect(replication).toContain('new AbortController()');
    expect(replication).toContain('setTimeout(() => void poll(), 2000)');
    expect(replication).not.toContain('setInterval(async () =>');
    expect(orgToOrg).toContain('jobPollGenerationRef');
    expect(orgToOrg).toContain('generation !== orgGenerationRef.current');
    expect(batch).toContain('loadAbort.current?.abort()');
  });

  it('guards preflight success, error, and finalization by request generation and configuration key', () => {
    const replication = source('./replication-panel.tsx');
    expect(replication.match(/isCurrentConfigurationRequest\(/g)).toHaveLength(3);
    expect(replication).toContain('previous');
    expect(replication).toContain('preflightRequestRef.current += 1');
  });

  it('keeps org-to-org record deployment only in the workbench data flow', () => {
    // The legacy Generic deploy tab was removed as a duplicate of /data-deploy.
    const workspace = source('./data-center-workspace.tsx');
    expect(workspace).not.toContain('GenericDeployPanel');
    const hook = source('./use-data-center-workspace.ts');
    expect(hook).toContain("router.replace('/deployment-workbench?flow=data')");
  });

  it('exposes query-driven Account Partner migration as a dedicated data operation', () => {
    const workspace = source('./data-center-workspace.tsx');
    const hook = source('./use-data-center-workspace.ts');
    const partners = source('./account-partners-panel.tsx');
    expect(workspace).toContain('AccountPartnersPanel');
    expect(hook).toContain("'account-partners'");
    expect(partners).toContain('/data/account-partners/mapping/preview');
    expect(partners).toContain('/data/account-partners/mapping/run');
    expect(partners).toContain('Create / update Account Partners');
    expect(partners).toContain('row.employeeName');
    expect(partners).toContain('Written to Account Partner Name');
    expect(partners).not.toContain('{row.targetEmployeeId}');
  });

  it('exposes update-only workbook imports with preview and explicit confirmation', () => {
    const workspace = source('./data-center-workspace.tsx');
    const hook = source('./use-data-center-workspace.ts');
    const bulkUpdate = source('./bulk-data-update-panel.tsx');
    expect(workspace).toContain('BulkDataUpdatePanel');
    expect(hook).toContain("'bulk-update'");
    expect(bulkUpdate).toContain('/data/bulk-update/inspect');
    expect(bulkUpdate).toContain('/data/bulk-update/preview');
    expect(bulkUpdate).toContain('/data/bulk-update/run');
    expect(bulkUpdate).toContain('Update existing records only');
    expect(bulkUpdate).toContain('0 records will be created');
    expect(bulkUpdate).toContain('reviewed');
    expect(bulkUpdate).not.toContain('upsert');
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
