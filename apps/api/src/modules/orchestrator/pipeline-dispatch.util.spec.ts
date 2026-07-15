import { describe, expect, it } from 'vitest';
import { resolvePipelineSuccessAction } from './pipeline-dispatch.util';

describe('resolvePipelineSuccessAction', () => {
  it('keeps combined org-to-org metadata success out of scratch stages', () => {
    expect(resolvePipelineSuccessAction(
      'org_to_org_metadata_data',
      'pipeline_metadata_deploy',
    )).toBe('combined_metadata');
  });

  it('continues the scratch pipeline for scratch metadata success', () => {
    expect(resolvePipelineSuccessAction(
      'scratch_org_pipeline',
      'pipeline_metadata_deploy',
    )).toBe('scratch_pipeline');
  });
});
