import type { TemplateConfigState } from './types';

export function hasValidCustomJson(config: TemplateConfigState, customJson: string): boolean {
  if (config.customSettings?.enabled === false || config.customSettings?.mode !== 'custom') {
    return true;
  }
  if (!customJson.trim()) return false;
  try {
    JSON.parse(customJson);
    return true;
  } catch {
    return false;
  }
}

export function setCustomSettingsEnabled(
  config: TemplateConfigState,
  enabled: boolean,
): TemplateConfigState {
  return {
    ...config,
    customSettings: {
      ...config.customSettings,
      enabled,
      mode: enabled ? (config.customSettings?.mode ?? 'bundled') : 'bundled',
    },
  };
}
