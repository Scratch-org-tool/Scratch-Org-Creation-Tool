import { describe, expect, it } from 'vitest';
import {
  listUsefulVoices,
  pickPreferredVoice,
  resolveUtteranceVoice,
  voiceKey,
} from './use-speech';

function voice(
  name: string,
  lang: string,
  overrides: Partial<SpeechSynthesisVoice> = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: overrides.voiceURI ?? `uri:${name}`,
    default: overrides.default ?? false,
    localService: overrides.localService ?? true,
  } as SpeechSynthesisVoice;
}

describe('voiceKey', () => {
  it('uses the voiceURI and falls back to name|lang', () => {
    expect(voiceKey(voice('Aria', 'en-US', { voiceURI: 'urn:aria' }))).toBe('urn:aria');
    expect(voiceKey(voice('Aria', 'en-US', { voiceURI: '' }))).toBe('Aria|en-US');
  });
});

describe('listUsefulVoices', () => {
  it('dedupes, prefers English, and sorts defaults first', () => {
    const voices = listUsefulVoices([
      voice('Zira', 'en-US'),
      voice('Zira', 'en-US'),
      voice('Anna', 'de-DE'),
      voice('David', 'en-GB', { default: true }),
    ]);
    expect(voices.map((v) => v.name)).toEqual(['David', 'Zira']);
  });

  it('keeps all voices when no English voice exists', () => {
    const voices = listUsefulVoices([voice('Anna', 'de-DE'), voice('Hana', 'ja-JP')]);
    expect(voices).toHaveLength(2);
  });
});

describe('pickPreferredVoice', () => {
  it('prefers curated natural voices, then en-US, then any English', () => {
    expect(
      pickPreferredVoice([voice('Zira', 'en-US'), voice('Google US English', 'en-US')])?.name,
    ).toBe('Google US English');
    expect(pickPreferredVoice([voice('Kate', 'en-GB'), voice('Zira', 'en-US')])?.name).toBe(
      'Zira',
    );
    expect(pickPreferredVoice([voice('Kate', 'en-GB')])?.name).toBe('Kate');
    expect(pickPreferredVoice([])).toBeNull();
  });
});

describe('resolveUtteranceVoice', () => {
  const available = [voice('Zira', 'en-US'), voice('Mark', 'en-GB')];

  it('honors the explicitly requested voice — the picker must actually change the narrator', () => {
    const resolved = resolveUtteranceVoice(available, 'uri:Mark', available[0]!);
    expect(resolved?.name).toBe('Mark');
  });

  it('falls back to the sticky selection when the request is missing or unknown', () => {
    expect(resolveUtteranceVoice(available, undefined, available[0]!)?.name).toBe('Zira');
    expect(resolveUtteranceVoice(available, 'uri:Ghost', available[1]!)?.name).toBe('Mark');
    expect(resolveUtteranceVoice(available, undefined, null)).toBeNull();
  });
});
