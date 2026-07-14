import { Injectable } from '@nestjs/common';
import type { ScratchOrgSkipStepKey } from '@sfcc/shared';

export class JobCancelledError extends Error {
  constructor(message = 'Job cancelled by user') {
    super(message);
    this.name = 'JobCancelledError';
  }
}

interface ActiveScratchOrgJob {
  cancelled: boolean;
  skipSteps: Set<ScratchOrgSkipStepKey>;
  kill: (() => void) | null;
}

@Injectable()
export class ScratchOrgJobService {
  private readonly activeJobs = new Map<string, ActiveScratchOrgJob>();

  register(dbJobId: string, initialSkipSteps: ScratchOrgSkipStepKey[] = []) {
    this.activeJobs.set(dbJobId, {
      cancelled: false,
      skipSteps: new Set(initialSkipSteps),
      kill: null,
    });
  }

  unregister(dbJobId: string) {
    this.activeJobs.delete(dbJobId);
  }

  setKill(dbJobId: string, kill: () => void) {
    const job = this.activeJobs.get(dbJobId);
    if (job) job.kill = kill;
  }

  clearKill(dbJobId: string) {
    const job = this.activeJobs.get(dbJobId);
    if (job) job.kill = null;
  }

  cancel(dbJobId: string) {
    const job = this.activeJobs.get(dbJobId);
    if (job) {
      job.cancelled = true;
      job.kill?.();
    } else {
      this.activeJobs.set(dbJobId, {
        cancelled: true,
        skipSteps: new Set(),
        kill: null,
      });
    }
  }

  skipStep(dbJobId: string, step: ScratchOrgSkipStepKey) {
    let job = this.activeJobs.get(dbJobId);
    if (!job) {
      job = { cancelled: false, skipSteps: new Set(), kill: null };
      this.activeJobs.set(dbJobId, job);
    }
    job.skipSteps.add(step);
    job.kill?.();
  }

  shouldSkip(dbJobId: string, step: ScratchOrgSkipStepKey): boolean {
    return this.activeJobs.get(dbJobId)?.skipSteps.has(step) ?? false;
  }

  isCancelled(dbJobId: string): boolean {
    return this.activeJobs.get(dbJobId)?.cancelled ?? false;
  }

  getSkipSteps(dbJobId: string): ScratchOrgSkipStepKey[] {
    const job = this.activeJobs.get(dbJobId);
    return job ? [...job.skipSteps] : [];
  }
}
