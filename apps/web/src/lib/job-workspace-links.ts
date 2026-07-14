export interface JobWorkspaceLinkInput {
  id: string;
  type: string;
  automationRunId?: string | null;
  runIntent?: string | null;
}

const SCRATCH_ORG_JOB_TYPES = new Set([
  'scratch_org_workflow',
  'scratch_org_create',
  'pipeline_metadata_deploy',
  'load_org_config',
  'assign_permission_set',
  'cona_user_provision',
  'cona_seed',
  'account_partner_import',
]);

export function getJobWorkspaceHref(job: JobWorkspaceLinkInput): string | null {
  const runId = job.automationRunId;
  if (!runId) return null;

  if (
    job.runIntent === 'scratch_org_pipeline' ||
    SCRATCH_ORG_JOB_TYPES.has(job.type)
  ) {
    return `/environment-center/create-scratch-org?runId=${encodeURIComponent(runId)}`;
  }

  return null;
}
