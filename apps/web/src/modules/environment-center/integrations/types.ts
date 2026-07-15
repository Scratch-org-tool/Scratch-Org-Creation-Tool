export type IntegrationTab = 'salesforce' | 'source-control' | 'work-management';

export type ScmProvider = 'azure_devops' | 'github' | 'bitbucket';
export type WorkItemProvider = 'azure_boards' | 'github_issues' | 'jira';

export interface PublicIntegrationConnection {
  id: string;
  provider: ScmProvider | WorkItemProvider;
  externalAccountId?: string | null;
  displayName: string;
  namespace?: string | null;
  baseUrl?: string | null;
  source?: 'database' | 'environment' | null;
  status: 'connected' | 'degraded' | 'disconnected' | 'error' | string;
  capabilities?: Record<string, boolean> | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
}

export interface ProjectBinding {
  id: string;
  scmConnectionId?: string | null;
  workItemConnectionId?: string | null;
  externalProjectId: string;
  projectKey?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  metadata?: { workspace?: string | null } | null;
  scmConnection?: Pick<PublicIntegrationConnection, 'id' | 'provider' | 'displayName' | 'status'> | null;
  workItemConnection?: Pick<PublicIntegrationConnection, 'id' | 'provider' | 'displayName' | 'status'> | null;
}

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
  orgConnectionId?: string;
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
