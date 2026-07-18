import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PlansService } from '../plans/plans.service';
import { DriftService } from '../drift/drift.service';
import { ScratchOrgRenewalService } from '../environment/scratch-org-renewal.service';

const DEFAULT_POLL_MS = 60_000;
const MIN_POLL_MS = 5_000;

/**
 * Polls for due automation work — scheduled deployment plans, drift monitors,
 * and scratch org renewals — and dispatches each one. Correctness under
 * multiple clustered API replicas relies on atomic per-row claims in the
 * services (a conditional update on nextRunAt), so it is safe for every
 * replica to tick; only one wins each slot. A self-managed interval keeps this
 * dependency-free and testable: `tick()` can be called directly without any
 * timer.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly plansService: PlansService,
    private readonly driftService: DriftService,
    private readonly scratchOrgRenewals: ScratchOrgRenewalService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('Automation scheduler disabled (SCHEDULER_ENABLED=false or test env)');
      return;
    }
    const pollMs = this.pollIntervalMs();
    this.timer = setInterval(() => {
      void this.tick();
    }, pollMs);
    // Never let the poll timer hold the process open on shutdown.
    this.timer.unref?.();
    this.logger.log(`Automation scheduler started (every ${Math.round(pollMs / 1000)}s)`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One scheduling pass. Guards against overlapping runs. */
  async tick(now = new Date()): Promise<{ plans: number; monitors: number; renewals: number }> {
    if (this.running) return { plans: 0, monitors: 0, renewals: 0 };
    this.running = true;
    let plans = 0;
    let monitors = 0;
    let renewals = 0;
    try {
      plans = await this.processDuePlans(now);
      monitors = await this.processDueMonitors(now);
      renewals = await this.processDueRenewals(now);
    } catch (error) {
      this.logger.error(
        `scheduler tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
    return { plans, monitors, renewals };
  }

  private async processDuePlans(now: Date): Promise<number> {
    const ids = await this.plansService.dueScheduledPlanIds(now);
    let fired = 0;
    for (const id of ids) {
      try {
        const { claimed } = await this.plansService.runScheduledPlan(id, now);
        if (claimed) fired += 1;
      } catch (error) {
        this.logger.warn(
          `scheduled plan ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (fired) this.logger.log(`Dispatched ${fired} scheduled deployment plan(s)`);
    return fired;
  }

  private async processDueMonitors(now: Date): Promise<number> {
    const ids = await this.driftService.dueMonitorIds(now);
    let fired = 0;
    for (const id of ids) {
      try {
        const { claimed } = await this.driftService.runScheduledMonitor(id, now);
        if (claimed) fired += 1;
      } catch (error) {
        this.logger.warn(
          `scheduled drift monitor ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (fired) this.logger.log(`Ran ${fired} scheduled drift monitor(s)`);
    return fired;
  }

  /**
   * Scratch org renewals fire in two phases: due rules launch a replacement
   * pipeline, and rules with an in-flight pipeline are finalized (roll forward
   * to the new org, or apply the failure retry policy) once that run settles.
   */
  private async processDueRenewals(now: Date): Promise<number> {
    let fired = 0;
    try {
      await this.scratchOrgRenewals.finalizeActiveRuns(now);
    } catch (error) {
      this.logger.warn(
        `renewal finalize pass failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const ids = await this.scratchOrgRenewals.dueRenewalIds(now);
    for (const id of ids) {
      try {
        const { claimed } = await this.scratchOrgRenewals.runScheduledRenewal(id, now);
        if (claimed) fired += 1;
      } catch (error) {
        this.logger.warn(
          `scheduled scratch org renewal ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (fired) this.logger.log(`Started ${fired} scratch org renewal(s)`);
    return fired;
  }

  private isEnabled(): boolean {
    if (process.env.SCHEDULER_ENABLED === 'false') return false;
    if (process.env.NODE_ENV === 'test') return false;
    return true;
  }

  private pollIntervalMs(): number {
    const parsed = parseInt(process.env.SCHEDULER_POLL_MS ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_POLL_MS;
    return Math.max(MIN_POLL_MS, parsed);
  }
}
