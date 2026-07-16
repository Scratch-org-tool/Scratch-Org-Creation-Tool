'use client';

import { BellRing, Send } from 'lucide-react';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_DESCRIPTIONS,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_DESCRIPTIONS,
  NOTIFICATION_CHANNEL_LABELS,
} from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, InlineAlert, PageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';
import { useNotificationSettings } from './use-notification-settings';

interface ToggleRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ id, title, description, checked, disabled, locked, onChange }: ToggleRowProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3 transition-opacity',
        disabled && 'opacity-55',
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        {locked && (
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
            Always on
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled || locked}
        onChange={onChange}
        aria-label={title}
      />
    </div>
  );
}

export function NotificationSettingsWorkspace() {
  const {
    profile,
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
    refresh,
  } = useNotificationSettings();

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const enabled = draft?.enabled ?? false;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Notifications"
        subtitle="You decide whether the platform sends notifications, through which channels, and for which activity."
        showBreadcrumbs={false}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} loading={loading} disabled={saving}>
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void sendTest()}
              loading={testing}
              disabled={loading || saving || dirty}
              title={dirty ? 'Save your changes before sending a test' : undefined}
            >
              <Send className="mr-1.5 size-4" />
              Send test
            </Button>
          </>
        }
      />

      {error && (
        <InlineAlert variant="error" onDismiss={() => setError(null)}>
          {error}
        </InlineAlert>
      )}
      {notice && (
        <InlineAlert variant="success" onDismiss={() => setNotice(null)}>
          {notice}
        </InlineAlert>
      )}

      {loading && !draft ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : draft ? (
        <>
          <GlassCard
            className={cn(
              'border-2 transition-colors',
              enabled ? 'border-emerald-500/30' : 'border-amber-500/25',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
                  )}
                >
                  <BellRing className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    {enabled ? 'Notifications are ON' : 'Notifications are OFF'}
                  </p>
                  <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                    This master switch controls everything. While it is off, the platform creates
                    and sends nothing — no in-app alerts, no email — regardless of the settings
                    below.
                  </p>
                </div>
              </div>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                aria-label="Enable notifications"
                className="mt-1"
              />
            </div>
          </GlassCard>

          <GlassCard
            title="Delivery channels"
            description="Where enabled notifications are delivered. The in-app inbox is always available."
          >
            <div className={cn('space-y-2', !enabled && 'pointer-events-none opacity-60')}>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <ToggleRow
                  key={channel}
                  id={`channel-${channel}`}
                  title={NOTIFICATION_CHANNEL_LABELS[channel]}
                  description={NOTIFICATION_CHANNEL_DESCRIPTIONS[channel]}
                  checked={draft.channels[channel]}
                  disabled={!enabled}
                  locked={channel === 'inApp'}
                  onChange={() => toggleChannel(channel)}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard
            title="Activity categories"
            description="Choose exactly which kinds of activity generate notifications."
          >
            <div className={cn('space-y-2', !enabled && 'pointer-events-none opacity-60')}>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <ToggleRow
                  key={category}
                  id={`category-${category}`}
                  title={NOTIFICATION_CATEGORY_LABELS[category]}
                  description={NOTIFICATION_CATEGORY_DESCRIPTIONS[category]}
                  checked={draft.categories[category]}
                  disabled={!enabled}
                  onChange={() => toggleCategory(category)}
                />
              ))}
            </div>
          </GlassCard>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border/60 bg-background/80 py-3 backdrop-blur">
            <Button variant="ghost" size="sm" onClick={reset} disabled={!dirty || saving}>
              Discard changes
            </Button>
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
