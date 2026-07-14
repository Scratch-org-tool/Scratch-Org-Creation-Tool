import type { ScratchPipelineTemplateConfig } from './sfdmu-export.js';

type OrgIdConfig = Pick<ScratchPipelineTemplateConfig, 'dataDeploymentOrgId' | 'customSettingsOrgId' | 'sourceOrgId'>;

/** Normalize legacy single sourceOrgId into dual org fields. */
export function migrateTemplateConfig(
  config: ScratchPipelineTemplateConfig,
): ScratchPipelineTemplateConfig {
  const legacy = config.sourceOrgId;
  const dataDeploymentOrgId = config.dataDeploymentOrgId ?? legacy;
  const customSettingsOrgId = config.customSettingsOrgId ?? legacy;

  const migrated: ScratchPipelineTemplateConfig = {
    ...config,
    dataDeploymentOrgId,
    customSettingsOrgId,
  };

  if (migrated.partnerImport && migrated.partnerImport.perOffice == null) {
    migrated.partnerImport = {
      ...migrated.partnerImport,
      perOffice: 20,
    };
  }

  if (migrated.dataSeed && !migrated.dataSeed.mode) {
    migrated.dataSeed = { ...migrated.dataSeed, mode: 'hybrid' };
  }

  return migrated;
}

export function getDataDeploymentOrgId(config: OrgIdConfig): string | undefined {
  return config.dataDeploymentOrgId ?? config.sourceOrgId;
}

export function getCustomSettingsOrgId(config: OrgIdConfig): string | undefined {
  return config.customSettingsOrgId ?? config.sourceOrgId;
}
