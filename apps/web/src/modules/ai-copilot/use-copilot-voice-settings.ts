'use client';

import { useEffect, useState } from 'react';
import type { CopilotSettings } from '@sfcc/shared';
import { api } from '@/services/api';

/**
 * Whether an administrator has switched the copilot voice assistant on.
 * Re-checked every time the panel opens so an admin toggle takes effect
 * without a full reload. Defaults to off — the mic never shows unless the
 * server explicitly allows it.
 */
export function useCopilotVoiceSettings(active: boolean): { voiceEnabled: boolean } {
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    api<CopilotSettings>('/copilot/settings')
      .then((settings) => {
        if (!cancelled) setVoiceEnabled(settings.voiceEnabled === true);
      })
      .catch(() => {
        /* keep voice hidden when settings cannot be loaded */
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { voiceEnabled };
}
