export type DataCenterTab = 'cona' | 'deploy' | 'replication' | 'templates' | 'org-to-org';

export interface Org {
  id: string;
  alias: string;
  type?: string;
  expiresAt?: string | null;
}

export type OrgToOrgDeployStrategy = 'insert' | 'upsert';

export type OrgToOrgWizardStep = 'configure' | 'preview' | 'deploy';

export type OrgToOrgFilterOperator = 'eq' | 'neq' | 'contains' | 'not_empty' | 'empty' | 'in';

export interface OrgToOrgFilterRow {
  field: string;
  operator: OrgToOrgFilterOperator;
  value?: string;
}

export interface OrgToOrgObjectInfo {
  apiName: string;
  label: string;
  queryable: boolean;
  custom: boolean;
}

export interface OrgToOrgReferenceField {
  name: string;
  label: string;
  referencedTo: string[];
  deployable: boolean;
  selected: boolean;
}

export interface OrgToOrgDeployableField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  createable: boolean;
  reference: boolean;
  custom: boolean;
  selected: boolean;
  externalId?: boolean;
  idLookup?: boolean;
}

export interface OrgToOrgObjectMeta {
  objectName: string;
  label: string;
  nameField: string;
  matchField: string;
  externalIdFields?: string[];
  displayFields: string[];
  filterableFields: Array<{ name: string; label: string; type: string }>;
  deployableFields: OrgToOrgDeployableField[];
  referenceFields: OrgToOrgReferenceField[];
}

export interface OrgToOrgRecordPage {
  records: unknown[];
  totalSize: number;
  page: number;
  pageSize: number;
  objectName: string;
  displayFields: string[];
}

export type OrgToOrgQueryMode = 'builder' | 'soql';

export interface OrgToOrgObjectDeployConfig {
  id?: string;
  objectName: string;
  recordLimit: number;
  filters: OrgToOrgFilterRow[];
  selectedReferenceFields: string[];
  selectedDeployFields: string[];
  matchField: string;
  queryMode?: OrgToOrgQueryMode;
  customSoql?: string;
  matchCount?: number;
  previewRecords?: unknown[];
  displayFields?: string[];
  dependsOn?: string[];
  order?: number;
}

export interface OrgToOrgFilterPreviewResult {
  soql: string;
  matchCount: number;
  records: unknown[];
  displayFields: string[];
  objectName: string;
}

export interface OrgToOrgCompareSummary {
  sourceTotal: number;
  targetTotal: number;
  onlyInSource: number;
  onlyInTarget: number;
  inBoth: number;
}

export interface OrgToOrgCompareResult {
  summary: OrgToOrgCompareSummary;
  onlyInSourceKeys: string[];
  onlyInTargetKeys: string[];
  inBothKeys: string[];
  sourceRecords: {
    records: unknown[];
    totalSize: number;
    page: number;
    pageSize: number;
  };
  matchField: string;
  truncated?: boolean;
  warning?: string;
}

export interface OrgToOrgDeployBatchResult {
  batchId: string;
  deployments: Array<{
    objectName: string;
    movementId: string;
    jobId?: string;
    status: string;
    batchId?: string;
    totalChunks?: number;
  }>;
  dryRun?: boolean;
  quotaSummary?: {
    estimatedBulkBatches: number;
    remaining: number | null;
    sufficient: boolean;
  };
  preflight?: Array<{
    id: string;
    objectName: string;
    report: import('./data-center-contracts').DataPreflightReport;
  }>;
}

export interface OrgToOrgFormState {
  sourceOrgId: string;
  targetOrgId: string;
  strategy: OrgToOrgDeployStrategy;
}

export const DEFAULT_OBJECT_CONFIG = (objectName: string, matchField = 'Name'): OrgToOrgObjectDeployConfig => ({
  objectName,
  recordLimit: 200,
  filters: [],
  selectedReferenceFields: [],
  selectedDeployFields: [],
  matchField,
  queryMode: 'builder',
  customSoql: '',
});

export const FILTER_OPERATORS: Array<{ value: OrgToOrgFilterOperator; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equal to' },
  { value: 'contains', label: 'contains' },
  { value: 'not_empty', label: 'is not empty' },
  { value: 'empty', label: 'is empty' },
  { value: 'in', label: 'in (comma-separated)' },
];
