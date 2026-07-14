export type OrgSetupTab = 'baseline' | 'load-config' | 'users-cona' | 'users-csv';

export interface Org {
  id: string;
  alias: string;
}

export interface OrgConfigLoadOptions {
  upsertQueueIds: boolean;
  upsertDomainFields: boolean;
  upsertRequestId: boolean;
}

export interface OrgConfigLoadResult {
  success: boolean;
  logs: string[];
  recordId: string | null;
}

export const DEFAULT_ORG_CONFIG_OPTIONS: OrgConfigLoadOptions = {
  upsertQueueIds: true,
  upsertDomainFields: true,
  upsertRequestId: true,
};

export const ORG_SETUP_TABS: OrgSetupTab[] = ['baseline', 'load-config', 'users-cona', 'users-csv'];
