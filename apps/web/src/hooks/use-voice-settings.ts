'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_COPILOT_VOICE_SETTINGS,
  normalizeCopilotVoiceSettings,
  type CopilotVoiceSettings,
} from '@sfcc/shared';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule } from '@/lib/auth-utils';

interface VoiceSettingsState {
  settings: CopilotVoiceSettings;
  enabled: boolean;
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
}

/**
 * Read-only view of the global Copilot voice settings for the chat panel.
 * Only fetches for users who can access the Copilot module; until the admin
 * enables voice, `enabled` stays false and no mic UI is shown.
 */
export function useVoiceSettings(): VoiceSettingsState {
  const { profile } = useAuth();
  const canUseCopilot = canAccessModule(profile, 'copilot');
  const [settings, setSettings] = useState<CopilotVoiceSettings>(DEFAULT_COPILOT_VOICE_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!canUseCopilot) return;
    setLoading(true);
    try {
      const data = await api<CopilotVoiceSettings>('/copilot/voice-settings');
      setSettings(normalizeCopilotVoiceSettings(data));
      setLoaded(true);
    } catch {
      // Voice is a progressive enhancement — a failure just leaves it off.
      setSettings(DEFAULT_COPILOT_VOICE_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [canUseCopilot]);

  useEffect(() => {
    if (canUseCopilot) void refresh();
  }, [canUseCopilot, refresh]);

  return {
    settings,
    enabled: canUseCopilot && settings.enabled,
    loading,
    loaded,
    refresh,
  };
}
