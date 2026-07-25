const ACTIVE_JOB_STATUSES = new Set(['pending', 'queued', 'planning', 'running', 'paused']);
const TERMINAL_AUTOMATION_RUN_STATUSES = new Set(['completed', 'partial', 'failed', 'cancelled']);

export function isActiveJobStatus(status: string): boolean {
  return ACTIVE_JOB_STATUSES.has(status.toLowerCase());
}

export function isActiveAutomationRunStatus(status: string): boolean {
  return !TERMINAL_AUTOMATION_RUN_STATUSES.has(status.toLowerCase());
}

export function canStopJobDetail(detail: {
  job: { status: string };
  automationRun: { status: string } | null;
}): boolean {
  if (detail.automationRun && isActiveAutomationRunStatus(detail.automationRun.status)) {
    return true;
  }
  return isActiveJobStatus(detail.job.status);
}
