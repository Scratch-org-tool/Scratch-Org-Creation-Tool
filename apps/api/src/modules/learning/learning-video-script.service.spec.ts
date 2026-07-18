import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sfcc/db', () => ({ prisma: {} }));

import { VIDEO_MIN_SEGMENTS, videoScriptToMarkdown } from '@sfcc/shared';
import type { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { CURRICULUM, getLesson } from './curriculum';
import {
  LearningVideoScriptService,
  buildStaticVideoScript,
} from './learning-video-script.service';

describe('buildStaticVideoScript', () => {
  it('produces a complete, valid script for EVERY lesson in the platform', () => {
    for (const path of CURRICULUM) {
      for (const module of path.modules) {
        for (const lesson of module.lessons) {
          const script = buildStaticVideoScript(getLesson(lesson.id)!);
          expect(script.segments.length).toBeGreaterThanOrEqual(VIDEO_MIN_SEGMENTS);
          expect(script.source).toBe('static');
          const kinds = script.segments.map((segment) => segment.kind);
          expect(kinds[0]).toBe('intro');
          expect(kinds).toContain('story');
          expect(kinds).toContain('recap');
          expect(kinds.at(-1)).toBe('cta');
          expect(script.totalDurationSeconds).toBeGreaterThan(60);
          for (const segment of script.segments) {
            expect(segment.narration.length).toBeGreaterThanOrEqual(40);
            expect(segment.onScreen.length).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it('turns hands-on sections into demo segments with numbered steps', () => {
    // Lesson content with actionable bullets must yield at least one demo
    // segment somewhere in the platform-wide catalog.
    const demoScripts = CURRICULUM.flatMap((path) =>
      path.modules.flatMap((module) =>
        module.lessons.map((lesson) => buildStaticVideoScript(getLesson(lesson.id)!)),
      ),
    ).filter((script) =>
      script.segments.some((segment) => segment.kind === 'demo' && segment.demoSteps?.length),
    );
    expect(demoScripts.length).toBeGreaterThan(10);
  });

  it('narrates the real-world case end to end', () => {
    const location = getLesson('foundations-what-is-salesforce')!;
    const script = buildStaticVideoScript(location);
    const story = script.segments.find((segment) => segment.kind === 'story')!;
    expect(story.narration).toContain(location.lesson.realWorld.solution.slice(0, 30));
    expect(story.narration).toContain('the payoff');
  });

  it('exports to a production markdown script', () => {
    const script = buildStaticVideoScript(getLesson('dev-governor-limits')!);
    const markdown = videoScriptToMarkdown(script);
    expect(markdown).toContain('# Video session — Governor limits');
    expect(markdown).toContain('**Narration (voice-over):**');
    expect(markdown).toContain('**On screen:**');
  });
});

describe('LearningVideoScriptService', () => {
  const nvidia = { chat: vi.fn() };
  let service: LearningVideoScriptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LearningVideoScriptService(nvidia as unknown as NvidiaService);
  });

  it('falls back to the static script when AI is unavailable and caches it', async () => {
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const script = await service.getScript('foundations-what-is-salesforce');
    expect(script.source).toBe('static');
    await service.getScript('foundations-what-is-salesforce');
    expect(nvidia.chat).toHaveBeenCalledTimes(1);
  });

  it('uses the AI script when the model returns valid JSON', async () => {
    const aiScript = {
      audience: 'New admins',
      segments: Array.from({ length: 7 }, (_, index) => ({
        kind: index === 0 ? 'intro' : index === 6 ? 'cta' : 'concept',
        title: `AI segment ${index + 1}`,
        narration:
          'Meet Dana at Solara Panels, whose finance team waits three days for every quote to be rechecked by hand before it can go out.',
        onScreen: 'Cinematic office scene with the quote paperwork stacking up.',
      })),
    };
    nvidia.chat.mockResolvedValue({ content: JSON.stringify(aiScript), model: 'real-model' });
    const script = await service.getScript('foundations-what-is-salesforce');
    expect(script.source).toBe('ai');
    expect(script.segments[0]!.title).toBe('AI segment 1');
    expect(script.segments).toHaveLength(7);
  });

  it('falls back when the AI returns malformed or thin scripts', async () => {
    nvidia.chat.mockResolvedValue({ content: '{"segments": []}', model: 'real-model' });
    const script = await service.getScript('foundations-what-is-salesforce');
    expect(script.source).toBe('static');
  });

  it('404s for unknown lessons', async () => {
    await expect(service.getScript('ghost')).rejects.toThrow('Lesson not found');
  });
});
