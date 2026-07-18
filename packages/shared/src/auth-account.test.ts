import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  changePasswordSchema,
  logoutAllSchema,
  signupSchema,
  updateMeSchema,
} from './schemas/auth.js';
import { isRegisteredAppPath, moduleForPath, ROUTE_MODULE_MAP } from './auth.js';

describe('self-service account contracts', () => {
  it('sanitizes a display name and rejects privilege or identity fields', () => {
    assert.deepEqual(
      updateMeSchema.parse({ displayName: '  Ada   <b>Lovelace</b>  ' }),
      { displayName: 'Ada Lovelace' },
    );

    for (const field of ['role', 'status', 'grantedModules', 'modules', 'email']) {
      assert.equal(
        updateMeSchema.safeParse({ displayName: 'Ada', [field]: 'admin' }).success,
        false,
      );
    }
    assert.equal(updateMeSchema.safeParse({ displayName: '<script></script>' }).success, false);
    assert.equal(updateMeSchema.safeParse({ displayName: 'x'.repeat(81) }).success, false);
  });

  it('uses the signup strength policy and validates confirmation and reuse', () => {
    const weak = 'password1';
    assert.equal(
      signupSchema.safeParse({
        email: 'ada@example.test',
        password: weak,
        confirmPassword: weak,
        displayName: 'Ada',
      }).success,
      false,
    );
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: 'OldPassword1!',
        newPassword: weak,
        confirmPassword: weak,
      }).success,
      false,
    );
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword2!',
        confirmPassword: 'DifferentPassword3!',
      }).success,
      false,
    );
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: 'NewPassword2!',
        newPassword: 'NewPassword2!',
        confirmPassword: 'NewPassword2!',
      }).success,
      false,
    );
    assert.equal(
      changePasswordSchema.safeParse({
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword2!',
        confirmPassword: 'NewPassword2!',
        email: 'attacker@example.test',
      }).success,
      false,
    );
  });

  it('allows no logout-all request fields', () => {
    assert.deepEqual(logoutAllSchema.parse({}), {});
    assert.deepEqual(logoutAllSchema.parse(undefined), {});
    assert.equal(logoutAllSchema.safeParse({ uid: 'another-user' }).success, false);
  });

  it('registers Account as authenticated-only instead of module-gated', () => {
    assert.equal(Object.hasOwn(ROUTE_MODULE_MAP, '/account'), true);
    assert.equal(ROUTE_MODULE_MAP['/account'], null);
    assert.equal(moduleForPath('/account'), null);
  });

  it('distinguishes registered role-only routes from unknown product routes', () => {
    assert.equal(ROUTE_MODULE_MAP['/admin'], null);
    assert.equal(isRegisteredAppPath('/admin/users'), true);
    assert.equal(isRegisteredAppPath('/account'), true);
    assert.equal(isRegisteredAppPath('/unregistered-feature'), false);
  });
});
