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

  it('requires a source org for automatic query deployment', () => {
    const preview = buildTemplateV2Preview({
      version: 2,
      template: 'config/project-scratch-def.json',
      duration: 7,
      installPackage: true,
      customSettings: { enabled: false, mode: 'bundled' },
      dataSeed: { datasets: [], mode: 'query_section' },
      pipelineSteps: {
        autoRunDataSeed: true,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    } as ScratchPipelineTemplateConfig);

    expect(preview.errors).toContain(
      'Select a Data Deployment Org for the automatic data deployment.',
    );
  });

  it('allows the scratch and source-only preset without a data source org', () => {
    const preview = buildTemplateV2Preview({
      version: 2,
      template: 'config/project-scratch-def.json',
      duration: 7,
      installPackage: true,
      customSettings: { enabled: false, mode: 'bundled' },
      pipelineSteps: {
        autoRunDataSeed: false,
        autoRunPartners: false,
        autoRunUsers: false,
      },
    } as ScratchPipelineTemplateConfig);

    expect(preview.errors).toEqual([]);
  });
});
