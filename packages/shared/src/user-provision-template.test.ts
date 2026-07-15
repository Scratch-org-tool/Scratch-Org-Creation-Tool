import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateEmailPool,
  expandUserGenerators,
  generateEmailStyleUsername,
  formatProvisioningUsername,
  normalizeRoleSlug,
  resolveRoleBottlerMapping,
  resolveUserProvisioningPlan,
  stableDeterministicShuffle,
  userProvisioningConfigSchema,
  type RoleBottlerMapping,
  type UserGenerator,
  type UserProvisionTeam,
} from './user-provision-template.js';

describe('user provisioning contracts', () => {
  it('accepts concrete users, legacy slots, generators, and sequential execution', () => {
    const parsed = userProvisioningConfigSchema.parse({
      discoveryPolicy: 'strict',
      users: [{
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
        role: 'Sales Rep',
        bottler: '5000',
      }],
      templates: [{
        id: 'rep',
        label: 'Rep',
        bottler: '5000',
        role: 'Sales Rep',
      }],
      slots: [{
        templateId: 'rep',
        firstName: 'Slot',
        lastName: 'User',
        email: 'slot@example.com',
      }],
      teams: [{
        id: 'alpha',
        emailPool: { emails: ['one@example.com'] },
      }],
      userGenerators: [{
        id: 'reps',
        count: 1,
        role: 'Sales Rep',
        bottler: '5000',
        teamId: 'alpha',
      }],
      execution: { mode: 'sequential', concurrency: 1, failurePolicy: 'continue' },
    });
    assert.equal(parsed.execution?.concurrency, 1);
    assert.equal(parsed.teams?.[0].emailPool.allocation, 'shuffled_round_robin');
    assert.equal(parsed.teams?.[0].emailPool.seed, 'automation_run');
  });

  it('rejects unsupported concurrency and unknown generator teams', () => {
    assert.throws(
      () => userProvisioningConfigSchema.parse({ execution: { concurrency: 2 } }),
      /Invalid literal value/,
    );
    assert.throws(
      () =>
        userProvisioningConfigSchema.parse({
          userGenerators: [{
            id: 'missing-team',
            count: 1,
            role: 'Rep',
            bottler: '5000',
            teamId: 'unknown',
          }],
        }),
      /Unknown team/,
    );
  });
});

describe('deterministic user helpers', () => {
  it('normalizes role slugs consistently', () => {
    assert.equal(normalizeRoleSlug('  Café & Field / SALES  '), 'cafe-and-field-sales');
  });

  it('shuffles without mutation and allocates stable round-robin pools', () => {
    const source = ['a', 'b', 'c', 'd'];
    const first = stableDeterministicShuffle(source, 'run-123');
    const second = stableDeterministicShuffle(source, 'run-123');
    assert.deepEqual(first, second);
    assert.deepEqual(source, ['a', 'b', 'c', 'd']);

    const allocated = allocateEmailPool(
      ['one@example.com', 'two@example.com'],
      5,
      { seed: 'run-123', allowReuse: true },
    );
    assert.deepEqual(allocated.slice(0, 2), allocated.slice(2, 4));
    assert.throws(
      () =>
        allocateEmailPool(
          ['one@example.com', 'two@example.com'],
          3,
          { seed: 'run-123', allowReuse: false },
        ),
      /2 addresses but 3 are required/,
    );
  });

  it('generates unique email-style usernames from a real configured domain', () => {
    const username = generateEmailStyleUsername({
      firstName: 'Ada',
      lastName: 'Lovelace',
      domain: 'login.example.com',
      uniqueKey: 'run-1-user-1',
    });
    assert.equal(username, 'ada.lovelace+run-1-user-1@login.example.com');
    assert.doesNotMatch(username, /\.invalid$/);
    assert.throws(
      () =>
        generateEmailStyleUsername({
          firstName: 'No',
          lastName: 'Domain',
          uniqueKey: 'one',
        }),
      /domain/,
    );
  });

  it('formats configured username patterns deterministically', () => {
    assert.equal(
      formatProvisioningUsername(
        'ada+seed@users.example.com',
        '{{local}}.{{runId}}.{{ordinal}}@{{domain}}',
        { runId: 'Run 42', ordinal: 3 },
      ),
      'ada+seed.run-42.3@users.example.com',
    );
  });

  it('resolves normalized role+bottler mappings and rejects ambiguity', () => {
    const mappings: RoleBottlerMapping[] = [{
      role: 'Field Sales',
      bottler: '5000',
      salesforceRole: 'SF Field Sales',
      permissionSets: [],
      modules: [],
      locations: [],
    }];
    assert.equal(
      resolveRoleBottlerMapping('field-sales', '5000', mappings)?.salesforceRole,
      'SF Field Sales',
    );
    assert.throws(
      () => resolveRoleBottlerMapping('Field Sales', '5000', [...mappings, ...mappings]),
      /Ambiguous/,
    );
  });

  it('expands generators deterministically with team pools and unique usernames', () => {
    const generators: UserGenerator[] = [{
      id: 'field-reps',
      count: 2,
      role: 'Field Sales',
      bottler: '5000',
      teamId: 'alpha',
      firstNamePrefix: 'Generated',
    }, {
      id: 'field-leads',
      count: 1,
      role: 'Field Lead',
      bottler: '5000',
      teamId: 'alpha',
      firstNamePrefix: 'Lead',
    }];
    const teams: UserProvisionTeam[] = [{
      id: 'alpha',
      emailPool: {
        emails: ['first@example.com', 'second@example.com', 'third@example.com'],
        allocation: 'shuffled_round_robin',
        allowReuse: false,
        seed: 'automation_run',
      },
    }];
    const options = {
      automationRunId: 'run-123',
      teams,
      usernamePolicy: { domain: 'users.example.com' },
    } as const;
    const first = expandUserGenerators(generators, options);
    const second = expandUserGenerators(generators, options);

    assert.deepEqual(first, second);
    assert.equal(new Set(first.map((user) => user.email)).size, 3);
    assert.equal(new Set(first.map((user) => user.username)).size, 3);
    assert.ok(first.every((user) => user.username?.endsWith('@users.example.com')));
  });

  it('applies Salesforce roles and profiles to explicit, slotted, and generated users', () => {
    const users = resolveUserProvisioningPlan({
      defaultProfile: 'Standard User',
      emailPolicy: { strategy: 'generated', domain: 'mail.example.com' },
      roleBottlerMappings: [{
        role: 'Field Sales',
        bottler: '5000',
        salesforceRole: 'Sales Rep',
        profile: 'Mapped Profile',
        permissionSets: ['Sales'],
      }],
      users: [{
        firstName: 'Explicit',
        lastName: 'User',
        email: 'explicit@example.com',
        role: 'Field Sales',
        bottler: '5000',
      }],
      templates: [{
        id: 'sales',
        label: 'Sales',
        role: 'Field Sales',
        bottler: '5000',
      }],
      slots: [{
        templateId: 'sales',
        firstName: 'Slot',
        lastName: 'User',
        email: 'slot@example.com',
      }],
      userGenerators: [{
        id: 'generated',
        count: 1,
        role: 'Field Sales',
        bottler: '5000',
      }],
    }, 'run-role-map');

    assert.equal(users.length, 3);
    assert.ok(users.every((user) => user.role === 'Sales Rep'));
    assert.ok(users.every((user) => user.profile === 'Mapped Profile'));
  });

  it('adds stable per-user entropy to constant patterns and enforces Salesforce length', () => {
    const config = {
      defaultProfile: 'Standard User',
      usernamePolicy: {
        strategy: 'email_style' as const,
        pattern: `${'provisioned'.repeat(12)}@users.example.com`,
        seed: 'automation_run' as const,
      },
      users: [1, 2].map((ordinal) => ({
        firstName: `User${ordinal}`,
        lastName: 'WithAnExtremelyLongNameThatMustStillProduceAValidSalesforceUsername',
        email: `user${ordinal}@example.com`,
        role: 'Rep',
        bottler: '5000',
      })),
    };
    const first = resolveUserProvisioningPlan(config, 'stable-run');
    const second = resolveUserProvisioningPlan(config, 'stable-run');
    assert.deepEqual(first, second);
    assert.equal(new Set(first.map((user) => user.username)).size, 2);
    assert.ok(first.every((user) =>
      Boolean(user.username?.includes('@')) && user.username!.length <= 80));
  });

  it('does not duplicate a previously persisted generator expansion on resume', () => {
    const generator: UserGenerator = {
      id: 'resume-generator',
      count: 1,
      role: 'Rep',
      bottler: '5000',
      firstNamePrefix: 'Generated',
    };
    const options = {
      automationRunId: 'resume-run',
      emailPolicy: { strategy: 'generated' as const, domain: 'mail.example.com' },
      defaultProfile: 'Standard User',
    };
    const persisted = expandUserGenerators([generator], options)[0];
    const resolved = resolveUserProvisioningPlan({
      defaultProfile: 'Standard User',
      emailPolicy: options.emailPolicy,
      users: [persisted],
      userGenerators: [generator],
    }, options.automationRunId);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].username, persisted.username);
  });
});
