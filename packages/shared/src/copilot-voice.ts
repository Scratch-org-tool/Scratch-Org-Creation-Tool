import { z } from 'zod';

/**
 * Admin-controlled AI Copilot settings. Voice interaction (microphone input +
 * spoken answers) is OFF by default: an administrator must explicitly enable
 * it before the mic ever appears for users.
 */
export interface CopilotSettings {
  /** Master switch for the copilot voice assistant (mic + spoken replies). */
  voiceEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
}

export const DEFAULT_COPILOT_SETTINGS: CopilotSettings = {
  voiceEnabled: false,
};

function coerceBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Merge a partial / untrusted settings object (e.g. DB row, request body) onto
 * the defaults so downstream code always sees a complete settings shape.
 */
export function normalizeCopilotSettings(raw: unknown): CopilotSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const normalized: CopilotSettings = {
    voiceEnabled: coerceBool(source.voiceEnabled, DEFAULT_COPILOT_SETTINGS.voiceEnabled),
  };
  if (typeof source.updatedAt === 'string') normalized.updatedAt = source.updatedAt;
  if (typeof source.updatedBy === 'string') normalized.updatedBy = source.updatedBy;
  return normalized;
}

export const copilotSettingsUpdateSchema = z
  .object({
    voiceEnabled: z.boolean(),
  })
  .strict();

export type CopilotSettingsUpdateInput = z.infer<typeof copilotSettingsUpdateSchema>;

/**
 * Voice interaction timings. Listening stops on its own when the user stays
 * silent — the mic never keeps running in the background unattended.
 */
/** No speech at all within this window → stop listening automatically. */
export const COPILOT_VOICE_SILENCE_TIMEOUT_MS = 3000;
/** Pause after the user spoke → treat the utterance as complete and send it. */
export const COPILOT_VOICE_PAUSE_FINALIZE_MS = 1400;

export interface CopilotWakeWordMatch {
  /** The wake phrase the user said, e.g. "hey copilot". */
  wakeWord: string;
  /** What was said after the wake word — empty when the wake word was said alone. */
  command: string;
}

/**
 * Detects "hey copilot" / "hey assistant" style wake phrases at the start of a
 * spoken transcript. Speech engines transcribe copilot as "copilot",
 * "co-pilot" or "co pilot", so all spellings are accepted.
 */
const WAKE_WORD_PATTERN =
  /^\s*(?:hey|hi|hello|ok|okay)\s*[,!.]?\s+(co[\s-]?pilot|assistant)\b[,!.?\s]*/i;

export function matchCopilotWakeWord(transcript: string): CopilotWakeWordMatch | null {
  const match = WAKE_WORD_PATTERN.exec(transcript);
  if (!match) return null;
  const rawName = match[1] ?? '';
  const name = /assistant/i.test(rawName) ? 'assistant' : 'copilot';
  return {
    wakeWord: `hey ${name}`,
    command: transcript.slice(match[0].length).trim(),
  };
}

/**
 * Spoken greeting for a wake word. Uses the user's first name when the
 * profile has one so the copilot addresses the person directly.
 */
export function buildCopilotVoiceGreeting(
  displayName?: string | null,
  pageTitle?: string,
): string {
  const firstName = displayName?.trim().split(/\s+/)[0] ?? '';
  const hello = firstName ? `Hi ${firstName}!` : 'Hi there!';
  const where = pageTitle ? ` You're on ${pageTitle}.` : '';
  return `${hello} I'm listening.${where} Ask me anything about this application.`;
}

/** Spoken notice when listening stops because nothing was said. */
export const COPILOT_VOICE_SILENCE_NOTICE =
  "I didn't hear anything, so I stopped listening. Tap the mic when you want to talk again.";

const SPEECH_MAX_CHARS = 1200;

/**
 * Turn a markdown copilot answer into plain text suitable for text-to-speech.
 * Code blocks and tables are pointed at ("on screen") instead of read out
 * loud, and very long answers are clamped at a sentence boundary.
 */
export function copilotSpeechText(markdown: string, maxChars = SPEECH_MAX_CHARS): string {
  let text = markdown;

  text = text.replace(/```[\s\S]*?```/g, ' See the code example on screen. ');
  // Tables: any line made of cells ("| a | b |") is skipped for speech.
  text = text
    .split('\n')
    .filter((line) => !/^\s*\|.*\|\s*$/.test(line) && !/^\s*[|\-+: ]+\s*$/.test(line))
    .join('\n');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '');
  text = text.replace(/(\*\*|__|\*|_|~~)/g, '');
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= maxChars) return text;
  const clamped = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    clamped.lastIndexOf('. '),
    clamped.lastIndexOf('! '),
    clamped.lastIndexOf('? '),
  );
  const cut = sentenceEnd > maxChars * 0.5 ? clamped.slice(0, sentenceEnd + 1) : clamped;
  return `${cut.trim()} The rest of the answer is on screen.`;
}
