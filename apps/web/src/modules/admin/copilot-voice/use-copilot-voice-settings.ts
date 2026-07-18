'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_COPILOT_VOICE_SETTINGS,
  normalizeCopilotVoiceSettings,
  normalizeWakeWords,
  type CopilotVoiceSettings,
} from '@sfcc/shared';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';

type EditableVoiceSettings = Pick<
  CopilotVoiceSettings,
  | 'enabled'
  | 'speakResponses'
  | 'autoListen'
  | 'wakeWords'
  | 'greetingTemplate'
  | 'listenSilenceMs'
  | 'speechRate'
  | 'voiceLang'
>;

function toEditable(settings: CopilotVoiceSettings): EditableVoiceSettings {
  return {
    enabled: settings.enabled,
    speakResponses: settings.speakResponses,
    autoListen: settings.autoListen,
    wakeWords: settings.wakeWords,
    greetingTemplate: settings.greetingTemplate,
    listenSilenceMs: settings.listenSilenceMs,
    speechRate: settings.speechRate,
    voiceLang: settings.voiceLang,
  };
}

function isSameSettings(a: EditableVoiceSettings, b: EditableVoiceSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useCopilotVoiceSettings() {
  const { profile } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<CopilotVoiceSettings | null>(null);
  const [draft, setDraft] = useState<CopilotVoiceSettings | null>(null);
  const [wakeWordsText, setWakeWordsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = normalizeCopilotVoiceSettings(
        await api<CopilotVoiceSettings>('/copilot/voice-settings'),
      );
      setSettings(data);
      setDraft(data);
      setWakeWordsText(data.wakeWords.join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Copilot voice settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') void load();
  }, [profile, load]);

  const parsedWakeWords = useMemo(
    () => normalizeWakeWords(wakeWordsText.split(/[,\n]/)),
    [wakeWordsText],
  );

  const effectiveDraft = useMemo<CopilotVoiceSettings | null>(
    () => (draft ? { ...draft, wakeWords: parsedWakeWords } : null),
    [draft, parsedWakeWords],
  );

  const dirty =
    effectiveDraft && settings
      ? !isSameSettings(toEditable(effectiveDraft), toEditable(settings))
      : false;

  const update = useCallback((patch: Partial<CopilotVoiceSettings>) => {
    setNotice(null);
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const save = useCallback(async () => {
    if (!effectiveDraft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = normalizeCopilotVoiceSettings(
        await api<CopilotVoiceSettings>('/copilot/voice-settings', {
          method: 'PATCH',
          body: JSON.stringify(toEditable(effectiveDraft)),
        }),
      );
      setSettings(saved);
      setDraft(saved);
      setWakeWordsText(saved.wakeWords.join(', '));
      setNotice('Copilot voice settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Copilot voice settings');
    } finally {
      setSaving(false);
    }
  }, [effectiveDraft]);

  const reset = useCallback(() => {
    setNotice(null);
    setError(null);
    setDraft(settings);
    setWakeWordsText((settings ?? DEFAULT_COPILOT_VOICE_SETTINGS).wakeWords.join(', '));
  }, [settings]);

  return {
    profile,
    draft: effectiveDraft,
    wakeWordsText,
    setWakeWordsText,
    loading,
    saving,
    error,
    notice,
    dirty,
    update,
    save,
    reset,
    setError,
    setNotice,
    refresh: load,
  };
}
