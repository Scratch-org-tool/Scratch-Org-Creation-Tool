import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';

const db = vi.hoisted(() => ({
  orgConnection: {
    findUnique: vi.fn(),
  },
  apexTestRun: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  orgCoverageSnapshot: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

const sfCli = vi.hoisted(() => ({
  runApexTests: vi.fn(),
  queryTooling: vi.fn(),
}));

vi.mock('@sfcc/db', () => ({ prisma: db, Prisma: {} }));
vi.mock('@sfcc/sf-cli', () => ({ createSfCliClient: () => sfCli }));

import { QualityService, apexRunRequestSchema } from './quality.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function createService() {
  const notifications = { notify: vi.fn().mockResolvedValue(null) };
  const service = new QualityService(notifications as never);
  return { service, notifications };
}

function org() {
  return { id: ORG_ID, alias: 'qa', username: 'qa@example.test', createdBy: 'DPT_user' };
}

describe('apexRunRequestSchema', () => {
  it('requires class names for RunSpecifiedTests', () => {
    expect(
      apexRunRequestSchema.safeParse({ orgId: ORG_ID, testLevel: 'RunSpecifiedTests' }).success,
    ).toBe(false);
    expect(
      apexRunRequestSchema.safeParse({
        orgId: ORG_ID,
        testLevel: 'RunSpecifiedTests',
        classNames: ['MyTest'],
      }).success,
    ).toBe(true);
  });
});

describe('QualityService.startRun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses concurrent runs per org', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.apexTestRun.findFirst.mockResolvedValue({ id: 'active' });
    const { service } = createService();
    await expect(
      service.startRun({ orgId: ORG_ID }, 'DPT_user', false),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records outcome, coverage snapshot, and notification when the run completes', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.apexTestRun.findFirst.mockResolvedValue(null);
    db.apexTestRun.create.mockResolvedValue({ id: 'run1' });
    db.apexTestRun.update.mockResolvedValue({});
    db.orgCoverageSnapshot.create.mockResolvedValue({});
    sfCli.runApexTests.mockResolvedValue({
      success: true,
      data: {
        result: {
          summary: {
            outcome: 'Passed',
            testsRan: 12,
            passing: 12,
            failing: 0,
            skipped: 0,
            orgWideCoverage: '82%',
            testRunCoverage: '91%',
          },
          tests: [],
        },
      },
    });
    const { service, notifications } = createService();

    const started = await service.startRun({ orgId: ORG_ID }, 'DPT_user', false);
    expect(started.status).toBe('running');
    // Wait for the detached execution to finish.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sfCli.runApexTests).toHaveBeenCalledWith('qa@example.test', expect.objectContaining({
      testLevel: 'RunLocalTests',
    }));
    expect(db.apexTestRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed', orgWideCoverage: 82 }),
    }));
    expect(db.orgCoverageSnapshot.create).toHaveBeenCalledWith({
      data: { orgConnectionId: ORG_ID, percentCovered: 82, source: 'test_run' },
    });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      level: 'success',
    }));
  });

  it('marks the run partial when tests fail', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.apexTestRun.findFirst.mockResolvedValue(null);
    db.apexTestRun.create.mockResolvedValue({ id: 'run1' });
    db.apexTestRun.update.mockResolvedValue({});
    db.orgCoverageSnapshot.create.mockResolvedValue({});
    sfCli.runApexTests.mockResolvedValue({
      success: false,
      data: {
        result: {
          summary: { outcome: 'Failed', testsRan: 10, passing: 8, failing: 2, orgWideCoverage: '70%' },
          tests: [],
        },
      },
    });
    const { service } = createService();

    await service.startRun({ orgId: ORG_ID }, 'DPT_user', false);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(db.apexTestRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'partial', failing: 2 }),
    }));
  });

  it('records a failed run when the CLI produces no summary', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.apexTestRun.findFirst.mockResolvedValue(null);
    db.apexTestRun.create.mockResolvedValue({ id: 'run1' });
    db.apexTestRun.update.mockResolvedValue({});
    sfCli.runApexTests.mockResolvedValue({ success: false, error: 'no org', data: undefined });
    const { service } = createService();

    await service.startRun({ orgId: ORG_ID }, 'DPT_user', false);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(db.apexTestRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', error: 'no org' }),
    }));
  });
});

describe('QualityService.captureCoverage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores a snapshot from the Tooling API', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    db.orgCoverageSnapshot.create.mockResolvedValue({});
    sfCli.queryTooling.mockResolvedValue({
      success: true,
      data: { result: { records: [{ PercentCovered: 78.5 }], totalSize: 1 } },
    });
    const { service } = createService();

    const result = await service.captureCoverage(ORG_ID, 'DPT_user', true);
    expect(result.percentCovered).toBe(78.5);
    expect(sfCli.queryTooling).toHaveBeenCalledWith(
      'qa@example.test',
      'SELECT PercentCovered FROM ApexOrgWideCoverage',
    );
  });

  it('surfaces Tooling API failures as client errors', async () => {
    db.orgConnection.findUnique.mockResolvedValue(org());
    sfCli.queryTooling.mockResolvedValue({ success: false, error: 'expired token' });
    const { service } = createService();
    await expect(service.captureCoverage(ORG_ID, 'DPT_user', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
