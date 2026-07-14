export type DeploymentState =
  | 'NOT_DISCOVERED'
  | 'DISCOVERED'
  | 'READY'
  | 'QUEUED'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'FAILED'
  | 'WAITING'
  | 'RETRYING'
  | 'SKIPPED';

export type DependencySource = 'known_rule' | 'xml_parse' | 'cross_ref' | 'learned' | 'metadata_api';

export type DeployErrorClass =
  | 'MISSING_DEPENDENCY'
  | 'COMPILE_ERROR'
  | 'REFERENCE_ERROR'
  | 'PERMISSION_ISSUE'
  | 'UNKNOWN_METADATA'
  | 'TRANSIENT'
  | 'UNKNOWN';

export interface DeployError {
  class: DeployErrorClass;
  message: string;
  missingComponentId?: string;
}

export const TERMINAL_STATES: ReadonlySet<DeploymentState> = new Set([
  'DEPLOYED',
  'SKIPPED',
]);

export const ACTIVE_STATES: ReadonlySet<DeploymentState> = new Set([
  'READY',
  'QUEUED',
  'DEPLOYING',
  'WAITING',
  'RETRYING',
]);
