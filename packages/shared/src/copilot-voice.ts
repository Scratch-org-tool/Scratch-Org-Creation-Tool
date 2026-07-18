import { z } from 'zod';

/**
 * Admin-owned controls for the AI Copilot voice ("voiceover") mode. A single
 * global row decides whether the voice assistant is available at all, which
 * wake phrases trigger a greeting, and how spoken replies behave. Voice is OFF
 * by default — an administrator must explicitly enable it (mirrors the
 * notifications admin controls).
 */
export interface CopilotVoiceSettings {
  /**
   * Master switch. While false the mic UI never renders and no browser
   * speech recognition / synthesis is started for the Copilot.
   */
  enabled: boolean;
  /** Read assistant replies aloud when they finish streaming. */
  speakResponses: boolean;
  /** Begin listening automatically when the Copilot panel is opened. */
  autoListen: boolean;
  /** Phrases that trigger a spoken greeting, e.g. "hey copilot". Lower-cased. */
  wakeWords: string[];
  /** Greeting spoken on a wake word. `{name}` is replaced with the user's name. */
  greetingTemplate: string;
  /**
   * How long (ms) background listening waits with nothing relevant said before
   * it stops on its own. The "stop after 2–3 seconds" behaviour.
   */
  listenSilenceMs: number;
  /** Speech-synthesis rate for spoken replies (0.5–2). */
  speechRate: number;
  /** BCP-47 language used for recognition + synthesis, e.g. "en-US". */
  voiceLang: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export const DEFAULT_COPILOT_VOICE_WAKE_WORDS = ['hey copilot', 'hey assistant'] as const;
export const DEFAULT_COPILOT_VOICE_GREETING = 'Hi {name}, how can I help you today?';

/** Voice is disabled until an administrator turns it on. */
export const DEFAULT_COPILOT_VOICE_SETTINGS: CopilotVoiceSettings = {
  enabled: false,
  speakResponses: true,
  autoListen: false,
  wakeWords: [...DEFAULT_COPILOT_VOICE_WAKE_WORDS],
  greetingTemplate: DEFAULT_COPILOT_VOICE_GREETING,
  listenSilenceMs: 2500,
  speechRate: 1,
  voiceLang: 'en-US',
};

export const VOICE_LISTEN_SILENCE_MIN_MS = 1000;
export const VOICE_LISTEN_SILENCE_MAX_MS = 8000;
export const VOICE_SPEECH_RATE_MIN = 0.5;
export const VOICE_SPEECH_RATE_MAX = 2;
export const VOICE_WAKE_WORD_MAX = 6;
export const VOICE_WAKE_WORD_MAX_LEN = 40;
export const VOICE_GREETING_MAX_LEN = 200;
export const VOICE_LANG_MAX_LEN = 20;

function coerceBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Normalize a spoken/typed phrase for matching: lower-case, strip punctuation
 * (so "Hey, Co-Pilot!" == "hey copilot"), and collapse whitespace.
 */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    // Join hyphenated / apostrophised words so "co-pilot" == "copilot".
    .replace(/[-'’‘`]+/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clean, dedupe and bound a wake-word list. Falls back to the defaults. */
export function normalizeWakeWords(raw: unknown): string[] {
  const source = Array.isArray(raw) ? raw : [];
  const cleaned: string[] = [];
  for (const entry of source) {
    if (typeof entry !== 'string') continue;
    const word = normalizeSpeech(entry).slice(0, VOICE_WAKE_WORD_MAX_LEN).trim();
    if (word && !cleaned.includes(word)) cleaned.push(word);
    if (cleaned.length >= VOICE_WAKE_WORD_MAX) break;
  }
  return cleaned.length > 0 ? cleaned : [...DEFAULT_COPILOT_VOICE_WAKE_WORDS];
}

/**
 * Merge a partial / untrusted settings object onto the defaults so callers
 * always see every field with a sane, bounded value.
 */
export function normalizeCopilotVoiceSettings(raw: unknown): CopilotVoiceSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const greeting =
    typeof source.greetingTemplate === 'string' && source.greetingTemplate.trim()
      ? source.greetingTemplate.trim().slice(0, VOICE_GREETING_MAX_LEN)
      : DEFAULT_COPILOT_VOICE_SETTINGS.greetingTemplate;

  const voiceLang =
    typeof source.voiceLang === 'string' && source.voiceLang.trim()
      ? source.voiceLang.trim().slice(0, VOICE_LANG_MAX_LEN)
      : DEFAULT_COPILOT_VOICE_SETTINGS.voiceLang;

  const normalized: CopilotVoiceSettings = {
    enabled: coerceBool(source.enabled, DEFAULT_COPILOT_VOICE_SETTINGS.enabled),
    speakResponses: coerceBool(source.speakResponses, DEFAULT_COPILOT_VOICE_SETTINGS.speakResponses),
    autoListen: coerceBool(source.autoListen, DEFAULT_COPILOT_VOICE_SETTINGS.autoListen),
    wakeWords: normalizeWakeWords(source.wakeWords),
    greetingTemplate: greeting,
    listenSilenceMs: Math.round(
      clampNumber(
        source.listenSilenceMs,
        VOICE_LISTEN_SILENCE_MIN_MS,
        VOICE_LISTEN_SILENCE_MAX_MS,
        DEFAULT_COPILOT_VOICE_SETTINGS.listenSilenceMs,
      ),
    ),
    speechRate: clampNumber(
      source.speechRate,
      VOICE_SPEECH_RATE_MIN,
      VOICE_SPEECH_RATE_MAX,
      DEFAULT_COPILOT_VOICE_SETTINGS.speechRate,
    ),
    voiceLang,
  };
  if (typeof source.updatedAt === 'string') normalized.updatedAt = source.updatedAt;
  if (typeof source.updatedBy === 'string') normalized.updatedBy = source.updatedBy;
  return normalized;
}

/** Merge an admin update on top of current settings (partial fields allowed). */
export function applyCopilotVoiceSettingsUpdate(
  current: CopilotVoiceSettings,
  update: CopilotVoiceSettingsUpdateInput,
): CopilotVoiceSettings {
  return normalizeCopilotVoiceSettings({
    enabled: update.enabled ?? current.enabled,
    speakResponses: update.speakResponses ?? current.speakResponses,
    autoListen: update.autoListen ?? current.autoListen,
    wakeWords: update.wakeWords ?? current.wakeWords,
    greetingTemplate: update.greetingTemplate ?? current.greetingTemplate,
    listenSilenceMs: update.listenSilenceMs ?? current.listenSilenceMs,
    speechRate: update.speechRate ?? current.speechRate,
    voiceLang: update.voiceLang ?? current.voiceLang,
  });
}

export interface WakeWordMatch {
  matched: boolean;
  /** Any words spoken after the wake phrase (already normalized), or '' . */
  command?: string;
}

/**
 * Detect a wake phrase in a transcript and return the trailing command, if any.
 * Matching is tolerant to punctuation/casing. The wake phrase may appear at the
 * start ("hey copilot what is drift") or anywhere in the utterance.
 */
export function matchesWakeWord(transcript: string, wakeWords: string[]): WakeWordMatch {
  const normalized = normalizeSpeech(transcript);
  if (!normalized) return { matched: false };

  for (const raw of wakeWords) {
    const word = normalizeSpeech(raw);
    if (!word) continue;
    if (normalized === word) return { matched: true, command: '' };
    if (normalized.startsWith(`${word} `)) {
      return { matched: true, command: normalized.slice(word.length).trim() };
    }
    if (normalized.endsWith(` ${word}`)) {
      return { matched: true, command: '' };
    }
    const mid = normalized.indexOf(` ${word} `);
    if (mid !== -1) {
      return { matched: true, command: normalized.slice(mid + word.length + 2).trim() };
    }
  }
  return { matched: false };
}

/** Render the greeting with the user's name; falls back to a friendly default. */
export function renderVoiceGreeting(template: string, name?: string | null): string {
  const safeName = (name ?? '').trim() || 'there';
  const base = (template ?? '').trim() || DEFAULT_COPILOT_VOICE_GREETING;
  return base.replace(/\{name\}/gi, safeName).trim();
}

/**
 * Convert a markdown chat reply into a clean string suitable for text-to-speech
 * (drops code fences, link syntax, emphasis and list bullets). Optionally caps
 * the length so spoken replies stay snappy.
 */
export function stripMarkdownForSpeech(text: string, maxChars?: number): string {
  let out = text
    .replace(/```[\s\S]*?```/g, ' code snippet omitted ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/>\s?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxChars && out.length > maxChars) {
    const clipped = out.slice(0, maxChars);
    const lastStop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
    out = (lastStop > maxChars * 0.5 ? clipped.slice(0, lastStop + 1) : clipped).trim();
  }
  return out;
}

const wakeWordSchema = z.string().trim().min(1).max(VOICE_WAKE_WORD_MAX_LEN);

export const copilotVoiceSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    speakResponses: z.boolean().optional(),
    autoListen: z.boolean().optional(),
    wakeWords: z.array(wakeWordSchema).min(1).max(VOICE_WAKE_WORD_MAX).optional(),
    greetingTemplate: z.string().trim().min(1).max(VOICE_GREETING_MAX_LEN).optional(),
    listenSilenceMs: z
      .number()
      .int()
      .min(VOICE_LISTEN_SILENCE_MIN_MS)
      .max(VOICE_LISTEN_SILENCE_MAX_MS)
      .optional(),
    speechRate: z.number().min(VOICE_SPEECH_RATE_MIN).max(VOICE_SPEECH_RATE_MAX).optional(),
    voiceLang: z.string().trim().min(2).max(VOICE_LANG_MAX_LEN).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one setting must be provided',
  });

export type CopilotVoiceSettingsUpdateInput = z.infer<typeof copilotVoiceSettingsUpdateSchema>;
