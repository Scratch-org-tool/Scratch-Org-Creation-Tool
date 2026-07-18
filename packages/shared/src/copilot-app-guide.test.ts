import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatGuideForPrompt,
  matchNavigationAction,
} from './copilot-app-guide.js';

describe('permission-aware Copilot app guide', () => {
  it('allows navigation only to explicitly granted feature routes', () => {
    assert.equal(
      matchNavigationAction('open data deploy', ['dashboard', 'deployment']),
      undefined,
    );
    assert.deepEqual(
      matchNavigationAction('open data deploy', ['dashboard', 'data']),
      {
        type: 'navigate',
        href: '/data-deploy',
        label: 'Data Deployment',
      },
    );
    assert.equal(
      matchNavigationAction('open org setup', ['dashboard', 'deployment']),
      undefined,
    );
    assert.deepEqual(
      matchNavigationAction('open org setup', ['dashboard', 'org-setup']),
      {
        type: 'navigate',
        href: '/org-setup',
        label: 'Org Setup',
      },
    );
  });

  it('never offers admin navigation to a standard user', () => {
    assert.equal(
      matchNavigationAction('open user access', ['dashboard'], 'user'),
      undefined,
    );
    assert.deepEqual(
      matchNavigationAction('open user access', ['dashboard'], 'admin'),
      {
        type: 'navigate',
        href: '/admin/users',
        label: 'User Access',
      },
    );
  });

  it('filters route and workflow grounding to the server-authorized context', () => {
    const userGuide = formatGuideForPrompt('How do I grant module access?', {
      role: 'user',
      grantedModules: ['dashboard', 'copilot'],
    });
    assert.match(userGuide, /\*\*Dashboard\*\*/);
    assert.doesNotMatch(userGuide, /\*\*Environment Center\*\*/);
    assert.doesNotMatch(userGuide, /\*\*User Access\*\*/);
    assert.doesNotMatch(userGuide, /Grant module access to users/);

    const dataGuide = formatGuideForPrompt('How do I deploy records?', {
      role: 'user',
      grantedModules: ['dashboard', 'copilot', 'data'],
    });
    assert.match(dataGuide, /\*\*Deployment Center\*\*/);
    assert.match(dataGuide, /Data Deployment/);
    assert.doesNotMatch(dataGuide, /Git Metadata Deploy:/);
    assert.doesNotMatch(dataGuide, /Org Setup:/);
  });
});
