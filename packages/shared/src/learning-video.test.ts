import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIDEO_MAX_SEGMENTS,
  estimateSegmentSeconds,
  formatTimecode,
  learningVideoScriptRequestSchema,
  sanitizeVideoScript,
  videoScriptToMarkdown,
  videoScriptToNarration,
} from './learning-video';

const meta = {
  lessonId: 'foundations-what-is-salesforce',
  lessonTitle: 'What is Salesforce?',
  moduleTitle: 'Welcome to Salesforce & the Cloud',
  pathTitle: 'Salesforce Foundations',
  level: 'beginner',
};

const validSegment = (index: number, kind = 'concept') => ({
  kind,
  title: `Part ${index}`,
  narration:
    'Meet Dana, a sales ops admin whose team keeps deals in five different spreadsheets and loses track of every follow-up call.',
  onScreen: 'Isometric office scene: five glowing spreadsheets floating apart, one desk in the middle.',
});

describe('sanitizeVideoScript', () => {
  it('normalizes a valid AI script with timecoded segments', () => {
    const script = sanitizeVideoScript(
      {
        audience: 'Complete beginners',
        segments: [
          { ...validSegment(1, 'intro'), lowerThird: 'What is Salesforce?' },
          validSegment(2),
          {
            ...validSegment(3, 'demo'),
            demoSteps: ['Open Setup', 'Search "Object Manager"', 'Click New Custom Object'],
          },
          validSegment(4, 'story'),
          validSegment(5, 'recap'),
        ],
      },
      meta,
      'ai',
    );
    assert.ok(script);
    assert.equal(script.source, 'ai');
    assert.equal(script.segments.length, 5);
    assert.equal(script.segments[0].id, 'segment-1');
    assert.equal(script.segments[0].lowerThird, 'What is Salesforce?');
    assert.deepEqual(script.segments[2].demoSteps, [
      'Open Setup',
      'Search "Object Manager"',
      'Click New Custom Object',
    ]);
    assert.equal(
      script.totalDurationSeconds,
      script.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0),
    );
  });

  it('rejects thin scripts and drops malformed segments', () => {
    assert.equal(
      sanitizeVideoScript({ segments: [validSegment(1)] }, meta, 'ai'),
      null,
    );
    const script = sanitizeVideoScript(
      {
        segments: [
          validSegment(1),
          { kind: 'concept', title: 'broken', narration: 'too short', onScreen: 'x' },
          validSegment(2),
          validSegment(3),
          validSegment(4),
          validSegment(5),
        ],
      },
      meta,
      'ai',
    );
    assert.ok(script);
    assert.equal(script.segments.length, 5);
    assert.deepEqual(
      script.segments.map((segment) => segment.id),
      ['segment-1', 'segment-2', 'segment-3', 'segment-4', 'segment-5'],
    );
  });

  it('clamps unknown kinds, long text, and caps segment count', () => {
    const script = sanitizeVideoScript(
      {
        segments: Array.from({ length: 20 }, (_, index) => ({
          ...validSegment(index + 1, index === 0 ? 'hologram' : 'concept'),
          title: 'T'.repeat(300),
          demoSteps: Array.from({ length: 20 }, (_, step) => `Step ${step} ${'x'.repeat(300)}`),
        })),
      },
      meta,
      'static',
    );
    assert.ok(script);
    assert.equal(script.segments[0].kind, 'concept');
    assert.ok(script.segments.length <= VIDEO_MAX_SEGMENTS);
    assert.ok(script.segments[0].title.length <= 90);
    assert.ok(script.segments[0].demoSteps!.length <= 10);
    assert.ok(script.segments[0].demoSteps![0].length <= 200);
  });
});

describe('exports for video tools', () => {
  const script = sanitizeVideoScript(
    {
      segments: [
        validSegment(1, 'intro'),
        {
          ...validSegment(2, 'demo'),
          demoSteps: ['Open Setup', 'Create the field'],
          lowerThird: 'Setup → Object Manager',
        },
        validSegment(3, 'story'),
        validSegment(4, 'recap'),
        validSegment(5, 'cta'),
      ],
    },
    meta,
    'ai',
  )!;

  it('renders a timecoded Markdown production script', () => {
    const markdown = videoScriptToMarkdown(script);
    assert.match(markdown, /# Video session — What is Salesforce\?/);
    assert.match(markdown, /## 00:00 · Cold open — Part 1/);
    assert.match(markdown, /\*\*Screen-capture steps:\*\*/);
    assert.match(markdown, /1\. Open Setup/);
    assert.match(markdown, /\*\*Lower third:\*\* Setup → Object Manager/);
  });

  it('exports narration-only text for TTS and avatar tools', () => {
    const narration = videoScriptToNarration(script);
    assert.equal(narration.split('\n\n').length, script.segments.length);
    assert.ok(!narration.includes('On screen'));
  });

  it('formats timecodes', () => {
    assert.equal(formatTimecode(0), '00:00');
    assert.equal(formatTimecode(75), '01:15');
    assert.equal(formatTimecode(600), '10:00');
  });
});

describe('estimateSegmentSeconds', () => {
  it('scales with words and demo steps with a floor', () => {
    assert.equal(estimateSegmentSeconds('short', 0), 12);
    const words = 'word '.repeat(150);
    assert.equal(estimateSegmentSeconds(words, 0), 60);
    assert.equal(estimateSegmentSeconds(words, 3), 72);
  });
});

describe('learningVideoScriptRequestSchema', () => {
  it('validates the lesson id', () => {
    assert.equal(
      learningVideoScriptRequestSchema.safeParse({ lessonId: 'foundations-reports' }).success,
      true,
    );
    assert.equal(learningVideoScriptRequestSchema.safeParse({ lessonId: '' }).success, false);
  });
});
