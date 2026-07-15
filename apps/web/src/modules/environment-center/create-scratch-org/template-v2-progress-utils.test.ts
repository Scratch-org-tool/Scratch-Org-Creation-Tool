import { describe, expect, it } from 'vitest';
import { latestJobOfType } from './template-v2-progress-utils';

describe('Template V2 retry progress', () => {
  it('selects the latest matching job attempt', () => {
    const jobs = [
      {
        id: 'first',
        createdAt: '2026-01-01T00:00:00.000Z',
        status: 'failed',
        currentStep: 'failed',
        type: 'cona_user_provision',
      },
      {
        id: 'other',
        createdAt: '2026-01-01T00:00:01.000Z',
        status: 'completed',
        currentStep: 'done',
        type: 'custom_settings_load',
      },
      {
        id: 'retry',
        createdAt: '2026-01-01T00:00:02.000Z',
        status: 'running',
        currentStep: 'retrying',
        type: 'cona_user_provision',
      },
    ];
    expect(latestJobOfType(jobs, 'cona_user_provision')?.id).toBe('retry');
  });
});
