import { describe, expect, it } from 'vitest';
import {
  buildStableProvisioningUsername,
  deriveProvisioningBatchStatus,
} from './provisioning-status.util';

describe('buildStableProvisioningUsername', () => {
  const user = { firstName: 'Ada', lastName: 'Lovelace', email: 'Ada@example.com' };

  it('is stable across retries for the same org and user', () => {
    expect(buildStableProvisioningUsername(user, 'org-1'))
      .toBe(buildStableProvisioningUsername(user, 'org-1'));
  });

  it('avoids collisions across target orgs', () => {
    expect(buildStableProvisioningUsername(user, 'org-1'))
      .not.toBe(buildStableProvisioningUsername(user, 'org-2'));
  });
});

describe('deriveProvisioningBatchStatus', () => {
  it.each([
    [3, 0, 3, 'completed'],
    [2, 1, 3, 'partial'],
    [0, 3, 3, 'failed'],
  ] as const)('derives %s completed and %s failed of %s as %s', (completed, failed, total, status) => {
    expect(deriveProvisioningBatchStatus(completed, failed, total)).toBe(status);
  });
});
