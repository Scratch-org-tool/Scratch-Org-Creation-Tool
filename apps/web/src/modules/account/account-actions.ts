import {
  AUTH_ACCOUNT_ACTION_FAILED,
  AUTH_GENERIC_INVALID,
  AUTH_PASSWORD_MISMATCH,
  AUTH_PASSWORD_SAME,
  AUTH_PASSWORD_TOO_WEAK,
  changePasswordSchema,
  updateMeSchema,
} from '@sfcc/shared';
import { ApiError } from '@/services/api';

export interface PasswordChangeFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AccountActionErrors {
  fields: Partial<Record<keyof PasswordChangeFields, string>>;
  page?: string;
}

export interface LatestRequestGate {
  current: number;
}

export type OptimisticUpdateResult<T> =
  | { status: 'success'; profile: T }
  | { status: 'stale'; profile: null };

export function buildDisplayNameRequest(displayName: string): { displayName: string } {
  const parsed = updateMeSchema.safeParse({ displayName });
  if (!parsed.success) throw new Error(AUTH_GENERIC_INVALID);
  return parsed.data;
}

export async function runOptimisticDisplayNameUpdate<T extends { displayName: string }>(input: {
  gate: LatestRequestGate;
  snapshot: T;
  displayName: string;
  setProfile: (profile: T) => void;
  request: () => Promise<T>;
  syncFirebase?: (displayName: string) => Promise<void>;
}): Promise<OptimisticUpdateResult<T>> {
  const requestId = ++input.gate.current;
  input.setProfile({ ...input.snapshot, displayName: input.displayName });

  try {
    const response = await input.request();
    if (requestId !== input.gate.current) return { status: 'stale', profile: null };

    input.setProfile(response);
    if (input.syncFirebase) {
      try {
        await input.syncFirebase(response.displayName);
      } catch {
        // The API has already updated the authoritative profile. A future
        // Firebase auth refresh will reconcile this optional client cache.
      }
    }
    return { status: 'success', profile: response };
  } catch (error) {
    if (requestId !== input.gate.current) return { status: 'stale', profile: null };
    input.setProfile(input.snapshot);
    throw error;
  }
}

function friendlyValidationMessage(
  field: keyof PasswordChangeFields,
  message: string,
): string {
  if (message === AUTH_PASSWORD_MISMATCH) return AUTH_PASSWORD_MISMATCH;
  if (message === AUTH_PASSWORD_SAME) return AUTH_PASSWORD_SAME;
  if (message === AUTH_PASSWORD_TOO_WEAK) return AUTH_PASSWORD_TOO_WEAK;
  if (field === 'currentPassword') return 'Enter your current password (8–128 characters).';
  if (field === 'newPassword') return 'Enter a new password (8–128 characters).';
  return 'Confirm your new password.';
}

export function validatePasswordChange(input: PasswordChangeFields): AccountActionErrors | null {
  const result = changePasswordSchema.safeParse(input);
  if (result.success) return null;

  const fields: AccountActionErrors['fields'] = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword')
      && !fields[field]
    ) {
      fields[field] = friendlyValidationMessage(field, issue.message);
    }
  }
  return Object.keys(fields).length > 0
    ? { fields }
    : { fields: {}, page: AUTH_ACCOUNT_ACTION_FAILED };
}

export function mapPasswordChangeError(error: unknown): AccountActionErrors {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === 'auth/too-many-requests') {
      return {
        fields: {},
        page: 'Too many password attempts. Wait a few minutes and try again.',
      };
    }
    if (error.status === 400 || error.status === 401) {
      return {
        fields: {
          currentPassword: 'The current password is incorrect or could not be verified.',
        },
      };
    }
    if (error.status >= 500) {
      return {
        fields: {},
        page: 'Password service is temporarily unavailable. Please try again.',
      };
    }
  }

  return {
    fields: {},
    page: 'Could not reach the password service. Check your connection and try again.',
  };
}

export function requiresReauthentication(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.details.reauthenticationRequired === true;
}

export interface PasswordChangeDependencies {
  request: (input: PasswordChangeFields) => Promise<unknown>;
  clearSecrets: () => void;
  signOut: () => Promise<void>;
  redirect: (href: string) => void;
}

export type PasswordChangeResult =
  | { ok: true }
  | { ok: false; errors: AccountActionErrors };

export async function executePasswordChange(
  input: PasswordChangeFields,
  dependencies: PasswordChangeDependencies,
): Promise<PasswordChangeResult> {
  const validation = validatePasswordChange(input);
  if (validation) return { ok: false, errors: validation };

  try {
    await dependencies.request(input);
  } catch (error) {
    if (!requiresReauthentication(error)) {
      return { ok: false, errors: mapPasswordChangeError(error) };
    }
  }

  dependencies.clearSecrets();
  try {
    await dependencies.signOut();
  } catch {
    // The server revoked sessions; redirect even if local Firebase cleanup
    // reports an error so no authenticated account UI remains visible.
  }
  dependencies.redirect('/login?notice=password-changed');
  return { ok: true };
}
