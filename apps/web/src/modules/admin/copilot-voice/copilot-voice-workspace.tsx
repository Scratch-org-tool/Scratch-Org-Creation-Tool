'use client';

import { Mic } from 'lucide-react';
import { renderVoiceGreeting } from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard, InlineAlert, PageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';
import { useCopilotVoiceSettings } from './use-copilot-voice-settings';

interface ToggleRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ id, title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

const SILENCE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1500, label: '1.5 seconds' },
  { value: 2000, label: '2 seconds' },
  { value: 2500, label: '2.5 seconds' },
  { value: 3000, label: '3 seconds' },
  { value: 4000, label: '4 seconds' },
  { value: 5000, label: '5 seconds' },
];

const RATE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.75, label: 'Slow (0.75×)' },
  { value: 0.9, label: 'Relaxed (0.9×)' },
  { value: 1, label: 'Normal (1×)' },
  { value: 1.15, label: 'Brisk (1.15×)' },
  { value: 1.3, label: 'Fast (1.3×)' },
];

export function CopilotVoiceWorkspace() {
  const {
    profile,
    draft,
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
    refresh,
  } = useCopilotVoiceSettings();

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  const enabled = draft?.enabled ?? false;
  const greetingPreview = draft
    ? renderVoiceGreeting(draft.greetingTemplate, profile.displayName)
    : '';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Copilot Voice"
        subtitle="You decide whether the AI Copilot can listen and speak. Voice stays off for everyone until you enable it here."
        showBreadcrumbs={false}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} loading={loading} disabled={saving}>
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

      {loading && !draft ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : draft ? (
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
                  <Mic className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    {enabled ? 'Voice is ON' : 'Voice is OFF'}
                  </p>
                  <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                    This master switch controls everything. While it is off, the Copilot mic never
                    appears and nothing is spoken — regardless of the settings below.
                  </p>
                  {!enabled && (
                    <p className="mt-2 text-xs font-medium text-amber-300">
                      Configure the options below, turn this on, then click “Save changes”.
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
                  {enabled ? 'On' : 'Off'}
                </span>
                <Switch
                  size="lg"
                  checked={enabled}
                  onChange={(value) => update({ enabled: value })}
                  aria-label={enabled ? 'Turn Copilot voice off' : 'Turn Copilot voice on'}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard
            title="Listening & speaking"
            description="How the Copilot behaves once a user taps the mic."
          >
            <div className="space-y-2">
              <ToggleRow
                id="voice-speak-responses"
                title="Speak replies aloud"
                description="Read the Copilot's answers out loud after they finish."
                checked={draft.speakResponses}
                onChange={(value) => update({ speakResponses: value })}
              />
              <ToggleRow
                id="voice-auto-listen"
                title="Auto-start listening"
                description="Begin listening as soon as the Copilot panel is opened."
                checked={draft.autoListen}
                onChange={(value) => update({ autoListen: value })}
              />
              <div className="grid gap-4 rounded-lg border border-border/60 px-4 py-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="voice-silence">Stop listening after silence</Label>
                  <Select
                    id="voice-silence"
                    value={String(draft.listenSilenceMs)}
                    onChange={(e) => update({ listenSilenceMs: Number(e.target.value) })}
                    aria-label="Stop listening after silence"
                  >
                    {SILENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Background listening ends automatically after this much quiet.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="voice-rate">Speaking speed</Label>
                  <Select
                    id="voice-rate"
                    value={String(draft.speechRate)}
                    onChange={(e) => update({ speechRate: Number(e.target.value) })}
                    aria-label="Speaking speed"
                  >
                    {RATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Playback rate for spoken replies and greetings.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard
            title="Wake word & greeting"
            description="What users say to wake the Copilot, and how it greets them by name."
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="voice-wake-words">Wake phrases</Label>
                <Input
                  id="voice-wake-words"
                  value={wakeWordsText}
                  onChange={(e) => {
                    setNotice(null);
                    setWakeWordsText(e.target.value);
                  }}
                  placeholder="hey copilot, hey assistant"
                  aria-label="Wake phrases"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. Saying one of these greets the user, e.g. “hey copilot”.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="voice-greeting">Greeting</Label>
                <Textarea
                  id="voice-greeting"
                  value={draft.greetingTemplate}
                  onChange={(e) => update({ greetingTemplate: e.target.value })}
                  placeholder="Hi {name}, how can I help you today?"
                  className="min-h-[60px]"
                  aria-label="Greeting"
                />
                <p className="text-xs text-muted-foreground">
                  Use <code className="rounded bg-muted px-1">{'{name}'}</code> for the user&apos;s name.
                  Preview: <span className="text-foreground">“{greetingPreview}”</span>
                </p>
              </div>
              <div className="space-y-1.5 sm:max-w-xs">
                <Label htmlFor="voice-lang">Language</Label>
                <Input
                  id="voice-lang"
                  value={draft.voiceLang}
                  onChange={(e) => update({ voiceLang: e.target.value })}
                  placeholder="en-US"
                  aria-label="Language"
                />
                <p className="text-xs text-muted-foreground">
                  BCP-47 code used for recognition and speech, e.g. “en-US”, “en-GB”.
                </p>
              </div>
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
