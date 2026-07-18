import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {} }));

import { EXPLAINER_MIN_SCENES, sanitizeStoryboard } from '@sfcc/shared';
import type { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { CURRICULUM, getLesson } from './curriculum';
import {
  LearningExplainerService,
  buildStaticStoryboard,
  extractJsonObject,
} from './learning-explainer.service';

describe('extractJsonObject', () => {
  it('parses fenced, noisy, and plain JSON objects', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('Sure! Here is the script: {"title":"x","scenes":[]} enjoy')).toEqual({
      title: 'x',
      scenes: [],
    });
    expect(extractJsonObject('[1,2,3]')).toBeNull();
    expect(extractJsonObject('{broken')).toBeNull();
    expect(extractJsonObject('no json at all')).toBeNull();
  });
});

describe('buildStaticStoryboard', () => {
  it('produces a valid storyboard for EVERY lesson in both focuses', () => {
    for (const path of CURRICULUM) {
      for (const module of path.modules) {
        for (const lesson of module.lessons) {
          const location = getLesson(lesson.id)!;
          for (const focus of ['lesson', 'real-world'] as const) {
            const board = buildStaticStoryboard(location, focus);
            expect(board.scenes.length).toBeGreaterThanOrEqual(EXPLAINER_MIN_SCENES);
            expect(board.source).toBe('static');
            // Round-trips through the shared sanitizer without loss.
            expect(sanitizeStoryboard(board, lesson.id, 'static')?.scenes.length).toBe(
              board.scenes.length,
            );
            for (const scene of board.scenes) {
              expect(scene.narration.length).toBeGreaterThanOrEqual(20);
              expect(scene.visual.items.length).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    }
  });

  it('tells the real-world story as problem → solution → outcome', () => {
    const location = getLesson('foundations-what-is-salesforce')!;
    const board = buildStaticStoryboard(location, 'real-world');
    const titles = board.scenes.map((scene) => scene.title);
    expect(titles).toContain('The problem');
    expect(titles).toContain('The solution');
    expect(titles).toContain('The outcome');
  });
});

describe('LearningExplainerService', () => {
  const nvidia = { chat: vi.fn() };
  let service: LearningExplainerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LearningExplainerService(nvidia as unknown as NvidiaService);
  });

  it('falls back to the static storyboard when AI is unavailable', async () => {
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const board = await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(board.source).toBe('static');
    expect(board.scenes.length).toBeGreaterThanOrEqual(EXPLAINER_MIN_SCENES);
  });

  it('uses the AI storyboard when the model returns valid JSON', async () => {
    const aiBoard = {
      title: 'CRM, animated',
      scenes: Array.from({ length: 4 }, (_, i) => ({
        title: `AI scene ${i + 1}`,
        narration:
          'A generated narration line that is comfortably long enough to pass validation rules.',
        visual: {
          kind: 'flow',
          items: [
            { label: 'Lead', icon: 'user', accent: 'sky' },
            { label: 'Opportunity', icon: 'target', accent: 'violet' },
          ],
        },
      })),
    };
    nvidia.chat.mockResolvedValue({ content: JSON.stringify(aiBoard), model: 'real-model' });
    const board = await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(board.source).toBe('ai');
    expect(board.scenes[0]!.title).toBe('AI scene 1');
  });

  it('falls back when the AI returns malformed or thin storyboards', async () => {
    nvidia.chat.mockResolvedValue({
      content: '{"title":"x","scenes":[{"title":"only one","narration":"long enough narration for one scene only.","visual":{"kind":"callout","items":[{"label":"X"}]}}]}',
      model: 'real-model',
    });
    const board = await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(board.source).toBe('static');
  });

  it('caches storyboards per lesson/focus/question', async () => {
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(nvidia.chat).toHaveBeenCalledTimes(1);
    await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce', focus: 'real-world' });
    expect(nvidia.chat).toHaveBeenCalledTimes(2);
  });

  it('404s for unknown lessons', async () => {
    await expect(service.getStoryboard({ lessonId: 'ghost' })).rejects.toThrow('Lesson not found');
  });
});
