import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulerService } from './scheduler.service';

function createScheduler() {
  const plansService = {
    dueScheduledPlanIds: vi.fn().mockResolvedValue([]),
    runScheduledPlan: vi.fn().mockResolvedValue({ claimed: true }),
  };
  const driftService = {
    dueMonitorIds: vi.fn().mockResolvedValue([]),
    runScheduledMonitor: vi.fn().mockResolvedValue({ claimed: true }),
  };
  const renewalService = {
    finalizeActiveRuns: vi.fn().mockResolvedValue(0),
    dueRenewalIds: vi.fn().mockResolvedValue([]),
    runScheduledRenewal: vi.fn().mockResolvedValue({ claimed: true }),
  };
  const scheduler = new SchedulerService(
    plansService as never,
    driftService as never,
    renewalService as never,
  );
  return { scheduler, plansService, driftService, renewalService };
}

describe('SchedulerService.tick', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches every due plan, monitor and renewal', async () => {
    const { scheduler, plansService, driftService, renewalService } = createScheduler();
    plansService.dueScheduledPlanIds.mockResolvedValue(['plan-1', 'plan-2']);
    driftService.dueMonitorIds.mockResolvedValue(['mon-1']);
    renewalService.dueRenewalIds.mockResolvedValue(['ren-1']);

    const result = await scheduler.tick(new Date('2026-07-16T00:00:00Z'));

    expect(result).toEqual({ plans: 2, monitors: 1, renewals: 1 });
    expect(plansService.runScheduledPlan).toHaveBeenCalledTimes(2);
    expect(driftService.runScheduledMonitor).toHaveBeenCalledTimes(1);
    expect(renewalService.runScheduledRenewal).toHaveBeenCalledTimes(1);
  });

  it('finalizes in-flight renewal pipelines every tick, even with nothing due', async () => {
    const { scheduler, renewalService } = createScheduler();

    await scheduler.tick(new Date('2026-07-16T00:00:00Z'));

    expect(renewalService.finalizeActiveRuns).toHaveBeenCalledTimes(1);
    expect(renewalService.runScheduledRenewal).not.toHaveBeenCalled();
  });

  it('counts only rows this replica actually claimed', async () => {
    const { scheduler, plansService, driftService } = createScheduler();
    plansService.dueScheduledPlanIds.mockResolvedValue(['plan-1', 'plan-2']);
    plansService.runScheduledPlan
      .mockResolvedValueOnce({ claimed: true })
      .mockResolvedValueOnce({ claimed: false });
    driftService.dueMonitorIds.mockResolvedValue([]);

    const result = await scheduler.tick();
    expect(result.plans).toBe(1);
  });

  it('keeps going when one dispatch throws', async () => {
    const { scheduler, plansService } = createScheduler();
    plansService.dueScheduledPlanIds.mockResolvedValue(['plan-1', 'plan-2']);
    plansService.runScheduledPlan
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ claimed: true });

    const result = await scheduler.tick();
    expect(result.plans).toBe(1);
    expect(plansService.runScheduledPlan).toHaveBeenCalledTimes(2);
  });

  it('still fires due renewals when the finalize pass throws', async () => {
    const { scheduler, renewalService } = createScheduler();
    renewalService.finalizeActiveRuns.mockRejectedValue(new Error('poll failed'));
    renewalService.dueRenewalIds.mockResolvedValue(['ren-1']);

    const result = await scheduler.tick();
    expect(result.renewals).toBe(1);
    expect(renewalService.runScheduledRenewal).toHaveBeenCalledWith('ren-1', expect.any(Date));
  });

  it('does not run overlapping ticks', async () => {
    const { scheduler, plansService, driftService } = createScheduler();
    let release: (() => void) | undefined;
    plansService.dueScheduledPlanIds.mockImplementation(
      () => new Promise<string[]>((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = scheduler.tick();
    const second = await scheduler.tick();
    expect(second).toEqual({ plans: 0, monitors: 0, renewals: 0 });
    expect(driftService.dueMonitorIds).not.toHaveBeenCalled();

    release?.();
    await first;
  });
});
