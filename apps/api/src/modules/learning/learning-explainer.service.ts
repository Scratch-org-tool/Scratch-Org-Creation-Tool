import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EXPLAINER_ICONS,
  EXPLAINER_LABEL_MAX,
  EXPLAINER_NARRATION_MAX,
  sanitizeStoryboard,
  type ExplainerFocus,
  type ExplainerScene,
  type ExplainerStoryboard,
  type LearningExplainerRequest,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { getLesson, type LessonLocation } from './curriculum';

/** Keep AI attempts short — Next.js proxy times out around 30s; we fall back to static curriculum. */
const EXPLAINER_TIMEOUT_MS =
  parseInt(process.env.LEARNING_EXPLAINER_TIMEOUT_MS ?? '8000', 10) || 8_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

/** Pull the first JSON object out of an LLM response that may include prose/fences. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function clamp(text: string, max: number): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function firstParagraph(body: string): string {
  const chunk = body.split(/\n\s*\n/).find((part) => part.trim().length > 0) ?? body;
  return chunk.replace(/^- /gm, '').replace(/\n/g, ' ');
}

function bulletItems(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

/**
 * Deterministic storyboard derived from curriculum content. Always available
 * (no AI dependency) and used both as the fallback and in tests as the
 * guaranteed baseline for every lesson.
 */
export function buildStaticStoryboard(
  location: LessonLocation,
  focus: ExplainerFocus,
): ExplainerStoryboard {
  const { lesson } = location;
  const scenes: Array<Omit<ExplainerScene, 'id'>> = [];

  if (focus === 'real-world') {
    scenes.push({
      title: 'A story from the field',
      narration: `Let's make "${lesson.title}" concrete with a real-world case: ${lesson.realWorld.title}.`,
      visual: {
        kind: 'callout',
        caption: 'Real-world example',
        items: [
          { label: clamp(lesson.realWorld.title, EXPLAINER_LABEL_MAX), icon: 'briefcase', accent: 'sky' },
        ],
      },
    });
    scenes.push({
      title: 'The problem',
      narration: clamp(lesson.realWorld.scenario, EXPLAINER_NARRATION_MAX),
      visual: {
        kind: 'callout',
        caption: 'What was going wrong',
        items: [{ label: 'The problem', icon: 'alert-triangle', accent: 'amber' }],
      },
    });
    scenes.push({
      title: 'The solution',
      narration: clamp(lesson.realWorld.solution, EXPLAINER_NARRATION_MAX),
      visual: {
        kind: 'flow',
        caption: 'How the team fixed it',
        items: [
          { label: 'Understand', sublabel: 'Read the process', icon: 'search', accent: 'sky' },
          { label: 'Redesign', sublabel: 'Apply the concept', icon: 'wrench', accent: 'violet' },
          { label: 'Adopt', sublabel: 'Roll out to the team', icon: 'users', accent: 'emerald' },
        ],
      },
    });
    scenes.push({
      title: 'The outcome',
      narration: clamp(lesson.realWorld.outcome, EXPLAINER_NARRATION_MAX),
      visual: {
        kind: 'callout',
        caption: 'What changed',
        items: [{ label: 'The outcome', icon: 'trophy', accent: 'emerald' }],
      },
    });
  } else {
    scenes.push({
      title: lesson.title,
      narration: clamp(`${lesson.title}. ${lesson.summary}`, EXPLAINER_NARRATION_MAX),
      visual: {
        kind: 'callout',
        caption: 'This lesson in one picture',
        items: [{ label: clamp(lesson.title, EXPLAINER_LABEL_MAX), icon: 'graduation-cap', accent: 'sky' }],
      },
    });
    const accents = ['violet', 'sky', 'amber', 'emerald'] as const;
    lesson.sections.slice(0, 4).forEach((section, index) => {
      const bullets = bulletItems(section.body);
      scenes.push({
        title: section.heading,
        narration: clamp(firstParagraph(section.body), EXPLAINER_NARRATION_MAX),
        visual:
          bullets.length >= 2
            ? {
                kind: 'timeline',
                caption: section.heading,
                items: bullets.slice(0, 5).map((bullet) => ({
                  label: clamp(bullet, EXPLAINER_LABEL_MAX),
                  icon: 'check-circle' as const,
                  accent: accents[index % accents.length],
                })),
              }
            : {
                kind: 'callout',
                caption: 'Key idea',
                items: [
                  {
                    label: clamp(section.heading, EXPLAINER_LABEL_MAX),
                    icon: 'lightbulb' as const,
                    accent: accents[index % accents.length],
                  },
                ],
              },
      });
    });
  }

  scenes.push({
    title: 'Remember this',
    narration: clamp(
      `Before you move on, lock in the essentials. ${lesson.keyTakeaways[0] ?? ''}`,
      EXPLAINER_NARRATION_MAX,
    ),
    visual: {
      kind: 'timeline',
      caption: 'Key takeaways',
      items: lesson.keyTakeaways.slice(0, 4).map((takeaway) => ({
        label: clamp(takeaway, EXPLAINER_LABEL_MAX),
        icon: 'check-circle' as const,
        accent: 'emerald' as const,
      })),
    },
  });

  const board = sanitizeStoryboard(
    {
      title:
        focus === 'real-world'
          ? `Real-world story: ${lesson.realWorld.title}`
          : `Visual story: ${lesson.title}`,
      scenes,
    },
    lesson.id,
    'static',
  );
  // The curriculum guarantees enough content for a valid static board.
  if (!board) throw new Error(`Static storyboard invalid for lesson ${lesson.id}`);
  return board;
}

@Injectable()
export class LearningExplainerService {
  private readonly logger = new Logger(LearningExplainerService.name);
  private readonly cache = new Map<string, { board: ExplainerStoryboard; expires: number }>();

  constructor(private readonly nvidia: NvidiaService) {}

  async getStoryboard(input: LearningExplainerRequest): Promise<ExplainerStoryboard> {
    const location = getLesson(input.lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    const focus: ExplainerFocus = input.focus ?? 'lesson';
    const cacheKey = `${input.lessonId}|${focus}|${input.question ?? ''}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.board;
    }

    let board: ExplainerStoryboard | null = null;
    try {
      board = await this.generateWithAi(location, focus, input.question);
    } catch (error) {
      this.logger.warn(
        `AI explainer generation failed for ${input.lessonId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!board) {
      board = buildStaticStoryboard(location, focus);
    }

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(cacheKey, { board, expires: Date.now() + CACHE_TTL_MS });
    return board;
  }

  private async generateWithAi(
    location: LessonLocation,
    focus: ExplainerFocus,
    question?: string,
  ): Promise<ExplainerStoryboard | null> {
    const { path, module, lesson } = location;

    const subject = question
      ? `the learner's question: "${question}" (answer it within the context of this lesson)`
      : focus === 'real-world'
        ? `the real-world case study: ${lesson.realWorld.title}. Scenario: ${lesson.realWorld.scenario} Solution: ${lesson.realWorld.solution} Outcome: ${lesson.realWorld.outcome}`
        : `the lesson as a whole`;

    const systemPrompt =
      'You are a Salesforce training video director. You script short animated explainers. You output ONLY valid JSON — no prose, no markdown fences.';
    const userPrompt = [
      `Script an animated visual explainer for a Salesforce training lesson.`,
      `Path: ${path.title} (${path.level}) · Module: ${module.title}`,
      `Lesson: ${lesson.title} — ${lesson.summary}`,
      `Section headings: ${lesson.sections.map((section) => section.heading).join(' | ')}`,
      `Key takeaways: ${lesson.keyTakeaways.join(' | ')}`,
      `Explain ${subject}.`,
      '',
      'Output a JSON object exactly shaped like:',
      '{"title":"...","scenes":[{"title":"...","narration":"...","visual":{"kind":"flow","caption":"...","items":[{"label":"...","sublabel":"...","icon":"cloud","accent":"sky","side":"left"}]}}]}',
      '',
      'Rules:',
      '- 4 to 6 scenes telling one coherent story: hook → concept → real-world walk-through → outcome/recap.',
      '- narration: 2-3 conversational teaching sentences (max 450 characters) — it will be SPOKEN aloud, so write for the ear.',
      '- visual.kind must be one of: flow (process arrows), compare (two sides; give each item "side":"left"|"right"), stack (layers), timeline (ordered steps), callout (single big idea), grid (related concepts).',
      '- 1-6 items per visual. label max 40 chars, sublabel max 60 chars.',
      `- icon must be one of: ${EXPLAINER_ICONS.join(', ')}.`,
      '- accent must be one of: sky, emerald, violet, amber, red, slate.',
      '- Prefer concrete business entities (Lead, Account, Case, ERP, Data Loader…) as items over abstract words.',
    ].join('\n');

    const result = await this.nvidia.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 2200,
      temperature: 0.5,
      timeoutMs: EXPLAINER_TIMEOUT_MS,
      skipModelFallback: true,
    });

    if (result.model === 'dev-mock' || result.model === 'error') return null;
    const parsed = extractJsonObject(result.content);
    if (!parsed) return null;
    return sanitizeStoryboard(parsed, lesson.id, 'ai');
  }
}
