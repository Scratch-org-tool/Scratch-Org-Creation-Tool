import { createHash } from 'node:crypto';

export interface ProvisioningUsernameInput {
  firstName: string;
  lastName: string;
  email: string;
}

export function buildStableProvisioningUsername(
  user: ProvisioningUsernameInput,
  orgId: string,
): string {
  const local = (user.email.split('@')[0] || `${user.firstName}.${user.lastName}`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'user';
  const suffix = createHash('sha256')
    .update(`${orgId}:${user.email.trim().toLowerCase()}:${user.firstName}:${user.lastName}`)
    .digest('hex')
    .slice(0, 12);
  return `${local}.${suffix}@sfcc.invalid`;
}

export function deriveProvisioningBatchStatus(
  completed: number,
  failed: number,
  total: number,
): 'completed' | 'partial' | 'failed' {
  if (total > 0 && completed >= total) return 'completed';
  if (total > 0 && failed >= total) return 'failed';
  return completed > 0 ? 'partial' : 'failed';
}
