import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPLAINER_MAX_ITEMS,
  EXPLAINER_MAX_SCENES,
  estimateNarrationMs,
  learningExplainerRequestSchema,
  sanitizeExplainerAccent,
  sanitizeExplainerIcon,
  sanitizeStoryboard,
} from './learning-explainer';

const validScene = (index: number) => ({
  title: `Scene ${index}`,
  narration:
    'Salesforce runs as a multi-tenant cloud where every company rents an isolated org on shared infrastructure.',
  visual: {
    kind: 'flow',
    caption: 'Lead to cash',
    items: [
      { label: 'Lead', icon: 'user', accent: 'sky' },
      { label: 'Opportunity', icon: 'target', accent: 'violet' },
      { label: 'Order', icon: 'package', accent: 'emerald' },
    ],
  },
});

describe('sanitizeExplainerIcon / accent', () => {
  it('accepts whitelisted values and falls back otherwise', () => {
    assert.equal(sanitizeExplainerIcon('database'), 'database');
    assert.equal(sanitizeExplainerIcon('  CLOUD '), 'cloud');
    assert.equal(sanitizeExplainerIcon('<script>'), 'sparkles');
    assert.equal(sanitizeExplainerIcon(42), 'sparkles');
    assert.equal(sanitizeExplainerAccent('emerald'), 'emerald');
    assert.equal(sanitizeExplainerAccent('hotpink', 'amber'), 'amber');
  });
});

describe('sanitizeStoryboard', () => {
  it('normalizes a valid AI storyboard', () => {
    const board = sanitizeStoryboard(
      { title: 'CRM basics', scenes: [validScene(1), validScene(2), validScene(3)] },
      'lesson-1',
      'ai',
    );
    assert.ok(board);
    assert.equal(board.scenes.length, 3);
    assert.equal(board.source, 'ai');
    assert.equal(board.scenes[0].id, 'scene-1');
    assert.equal(board.scenes[0].visual.items.length, 3);
  });

  it('rejects boards with fewer than 3 usable scenes', () => {
    assert.equal(sanitizeStoryboard({ scenes: [validScene(1)] }, 'l', 'ai'), null);
    assert.equal(sanitizeStoryboard('nonsense', 'l', 'ai'), null);
    assert.equal(sanitizeStoryboard({ scenes: 'nope' }, 'l', 'ai'), null);
  });

  it('drops malformed scenes and items but keeps good ones', () => {
    const board = sanitizeStoryboard(
      {
        scenes: [
          validScene(1),
          { title: 'broken', narration: 'too short', visual: { kind: 'flow', items: [] } },
          validScene(2),
          validScene(3),
        ],
      },
      'lesson-1',
      'ai',
    );
    assert.ok(board);
    assert.equal(board.scenes.length, 3);
    // ids stay sequential after the broken scene was dropped
    assert.deepEqual(
      board.scenes.map((scene) => scene.id),
      ['scene-1', 'scene-2', 'scene-3'],
    );
  });

  it('clamps unknown icons, kinds, accents, and long text', () => {
    const board = sanitizeStoryboard(
      {
        scenes: [
          {
            title: 'T'.repeat(400),
            narration: `${'A very long narration sentence. '.repeat(40)}`,
            visual: {
              kind: 'hologram',
              items: [
                { label: 'L'.repeat(300), icon: 'flux-capacitor', accent: 'neon' },
              ],
            },
          },
          validScene(2),
          validScene(3),
        ],
      },
      'lesson-1',
      'ai',
    );
    assert.ok(board);
    const scene = board.scenes[0];
    assert.equal(scene.visual.kind, 'callout');
    assert.equal(scene.visual.items[0].icon, 'sparkles');
    assert.ok(scene.narration.length <= 520);
    assert.ok(scene.visual.items[0].label.length <= 48);
  });

  it('caps scenes and items at the maxima', () => {
    const manyItems = {
      title: 'Big',
      narration: 'A scene with far too many items that should be capped at the maximum.',
      visual: {
        kind: 'grid',
        items: Array.from({ length: 12 }, (_, i) => ({ label: `Item ${i}`, icon: 'star', accent: 'sky' })),
      },
    };
    const board = sanitizeStoryboard(
      { scenes: Array.from({ length: 15 }, (_, i) => (i === 0 ? manyItems : validScene(i))) },
      'lesson-1',
      'ai',
    );
    assert.ok(board);
    assert.ok(board.scenes.length <= EXPLAINER_MAX_SCENES);
    assert.ok(board.scenes[0].visual.items.length <= EXPLAINER_MAX_ITEMS);
  });

  it('balances compare visuals or downgrades them to grid', () => {
    const board = sanitizeStoryboard(
      {
        scenes: [
          {
            title: 'Lookup vs master-detail',
            narration: 'Two relationship types with very different ownership behavior on the platform.',
            visual: {
              kind: 'compare',
              items: [
                { label: 'Lookup', icon: 'link', side: 'left' },
                { label: 'Master-detail', icon: 'layers' },
              ],
            },
          },
          validScene(2),
          validScene(3),
        ],
      },
      'lesson-1',
      'ai',
    );
    assert.ok(board);
    const compare = board.scenes[0].visual;
    assert.equal(compare.kind, 'compare');
    assert.equal(compare.items[0].side, 'left');
    assert.equal(compare.items[1].side, 'right');
  });
});

describe('learningExplainerRequestSchema', () => {
  it('validates requests', () => {
    assert.equal(
      learningExplainerRequestSchema.safeParse({ lessonId: 'foundations-what-is-salesforce' }).success,
      true,
    );
    assert.equal(
      learningExplainerRequestSchema.safeParse({
        lessonId: 'x',
        focus: 'real-world',
        question: 'Explain junction objects visually',
      }).success,
      true,
    );
    assert.equal(learningExplainerRequestSchema.safeParse({ lessonId: '' }).success, false);
    assert.equal(
      learningExplainerRequestSchema.safeParse({ lessonId: 'x', focus: 'cinematic' }).success,
      false,
    );
  });
});

describe('estimateNarrationMs', () => {
  it('scales with word count and floors at 4 seconds', () => {
    assert.equal(estimateNarrationMs('short one'), 4000);
    const long = estimateNarrationMs('word '.repeat(155));
    assert.ok(long >= 59_000 && long <= 61_000);
  });
});
