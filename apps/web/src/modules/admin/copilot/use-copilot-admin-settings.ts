'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import type { CopilotSettings } from '@sfcc/shared';

export function useCopilotAdminSettings() {
  const { profile } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<CopilotSettings | null>(null);
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
      const data = await api<CopilotSettings>('/copilot/settings');
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load copilot settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') void load();
  }, [profile, load]);

  /** Single switch — saved immediately, rolled back if the server rejects it. */
  const setVoiceEnabled = async (voiceEnabled: boolean) => {
    if (!settings || saving) return;
    const previous = settings;
    setSaving(true);
    setError(null);
    setNotice(null);
    setSettings({ ...settings, voiceEnabled });
    try {
      const saved = await api<CopilotSettings>('/copilot/settings', {
        method: 'PATCH',
        body: JSON.stringify({ voiceEnabled }),
      });
      setSettings(saved);
      setNotice(
        voiceEnabled
          ? 'Voice assistant enabled — copilot users now get a mic button.'
          : 'Voice assistant disabled — the mic button is hidden for everyone.',
      );
    } catch (err) {
      setSettings(previous);
      setError(err instanceof Error ? err.message : 'Failed to save copilot settings');
    } finally {
      setSaving(false);
    }
  };

  return {
    profile,
    settings,
    loading,
    saving,
    error,
    notice,
    setVoiceEnabled,
    setError,
    setNotice,
    refresh: load,
  };
}
