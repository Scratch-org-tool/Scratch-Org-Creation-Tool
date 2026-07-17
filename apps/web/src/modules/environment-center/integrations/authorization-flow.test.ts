import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(
  fileURLToPath(new URL('./use-integrations-workspace.ts', import.meta.url)),
  'utf8',
);

describe('Salesforce org authorization flow', () => {
  it('waits for actual OAuth completion before showing success', () => {
    expect(hookSource).toContain('applyAuthorizationStatus');
    expect(hookSource).toContain('status === \'authorized\'');
    expect(hookSource).toContain('setAuthMessage(`Authorized: ${result.alias}`)');
    expect(hookSource).not.toContain('setAuthMessage(`Authorized: ${sfForm.alias}`)');
  });

  it('polls authorization state when event delivery is unavailable', () => {
    expect(hookSource).toContain(
      '`/orgs/authorize/${encodeURIComponent(authorizingAlias)}/status`',
    );
    expect(hookSource).toContain('AUTHORIZATION_POLL_INTERVAL_MS');
    expect(hookSource).toContain(
      'Browser login opened. Finish signing in; this page will update automatically.',
    );
  });
});
