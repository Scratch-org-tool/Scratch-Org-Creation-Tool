import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COPILOT_SETTINGS,
  buildCopilotVoiceGreeting,
  copilotSettingsUpdateSchema,
  copilotSpeechText,
  matchCopilotWakeWord,
  normalizeCopilotSettings,
} from './copilot-voice';

describe('copilot settings defaults', () => {
  it('keep voice off until an admin turns it on', () => {
    assert.equal(DEFAULT_COPILOT_SETTINGS.voiceEnabled, false);
  });
});

describe('normalizeCopilotSettings', () => {
  it('fills the shape from partial input', () => {
    const normalized = normalizeCopilotSettings({ voiceEnabled: true, updatedBy: 'DPT_admin' });
    assert.equal(normalized.voiceEnabled, true);
    assert.equal(normalized.updatedBy, 'DPT_admin');
  });

  it('is resilient to junk input', () => {
    assert.deepEqual(normalizeCopilotSettings('nope' as unknown), DEFAULT_COPILOT_SETTINGS);
    assert.deepEqual(normalizeCopilotSettings({ voiceEnabled: 'yes' }), DEFAULT_COPILOT_SETTINGS);
  });
});

describe('copilotSettingsUpdateSchema', () => {
  it('requires an explicit boolean', () => {
    assert.equal(copilotSettingsUpdateSchema.safeParse({ voiceEnabled: true }).success, true);
    assert.equal(copilotSettingsUpdateSchema.safeParse({}).success, false);
    assert.equal(copilotSettingsUpdateSchema.safeParse({ voiceEnabled: 'on' }).success, false);
  });

  it('rejects unknown fields', () => {
    assert.equal(
      copilotSettingsUpdateSchema.safeParse({ voiceEnabled: true, extra: 1 }).success,
      false,
    );
  });
});

describe('matchCopilotWakeWord', () => {
  it('matches "hey copilot" said alone', () => {
    const match = matchCopilotWakeWord('Hey copilot');
    assert.ok(match);
    assert.equal(match.wakeWord, 'hey copilot');
    assert.equal(match.command, '');
  });

  it('matches hyphenated and spaced transcriptions of copilot', () => {
    for (const phrase of ['hey co-pilot', 'Hey co pilot!', 'hey, copilot.']) {
      const match = matchCopilotWakeWord(phrase);
      assert.ok(match, `should match: ${phrase}`);
      assert.equal(match.command, '');
    }
  });

  it('matches "hey assistant" and friends', () => {
    for (const phrase of ['hey assistant', 'Hello assistant', 'okay assistant', 'hi assistant']) {
      const match = matchCopilotWakeWord(phrase);
      assert.ok(match, `should match: ${phrase}`);
      assert.equal(match.wakeWord, 'hey assistant');
    }
  });

  it('extracts the command spoken after the wake word', () => {
    const match = matchCopilotWakeWord('hey copilot, how do I deploy metadata?');
    assert.ok(match);
    assert.equal(match.command, 'how do I deploy metadata?');
  });

  it('ignores sentences that merely mention the copilot', () => {
    assert.equal(matchCopilotWakeWord('the copilot is great'), null);
    assert.equal(matchCopilotWakeWord('how do I deploy metadata?'), null);
    assert.equal(matchCopilotWakeWord('hey how do I deploy?'), null);
  });
});

describe('buildCopilotVoiceGreeting', () => {
  it('greets the user by first name', () => {
    const greeting = buildCopilotVoiceGreeting('Priya Sharma', 'Deployment Center');
    assert.ok(greeting.startsWith('Hi Priya!'));
    assert.ok(greeting.includes('Deployment Center'));
  });

  it('falls back to a generic greeting without a name', () => {
    assert.ok(buildCopilotVoiceGreeting(undefined).startsWith('Hi there!'));
    assert.ok(buildCopilotVoiceGreeting('   ').startsWith('Hi there!'));
  });
});

describe('copilotSpeechText', () => {
  it('strips markdown decorations', () => {
    const spoken = copilotSpeechText(
      '## Steps\n\n1. Open **Deployment Center**\n2. Click [Deploy](/deploy)\n> Note: use `sf deploy`',
    );
    assert.equal(spoken, 'Steps Open Deployment Center Click Deploy Note: use sf deploy');
  });

  it('points at code blocks instead of reading them', () => {
    const spoken = copilotSpeechText('Run this:\n```bash\nsf org list\n```\nThen retry.');
    assert.ok(spoken.includes('See the code example on screen.'));
    assert.ok(!spoken.includes('sf org list'));
  });

  it('skips table rows', () => {
    const spoken = copilotSpeechText('Overview:\n| Org | Type |\n| --- | --- |\n| dev | scratch |\nDone.');
    assert.ok(!spoken.includes('scratch'));
    assert.ok(spoken.includes('Done.'));
  });

  it('clamps very long answers at a sentence boundary', () => {
    const long = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} explains a step.`).join(' ');
    const spoken = copilotSpeechText(long, 300);
    assert.ok(spoken.length < 360);
    assert.ok(spoken.endsWith('The rest of the answer is on screen.'));
  });
});
