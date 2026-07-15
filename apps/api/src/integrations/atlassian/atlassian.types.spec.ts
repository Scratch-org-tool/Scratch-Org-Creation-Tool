import { describe, expect, it } from 'vitest';
import { normalizeCredential } from './atlassian.types';

describe('Atlassian credentials', () => {
  it('accepts OAuth 2.0 and scoped API tokens', () => {
    expect(normalizeCredential({
      authType: 'oauth2',
      accessToken: 'oauth-token',
    })).toEqual({
      authType: 'oauth2',
      accessToken: 'oauth-token',
      refreshToken: undefined,
      expiresAt: undefined,
      clientId: undefined,
      clientSecret: undefined,
    });
    expect(normalizeCredential({
      authType: 'api_token',
      email: 'admin@example.test',
      apiToken: 'scoped-token',
    })).toEqual({
      authType: 'api_token',
      email: 'admin@example.test',
      apiToken: 'scoped-token',
    });
  });

  it('explicitly refuses Bitbucket app passwords', () => {
    expect(() => normalizeCredential({
      authType: 'api_token',
      email: 'admin@example.test',
      apiToken: 'token',
      appPassword: 'deprecated-secret',
    })).toThrow(/app passwords are not supported/i);
    expect(() => normalizeCredential({
      authType: 'app_password',
    } as never)).toThrow(/app passwords are not supported/i);
  });
});
