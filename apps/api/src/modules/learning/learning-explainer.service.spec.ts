import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {} }));

import { EXPLAINER_MIN_SCENES, sanitizeStoryboard } from '@sfcc/shared';
import type { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { OpenSourceMediaService } from '../../integrations/media/open-source-media.service';
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
    expect(titles).toContain('Feel the friction');
    expect(titles).toContain('Watch the turning point');
    expect(titles).toContain('See what changed');
  });

  it('gives different lessons visibly different fallback visuals', () => {
    const fingerprint = (lessonId: string) => {
      const board = buildStaticStoryboard(getLesson(lessonId)!, 'lesson');
      return board.scenes
        .map(
          (scene) =>
            `${scene.visual.kind}:${scene.visual.items
              .map((item) => `${item.icon}/${item.accent}`)
              .join(',')}`,
        )
        .join('|');
    };
    const prints = [
      fingerprint('foundations-what-is-salesforce'),
      fingerprint('dev-governor-limits'),
      fingerprint('foundations-reports'),
    ];
    expect(new Set(prints).size).toBe(prints.length);
  });

  it('keeps a custom visual answer question-aware without forcing a case study', () => {
    const location = getLesson('dev-governor-limits')!;
    const board = buildStaticStoryboard(
      location,
      'lesson',
      'Why do governor limits exist?',
    );
    expect(board.title).toContain('Why do governor limits exist?');
    expect(board.scenes[0]!.narration).toContain('Why do governor limits exist?');
    expect(board.scenes.map((scene) => scene.title)).not.toContain('Meet the challenge');
  });

  it('teaches the concept through the lesson’s real-world story so it lands on one listen', () => {
    const location = getLesson('foundations-what-is-salesforce')!;
    const board = buildStaticStoryboard(location, 'lesson');
    const { realWorld } = location.lesson;
    expect(board.scenes[0]!.narration).toContain('picture the story');
    // Scenario, solution, and outcome from the curriculum case all narrate.
    expect(board.scenes[0]!.narration).toContain(realWorld.scenario.slice(0, 40));
    const solutionScene = board.scenes.find((scene) => scene.title === 'Watch it work in the story');
    expect(solutionScene?.narration).toContain(realWorld.solution.slice(0, 40));
    expect(board.scenes.at(-1)!.narration).toContain('And the payoff?');
  });
});

describe('LearningExplainerService', () => {
  const nvidia = { chat: vi.fn() };
  const media = {
    isVideoConfigured: vi.fn().mockReturnValue(false),
    isImageConfigured: vi.fn().mockReturnValue(false),
    isSpeechConfigured: vi.fn().mockReturnValue(false),
    getMediaStatus: vi.fn(),
    generateVideo: vi.fn(),
    generateImage: vi.fn(),
    generateSpeech: vi.fn(),
  };
  let service: LearningExplainerService;

  beforeEach(() => {
    vi.clearAllMocks();
    media.isVideoConfigured.mockReturnValue(false);
    media.isImageConfigured.mockReturnValue(false);
    media.isSpeechConfigured.mockReturnValue(false);
    media.getMediaStatus.mockResolvedValue({ video: 'off', images: 'off', speech: 'off' });
    service = new LearningExplainerService(
      nvidia as unknown as NvidiaService,
      media as unknown as OpenSourceMediaService,
    );
  });

  it('falls back to the static storyboard when AI is unavailable', async () => {
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const board = await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(board.source).toBe('static');
    expect(board.scenes.length).toBeGreaterThanOrEqual(EXPLAINER_MIN_SCENES);
    expect(board.media).toEqual({
      generatedVideo: false,
      generatedImages: false,
      generatedSpeech: false,
      status: { video: 'off', images: 'off', speech: 'off' },
    });
  });

  it('refreshes live media status even on cached storyboards', async () => {
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const first = await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(first.media.generatedSpeech).toBe(false);
    expect(first.media.status.speech).toBe('off');

    // Speech tier becomes configured: capabilities flip on without busting the story cache.
    media.isSpeechConfigured.mockReturnValue(true);
    media.getMediaStatus.mockResolvedValue({
      video: 'unreachable',
      images: 'off',
      speech: 'ready',
    });
    const second = await service.getStoryboard({ lessonId: 'foundations-what-is-salesforce' });
    expect(nvidia.chat).toHaveBeenCalledTimes(1);
    expect(second.media.generatedSpeech).toBe(true);
    expect(second.media.generatedVideo).toBe(false);
    expect(second.media.status).toEqual({
      video: 'unreachable',
      images: 'off',
      speech: 'ready',
    });
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

  it('generates and caches scene imagery only when configured', async () => {
    media.isImageConfigured.mockReturnValue(true);
    const generated = { buffer: Buffer.from('image'), contentType: 'image/png' };
    media.generateImage.mockResolvedValue(generated);
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const request = {
      lessonId: 'foundations-what-is-salesforce',
      sceneId: 'scene-1',
    };

    await expect(service.getSceneImage(request)).resolves.toBe(generated);
    await expect(service.getSceneImage(request)).resolves.toBe(generated);
    expect(media.generateImage).toHaveBeenCalledTimes(1);
    const [prompt, negative] = media.generateImage.mock.calls[0]!;
    expect(prompt).toContain('premium editorial 3D illustration');
    expect(negative).toContain('watermark');
  });

  it('generates and caches motion clips with movement direction in the prompt', async () => {
    media.isVideoConfigured.mockReturnValue(true);
    const generated = { buffer: Buffer.from('clip'), contentType: 'video/webm' };
    media.generateVideo.mockResolvedValue(generated);
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const request = {
      lessonId: 'foundations-what-is-salesforce',
      sceneId: 'scene-2',
    };

    await expect(service.getSceneVideo(request)).resolves.toBe(generated);
    await expect(service.getSceneVideo(request)).resolves.toBe(generated);
    expect(media.generateVideo).toHaveBeenCalledTimes(1);
    expect(media.generateVideo.mock.calls[0]![0]).toContain('camera push-in');
    // No image tier → image-to-video backends receive no base frame.
    expect(media.generateVideo.mock.calls[0]![2]).toBeNull();
  });

  it('feeds the cached scene image into image-to-video generation', async () => {
    media.isVideoConfigured.mockReturnValue(true);
    media.isImageConfigured.mockReturnValue(true);
    const still = { buffer: Buffer.from('still'), contentType: 'image/png' };
    const clip = { buffer: Buffer.from('clip'), contentType: 'video/mp4' };
    media.generateImage.mockResolvedValue(still);
    media.generateVideo.mockResolvedValue(clip);
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });

    await expect(
      service.getSceneVideo({ lessonId: 'foundations-what-is-salesforce', sceneId: 'scene-1' }),
    ).resolves.toBe(clip);
    expect(media.generateImage).toHaveBeenCalledTimes(1);
    expect(media.generateVideo).toHaveBeenCalledWith(
      expect.stringContaining('camera push-in'),
      expect.any(String),
      still,
    );
  });

  it('generates selected studio narration and rejects missing scenes', async () => {
    media.isSpeechConfigured.mockReturnValue(true);
    const generated = { buffer: Buffer.from('audio'), contentType: 'audio/wav' };
    media.generateSpeech.mockResolvedValue(generated);
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });

    await expect(
      service.getSceneSpeech({
        lessonId: 'foundations-what-is-salesforce',
        sceneId: 'scene-1',
        voice: 'Ryan',
      }),
    ).resolves.toBe(generated);
    expect(media.generateSpeech).toHaveBeenCalledWith(
      expect.any(String),
      'Ryan',
      expect.any(String),
    );
    await expect(
      service.getSceneSpeech({
        lessonId: 'foundations-what-is-salesforce',
        sceneId: 'scene-8',
        voice: 'Ryan',
      }),
    ).rejects.toThrow('Explainer scene not found');
  });
});
