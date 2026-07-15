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
  | { status: 'success'; profile: T; syncWarning?: string }
  | { status: 'stale'; profile: null };

export const DISPLAY_NAME_SYNC_WARNING =
  'Display name saved, but this device could not refresh it. It will be reconciled automatically.';

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
  reconcile?: () => Promise<void>;
}): Promise<OptimisticUpdateResult<T>> {
  const requestId = ++input.gate.current;
  input.setProfile({ ...input.snapshot, displayName: input.displayName });

  try {
    const response = await input.request();
    if (requestId !== input.gate.current) return { status: 'stale', profile: null };

    input.setProfile(response);
    let syncWarning: string | undefined;
    if (input.syncFirebase) {
      try {
        await input.syncFirebase(response.displayName);
      } catch {
        try {
          await input.reconcile?.();
        } catch {
          // Keep the authoritative API profile even if reconciliation is
          // temporarily unavailable.
        }
        syncWarning = DISPLAY_NAME_SYNC_WARNING;
      }
    }
    return { status: 'success', profile: response, ...(syncWarning ? { syncWarning } : {}) };
  } catch (error) {
    if (requestId !== input.gate.current) return { status: 'stale', profile: null };
    input.setProfile(input.snapshot);
    throw error;
  }
}

export interface FirebaseDisplayNameSyncDependencies {
  updateProfile: () => Promise<void>;
  reload: () => Promise<void>;
  refreshContext: () => void;
}

export async function synchronizeFirebaseDisplayName(
  dependencies: FirebaseDisplayNameSyncDependencies,
): Promise<void> {
  try {
    await dependencies.updateProfile();
    await dependencies.reload();
  } finally {
    // Firebase mutates the User object in place, so force the context value to
    // refresh even when the object identity does not change.
    dependencies.refreshContext();
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

export function revalidatePasswordErrors(
  errors: AccountActionErrors,
  passwords: PasswordChangeFields,
  changedField: keyof PasswordChangeFields,
): AccountActionErrors {
  const fields = { ...errors.fields };
  delete fields[changedField];

  const validationFields = validatePasswordChange(passwords)?.fields ?? {};
  if (errors.fields.newPassword === AUTH_PASSWORD_SAME) {
    if (validationFields.newPassword === AUTH_PASSWORD_SAME) {
      fields.newPassword = AUTH_PASSWORD_SAME;
    } else {
      delete fields.newPassword;
    }
  }
  if (errors.fields.confirmPassword === AUTH_PASSWORD_MISMATCH) {
    if (validationFields.confirmPassword === AUTH_PASSWORD_MISMATCH) {
      fields.confirmPassword = AUTH_PASSWORD_MISMATCH;
    } else {
      delete fields.confirmPassword;
    }
  }

  // A page error describes the previous request and is stale after any input
  // changes. Field errors unrelated to the edit remain actionable.
  return { fields };
}

function normalizedAccountErrorCode(code: string): string {
  return code.trim().toUpperCase().replace(/[-/]/g, '_');
}

export function isAccountRateLimitError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 429) return true;
  if (!error.code) return false;

  const code = normalizedAccountErrorCode(error.code);
  return code === 'AUTH_TOO_MANY_REQUESTS'
    || code === 'AUTH_RATE_LIMITED'
    || code === 'AUTH_ACCOUNT_RATE_LIMITED'
    || code === 'AUTH_ACCOUNT_ACTION_RATE_LIMITED'
    || code === 'RATE_LIMITED'
    || code.endsWith('_RATE_LIMITED');
}

export function mapPasswordChangeError(error: unknown): AccountActionErrors {
  if (error instanceof ApiError) {
    if (isAccountRateLimitError(error)) {
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

export function mapLogoutAllError(error: unknown): string {
  return isAccountRateLimitError(error)
    ? 'Too many session requests. Wait a few minutes and try again.'
    : 'Could not sign out all sessions. Please try again.';
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

export interface LogoutAllDependencies {
  request: () => Promise<unknown>;
  signOut: () => Promise<void>;
  redirect: (href: string) => void;
}

export type LogoutAllResult =
  | { ok: true }
  | { ok: false; error: string };

export async function executeLogoutAll(
  dependencies: LogoutAllDependencies,
): Promise<LogoutAllResult> {
  try {
    await dependencies.request();
  } catch (error) {
    return { ok: false, error: mapLogoutAllError(error) };
  }

  try {
    await dependencies.signOut();
  } catch {
    // Revocation is authoritative. Local Firebase failures must not leave the
    // revoked account UI visible or suppress the successful server notice.
  }
  dependencies.redirect('/login?notice=sessions-ended');
  return { ok: true };
}

export async function runFirebaseSignOutWithCleanup(
  firebaseSignOut: () => Promise<void>,
  clearClientAuth: () => void,
): Promise<void> {
  try {
    await firebaseSignOut();
  } finally {
    clearClientAuth();
  }
}
