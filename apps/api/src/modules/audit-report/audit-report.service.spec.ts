import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  authAuditEvent: { findMany: vi.fn() },
  deploymentAudit: { findMany: vi.fn() },
  deploymentQualityAudit: { findMany: vi.fn() },
  orgConnection: { findMany: vi.fn() },
  appUser: { findMany: vi.fn() },
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));

import { AuditReportService } from './audit-report.service';

function seed() {
  db.authAuditEvent.findMany.mockResolvedValue([
    {
      id: 'a1',
      userId: 'DPT_admin',
      eventType: 'user_access_updated',
      metadata: { targetUserId: 'DPT_dev' },
      createdAt: new Date('2026-07-17T03:00:00.000Z'),
    },
  ]);
  db.deploymentAudit.findMany.mockResolvedValue([
    {
      id: 'd1',
      action: 'deploy_enqueued',
      performedBy: 'DPT_dev',
      repo: 'metadata',
      branch: 'main',
      sourceOrgId: null,
      targetOrgId: 'org-1',
      componentCount: 12,
      status: 'queued',
      createdAt: new Date('2026-07-17T02:00:00.000Z'),
    },
  ]);
  db.deploymentQualityAudit.findMany.mockResolvedValue([
    {
      id: 'w1',
      runId: 'run-123456789',
      action: 'approved',
      actorId: 'DPT_admin',
      createdAt: new Date('2026-07-17T01:00:00.000Z'),
    },
  ]);
  db.orgConnection.findMany.mockResolvedValue([{ id: 'org-1', alias: 'uat' }]);
  db.appUser.findMany.mockResolvedValue([
    { id: 'DPT_admin', displayName: 'Ada Admin' },
    { id: 'DPT_dev', displayName: 'Devon Dev' },
  ]);
}

describe('AuditReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed();
  });

  it('merges all three sources newest-first with resolved names', async () => {
    const service = new AuditReportService();
    const { entries, total } = await service.report({});

    expect(total).toBe(3);
    expect(entries.map((entry) => entry.source)).toEqual(['auth', 'deployment', 'workbench']);
    expect(entries[0].actorName).toBe('Ada Admin');
    expect(entries[1].target).toContain('metadata/main');
    expect(entries[1].target).toContain('uat');
  });

  it('respects the source filter', async () => {
    const service = new AuditReportService();
    const { entries } = await service.report({ source: 'deployment' });
    expect(db.authAuditEvent.findMany).not.toHaveBeenCalled();
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('deployment');
  });

  it('pages the merged feed', async () => {
    const service = new AuditReportService();
    const page = await service.report({ limit: '1', offset: '1' });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].source).toBe('deployment');
    expect(page.total).toBe(3);
  });

  it('exports CSV with formula-injection hardening', async () => {
    db.deploymentAudit.findMany.mockResolvedValue([
      {
        id: 'd2',
        action: '=HYPERLINK("http://evil")',
        performedBy: 'DPT_dev',
        repo: null,
        branch: null,
        sourceOrgId: null,
        targetOrgId: null,
        componentCount: null,
        status: 'queued',
        createdAt: new Date('2026-07-17T02:00:00.000Z'),
      },
    ]);
    const service = new AuditReportService();
    const csv = await service.exportCsv({ source: 'deployment' });

    expect(csv.split('\r\n')[0]).toBe('timestamp,source,action,actor_id,actor_name,target,status');
    expect(csv).toContain('"\'=HYPERLINK');
  });
});
