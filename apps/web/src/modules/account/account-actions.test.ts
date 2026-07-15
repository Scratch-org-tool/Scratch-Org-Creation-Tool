import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api';
import {
  buildDisplayNameRequest,
  executePasswordChange,
  mapPasswordChangeError,
  runOptimisticDisplayNameUpdate,
  validatePasswordChange,
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
    expect(syncFirebase).toHaveBeenCalledWith('Ada L.');
    expect(result.status).toBe('success');
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
      new Error('offline'),
    ).page).toMatch(/connection/i);
  });
});
