import { describe, expect, it } from 'vitest';
import { oauthReturnPath } from './oauth-return-path';

describe('provider OAuth return paths', () => {
  it('returns to the provider-specific Environment Center tab', () => {
    expect(oauthReturnPath('github')).toBe('/environment-center?tab=github');
    expect(oauthReturnPath('bitbucket')).toBe('/environment-center?tab=bitbucket');
    expect(oauthReturnPath('jira')).toBe('/environment-center?tab=jira');
  });
});
