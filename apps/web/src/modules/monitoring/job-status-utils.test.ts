import { describe, expect, it } from 'vitest';
import {
  canStopJobDetail,
  isActiveAutomationRunStatus,
  isActiveJobStatus,
} from './job-status-utils';

describe('job-status-utils', () => {
  it('detects active job statuses', () => {
    expect(isActiveJobStatus('running')).toBe(true);
    expect(isActiveJobStatus('queued')).toBe(true);
    expect(isActiveJobStatus('completed')).toBe(false);
    expect(isActiveJobStatus('cancelled')).toBe(false);
  });

  it('detects active automation runs', () => {
    expect(isActiveAutomationRunStatus('running')).toBe(true);
    expect(isActiveAutomationRunStatus('completed')).toBe(false);
    expect(isActiveAutomationRunStatus('cancelled')).toBe(false);
  });

  it('allows stopping active jobs and pipeline runs', () => {
    expect(canStopJobDetail({
      job: { status: 'running' },
      automationRun: null,
    })).toBe(true);

    expect(canStopJobDetail({
      job: { status: 'completed' },
      automationRun: { status: 'running' },
    })).toBe(true);

    expect(canStopJobDetail({
      job: { status: 'completed' },
      automationRun: { status: 'completed' },
    })).toBe(false);
  });
});
