import { describe, expect, it } from 'vitest';
import {
  composePipelineConfig,
  DEFAULT_CREATE_PIPELINE_SCOPE,
  pipelineScopeRequiresDataSource,
  pipelineScopeRequiresGitSource,
  resolvePipelineScope,
} from './scratch-pipeline-compose.js';

const foundation = {
  version: 2 as const,
  installPackage: true,
  customSettings: { enabled: false, mode: 'bundled' as const },
  pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
};

const master = {
  version: 2 as const,
  customSettings: { enabled: true, mode: 'master' as const },
  orgConfig: {
    upsertQueueIds: true,
    upsertDomainFields: true,
    upsertRequestId: true,
  },
  pipelineSteps: { autoRunDataSeed: false, autoRunPartners: false, autoRunUsers: false },
};

describe('composePipelineConfig', () => {
  it('merges foundation and master when both scopes are enabled', () => {
    const composed = composePipelineConfig({
      foundation,
      master,
      scope: DEFAULT_CREATE_PIPELINE_SCOPE,
    });
    expect(composed.customSettings).toEqual({ enabled: true, mode: 'master' });
    expect(composed.orgConfig?.upsertQueueIds).toBe(true);
    expect(composed.skipSteps).toBeUndefined();
  });

  it('disables data phases for source-only scope', () => {
    const composed = composePipelineConfig({
      foundation,
      master,
      scope: { sourceDeployment: true, dataDeployment: false },
    });
    expect(composed.customSettings?.enabled).toBe(false);
    expect(composed.dataSeed).toBeUndefined();
  });

  it('skips metadata deploy steps for data-only scope', () => {
    const composed = composePipelineConfig({
      foundation,
      master,
      scope: { sourceDeployment: false, dataDeployment: true },
    });
    expect(composed.skipSteps).toEqual(['deployMetadata', 'assignPermissions']);
    expect(composed.customSettings?.mode).toBe('master');
  });

  it('resolves configure-existing defaults', () => {
    expect(resolvePipelineScope(undefined, 'configure_existing')).toEqual({
      sourceDeployment: true,
      dataDeployment: false,
    });
  });

  it('reports git and data requirements from scope', () => {
    expect(pipelineScopeRequiresGitSource({ sourceDeployment: false, dataDeployment: true }))
      .toBe(false);
    expect(pipelineScopeRequiresDataSource({ sourceDeployment: true, dataDeployment: false }))
      .toBe(false);
  });
});
