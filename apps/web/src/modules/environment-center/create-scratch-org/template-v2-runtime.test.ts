import { describe, expect, it } from 'vitest';
import type { ScratchPipelineTemplateConfig } from '@sfcc/shared';
import { buildTemplateV2Preview } from './template-v2-runtime';

describe('Template V2 provisioning preview severity', () => {
  it('keeps disabled-discovery information visible without blocking launch', () => {
    const preview = buildTemplateV2Preview(
      { version: 2 } as ScratchPipelineTemplateConfig,
      {
        users: [],
        errors: [],
        warnings: ['Target metadata discovery is disabled'],
        metadata: null,
      },
    );

    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual(['Target metadata discovery is disabled']);
  });

  it('continues to expose provisioning errors as launch blockers', () => {
    const preview = buildTemplateV2Preview(
      { version: 2 } as ScratchPipelineTemplateConfig,
      {
        users: [],
        errors: ['Unknown profile'],
        warnings: ['Metadata was incomplete'],
        metadata: null,
      },
    );

    expect(preview.errors).toEqual(['Unknown profile']);
    expect(preview.warnings).toEqual(['Metadata was incomplete']);
  });
});
