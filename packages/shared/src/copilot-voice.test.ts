import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COPILOT_VOICE_SETTINGS,
  applyCopilotVoiceSettingsUpdate,
  copilotVoiceSettingsUpdateSchema,
  matchesWakeWord,
  normalizeCopilotVoiceSettings,
  normalizeWakeWords,
  renderVoiceGreeting,
  stripMarkdownForSpeech,
} from './copilot-voice';

describe('copilot voice defaults', () => {
  it('are disabled until an admin turns them on', () => {
    assert.equal(DEFAULT_COPILOT_VOICE_SETTINGS.enabled, false);
  });

  it('ship the two documented wake words', () => {
    assert.deepEqual(DEFAULT_COPILOT_VOICE_SETTINGS.wakeWords, ['hey copilot', 'hey assistant']);
  });
});

describe('normalizeCopilotVoiceSettings', () => {
  it('fills every field from partial input', () => {
    const normalized = normalizeCopilotVoiceSettings({ enabled: true });
    assert.equal(normalized.enabled, true);
    assert.equal(normalized.speakResponses, true);
    assert.equal(normalized.listenSilenceMs, 2500);
    assert.equal(normalized.speechRate, 1);
    assert.equal(normalized.voiceLang, 'en-US');
  });

  it('clamps the silence window and speech rate', () => {
    const low = normalizeCopilotVoiceSettings({ listenSilenceMs: 10, speechRate: 0.1 });
    assert.equal(low.listenSilenceMs, 1000);
    assert.equal(low.speechRate, 0.5);
    const high = normalizeCopilotVoiceSettings({ listenSilenceMs: 999999, speechRate: 9 });
    assert.equal(high.listenSilenceMs, 8000);
    assert.equal(high.speechRate, 2);
  });

  it('is resilient to junk input', () => {
    const normalized = normalizeCopilotVoiceSettings('not an object');
    assert.deepEqual(normalized, DEFAULT_COPILOT_VOICE_SETTINGS);
  });

  it('normalizes and de-duplicates wake words, falling back to defaults', () => {
    assert.deepEqual(normalizeWakeWords(['Hey, Co-Pilot!', 'hey copilot', 42]), ['hey copilot']);
    assert.deepEqual(normalizeWakeWords([]), ['hey copilot', 'hey assistant']);
    assert.deepEqual(normalizeWakeWords(['   ']), ['hey copilot', 'hey assistant']);
  });
});

describe('applyCopilotVoiceSettingsUpdate', () => {
  it('merges partial updates on top of current settings', () => {
    const next = applyCopilotVoiceSettingsUpdate(DEFAULT_COPILOT_VOICE_SETTINGS, {
      enabled: true,
      speechRate: 1.25,
    });
    assert.equal(next.enabled, true);
    assert.equal(next.speechRate, 1.25);
    assert.equal(next.speakResponses, true);
  });
});

describe('matchesWakeWord', () => {
  const words = ['hey copilot', 'hey assistant'];

  it('matches the bare wake phrase with no command', () => {
    assert.deepEqual(matchesWakeWord('Hey Copilot', words), { matched: true, command: '' });
  });

  it('extracts the trailing command', () => {
    assert.deepEqual(matchesWakeWord('hey copilot what is drift monitoring', words), {
      matched: true,
      command: 'what is drift monitoring',
    });
  });

  it('tolerates punctuation and hyphenation', () => {
    assert.deepEqual(matchesWakeWord('Hey, co-pilot! open the dashboard', words), {
      matched: true,
      command: 'open the dashboard',
    });
  });

  it('finds a wake phrase mid-utterance', () => {
    assert.equal(matchesWakeWord('ok hey assistant help me', words).matched, true);
  });

  it('does not match unrelated speech', () => {
    assert.equal(matchesWakeWord('what time is it', words).matched, false);
    assert.equal(matchesWakeWord('', words).matched, false);
  });
});

describe('renderVoiceGreeting', () => {
  it('substitutes the user name', () => {
    assert.equal(
      renderVoiceGreeting('Hi {name}, how can I help you today?', 'Ajay'),
      'Hi Ajay, how can I help you today?',
    );
  });

  it('falls back when name is missing', () => {
    assert.equal(renderVoiceGreeting('Hello {name}!', ''), 'Hello there!');
    assert.equal(renderVoiceGreeting('', 'Sam'), 'Hi Sam, how can I help you today?');
  });
});

describe('stripMarkdownForSpeech', () => {
  it('removes markdown syntax', () => {
    const spoken = stripMarkdownForSpeech('# Title\n\n- **Bold** and `code` and [link](https://x.com)');
    assert.equal(spoken, 'Title Bold and code and link');
  });

  it('drops fenced code blocks', () => {
    const spoken = stripMarkdownForSpeech('Do this:\n```ts\nconst a = 1;\n```\nDone');
    assert.match(spoken, /Do this: code snippet omitted Done/);
  });

  it('caps length on a sentence boundary when requested', () => {
    const long = 'First sentence is here. Second sentence continues on for a while longer.';
    const capped = stripMarkdownForSpeech(long, 30);
    assert.equal(capped, 'First sentence is here.');
  });
});

describe('copilotVoiceSettingsUpdateSchema', () => {
  it('accepts a valid partial update', () => {
    const parsed = copilotVoiceSettingsUpdateSchema.safeParse({ enabled: true, wakeWords: ['hey copilot'] });
    assert.equal(parsed.success, true);
  });

  it('rejects an empty update', () => {
    assert.equal(copilotVoiceSettingsUpdateSchema.safeParse({}).success, false);
  });

  it('rejects out-of-range values and unknown keys', () => {
    assert.equal(copilotVoiceSettingsUpdateSchema.safeParse({ speechRate: 5 }).success, false);
    assert.equal(copilotVoiceSettingsUpdateSchema.safeParse({ listenSilenceMs: 100 }).success, false);
    assert.equal(copilotVoiceSettingsUpdateSchema.safeParse({ bogus: true }).success, false);
  });
});
