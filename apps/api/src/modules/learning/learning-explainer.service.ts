import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EXPLAINER_ICONS,
  EXPLAINER_LABEL_MAX,
  EXPLAINER_NARRATION_MAX,
  sanitizeStoryboard,
  type ExplainerFocus,
  type ExplainerScene,
  type ExplainerStoryboard,
  type LearningExplainerImageRequest,
  type LearningExplainerRequest,
  type LearningExplainerSpeechRequest,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import {
  GoogleGenerativeMediaService,
  type GeneratedMedia,
} from '../../integrations/google/google-generative-media.service';
import { getLesson, type LessonLocation } from './curriculum';

/** Keep AI attempts short — Next.js proxy times out around 30s; we fall back to static curriculum. */
const EXPLAINER_TIMEOUT_MS =
  parseInt(process.env.LEARNING_EXPLAINER_TIMEOUT_MS ?? '8000', 10) || 8_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const MEDIA_CACHE_MAX_ENTRIES = 500;

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

function searchableWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4),
  );
}

function mostRelevantSection(location: LessonLocation, question?: string) {
  if (!question) return location.lesson.sections[0]!;
  const words = searchableWords(question);
  return [...location.lesson.sections].sort((left, right) => {
    const score = (value: string) =>
      [...searchableWords(value)].filter((word) => words.has(word)).length;
    return score(`${right.heading} ${right.body}`) - score(`${left.heading} ${left.body}`);
  })[0]!;
}

function conceptArt(description: string): string {
  return [
    description,
    'Use a memorable visual metaphor, strong depth, a single focal point, and a clear visual journey.',
    'Do not place paragraphs, labels, logos, or software screenshots inside the image.',
  ].join(' ');
}

/**
 * Deterministic storyboard derived from curriculum content. Always available
 * (no AI dependency) and used both as the fallback and in tests as the
 * guaranteed baseline for every lesson.
 */
export function buildStaticStoryboard(
  location: LessonLocation,
  focus: ExplainerFocus,
  question?: string,
): ExplainerStoryboard {
  const { lesson } = location;
  const scenes: Array<Omit<ExplainerScene, 'id'>> = [];

  if (focus === 'real-world') {
    scenes.push({
      title: 'Meet the challenge',
      narration: `Step into ${lesson.realWorld.title}. Listen for the tension in this situation, because the Salesforce idea in this lesson is the move that resolves it.`,
      delivery: 'curious',
      visualDescription: conceptArt(
        `A cinematic establishing scene for ${lesson.realWorld.title}, moments before a difficult business process begins to fail.`,
      ),
      visual: {
        kind: 'callout',
        caption: 'The challenge begins',
        items: [
          { label: clamp(lesson.realWorld.title, EXPLAINER_LABEL_MAX), icon: 'briefcase', accent: 'sky' },
        ],
      },
    });
    scenes.push({
      title: 'Feel the friction',
      narration: clamp(
        `Here is what the team experiences. ${lesson.realWorld.scenario} Keep that bottleneck in mind; it is the reason the design matters.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'reflective',
      visualDescription: conceptArt(
        `Show the process bottleneck in this scenario: ${lesson.realWorld.scenario}`,
      ),
      visual: {
        kind: 'callout',
        caption: 'What was going wrong',
        items: [{ label: 'The problem', icon: 'alert-triangle', accent: 'amber' }],
      },
    });
    scenes.push({
      title: 'Watch the turning point',
      narration: clamp(
        `Now watch the turning point. ${lesson.realWorld.solution} Notice how the concept changes the flow, not just one isolated task.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'energetic',
      visualDescription: conceptArt(
        `A satisfying transformation from the broken process to this Salesforce-centered solution: ${lesson.realWorld.solution}`,
      ),
      visual: {
        kind: 'flow',
        caption: 'The idea changes the flow',
        items: [
          { label: 'Friction', sublabel: 'See the constraint', icon: 'search', accent: 'amber' },
          { label: 'Concept', sublabel: lesson.title, icon: 'lightbulb', accent: 'violet' },
          { label: 'New flow', sublabel: 'Apply with intent', icon: 'workflow', accent: 'emerald' },
        ],
      },
    });
    scenes.push({
      title: 'See what changed',
      narration: clamp(
        `The result is more than a cleaner screen. ${lesson.realWorld.outcome} That outcome is the evidence that the team understood the concept.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'clear',
      visualDescription: conceptArt(
        `A confident final scene that makes this improved outcome visible: ${lesson.realWorld.outcome}`,
      ),
      visual: {
        kind: 'callout',
        caption: 'What changed',
        items: [{ label: 'The outcome', icon: 'trophy', accent: 'emerald' }],
      },
    });
  } else {
    const relevant = mostRelevantSection(location, question);
    const supporting =
      lesson.sections.find((section) => section.heading !== relevant.heading) ?? relevant;
    const questionLead = question
      ? `You asked, "${question}" Here is the idea to catch: ${lesson.summary}`
      : `Start with one idea: ${lesson.summary}`;

    scenes.push({
      title: question ? 'Catch the answer' : 'Open the idea',
      narration: clamp(
        `${questionLead} Do not memorize the words yet; first, build the picture in your mind.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'curious',
      visualDescription: conceptArt(
        `An intriguing opening visual metaphor for this Salesforce concept: ${lesson.summary}`,
      ),
      visual: {
        kind: 'callout',
        caption: question ? 'The answer in one picture' : 'The central idea',
        items: [{ label: clamp(lesson.title, EXPLAINER_LABEL_MAX), icon: 'graduation-cap', accent: 'sky' }],
      },
    });

    const relevantBullets = bulletItems(relevant.body);
    scenes.push({
      title: 'Build the mental model',
      narration: clamp(
        `${firstParagraph(relevant.body)} Focus on the relationship between the parts; that relationship is what makes the concept useful.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'clear',
      visualDescription: conceptArt(
        `Reveal the moving parts and their relationship for ${relevant.heading}: ${firstParagraph(relevant.body)}`,
      ),
      visual: {
        kind: relevantBullets.length >= 2 ? 'flow' : 'stack',
        caption: relevant.heading,
        items:
          relevantBullets.length >= 2
            ? relevantBullets.slice(0, 5).map((bullet, index) => ({
                label: clamp(bullet, EXPLAINER_LABEL_MAX),
                icon: index === 0 ? ('lightbulb' as const) : ('workflow' as const),
                accent: index === 0 ? ('violet' as const) : ('sky' as const),
              }))
            : [
                { label: clamp(relevant.heading, EXPLAINER_LABEL_MAX), icon: 'layers', accent: 'violet' },
                {
                  label: clamp(lesson.keyTakeaways[0] ?? lesson.summary, EXPLAINER_LABEL_MAX),
                  icon: 'link',
                  accent: 'sky',
                },
              ],
      },
    });

    scenes.push({
      title: 'Watch cause become effect',
      narration: clamp(
        `${firstParagraph(supporting.body)} Ask yourself what changes downstream when this part changes. That cause-and-effect chain is the practical logic to remember.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'energetic',
      visualDescription: conceptArt(
        `A left-to-right cause-and-effect transformation for ${supporting.heading}: ${firstParagraph(supporting.body)}`,
      ),
      visual: {
        kind: 'flow',
        caption: 'Cause → platform behavior → effect',
        items: [
          { label: 'Input', sublabel: 'What starts it', icon: 'zap', accent: 'amber' },
          { label: clamp(lesson.title, EXPLAINER_LABEL_MAX), sublabel: 'What Salesforce does', icon: 'cloud', accent: 'violet' },
          { label: 'Effect', sublabel: 'What the user sees', icon: 'eye', accent: 'emerald' },
        ],
      },
    });

    scenes.push({
      title: 'Draw the boundary',
      narration: clamp(
        `One last distinction prevents confusion: ${lesson.keyTakeaways[1] ?? lesson.keyTakeaways[0] ?? lesson.summary} Knowing that boundary helps you choose correctly instead of applying the idea everywhere.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'reflective',
      visualDescription: conceptArt(
        `A clean split composition showing when the concept applies and where its boundary lies for ${lesson.title}.`,
      ),
      visual: {
        kind: 'compare',
        caption: 'Use the distinction',
        items: [
          { label: 'Use it here', sublabel: clamp(relevant.heading, 72), icon: 'check-circle', accent: 'emerald', side: 'left' },
          { label: 'Pause here', sublabel: 'Check the boundary first', icon: 'alert-triangle', accent: 'amber', side: 'right' },
        ],
      },
    });
  }

  scenes.push({
    title: 'Lock it in',
    narration: clamp(
      `Now compress the story into one thought: ${lesson.keyTakeaways[0] ?? lesson.summary} If you can picture the journey you just saw, you already have the concept.`,
      EXPLAINER_NARRATION_MAX,
    ),
    delivery: 'clear',
    visualDescription: conceptArt(
      `A memorable closing composition that unifies the key idea and resolves the visual journey for ${lesson.title}.`,
    ),
    visual: {
      kind: 'timeline',
      caption: 'The memory path',
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
        question
          ? `Visual answer: ${clamp(question, 64)}`
          : focus === 'real-world'
          ? `Real-world story: ${lesson.realWorld.title}`
          : `Concept story: ${lesson.title}`,
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
  private readonly imageCache = new Map<string, { media: GeneratedMedia; expires: number }>();
  private readonly speechCache = new Map<string, { media: GeneratedMedia; expires: number }>();
  private readonly imageInFlight = new Map<string, Promise<GeneratedMedia | null>>();
  private readonly speechInFlight = new Map<string, Promise<GeneratedMedia | null>>();

  constructor(
    private readonly nvidia: NvidiaService,
    private readonly googleMedia: GoogleGenerativeMediaService,
  ) {}

  async getStoryboard(input: LearningExplainerRequest): Promise<ExplainerStoryboard> {
    const location = getLesson(input.lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    const focus: ExplainerFocus = input.focus ?? 'lesson';
    const cacheKey = this.requestCacheKey(input);

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
      board = buildStaticStoryboard(location, focus, input.question);
    }
    board.media = {
      generatedImages: this.googleMedia.isImageConfigured(),
      generatedSpeech: this.googleMedia.isSpeechConfigured(),
    };

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(cacheKey, { board, expires: Date.now() + CACHE_TTL_MS });
    return board;
  }

  async getSceneImage(input: LearningExplainerImageRequest): Promise<GeneratedMedia | null> {
    if (!this.googleMedia.isImageConfigured()) return null;
    const board = await this.getStoryboard(input);
    const scene = board.scenes.find((candidate) => candidate.id === input.sceneId);
    if (!scene) throw new NotFoundException('Explainer scene not found');
    const location = getLesson(input.lessonId)!;
    const cacheKey = `${this.requestCacheKey(input)}|${scene.id}|image`;
    const labels = scene.visual.items
      .map((item) => `${item.label}${item.sublabel ? ` (${item.sublabel})` : ''}`)
      .join(', ');
    const prompt = [
      'Create one premium 16:9 cinematic educational illustration for an adult Salesforce learner.',
      'Art direction: polished editorial 3D illustration, subtle isometric depth, deep navy environment, luminous sky-blue and violet accents, realistic materials, clean composition, sophisticated enterprise learning-film quality.',
      `Lesson: ${location.lesson.title}. Story: ${board.title}.`,
      `Scene ${scene.id.replace('scene-', '')} of ${board.scenes.length}: ${scene.title}.`,
      `Precise visual direction: ${scene.visualDescription}`,
      `Concept anchors to represent visually: ${labels}.`,
      `Meaning the narrator must communicate: ${scene.narration}`,
      input.focus === 'real-world'
        ? 'Human characters and a recognizable workplace are welcome when they make this case easier to understand.'
        : 'Prefer a memorable visual metaphor or conceptual world over a generic office meeting.',
      'Keep the main subject centered with safe space near the bottom for app overlays.',
      'Do not render words, captions, logos, Salesforce trademarks, fake software screens, watermarks, or decorative gibberish. Do not make factual claims beyond the supplied concept.',
      'Return only the image.',
    ].join('\n');
    return this.getCachedMedia(
      cacheKey,
      this.imageCache,
      this.imageInFlight,
      () => this.googleMedia.generateImage(prompt),
    );
  }

  async getSceneSpeech(input: LearningExplainerSpeechRequest): Promise<GeneratedMedia | null> {
    if (!this.googleMedia.isSpeechConfigured()) return null;
    const board = await this.getStoryboard(input);
    const scene = board.scenes.find((candidate) => candidate.id === input.sceneId);
    if (!scene) throw new NotFoundException('Explainer scene not found');
    const cacheKey = `${this.requestCacheKey(input)}|${scene.id}|speech|${input.voice}`;
    return this.getCachedMedia(
      cacheKey,
      this.speechCache,
      this.speechInFlight,
      () => this.googleMedia.generateSpeech(scene.narration, input.voice, scene.delivery),
    );
  }

  private requestCacheKey(input: LearningExplainerRequest): string {
    const question = input.question?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
    return `${input.lessonId}|${input.focus ?? 'lesson'}|${question}`;
  }

  private async getCachedMedia(
    key: string,
    cache: Map<string, { media: GeneratedMedia; expires: number }>,
    inFlight: Map<string, Promise<GeneratedMedia | null>>,
    create: () => Promise<GeneratedMedia | null>,
  ): Promise<GeneratedMedia | null> {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.media;
    const pending = inFlight.get(key);
    if (pending) return pending;

    const operation = create()
      .then((media) => {
        if (media) {
          if (cache.size >= MEDIA_CACHE_MAX_ENTRIES) {
            const oldest = cache.keys().next().value;
            if (oldest) cache.delete(oldest);
          }
          cache.set(key, { media, expires: Date.now() + CACHE_TTL_MS });
        }
        return media;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, operation);
    return operation;
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

    const sectionContent = lesson.sections
      .map((section) => `${section.heading}: ${section.body}`)
      .join('\n\n');
    const systemPrompt = [
      'You are an elite Salesforce instructional storyteller and learning-film director.',
      'Turn difficult platform concepts into a mental movie a beginner can understand after one listen.',
      'Accuracy matters more than drama. Never invent Salesforce behavior.',
      'Output ONLY valid JSON — no prose and no markdown fences.',
    ].join(' ');
    const userPrompt = [
      'Direct a short narrated concept film for this Salesforce lesson.',
      `Path: ${path.title} (${path.level}) · Module: ${module.title}`,
      `Lesson: ${lesson.title} — ${lesson.summary}`,
      `Grounding content:\n${clamp(sectionContent, 7000)}`,
      `Key takeaways: ${lesson.keyTakeaways.join(' | ')}`,
      `Explain ${subject}.`,
      '',
      'Output a JSON object exactly shaped like:',
      '{"title":"...","scenes":[{"title":"...","narration":"...","delivery":"curious","visualDescription":"...","visual":{"kind":"flow","caption":"...","items":[{"label":"...","sublabel":"...","icon":"cloud","accent":"sky","side":"left"}]}}]}',
      '',
      'Story rules:',
      '- Write 5 coherent scenes: curiosity hook → mental model → cause and effect → important boundary or misconception → memorable compression.',
      question
        ? '- Answer the learner’s actual question in the FIRST spoken sentence, then make the reasoning intuitive.'
        : '- Reveal the concept instead of listing the lesson sections.',
      focus === 'real-world'
        ? '- This is explicitly a case story: make the supplied problem, turning point, and consequence concrete.'
        : '- This is a concept story. Do NOT force a generic company or workplace example. Use an analogy only when it sharpens the mental model.',
      '- narration: 2–4 short conversational sentences, max 480 characters. Write for listening: contractions, natural emphasis, varied rhythm, and a clear causal thread.',
      '- Never read slide labels, copy a curriculum paragraph, say “as you can see”, or announce “in this scene”. The voice must add meaning the visual alone cannot.',
      '- Each scene teaches exactly one insight and flows naturally into the next. Use concrete nouns and active verbs.',
      '- delivery must be one of curious, clear, energetic, reflective and should fit the scene.',
      '- visualDescription: 1–3 detailed sentences directing a memorable cinematic image. It must embody the idea, maintain a premium navy/sky/violet visual world, and contain no written text, logos, or fake Salesforce UI.',
      '- visual.kind must be one of: flow (process arrows), compare (two sides; give each item "side":"left"|"right"), stack (layers), timeline (ordered steps), callout (single big idea), grid (related concepts).',
      '- 1-6 items per visual. label max 40 chars, sublabel max 60 chars.',
      `- icon must be one of: ${EXPLAINER_ICONS.join(', ')}.`,
      '- accent must be one of: sky, emerald, violet, amber, red, slate.',
      '- Use exact Salesforce entities (Lead, Account, Case, governor limit, transaction, Flow, Apex…) only when supported by the grounding content.',
    ].join('\n');

    const result = await this.nvidia.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 3400,
      temperature: 0.65,
      timeoutMs: EXPLAINER_TIMEOUT_MS,
      skipModelFallback: true,
    });

    if (result.model === 'dev-mock' || result.model === 'error') return null;
    const parsed = extractJsonObject(result.content);
    if (!parsed) return null;
    return sanitizeStoryboard(parsed, lesson.id, 'ai');
  }
}
