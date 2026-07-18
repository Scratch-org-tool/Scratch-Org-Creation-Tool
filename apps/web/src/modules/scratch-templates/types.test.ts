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

  it('shows only source and query settings for the data deployment preset', () => {
    expect(
      getTemplateWizardSteps(
        SYSTEM_SCRATCH_TEMPLATE_KEYS.DATA_DEPLOYMENT_QUERIES,
      ).map((step) => step.id),
    ).toEqual(['general', 'source-orgs', 'data-seed', 'query-section', 'review']);
  });

  it('combines configuration seed and Account Partner settings in one preset', () => {
    const steps = getTemplateWizardSteps(
      SYSTEM_SCRATCH_TEMPLATE_KEYS.CONFIG_SEED_ACCOUNT_PARTNERS,
    );
    expect(steps.map((step) => step.id)).toEqual([
      'general',
      'source-orgs',
      'custom-settings',
      'permissions',
      'data-seed',
      'partners-users',
      'review',
    ]);
    expect(steps.find((step) => step.id === 'partners-users')?.label).toBe(
      'Account partners',
    );
  });

  it('keeps the complete editor for private templates', () => {
    expect(getTemplateWizardSteps()).toHaveLength(9);
  });
});

