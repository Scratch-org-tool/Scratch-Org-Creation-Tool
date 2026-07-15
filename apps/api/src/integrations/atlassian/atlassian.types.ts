export type AtlassianDeployment = 'cloud' | 'data_center';

export type AtlassianCredential =
  | {
      authType: 'oauth2';
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
      clientId?: string;
      clientSecret?: string;
    }
  | {
      authType: 'api_token';
      email: string;
      apiToken: string;
    };

export interface BitbucketConnectionConfig {
  deployment: AtlassianDeployment;
  apiBaseUrl: string;
  gitBaseUrl: string;
  oauthBaseUrl: string;
  workspace?: string;
  webhookSecret?: string;
}

export interface JiraConnectionConfig {
  deployment: AtlassianDeployment;
  /** Direct site URL for API-token auth, e.g. https://example.atlassian.net. */
  siteUrl?: string;
  /** Atlassian Cloud site identifier used by OAuth 2.0 3LO. */
  cloudId?: string;
  apiGatewayBaseUrl: string;
  authBaseUrl: string;
  fieldMappings?: JiraFieldMappings;
  webhookSecret?: string;
}

export interface JiraFieldMappings {
  severity?: string;
  area?: string;
  iteration?: string;
  sprint?: string;
  priority?: Record<string, string | number>;
  custom?: Record<string, string>;
  workflow?: Record<string, string>;
}

export interface StoredAtlassianConnection<TConfig> {
  id: string;
  externalAccountId: string | null;
  displayName: string;
  namespace: string | null;
  credential: AtlassianCredential;
  config: TConfig;
  connectedAt: string;
  lastVerifiedAt: string | null;
}

export interface AtlassianConnectInput {
  authType: 'oauth2' | 'api_token';
  accessToken?: string;
  authorizationCode?: string;
  refreshToken?: string;
  expiresAt?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  email?: string;
  apiToken?: string;
  /** Rejected explicitly. It exists only to return a useful migration error. */
  appPassword?: string;
  deployment?: AtlassianDeployment;
  apiBaseUrl?: string;
  gitBaseUrl?: string;
  oauthBaseUrl?: string;
  workspace?: string;
  siteUrl?: string;
  cloudId?: string;
  apiGatewayBaseUrl?: string;
  authBaseUrl?: string;
  fieldMappings?: JiraFieldMappings;
  webhookSecret?: string;
}

export function normalizeCredential(input: AtlassianConnectInput): AtlassianCredential {
  if (input.appPassword || (input.authType as string) === 'app_password') {
    throw new Error(
      'Bitbucket app passwords are not supported. Use OAuth 2.0 or an Atlassian scoped API token.',
    );
  }
  if (input.authType === 'oauth2') {
    if (!input.accessToken?.trim()) throw new Error('OAuth 2.0 accessToken is required');
    return {
      authType: 'oauth2',
      accessToken: input.accessToken.trim(),
      refreshToken: input.refreshToken?.trim() || undefined,
      expiresAt: input.expiresAt,
      clientId: input.clientId?.trim() || undefined,
      clientSecret: input.clientSecret?.trim() || undefined,
    };
  }
  if (!input.email?.trim() || !input.apiToken?.trim()) {
    throw new Error('Atlassian email and scoped API token are required');
  }
  return {
    authType: 'api_token',
    email: input.email.trim(),
    apiToken: input.apiToken.trim(),
  };
}

export function assertCloud(deployment: AtlassianDeployment): void {
  if (deployment !== 'cloud') {
    throw new Error(
      'This adapter implements Atlassian Cloud APIs only. Bitbucket/Jira Data Center requires a separate API profile.',
    );
  }
}
