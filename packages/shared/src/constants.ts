export const QUEUE_NAMES = {
  SCRATCH_ORG_CREATE: 'scratch-org-create',
  METADATA_DEPLOY: 'metadata-deploy',
  SFDMU_RUN: 'sfdmu-run',
  DATA_DEPLOY: 'data-deploy',
  CONA_SEED: 'cona-seed',
  ACCOUNT_PARTNER_IMPORT: 'account-partner-import',
  BULK_DATA_UPDATE: 'bulk-data-update',
  USER_PROVISION: 'user-provision',
  ORG_SETUP: 'org-setup',
  AI_ANALYSIS: 'ai-analysis',
} as const;

export const JOB_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const ORG_TYPES = {
  SCRATCH: 'scratch',
  SANDBOX: 'sandbox',
  PROD: 'prod',
} as const;

export const DEPLOYMENT_STRATEGIES = {
  AZURE: 'azure',
  JENKINS: 'jenkins',
} as const;

export const SCRATCH_ORG_WORKFLOW_STEPS = [
  'Create Scratch Org',
  'Generate Password',
  'Retrieve Org Details',
  'Install Packages',
  'Deploy Metadata',
  'Assign Permissions',
  'Complete',
] as const;

export const SCRATCH_ORG_SKIP_STEP_KEYS = {
  INSTALL_PACKAGES: 'installPackages',
  DEPLOY_METADATA: 'deployMetadata',
  ASSIGN_PERMISSIONS: 'assignPermissions',
} as const;

export type ScratchOrgSkipStepKey =
  (typeof SCRATCH_ORG_SKIP_STEP_KEYS)[keyof typeof SCRATCH_ORG_SKIP_STEP_KEYS];

export const SCRATCH_ORG_SKIPPABLE_STEPS = [
  { key: SCRATCH_ORG_SKIP_STEP_KEYS.INSTALL_PACKAGES, label: 'Install Package', workflowStep: 'Install Packages' },
  { key: SCRATCH_ORG_SKIP_STEP_KEYS.DEPLOY_METADATA, label: 'Deploy Metadata', workflowStep: 'Deploy Metadata' },
  { key: SCRATCH_ORG_SKIP_STEP_KEYS.ASSIGN_PERMISSIONS, label: 'Assign Permission', workflowStep: 'Assign Permissions' },
] as const;

export const SCRATCH_PERMISSION_SET = 'System_Admin_Extension';
/** API name in deployed orgs (label is "Onboarding Admin Extension"). */
export const CONA_ADMIN_EXTENSION_PERMSET = SCRATCH_PERMISSION_SET;
export const CONA_SUPER_USER_PERMSET = 'Lifecycle_Super_User';
export const ERROR_LOGGER_PACKAGE_ID = '04t4x000000IcRT';

/** Max workbook upload size for Bulk Data Update (inspect, preview, run). */
export const BULK_DATA_UPDATE_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const BULK_DATA_UPDATE_MAX_WORKBOOK_ROWS = 100_000;

export function bulkDataUpdateMaxFileSizeLabel(): string {
  return `${Math.round(BULK_DATA_UPDATE_MAX_FILE_BYTES / (1024 * 1024))} MB`;
}

export const DEFAULT_AZURE_MANIFEST_PATH = 'CoreFlex Onboarding/manifest/package.xml';

export const PIPELINE_STEPS = [
  'scratch_org_create',
  'prepare_existing_org',
  'git_metadata_deploy',
  // Persisted runs created before provider-neutral SCM support.
  'azure_metadata_deploy',
  'assign_permission_set',
  'load_org_config',
  'load_custom_settings',
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number];

export const USER_TRIGGERED_PIPELINE_STEPS = [
  'provision_users',
  'load_data_seed',
  'load_account_partners',
] as const;

export type UserTriggeredPipelineStepId = (typeof USER_TRIGGERED_PIPELINE_STEPS)[number];

export const ONBOARDING_CONFIG_OBJECT = 'cfs_ob__OnboardingConfig__c';
export const ONBOARDING_REQUEST_OBJECT = 'cfs_ob__u_Request__c';

export const ONBOARDING_CONFIG_QUEUE_MAP = {
  u_Commissions_User_Group: 'cfs_ob__Commissions_Queue_Id__c',
  Distribution_Queue: 'cfs_ob__Distribution_Queue_Id__c',
  u_EquipmentUserGroup: 'cfs_ob__Equipment_Queue_Id__c',
  Finance_Approver_Queue: 'cfs_ob__Finance_Queue_Id__c',
  General_Manager_Queue: 'cfs_ob__General_Manager_Queue_Id__c',
  u_LogisticsGroup: 'cfs_ob__Logistic_Queue_Id__c',
  Manager_Queue: 'cfs_ob__Manager_Queue_Id__c',
  u_MasterDataUserGroup: 'cfs_ob__Master_Data_Queue_Id__c',
  u_PricingUserGroup: 'cfs_ob__Pricing_Queue_Id__c',
  u_RoutingApproverGroup: 'cfs_ob__Router_Queue_Id__c',
  Sales_Ops_User_Group: 'cfs_ob__SalesOps_Queue_Id__c',
  u_ARUserGroup: 'cfs_ob__AR_Queue_Id__c',
  Customer_Life_Cycle_Queue: 'cfs_ob__Customer_Life_Cycle_Queue_Id__c',
} as const;

export const CONA_BOTTLERS = ['5000', '4900', '4600'] as const;

export const CONA_BOTTLER_LABELS: Record<(typeof CONA_BOTTLERS)[number], string> = {
  '5000': 'Northeast',
  '4900': 'Abarta',
  '4600': 'Reyes',
};

export const ACCOUNT_EXPORT_FIELDS =
  'cfs_ob__Active__c, cfs_ob__Anchor_Delivery_Date__c, cfs_ob__Bottler__c, ' +
  'cfs_ob__BusinessTypeExtension__c, cfs_ob__Business_Type__c, ' +
  'cfs_ob__PreferredOrderMethod__c, cfs_ob__Shipping_Conditions__c, ' +
  'cfs_ob__SuppressionReason__c, cfs_ob__u_CustomerName__c, ' +
  'cfs_ob__u_CustomerNumber__c, cfs_ob__u_PrimaryGroup__c, ' +
  'cfs_ob__u_SalesOffice__c, cfs_ob__u_DistributionChannel__c, ' +
  'cfs_ob__u_CustomerAccountGroup__c, cfs_ob__u_ActiveCustomer__c';

export const ONBOARDING_OBJECT = 'cfs_ob__Onboarding_Config__c';

export const QUERY_TEMPLATES = [
  {
    id: 'primary-group-onboarding',
    label: 'Primary Group Onboarding Config',
    object: ONBOARDING_OBJECT,
    requiredVariables: ['bottler'],
    soqlTemplate: `SELECT Id, RecordType.DeveloperName, RecordTypeId, cfs_ob__Bottler__c, cfs_ob__Business_Unit__c, cfs_ob__Sales_Office__c, cfs_ob__Primary_Group_Number__c, cfs_ob__Primary_Group__c, cfs_ob__Payer__c, cfs_ob__Trade_Channel__c, cfs_ob__Subtrade_Channel__c, cfs_ob__Secondary_Group__c, cfs_ob__Secondary_Group_Number__c, cfs_ob__Secondary_Group_Description__c, cfs_ob__Store_Number_Requirements__c, cfs_ob__Terms_of_Payment__c, cfs_ob__TermsofPayment__c, cfs_ob__AML__c, cfs_ob__Is_Tax_Form_Required__c, cfs_ob__Global_Customer__c, cfs_ob__Primary_Franchise_Group_Description__c, cfs_ob__ZN_Partner__c, cfs_ob__Tax_Certificate__c, cfs_ob__Secondary_Franchise_Group_Number__c, cfs_ob__Secondary_Franchise_Group_Description__c FROM ${ONBOARDING_OBJECT} WHERE cfs_ob__Record_Category__c = 'Primary Group' AND cfs_ob__Bottler__c = '{{bottler}}'`,
  },
  {
    id: 'secondary-group-onboarding',
    label: 'Secondary Group Onboarding Config',
    object: ONBOARDING_OBJECT,
    requiredVariables: ['bottler'],
    soqlTemplate: `SELECT Id, RecordType.DeveloperName, RecordTypeId, cfs_ob__Bottler__c, cfs_ob__Business_Unit__c, cfs_ob__Secondary_Group__c, cfs_ob__Secondary_Group_Number__c, cfs_ob__Secondary_Group_Description__c FROM ${ONBOARDING_OBJECT} WHERE cfs_ob__Record_Category__c = 'Secondary Group' AND cfs_ob__Bottler__c = '{{bottler}}'`,
  },
] as const;

export const PIPELINE_PROGRESS_LABELS = [
  'Create Scratch Org',
  'Generate Password',
  'Prepare Existing Org',
  'Install Package',
  'Azure Metadata Deploy',
  'Assign Permission Set',
  'Load Custom Settings',
  'Load Org Config',
  'Complete',
] as const;
