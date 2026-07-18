import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONA_ADMIN_EXTENSION_PERMSET, CONA_SUPER_USER_PERMSET } from './constants.js';
import {
  DEFAULT_LIFECYCLE_PROFILE,
  DEFAULT_LIFECYCLE_USERNAME_PATTERN,
  expandLifecycleUsers,
  formatLifecycleUsername,
  lifecycleUserGenerationSchema,
  resolveBottlerLabel,
} from './lifecycle-user-generation.js';

const ORG_ID = '3f0e8f38-8f5f-4bb0-9c33-92aa8d6f9df1';

const baseInput = {
  orgId: ORG_ID,
  bottler: '4600',
  roles: ['Requestor', 'Master Data', 'Distribution'],
  modules: ['Onboarding', 'Equipment'],
  locations: ['Northeast'],
  emails: ['team@example.com'],
};

describe('lifecycleUserGenerationSchema', () => {
  it('applies pattern and profile defaults', () => {
    const parsed = lifecycleUserGenerationSchema.parse(baseInput);
    assert.equal(parsed.usernamePattern, DEFAULT_LIFECYCLE_USERNAME_PATTERN);
    assert.equal(parsed.profile, DEFAULT_LIFECYCLE_PROFILE);
    assert.deepEqual(parsed.modules, ['Onboarding', 'Equipment']);
  });

  it('rejects duplicate emails, duplicate roles, and patterns without a domain', () => {
    assert.throws(() => lifecycleUserGenerationSchema.parse({
      ...baseInput,
      emails: ['a@example.com', 'A@example.com'],
    }), /Emails must be unique/);
    assert.throws(() => lifecycleUserGenerationSchema.parse({
      ...baseInput,
      roles: ['Requestor', 'requestor'],
    }), /Roles must be unique/);
    assert.throws(() => lifecycleUserGenerationSchema.parse({
      ...baseInput,
      usernamePattern: '{role}.reyes',
    }), /must contain an @domain/);
  });
});

describe('formatLifecycleUsername', () => {
  const values = {
    role: 'Master Data',
    bottler: '4600',
    bottlerLabel: 'Reyes',
    seed: 'batch-1',
    ordinal: 2,
  };

  it('substitutes tokens case-insensitively and lowercases the result', () => {
    const username = formatLifecycleUsername('{Role}.{bottlerLabel}@Lifecycle.Scratch', values);
    assert.equal(username, 'masterdata.reyes@lifecycle.scratch');
    assert.equal(
      formatLifecycleUsername('{role}{bottler}@x.scratch', values),
      'masterdata4600@x.scratch',
    );
  });

  it('keeps {unique} stable for the same seed and distinct across ordinals', () => {
    const pattern = '{role}.{unique}@lifecycle.scratch';
    const first = formatLifecycleUsername(pattern, values);
    assert.equal(formatLifecycleUsername(pattern, values), first);
    const otherOrdinal = formatLifecycleUsername(pattern, { ...values, ordinal: 3 });
    assert.notEqual(otherOrdinal, first);
  });

  it('rejects unknown tokens and enforces the 80-character username limit', () => {
    assert.throws(() => formatLifecycleUsername('{nope}@x.scratch', values), /Unknown username token \{nope\}/);
    const long = formatLifecycleUsername(`${'{role}'.repeat(12)}@lifecycle.scratch`, values);
    assert.ok(long.length <= 80);
    assert.match(long, /@lifecycle\.scratch$/);
  });
});

describe('expandLifecycleUsers', () => {
  const expansion = {
    ...lifecycleUserGenerationSchema.parse(baseInput),
    seed: 'batch-42',
    bottlerLabel: 'Reyes',
  };

  it('creates one user per role with Apex-style names and shared fields', () => {
    const users = expandLifecycleUsers(expansion);
    assert.equal(users.length, 3);
    const masterData = users.find((user) => user.role === 'Master Data');
    assert.ok(masterData);
    assert.equal(masterData.firstName, 'MasterData');
    assert.equal(masterData.lastName, 'Reyes');
    assert.equal(masterData.email, 'team@example.com');
    assert.equal(masterData.profile, 'System Administrator');
    assert.deepEqual(masterData.modules, ['Onboarding', 'Equipment']);
    assert.deepEqual(masterData.locations, ['Northeast']);
    assert.match(masterData.username, /^masterdata\.reyes\.[a-z0-9]+@lifecycle\.scratch$/);
    assert.equal(new Set(users.map((user) => user.username)).size, 3);
  });

  it('assigns the admin extension to everyone and super user only to Master Data', () => {
    const users = expandLifecycleUsers(expansion);
    const masterData = users.find((user) => user.role === 'Master Data');
    const requestor = users.find((user) => user.role === 'Requestor');
    assert.deepEqual(masterData?.permissionSets, [CONA_ADMIN_EXTENSION_PERMSET, CONA_SUPER_USER_PERMSET]);
    assert.deepEqual(requestor?.permissionSets, [CONA_ADMIN_EXTENSION_PERMSET]);
  });

  it('fans a single email out to every role and distributes two emails round-robin', () => {
    const single = expandLifecycleUsers(expansion);
    assert.ok(single.every((user) => user.email === 'team@example.com'));

    const two = expandLifecycleUsers({
      ...expansion,
      roles: ['Requestor', 'Master Data', 'Distribution', 'Equipment', 'Router'],
      emails: ['one@example.com', 'two@example.com'],
    });
    const counts = new Map<string, number>();
    for (const user of two) counts.set(user.email, (counts.get(user.email) ?? 0) + 1);
    assert.deepEqual([...counts.values()].sort(), [2, 3]);
  });

  it('is deterministic for the same seed', () => {
    const input = {
      ...expansion,
      emails: ['one@example.com', 'two@example.com'],
    };
    assert.deepEqual(expandLifecycleUsers(input), expandLifecycleUsers(input));
  });

  it('rejects patterns that collapse roles into duplicate usernames', () => {
    assert.throws(() => expandLifecycleUsers({
      ...expansion,
      usernamePattern: 'static.reyes@lifecycle.scratch',
    }), /duplicate username .* include \{role\} or \{unique\}/);
  });
});

describe('resolveBottlerLabel', () => {
  it('maps known bottlers and passes unknown values through', () => {
    assert.equal(resolveBottlerLabel('4600'), 'Reyes');
    assert.equal(resolveBottlerLabel('4900'), 'Abarta');
    assert.equal(resolveBottlerLabel('5000'), 'Northeast');
    assert.equal(resolveBottlerLabel('4700'), '4700');
  });
});
