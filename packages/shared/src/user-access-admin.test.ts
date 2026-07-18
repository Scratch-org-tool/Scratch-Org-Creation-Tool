import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { updateUserAccessSchema } from './schemas/auth.js';
import {
  APP_MODULES,
  DEFAULT_USER_MODULES,
  REVOCABLE_DEFAULT_MODULES,
  canAccessModule,
  getEffectiveModules,
  sanitizeRevokedModules,
} from './auth.js';
import {
  auditEventLabel,
  clampAuditLimit,
  clampAuditOffset,
  isAuditEventFailure,
  AUDIT_EVENTS_DEFAULT_LIMIT,
  AUDIT_EVENTS_MAX_LIMIT,
} from './user-access-admin.js';

describe('updateUserAccessSchema', () => {
  it('accepts every canonical module, including defects', () => {
    const result = updateUserAccessSchema.safeParse({
      grantedModules: [...APP_MODULES],
    });
    assert.equal(result.success, true);
    // The historical bug: `defects` used to be missing from the enum.
    assert.equal(
      updateUserAccessSchema.safeParse({ grantedModules: ['defects'] }).success,
      true,
    );
  });

  it('rejects unknown modules and oversized grants', () => {
    assert.equal(
      updateUserAccessSchema.safeParse({ grantedModules: ['nope'] }).success,
      false,
    );
    assert.equal(
      updateUserAccessSchema.safeParse({
        grantedModules: Array.from({ length: 21 }, () => 'data'),
      }).success,
      false,
    );
  });

  it('accepts revokedModules and the learningAssignedOnly flag', () => {
    assert.equal(
      updateUserAccessSchema.safeParse({
        revokedModules: ['data', 'defects'],
        learningAssignedOnly: true,
      }).success,
      true,
    );
    assert.equal(
      updateUserAccessSchema.safeParse({ revokedModules: ['nope'] }).success,
      false,
    );
    assert.equal(
      updateUserAccessSchema.safeParse({ learningAssignedOnly: 'yes' }).success,
      false,
    );
  });
});

describe('revocable default modules', () => {
  it('dashboard is never revocable; revocable modules are real app modules', () => {
    assert.equal((REVOCABLE_DEFAULT_MODULES as readonly string[]).includes('dashboard'), false);
    assert.equal((DEFAULT_USER_MODULES as readonly string[]).includes('dashboard'), true);
    for (const module of REVOCABLE_DEFAULT_MODULES) {
      assert.equal((APP_MODULES as readonly string[]).includes(module), true);
    }
  });

  it('sanitizeRevokedModules keeps only revocable defaults and dedupes', () => {
    assert.deepEqual(
      sanitizeRevokedModules(['data', 'data', 'dashboard', 'deployment', 'nope']),
      ['data'],
    );
    assert.deepEqual(sanitizeRevokedModules(undefined), []);
  });

  it('getEffectiveModules subtracts revoked modules for users', () => {
    const profile: Parameters<typeof getEffectiveModules>[0] = {
      role: 'user',
      grantedModules: ['learning', 'environment', 'data', 'defects'],
      revokedModules: ['data', 'defects'],
    };
    const effective = getEffectiveModules(profile);
    assert.equal(effective.includes('data'), false);
    assert.equal(effective.includes('defects'), false);
    assert.equal(effective.includes('dashboard'), true);
    assert.equal(effective.includes('environment'), true);
    assert.equal(effective.includes('learning'), true);
    assert.equal(canAccessModule(profile, 'data'), false);
  });

  it('a stale grant of a default module cannot bypass a revocation', () => {
    const effective = getEffectiveModules({
      role: 'user',
      grantedModules: ['data'],
      revokedModules: ['data'],
    });
    assert.equal(effective.includes('data'), false);
  });

  it('admins ignore revocations entirely', () => {
    const effective = getEffectiveModules({
      role: 'admin',
      grantedModules: [],
      revokedModules: ['data', 'environment', 'defects'],
    });
    assert.deepEqual(effective, [...APP_MODULES]);
  });
});

describe('audit pagination guards', () => {
  it('clamps limit into [1, MAX] with a sane default', () => {
    assert.equal(clampAuditLimit(undefined), AUDIT_EVENTS_DEFAULT_LIMIT);
    assert.equal(clampAuditLimit('0'), AUDIT_EVENTS_DEFAULT_LIMIT);
    assert.equal(clampAuditLimit('-5'), AUDIT_EVENTS_DEFAULT_LIMIT);
    assert.equal(clampAuditLimit('10'), 10);
    assert.equal(clampAuditLimit(9999), AUDIT_EVENTS_MAX_LIMIT);
  });

  it('clamps offset to a non-negative integer', () => {
    assert.equal(clampAuditOffset(undefined), 0);
    assert.equal(clampAuditOffset('-3'), 0);
    assert.equal(clampAuditOffset('40'), 40);
  });
});

describe('audit event presentation', () => {
  it('maps known event types to friendly labels', () => {
    assert.equal(auditEventLabel('user_access_updated'), 'User access updated');
    assert.equal(auditEventLabel('password_change_success'), 'Password changed');
  });

  it('humanises unknown event types', () => {
    assert.equal(auditEventLabel('some_new_event'), 'Some New Event');
  });

  it('flags failures and denials', () => {
    assert.equal(isAuditEventFailure('user_access_update_denied'), true);
    assert.equal(isAuditEventFailure('password_change_failed'), true);
    assert.equal(isAuditEventFailure('user_access_updated'), false);
  });
});
