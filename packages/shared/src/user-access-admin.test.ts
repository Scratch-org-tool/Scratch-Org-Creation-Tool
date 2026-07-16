import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { updateUserAccessSchema } from './schemas/auth.js';
import { APP_MODULES } from './auth.js';
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
