import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api';
import {
  buildDisplayNameRequest,
  executeLogoutAll,
  executePasswordChange,
  mapLogoutAllError,
  mapPasswordChangeError,
  revalidatePasswordErrors,
  runFirebaseSignOutWithCleanup,
  runOptimisticDisplayNameUpdate,
  synchronizeFirebaseDisplayName,
  validatePasswordChange,
  type DisplayNameSyncSequence,
  type LatestRequestGate,
} from './account-actions';

const validPasswords = {
  currentPassword: 'OldPassword1!',
  newPassword: 'NewPassword2!',
  confirmPassword: 'NewPassword2!',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('optimistic display-name updates', () => {
  it('patches immediately and reconciles the authoritative response', async () => {
    const gate: LatestRequestGate = { current: 0 };
    const states: Array<{ displayName: string; role: string }> = [];
    const syncFirebase = vi.fn(async () => undefined);

    const result = await runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Ada', role: 'user' },
      displayName: 'Ada Lovelace',
      setProfile: (profile) => states.push(profile),
      request: async () => ({ displayName: 'Ada L.', role: 'user' }),
      syncFirebase,
    });

    expect(states).toEqual([
      { displayName: 'Ada Lovelace', role: 'user' },
      { displayName: 'Ada L.', role: 'user' },
    ]);
    expect(syncFirebase).toHaveBeenCalledWith(
      'Ada L.',
      expect.objectContaining({ requestId: 1 }),
    );
    expect(result.status).toBe('success');
  });

  it('updates and reloads Firebase before refreshing AuthContext state', async () => {
    const calls: string[] = [];
    const sequence: DisplayNameSyncSequence = {
      requestId: 1,
      isCurrent: () => true,
      latest: () => ({ requestId: 1, displayName: 'Ada Lovelace' }),
    };

    await synchronizeFirebaseDisplayName({
      displayName: 'Ada Lovelace',
      sequence,
      updateProfile: async (displayName) => {
        calls.push(`updateProfile:${displayName}`);
      },
      reload: async () => {
        calls.push('reload');
      },
      refreshContext: () => calls.push('refreshContext'),
    });

    expect(calls).toEqual([
      'updateProfile:Ada Lovelace',
      'reload',
      'refreshContext',
    ]);
  });

  it('keeps the authoritative name and warns when Firebase sync fails', async () => {
    const gate: LatestRequestGate = { current: 0 };
    const states: Array<{ displayName: string }> = [];
    const reconcile = vi.fn(async () => undefined);

    const result = await runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Ada' },
      displayName: 'Ada Lovelace',
      setProfile: (profile) => states.push(profile),
      request: async () => ({ displayName: 'Server Name' }),
      syncFirebase: async () => {
        throw new Error('firebase unavailable');
      },
      reconcile,
    });

    expect(states.at(-1)).toEqual({ displayName: 'Server Name' });
    expect(reconcile).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: 'success',
      profile: { displayName: 'Server Name' },
      syncWarning: expect.stringMatching(/saved.*refresh/i),
    });
  });

  it('rolls back its snapshot when the latest request fails', async () => {
    const gate: LatestRequestGate = { current: 0 };
    const states: Array<{ displayName: string }> = [];
    const failure = new Error('network');

    await expect(runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Ada' },
      displayName: 'Draft name',
      setProfile: (profile) => states.push(profile),
      request: async () => {
        throw failure;
      },
    })).rejects.toBe(failure);

    expect(states).toEqual([{ displayName: 'Draft name' }, { displayName: 'Ada' }]);
  });

  it('ignores stale success and failure responses', async () => {
    const gate: LatestRequestGate = { current: 0 };
    const first = deferred<{ displayName: string }>();
    const second = deferred<{ displayName: string }>();
    const states: Array<{ displayName: string }> = [];

    const firstRun = runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Ada' },
      displayName: 'First',
      setProfile: (profile) => states.push(profile),
      request: () => first.promise,
    });
    const secondRun = runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'First' },
      displayName: 'Second',
      setProfile: (profile) => states.push(profile),
      request: () => second.promise,
    });

    second.resolve({ displayName: 'Server second' });
    await expect(secondRun).resolves.toMatchObject({ status: 'success' });
    first.reject(new Error('stale failure'));
    await expect(firstRun).resolves.toEqual({ status: 'stale', profile: null });
    expect(states.at(-1)).toEqual({ displayName: 'Server second' });
  });

  it('reconciles an older Firebase completion to the latest successful name', async () => {
    const gate: LatestRequestGate = { current: 0 };
    const firstUpdate = deferred<void>();
    const profileStates: Array<{ displayName: string }> = [];
    const userStates: string[] = [];
    const updateCalls: string[] = [];
    let firebaseDisplayName = 'Ada';
    let firstWrite = true;

    const updateProfile = async (displayName: string) => {
      updateCalls.push(displayName);
      if (displayName === 'Server first' && firstWrite) {
        firstWrite = false;
        await firstUpdate.promise;
      }
      firebaseDisplayName = displayName;
    };
    const syncFirebase = (
      displayName: string,
      sequence: DisplayNameSyncSequence,
    ) => synchronizeFirebaseDisplayName({
      displayName,
      sequence,
      updateProfile,
      reload: async () => undefined,
      refreshContext: () => userStates.push(firebaseDisplayName),
    });

    const olderRun = runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Ada' },
      displayName: 'First',
      setProfile: (next) => profileStates.push(next),
      request: async () => ({ displayName: 'Server first' }),
      syncFirebase,
    });
    await vi.waitFor(() => expect(updateCalls).toEqual(['Server first']));

    const latestRun = runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Server first' },
      displayName: 'Second',
      setProfile: (next) => profileStates.push(next),
      request: async () => ({ displayName: 'Server second' }),
      syncFirebase,
    });
    await expect(latestRun).resolves.toMatchObject({
      status: 'success',
      profile: { displayName: 'Server second' },
    });
    expect(firebaseDisplayName).toBe('Server second');

    firstUpdate.resolve(undefined);
    await expect(olderRun).resolves.toEqual({ status: 'stale', profile: null });

    expect(updateCalls).toEqual([
      'Server first',
      'Server second',
      'Server second',
    ]);
    expect(profileStates.at(-1)).toEqual({ displayName: 'Server second' });
    expect(userStates).toEqual(['Server second', 'Server second']);
    expect(firebaseDisplayName).toBe('Server second');
  });

  it('does not publish an older user after its delayed reload completes', async () => {
    const gate: LatestRequestGate = { current: 0 };
    const firstReload = deferred<void>();
    const profileStates: Array<{ displayName: string }> = [];
    const userStates: string[] = [];
    let firebaseDisplayName = 'Ada';
    let loadedDisplayName = 'Ada';
    let reloadCount = 0;

    const syncFirebase = (
      displayName: string,
      sequence: DisplayNameSyncSequence,
    ) => synchronizeFirebaseDisplayName({
      displayName,
      sequence,
      updateProfile: async (nextDisplayName) => {
        firebaseDisplayName = nextDisplayName;
      },
      reload: async () => {
        reloadCount += 1;
        const reloadedName = firebaseDisplayName;
        if (reloadCount === 1) await firstReload.promise;
        loadedDisplayName = reloadedName;
      },
      refreshContext: () => userStates.push(loadedDisplayName),
    });

    const olderRun = runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Ada' },
      displayName: 'First',
      setProfile: (next) => profileStates.push(next),
      request: async () => ({ displayName: 'Server first' }),
      syncFirebase,
    });
    await vi.waitFor(() => expect(reloadCount).toBe(1));

    const latestRun = runOptimisticDisplayNameUpdate({
      gate,
      snapshot: { displayName: 'Server first' },
      displayName: 'Second',
      setProfile: (next) => profileStates.push(next),
      request: async () => ({ displayName: 'Server second' }),
      syncFirebase,
    });
    await expect(latestRun).resolves.toMatchObject({ status: 'success' });
    expect(userStates).toEqual(['Server second']);

    firstReload.resolve(undefined);
    await expect(olderRun).resolves.toEqual({ status: 'stale', profile: null });

    expect(profileStates.at(-1)).toEqual({ displayName: 'Server second' });
    expect(userStates).toEqual(['Server second', 'Server second']);
    expect(loadedDisplayName).toBe('Server second');
  });

  it('builds a sanitized request without privilege-bearing fields', () => {
    expect(buildDisplayNameRequest('  Ada   <b>Lovelace</b> ')).toEqual({
      displayName: 'Ada Lovelace',
    });
    expect(buildDisplayNameRequest('Ada')).not.toHaveProperty('role');
    expect(buildDisplayNameRequest('Ada')).not.toHaveProperty('status');
    expect(buildDisplayNameRequest('Ada')).not.toHaveProperty('effectiveModules');
  });
});

describe('password changes', () => {
  it('maps weak and mismatched passwords to fields without making a request', async () => {
    expect(validatePasswordChange({
      ...validPasswords,
      newPassword: 'password1',
      confirmPassword: 'password1',
    })?.fields.newPassword).toMatch(/stronger password/i);
    expect(validatePasswordChange({
      ...validPasswords,
      confirmPassword: 'DifferentPassword3!',
    })?.fields.confirmPassword).toMatch(/do not match/i);

    const request = vi.fn();
    const result = await executePasswordChange(
      { ...validPasswords, confirmPassword: 'DifferentPassword3!' },
      {
        request,
        clearSecrets: vi.fn(),
        signOut: vi.fn(),
        redirect: vi.fn(),
      },
    );
    expect(result.ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('posts only password fields, clears secrets, signs out, and redirects in order', async () => {
    const calls: string[] = [];
    const request = vi.fn(async (body) => {
      calls.push('request');
      expect(body).toEqual(validPasswords);
    });

    const result = await executePasswordChange(validPasswords, {
      request,
      clearSecrets: () => calls.push('clear'),
      signOut: async () => {
        calls.push('signOut');
      },
      redirect: (href) => calls.push(`redirect:${href}`),
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      'request',
      'clear',
      'signOut',
      'redirect:/login?notice=password-changed',
    ]);
  });

  it('maps wrong-current, rate-limit, and network failures', () => {
    expect(mapPasswordChangeError(
      new ApiError('generic', 400),
    ).fields.currentPassword).toMatch(/current password/i);
    expect(mapPasswordChangeError(
      new ApiError('generic', 429),
    ).page).toMatch(/too many/i);
    expect(mapPasswordChangeError(
      new ApiError('generic', 400, 'AUTH_RATE_LIMITED'),
    ).page).toMatch(/too many/i);
    expect(mapPasswordChangeError(
      new Error('offline'),
    ).page).toMatch(/connection/i);
  });

  it('revalidates mismatch and reuse errors when any dependent field changes', () => {
    const bothErrors = validatePasswordChange({
      currentPassword: 'SamePassword1!',
      newPassword: 'SamePassword1!',
      confirmPassword: 'DifferentPassword2!',
    });
    expect(bothErrors?.fields.newPassword).toMatch(/different/i);
    expect(bothErrors?.fields.confirmPassword).toMatch(/do not match/i);

    const newPasswordResolved = revalidatePasswordErrors(
      bothErrors!,
      {
        currentPassword: 'SamePassword1!',
        newPassword: 'DifferentPassword2!',
        confirmPassword: 'DifferentPassword2!',
      },
      'newPassword',
    );
    expect(newPasswordResolved.fields.newPassword).toBeUndefined();
    expect(newPasswordResolved.fields.confirmPassword).toBeUndefined();

    const reuseError = validatePasswordChange({
      currentPassword: 'SamePassword1!',
      newPassword: 'SamePassword1!',
      confirmPassword: 'SamePassword1!',
    });
    const currentResolved = revalidatePasswordErrors(
      { ...reuseError!, page: 'Previous request failed.' },
      {
        currentPassword: 'OldPassword2!',
        newPassword: 'SamePassword1!',
        confirmPassword: 'SamePassword1!',
      },
      'currentPassword',
    );
    expect(currentResolved.fields.newPassword).toBeUndefined();
    expect(currentResolved.page).toBeUndefined();

    const mismatchError = validatePasswordChange({
      ...validPasswords,
      confirmPassword: 'DifferentPassword3!',
    });
    const confirmResolved = revalidatePasswordErrors(
      mismatchError!,
      validPasswords,
      'confirmPassword',
    );
    expect(confirmResolved.fields.confirmPassword).toBeUndefined();
  });
});

describe('logout-all', () => {
  it('clears client auth and redirects after server success when Firebase sign-out fails', async () => {
    const clearClientAuth = vi.fn();
    const redirect = vi.fn();

    const result = await executeLogoutAll({
      request: vi.fn(async () => ({ reauthenticationRequired: true })),
      signOut: () => runFirebaseSignOutWithCleanup(
        async () => {
          throw new Error('local Firebase failure');
        },
        clearClientAuth,
      ),
      redirect,
    });

    expect(result).toEqual({ ok: true });
    expect(clearClientAuth).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith('/login?notice=sessions-ended');
  });

  it('keeps the client session on server failure and maps status or stable rate codes', async () => {
    const signOut = vi.fn();
    const redirect = vi.fn();

    const result = await executeLogoutAll({
      request: async () => {
        throw new ApiError('generic', 429);
      },
      signOut,
      redirect,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/too many session/i),
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(mapLogoutAllError(
      new ApiError('generic', 400, 'AUTH_RATE_LIMITED'),
    )).toMatch(/too many session/i);
  });
});
