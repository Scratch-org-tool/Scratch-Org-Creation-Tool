export type DeploySourceMode = 'azure_manifest' | 'org_to_org_manifest' | 'local_workspace';

export type TargetOrgProfile = 'greenfield' | 'incremental';

export interface DeploySourceContext {
  mode: DeploySourceMode;
  projectRoot: string;
  manifestPath: string;
  manifestAbsolutePath: string;
  targetOrgAlias: string;
  testLevel?: string;
  sourceOrgAlias?: string;
  targetOrgProfile?: TargetOrgProfile;
}

export interface OrchestratorRunContext {
  runId: string;
  source: DeploySourceContext;
  deploymentId?: string;
  automationRunId?: string;
  resumeCheckpoint?: import('./checkpoint').DeployCheckpoint;
  maxRetriesPerNode?: number;
  targetOrgProfile?: TargetOrgProfile;
}
