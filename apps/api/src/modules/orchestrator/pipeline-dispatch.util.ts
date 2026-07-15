export type PipelineSuccessAction = 'combined_metadata' | 'scratch_pipeline';

export function resolvePipelineSuccessAction(
  intent: string,
  jobType: string,
): PipelineSuccessAction {
  if (intent === 'org_to_org_metadata_data' && jobType === 'pipeline_metadata_deploy') {
    return 'combined_metadata';
  }
  return 'scratch_pipeline';
}
