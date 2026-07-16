'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationSettings,
} from '@sfcc/shared';

function isSameSettings(a: NotificationSettings, b: NotificationSettings): boolean {
  return (
    a.enabled === b.enabled &&
    JSON.stringify(a.channels) === JSON.stringify(b.channels) &&
    JSON.stringify(a.categories) === JSON.stringify(b.categories)
  );
}

export function useNotificationSettings() {
  const { profile } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
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
      const data = await api<NotificationSettings>('/notifications/settings');
      setSettings(data);
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') void load();
  }, [profile, load]);

  const dirty = draft && settings ? !isSameSettings(draft, settings) : false;

  const setEnabled = (enabled: boolean) => {
    setNotice(null);
    setDraft((current) => (current ? { ...current, enabled } : current));
  };

  const toggleChannel = (channel: NotificationChannel) => {
    setNotice(null);
    setDraft((current) =>
      current
        ? { ...current, channels: { ...current.channels, [channel]: !current.channels[channel] } }
        : current,
    );
  };

  const toggleCategory = (category: NotificationCategory) => {
    setNotice(null);
    setDraft((current) =>
      current
        ? {
            ...current,
            categories: { ...current.categories, [category]: !current.categories[category] },
          }
        : current,
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api<NotificationSettings>('/notifications/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: draft.enabled,
          channels: draft.channels,
          categories: draft.categories,
        }),
      });
      setSettings(saved);
      setDraft(saved);
      setNotice('Notification settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setNotice(null);
    setError(null);
    setDraft(settings);
  };

  const sendTest = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ delivered: boolean }>('/notifications/settings/test', {
        method: 'POST',
      });
      setNotice(
        result.delivered
          ? 'Test notification sent — open the bell to see it.'
          : 'Test was suppressed. Enable notifications and the "System & account" category, then save before testing.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send a test notification');
    } finally {
      setTesting(false);
    }
  };

  return {
    profile,
    settings,
    draft,
    loading,
    saving,
    testing,
    error,
    notice,
    dirty,
    setEnabled,
    toggleChannel,
    toggleCategory,
    save,
    reset,
    sendTest,
    setError,
    setNotice,
    refresh: load,
  };
}
