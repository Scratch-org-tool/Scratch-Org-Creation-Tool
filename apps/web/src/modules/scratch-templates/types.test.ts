import { describe, expect, it } from 'vitest';
import { SYSTEM_SCRATCH_TEMPLATE_KEYS } from '@sfcc/shared';
import { getTemplateWizardSteps } from './types';

describe('template editor step scope', () => {
  it('shows only scratch and source deployment settings for the foundation preset', () => {
    expect(
      getTemplateWizardSteps(
        SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT,
      ).map((step) => step.id),
    ).toEqual(['general', 'scratch', 'permissions', 'review']);
  });

  it('shows master SFDMU settings for the master preset', () => {
    expect(
      getTemplateWizardSteps(
        SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE,
      ).map((step) => step.id),
    ).toEqual(['general', 'source-orgs', 'custom-settings', 'permissions', 'review']);
    expect(
      getTemplateWizardSteps(SYSTEM_SCRATCH_TEMPLATE_KEYS.MASTER_TEMPLATE)
        .find((step) => step.id === 'custom-settings')?.label,
    ).toBe('Master SFDMU export');
  });

  it('keeps the complete editor for private templates', () => {
    expect(getTemplateWizardSteps()).toHaveLength(9);
  });
});
