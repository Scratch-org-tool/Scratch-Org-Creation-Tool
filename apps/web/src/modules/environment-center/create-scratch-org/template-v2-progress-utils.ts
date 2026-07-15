import type { AutomationRunView } from '@/components/scratch-org/types';

export type AutomationJob = NonNullable<AutomationRunView['jobs']>[number];

export function latestJobOfType(
  jobs: AutomationRunView['jobs'],
  type: string,
): AutomationJob | undefined {
  return jobs?.reduce<AutomationJob | undefined>((latest, job) => {
    if (job.type !== type) return latest;
    if (!latest) return job;
    const latestTime = latest.createdAt ? Date.parse(latest.createdAt) : Number.NaN;
    const jobTime = job.createdAt ? Date.parse(job.createdAt) : Number.NaN;
    if (Number.isFinite(latestTime) && Number.isFinite(jobTime)) {
      return jobTime >= latestTime ? job : latest;
    }
    // The run API orders attempts oldest-to-newest, so the later matching
    // array entry is authoritative when timestamps are unavailable.
    return job;
  }, undefined);
}
