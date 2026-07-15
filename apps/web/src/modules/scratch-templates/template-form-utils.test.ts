import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE_CONFIG } from './types';
import {
  hasValidCustomJson,
  provisioningPreviewIsValid,
  setCustomSettingsEnabled,
} from './template-form-utils';

describe('Template V2 custom settings state', () => {
  it('blocks custom mode without valid JSON', () => {
    const config = {
      ...DEFAULT_TEMPLATE_CONFIG,
      customSettings: { enabled: true, mode: 'custom' as const },
    };
    expect(hasValidCustomJson(config, '')).toBe(false);
    expect(hasValidCustomJson(config, '{')).toBe(false);
    expect(hasValidCustomJson(config, '{"objects":[]}')).toBe(true);
  });

  it('switches disabled custom settings to a schema-valid bundled state', () => {
    const config = {
      ...DEFAULT_TEMPLATE_CONFIG,
      customSettings: { enabled: true, mode: 'custom' as const },
    };
    expect(setCustomSettingsEnabled(config, false).customSettings).toMatchObject({
      enabled: false,
      mode: 'bundled',
    });
  });

  it('allows provisioning warnings while blocking actual errors', () => {
    expect(provisioningPreviewIsValid({
      errors: [],
      warnings: ['Target metadata discovery is disabled'],
    })).toBe(true);
    expect(provisioningPreviewIsValid({
      errors: ['Unknown profile'],
      warnings: [],
    })).toBe(false);
  });
});
