export type IntegrationTab = 'salesforce' | 'azure';

export type OrgConnectType = 'production' | 'sandbox' | 'devhub' | 'custom';

export const LOGIN_URL_PRODUCTION = 'https://login.salesforce.com';
export const LOGIN_URL_SANDBOX = 'https://test.salesforce.com';

export interface ConnectedOrg {
  id: string;
  alias: string;
  username?: string | null;
  orgType: string;
  type?: string;
  status: string;
  instanceUrl?: string;
  isDevHub?: boolean;
  isDefaultDevHub?: boolean;
  createdAt?: string;
}

export interface ScratchOrg {
  id: string;
  alias: string;
  username: string;
  orgId?: string | null;
  instanceUrl?: string | null;
  loginUrl?: string | null;
  expirationDate?: string | null;
  status: string;
  devHubAlias?: string | null;
  hasPassword?: boolean;
  createdAt: string;
}

export interface ScratchOrgCredentials {
  alias: string;
  username: string;
  password: string | null;
  orgId?: string;
  instanceUrl?: string;
  loginUrl?: string;
  expirationDate?: string | null;
  devHubAlias?: string;
  status: string;
  hasPassword: boolean;
}

export interface AzureStatus {
  connected: boolean;
  source?: string | null;
  orgSlug?: string | null;
  project?: string | null;
  status?: string | null;
}

export interface SalesforceConnectForm {
  alias: string;
  instanceUrl: string;
  isDevHub: boolean;
  orgType: OrgConnectType;
}
