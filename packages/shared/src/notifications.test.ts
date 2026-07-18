import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  applyNotificationSettingsUpdate,
  isCategoryEnabled,
  isChannelEnabled,
  normalizeNotificationSettings,
  notificationLevelForStatus,
  notificationSettingsUpdateSchema,
  queueToNotificationCategory,
} from './notifications';
import { QUEUE_NAMES } from './constants';

describe('notification defaults', () => {
  it('are disabled until an admin turns them on', () => {
    assert.equal(DEFAULT_NOTIFICATION_SETTINGS.enabled, false);
  });

  it('keep the in-app inbox on by default', () => {
    assert.equal(DEFAULT_NOTIFICATION_SETTINGS.channels.inApp, true);
  });
});

describe('normalizeNotificationSettings', () => {
  it('fills every category and channel from partial input', () => {
    const normalized = normalizeNotificationSettings({ enabled: true, categories: { data: false } });
    assert.equal(normalized.enabled, true);
    assert.equal(normalized.categories.data, false);
    assert.equal(normalized.categories.deployment, true);
    assert.equal(normalized.channels.inApp, true);
    assert.equal(normalized.channels.email, false);
  });

  it('never lets the in-app channel be turned off', () => {
    const normalized = normalizeNotificationSettings({ channels: { inApp: false } });
    assert.equal(normalized.channels.inApp, true);
  });

  it('is resilient to junk input', () => {
    const normalized = normalizeNotificationSettings('nope' as unknown);
    assert.deepEqual(normalized, DEFAULT_NOTIFICATION_SETTINGS);
  });
});

describe('gating helpers', () => {
  it('suppresses categories while the master switch is off', () => {
    const settings = normalizeNotificationSettings({ enabled: false, categories: { deployment: true } });
    assert.equal(isCategoryEnabled(settings, 'deployment'), false);
  });

  it('respects the master switch and per-category toggle together', () => {
    const settings = normalizeNotificationSettings({
      enabled: true,
      categories: { deployment: true, data: false },
    });
    assert.equal(isCategoryEnabled(settings, 'deployment'), true);
    assert.equal(isCategoryEnabled(settings, 'data'), false);
  });

  it('only reports a channel enabled when master + channel are on', () => {
    const off = normalizeNotificationSettings({ enabled: false, channels: { email: true } });
    assert.equal(isChannelEnabled(off, 'email'), false);
    const on = normalizeNotificationSettings({ enabled: true, channels: { email: true } });
    assert.equal(isChannelEnabled(on, 'email'), true);
  });
});

describe('applyNotificationSettingsUpdate', () => {
  it('merges partial toggles onto the current settings', () => {
    const next = applyNotificationSettingsUpdate(DEFAULT_NOTIFICATION_SETTINGS, {
      enabled: true,
      categories: { data: false },
    });
    assert.equal(next.enabled, true);
    assert.equal(next.categories.data, false);
    assert.equal(next.categories.deployment, true);
  });
});

describe('queueToNotificationCategory', () => {
  it('maps queues to categories', () => {
    assert.equal(queueToNotificationCategory(QUEUE_NAMES.METADATA_DEPLOY), 'deployment');
    assert.equal(queueToNotificationCategory(QUEUE_NAMES.DATA_DEPLOY), 'data');
    assert.equal(queueToNotificationCategory(QUEUE_NAMES.BULK_DATA_UPDATE), 'data');
    assert.equal(queueToNotificationCategory(QUEUE_NAMES.SCRATCH_ORG_CREATE), 'environment');
    assert.equal(queueToNotificationCategory(QUEUE_NAMES.USER_PROVISION), 'provisioning');
    assert.equal(queueToNotificationCategory('anything-else'), 'system');
  });
});

describe('notificationLevelForStatus', () => {
  it('maps job status to a severity level', () => {
    assert.equal(notificationLevelForStatus('completed'), 'success');
    assert.equal(notificationLevelForStatus('failed'), 'error');
    assert.equal(notificationLevelForStatus('partial'), 'warning');
  });
});

describe('notificationSettingsUpdateSchema', () => {
  it('rejects an empty update', () => {
    assert.equal(notificationSettingsUpdateSchema.safeParse({}).success, false);
  });

  it('rejects unknown keys', () => {
    assert.equal(
      notificationSettingsUpdateSchema.safeParse({ enabled: true, bogus: 1 }).success,
      false,
    );
  });

  it('accepts a valid partial update', () => {
    const parsed = notificationSettingsUpdateSchema.safeParse({
      enabled: true,
      categories: { deployment: false },
    });
    assert.equal(parsed.success, true);
  });
});
