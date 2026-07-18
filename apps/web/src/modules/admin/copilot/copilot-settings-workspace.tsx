'use client';

import { Bot, Ear, MessageSquareText, Mic, TimerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, InlineAlert, PageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';
import { useCopilotAdminSettings } from './use-copilot-admin-settings';

const VOICE_BEHAVIOURS = [
  {
    icon: Mic,
    title: 'Push-to-talk mic in the copilot',
    description:
      'Users with copilot access get a mic button in the chat panel. One tap starts listening; speech is transcribed by the browser and sent as a normal chat message.',
  },
  {
    icon: TimerOff,
    title: 'Stops on its own when nobody talks',
    description:
      'If nothing is said for about 3 seconds, listening switches off automatically. The mic never keeps running in the background.',
  },
  {
    icon: Ear,
    title: '“Hey Copilot” / “Hey Assistant” greeting',
    description:
      'Saying the wake phrase makes the copilot greet the user by their profile name and wait for a question.',
  },
  {
    icon: MessageSquareText,
    title: 'Answers are read aloud',
    description:
      'While voice mode is on, copilot answers are spoken with the browser voice as well as shown in the chat.',
  },
] as const;

export function CopilotSettingsWorkspace() {
  const {
    profile,
    settings,
    loading,
    saving,
    error,
    notice,
    setVoiceEnabled,
    setError,
    setNotice,
    refresh,
  } = useCopilotAdminSettings();

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const enabled = settings?.voiceEnabled ?? false;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="AI Copilot"
        subtitle="You decide whether the copilot can listen and speak. Voice stays off for everyone until you enable it."
        showBreadcrumbs={false}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            loading={loading}
            disabled={saving}
          >
            Refresh
          </Button>
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

      {loading && !settings ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : settings ? (
        <>
          <GlassCard
            className={cn(
              'border-2 transition-colors',
              enabled ? 'border-emerald-500/30' : 'border-amber-500/40',
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
                  )}
                >
                  <Bot className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    {enabled ? 'Voice assistant is ON' : 'Voice assistant is OFF'}
                  </p>
                  <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                    This switch controls the copilot voiceover for the whole workspace. While it
                    is off, no user sees the mic button and nothing is listened to or spoken —
                    the copilot stays text-only.
                  </p>
                  {!enabled && (
                    <p className="mt-2 text-xs font-medium text-amber-300">
                      Turn this on to activate voice for users with copilot access.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:pt-0.5">
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wide',
                    enabled ? 'text-emerald-400' : 'text-amber-300',
                  )}
                >
                  {saving ? 'Saving…' : enabled ? 'On' : 'Off'}
                </span>
                <Switch
                  size="lg"
                  checked={enabled}
                  disabled={saving}
                  onChange={(next) => void setVoiceEnabled(next)}
                  aria-label={enabled ? 'Turn the voice assistant off' : 'Turn the voice assistant on'}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard
            title="What users get when voice is on"
            description="Speech recognition and speech playback run in the user's own browser (Web Speech API) — audio is never stored on the server. Transcribed questions travel the same path as typed ones."
          >
            <div className="space-y-2">
              {VOICE_BEHAVIOURS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-lg border border-border/60 px-4 py-3"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-purple-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Voice input requires a browser with speech recognition (Chrome, Edge, or Safari) and
              microphone permission granted by the user. Browsers without support simply never
              show the mic button.
            </p>
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}
