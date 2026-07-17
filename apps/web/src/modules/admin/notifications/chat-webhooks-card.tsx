'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquareShare, Plus, Send, Trash2 } from 'lucide-react';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_WEBHOOK_TYPES,
  NOTIFICATION_WEBHOOK_TYPE_LABELS,
  type NotificationCategory,
  type NotificationWebhookRecord,
  type NotificationWebhookType,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog, GlassCard, InlineAlert, StatusBadge } from '@/components/studio';
import { api } from '@/services/api';

interface FormState {
  type: NotificationWebhookType;
  name: string;
  url: string;
  categories: NotificationCategory[];
}

const EMPTY_FORM: FormState = { type: 'slack', name: '', url: '', categories: [] };

type WebhookAction = 'toggle' | 'test' | 'delete';

export function ChatWebhooksCard() {
  const [webhooks, setWebhooks] = useState<NotificationWebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: WebhookAction } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NotificationWebhookRecord | null>(null);

  const isBusy = (id: string, action?: WebhookAction) =>
    busy !== null && busy.id === id && (action === undefined || busy.action === action);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWebhooks(await api<NotificationWebhookRecord[]>('/notifications/webhooks'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api<NotificationWebhookRecord>('/notifications/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          name: form.name,
          url: form.url,
          categories: form.categories.length > 0 ? form.categories : undefined,
        }),
      });
      setWebhooks((current) => [created, ...current]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice(`Webhook "${created.name}" added. Send a test to verify delivery.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add webhook');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (webhook: NotificationWebhookRecord) => {
    setBusy({ id: webhook.id, action: 'toggle' });
    try {
      const updated = await api<NotificationWebhookRecord>(
        `/notifications/webhooks/${webhook.id}`,
        { method: 'PATCH', body: JSON.stringify({ enabled: !webhook.enabled }) },
      );
      setWebhooks((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (webhook: NotificationWebhookRecord) => {
    setBusy({ id: webhook.id, action: 'test' });
    setNotice(null);
    setError(null);
    try {
      const result = await api<{ delivered: boolean; error?: string }>(
        `/notifications/webhooks/${webhook.id}/test`,
        { method: 'POST' },
      );
      if (result.delivered) {
        setNotice(`Test message delivered to "${webhook.name}".`);
      } else {
        setError(`Delivery to "${webhook.name}" failed${result.error ? `: ${result.error}` : '.'}`);
      }
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (webhook: NotificationWebhookRecord) => {
    setBusy({ id: webhook.id, action: 'delete' });
    try {
      await api(`/notifications/webhooks/${webhook.id}`, { method: 'DELETE' });
      setWebhooks((current) => current.filter((row) => row.id !== webhook.id));
      setConfirmDelete(null);
    } catch (err) {
      setConfirmDelete(null);
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally {
      setBusy(null);
    }
  };

  const toggleFormCategory = (category: NotificationCategory) => {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  return (
    <GlassCard
      title={(
        <span className="flex items-center gap-2 text-base font-semibold">
          <MessageSquareShare className="size-4 text-primary" aria-hidden />
          Slack &amp; Microsoft Teams
        </span>
      )}
      description="Post enabled notifications into chat channels via incoming webhooks. Delivery follows the master switch and category toggles above."
      headerAction={(
        <Button size="sm" variant="outline" onClick={() => setShowForm((current) => !current)}>
          <Plus aria-hidden />
          Add webhook
        </Button>
      )}
    >
      {error && (
        <div className="mb-3">
          <InlineAlert variant="error" onDismiss={() => setError(null)}>{error}</InlineAlert>
        </div>
      )}
      {notice && (
        <div className="mb-3">
          <InlineAlert variant="success" onDismiss={() => setNotice(null)}>{notice}</InlineAlert>
        </div>
      )}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="webhook-type">Type</Label>
              <Select
                id="webhook-type"
                value={form.type}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  type: event.target.value as NotificationWebhookType,
                }))}
              >
                {NOTIFICATION_WEBHOOK_TYPES.map((type) => (
                  <option key={type} value={type}>{NOTIFICATION_WEBHOOK_TYPE_LABELS[type]}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                value={form.name}
                maxLength={80}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. #deployments"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={form.url}
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              placeholder={form.type === 'slack'
                ? 'https://hooks.slack.com/services/…'
                : 'https://…webhook.office.com/webhookb2/…'}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The URL is encrypted at rest and never shown again after saving.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Categories</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Leave all unchecked to receive every category.
            </p>
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleFormCategory(category)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    form.categories.includes(category)
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border/60 text-muted-foreground hover:border-primary/30'
                  }`}
                  aria-pressed={form.categories.includes(category)}
                >
                  {NOTIFICATION_CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void create()}
              loading={saving}
              disabled={!form.name.trim() || !form.url.trim()}
            >
              Add webhook
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy role="status" aria-label="Loading webhooks">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : webhooks.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No chat webhooks yet. Add one to post alerts into Slack or Teams.
        </p>
      ) : (
        <ul className="space-y-2">
          {webhooks.map((webhook) => (
            <li
              key={webhook.id}
              className="flex flex-col gap-2 rounded-lg border border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{webhook.name}</span>
                  <StatusBadge
                    status={webhook.enabled ? 'active' : 'pending'}
                    label={NOTIFICATION_WEBHOOK_TYPE_LABELS[webhook.type]}
                  />
                  {webhook.lastError && (
                    <span className="text-xs text-destructive" title={webhook.lastError}>
                      last delivery failed
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {webhook.urlPreview}
                  {' · '}
                  {webhook.categories.length === 0
                    ? 'all categories'
                    : webhook.categories.map((c) => NOTIFICATION_CATEGORY_LABELS[c]).join(', ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={webhook.enabled}
                  onChange={() => void toggleEnabled(webhook)}
                  disabled={isBusy(webhook.id)}
                  aria-label={`Toggle ${webhook.name}`}
                  size="sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void sendTest(webhook)}
                  loading={isBusy(webhook.id, 'test')}
                  disabled={isBusy(webhook.id)}
                >
                  {!isBusy(webhook.id, 'test') && <Send aria-hidden />}
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(webhook)}
                  loading={isBusy(webhook.id, 'delete')}
                  disabled={isBusy(webhook.id)}
                  aria-label={`Delete ${webhook.name}`}
                >
                  {!isBusy(webhook.id, 'delete') && <Trash2 aria-hidden />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete chat webhook?"
        message={`"${confirmDelete?.name ?? ''}" will stop receiving notifications. The webhook URL cannot be recovered after deletion.`}
        confirmLabel="Delete webhook"
        loading={confirmDelete ? isBusy(confirmDelete.id, 'delete') : false}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        onConfirm={() => {
          if (confirmDelete) void remove(confirmDelete);
        }}
      />
    </GlassCard>
  );
}
