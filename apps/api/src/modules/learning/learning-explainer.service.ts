import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EXPLAINER_ICONS,
  EXPLAINER_LABEL_MAX,
  EXPLAINER_NARRATION_MAX,
  sanitizeStoryboard,
  type ExplainerAccent,
  type ExplainerFocus,
  type ExplainerIcon,
  type ExplainerMediaCapabilities,
  type ExplainerScene,
  type ExplainerStoryboard,
  type LearningExplainerImageRequest,
  type LearningExplainerRequest,
  type LearningExplainerSpeechRequest,
  type LearningExplainerVideoRequest,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import {
  OpenSourceMediaService,
  type GeneratedMedia,
} from '../../integrations/media/open-source-media.service';
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

/** Stable, deterministic seed so every lesson's fallback story looks different. */
export function hashString(value: string): number {
  let hash = 5381;
  for (const char of value) {
    hash = ((hash << 5) + hash + char.codePointAt(0)!) >>> 0;
  }
  return hash;
}

/** Topic keyword → whitelisted icon, so fallback diagrams reflect the concept. */
const TOPIC_ICONS: Array<[RegExp, ExplainerIcon]> = [
  [/report|dashboard|analytic|chart|metric/i, 'bar-chart'],
  [/deploy|release|devops|ci\/cd|change set|version control/i, 'rocket'],
  [/securit|profile|permission|owd|role hierarch|access control/i, 'shield'],
  [/sharing/i, 'share-2'],
  [/flow|automat|process builder|approval/i, 'workflow'],
  [/apex|trigger|lwc|lightning web|code|develop|javascript|method/i, 'code'],
  [/soql|sosl|query|search index/i, 'search'],
  [/api|integration|middleware|webhook|rest|soap|event-driven/i, 'link'],
  [/identity|login|sso|oauth|authenticat/i, 'key'],
  [/governor|limit|bulkif|async|batch|queueable|performance|large data|scale/i, 'zap'],
  [/sandbox|scratch org|environment|org strateg/i, 'boxes'],
  [/architect|design pattern|layer|framework/i, 'layers'],
  [/data model|object|field|record|schema|database|import|export|loader/i, 'database'],
  [/multi-tenant|tenant|cloud|platform/i, 'cloud'],
  [/email|notification|alert/i, 'mail'],
  [/mobile/i, 'smartphone'],
  [/lead|opportunit|forecast|quote|sales process/i, 'target'],
  [/case|service|support|escalat/i, 'life-buoy'],
  [/test|assert|coverage|quality/i, 'check-circle'],
  [/user|team|collaborat|chatter|adoption/i, 'users'],
  [/price|billing|invoice|revenue|quote/i, 'dollar-sign'],
  [/account|customer|crm|contact|company/i, 'briefcase'],
  [/calendar|schedule|event/i, 'calendar'],
  [/report type|dashboard/i, 'pie-chart'],
];

export function iconForTopic(text: string, fallback: ExplainerIcon): ExplainerIcon {
  for (const [pattern, icon] of TOPIC_ICONS) {
    if (pattern.test(text)) return icon;
  }
  return fallback;
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

  // Per-lesson deterministic variety: without AI or media servers, stories for
  // different concepts must still LOOK different (icons from the topic,
  // rotated accent palette), not like one shared template.
  const palette: ExplainerAccent[] = ['sky', 'violet', 'emerald', 'amber'];
  const seed = hashString(lesson.id);
  const accentAt = (index: number): ExplainerAccent => palette[(seed + index) % palette.length]!;
  const topicIcon = iconForTopic(`${lesson.title} ${lesson.summary}`, 'lightbulb');

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
          {
            label: clamp(lesson.realWorld.title, EXPLAINER_LABEL_MAX),
            icon: iconForTopic(lesson.realWorld.title, 'briefcase'),
            accent: accentAt(0),
          },
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
          { label: 'Concept', sublabel: lesson.title, icon: topicIcon, accent: accentAt(1) },
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
      ? `You asked, "${question}" Here is the answer in one line: ${lesson.summary}`
      : `Here is the idea in one line: ${lesson.summary}`;

    // Teach through the lesson's own real-world case, so a learner can catch
    // the concept just by listening — even without any AI configured.
    scenes.push({
      title: question ? 'Catch the answer' : 'Step into the story',
      narration: clamp(
        `${questionLead} Now picture the story behind it: ${lesson.realWorld.scenario}`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'curious',
      visualDescription: conceptArt(
        `A cinematic establishing moment inside this real workplace story: ${clamp(lesson.realWorld.scenario, 220)}`,
      ),
      visual: {
        kind: 'callout',
        caption: question ? 'The answer in one picture' : 'A real story to hold on to',
        items: [
          { label: clamp(lesson.title, EXPLAINER_LABEL_MAX), icon: topicIcon, accent: accentAt(0) },
        ],
      },
    });

    const relevantBullets = bulletItems(relevant.body);
    scenes.push({
      title: 'Build the mental model',
      narration: clamp(
        `Inside that story, here is the idea at work. ${firstParagraph(relevant.body)} Focus on how the parts relate; that relationship is the concept.`,
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
                icon: iconForTopic(bullet, index === 0 ? 'lightbulb' : 'workflow'),
                accent: accentAt(index),
              }))
            : [
                {
                  label: clamp(relevant.heading, EXPLAINER_LABEL_MAX),
                  icon: iconForTopic(relevant.heading, 'layers'),
                  accent: accentAt(1),
                },
                {
                  label: clamp(lesson.keyTakeaways[0] ?? lesson.summary, EXPLAINER_LABEL_MAX),
                  icon: iconForTopic(lesson.keyTakeaways[0] ?? lesson.summary, 'link'),
                  accent: accentAt(2),
                },
              ],
      },
    });

    scenes.push({
      title: 'Watch it work in the story',
      narration: clamp(
        `Back in the story, watch the idea earn its keep: ${lesson.realWorld.solution} That is ${lesson.title} working — the same cause-and-effect you will reuse everywhere.`,
        EXPLAINER_NARRATION_MAX,
      ),
      delivery: 'energetic',
      visualDescription: conceptArt(
        `The turning point of the story, where the concept visibly fixes the problem: ${clamp(lesson.realWorld.solution, 220)}`,
      ),
      visual: {
        kind: 'flow',
        caption: 'Cause → platform behavior → effect',
        items: [
          { label: 'Input', sublabel: 'What starts it', icon: 'zap', accent: accentAt(3) },
          {
            label: clamp(lesson.title, EXPLAINER_LABEL_MAX),
            sublabel: 'What Salesforce does',
            icon: iconForTopic(supporting.heading, topicIcon),
            accent: accentAt(1),
          },
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
      focus === 'real-world'
        ? `Now compress the story into one thought: ${lesson.keyTakeaways[0] ?? lesson.summary} If you can picture the journey you just saw, you already have the concept.`
        : `And the payoff? ${lesson.realWorld.outcome} Now compress it all into one thought: ${lesson.keyTakeaways[0] ?? lesson.summary}`,
      EXPLAINER_NARRATION_MAX,
    ),
    delivery: 'clear',
    visualDescription: conceptArt(
      `A memorable closing composition that unifies the key idea and resolves the visual journey for ${lesson.title}.`,
    ),
    visual: {
      kind: 'timeline',
      caption: 'The memory path',
      items: lesson.keyTakeaways.slice(0, 4).map((takeaway, index) => ({
        label: clamp(takeaway, EXPLAINER_LABEL_MAX),
        icon: index === 0 ? topicIcon : iconForTopic(takeaway, 'check-circle'),
        accent: accentAt(index),
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
  private readonly videoCache = new Map<string, { media: GeneratedMedia; expires: number }>();
  private readonly imageInFlight = new Map<string, Promise<GeneratedMedia | null>>();
  private readonly speechInFlight = new Map<string, Promise<GeneratedMedia | null>>();
  private readonly videoInFlight = new Map<string, Promise<GeneratedMedia | null>>();

  constructor(
    private readonly nvidia: NvidiaService,
    private readonly media: OpenSourceMediaService,
  ) {}

  async getStoryboard(input: LearningExplainerRequest): Promise<ExplainerStoryboard> {
    const location = getLesson(input.lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    const focus: ExplainerFocus = input.focus ?? 'lesson';
    const cacheKey = this.requestCacheKey(input);

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      // Media health must reflect NOW, not the moment the story was cached —
      // otherwise starting/stopping a media server appears to do nothing for
      // six hours.
      cached.board.media = await this.currentMediaCapabilities();
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
    board.media = await this.currentMediaCapabilities();

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(cacheKey, { board, expires: Date.now() + CACHE_TTL_MS });
    return board;
  }

  /** Capabilities from live (60s-cached) provider probes, plus the reason per tier. */
  private async currentMediaCapabilities(): Promise<ExplainerMediaCapabilities> {
    const status = await this.media.getMediaStatus();
    return {
      generatedVideo: this.media.isVideoConfigured(),
      generatedImages: this.media.isImageConfigured(),
      generatedSpeech: this.media.isSpeechConfigured(),
      status,
    };
  }

  async getSceneImage(input: LearningExplainerImageRequest): Promise<GeneratedMedia | null> {
    if (!this.media.isImageConfigured()) return null;
    const scene = await this.resolveScene(input, input.sceneId);
    const cacheKey = `${this.requestCacheKey(input)}|${scene.id}|image`;
    const { stillPrompt, negativePrompt } = this.buildScenePrompts(scene, input.focus);
    return this.getCachedMedia(
      cacheKey,
      this.imageCache,
      this.imageInFlight,
      () => this.media.generateImage(stillPrompt, negativePrompt),
    );
  }

  async getSceneVideo(input: LearningExplainerVideoRequest): Promise<GeneratedMedia | null> {
    if (!this.media.isVideoConfigured()) return null;
    const scene = await this.resolveScene(input, input.sceneId);
    const cacheKey = `${this.requestCacheKey(input)}|${scene.id}|video`;
    const { motionPrompt, negativePrompt } = this.buildScenePrompts(scene, input.focus);
    return this.getCachedMedia(cacheKey, this.videoCache, this.videoInFlight, async () => {
      // Image-to-video backends (Wan 2.2) animate the scene still, which also
      // keeps the clip visually consistent with the image fallback tier.
      const baseImage = this.media.isImageConfigured()
        ? await this.getSceneImage(input)
        : null;
      return this.media.generateVideo(motionPrompt, negativePrompt, baseImage);
    });
  }

  async getSceneSpeech(input: LearningExplainerSpeechRequest): Promise<GeneratedMedia | null> {
    if (!this.media.isSpeechConfigured()) return null;
    const scene = await this.resolveScene(input, input.sceneId);
    const cacheKey = `${this.requestCacheKey(input)}|${scene.id}|speech|${input.voice}|${input.delivery ?? scene.delivery}`;
    return this.getCachedMedia(
      cacheKey,
      this.speechCache,
      this.speechInFlight,
      () =>
        this.media.generateSpeech(
          scene.narration,
          input.voice,
          input.delivery ?? scene.delivery,
        ),
    );
  }

  private async resolveScene(
    input: LearningExplainerRequest,
    sceneId: string,
  ): Promise<ExplainerScene> {
    const board = await this.getStoryboard(input);
    const scene = board.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) throw new NotFoundException('Explainer scene not found');
    return scene;
  }

  /**
   * Diffusion prompts composed server-side from the trusted storyboard —
   * descriptor-style (best for SD/FLUX/LTX) rather than instruction-style,
   * with a shared negative prompt that bans text, logos, and fake UI.
   */
  private buildScenePrompts(
    scene: ExplainerScene,
    focus?: ExplainerFocus,
  ): { stillPrompt: string; motionPrompt: string; negativePrompt: string } {
    const style =
      'premium editorial 3D illustration, cinematic lighting, deep navy environment with luminous sky-blue and violet accents, subtle isometric depth, clean composition, single clear focal point, enterprise learning film still, highly detailed, 16:9';
    const subject = [
      scene.visualDescription,
      focus === 'real-world'
        ? 'professional people in a believable modern workplace'
        : 'a memorable conceptual visual metaphor, no generic office meeting',
    ].join(', ');
    const negativePrompt =
      'text, words, letters, captions, subtitles, watermark, logo, signature, user interface, screenshot, charts with labels, low quality, blurry, deformed, extra limbs, gibberish writing';
    return {
      stillPrompt: `${subject}, ${style}`,
      motionPrompt: `${subject}, slow cinematic camera push-in, gentle flowing motion, smooth coherent movement, ${style}`,
      negativePrompt,
    };
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
      '- Write 5 coherent scenes: story hook → the idea inside the story → the idea working (cause and effect) → the boundary or misconception → payoff and one-thought recap.',
      '- Anchor the WHOLE film in ONE vivid real-world storyline: in scene 1, name a person, their role, and their company (e.g. "Priya, sales ops at a solar installer"), and stay inside that same storyline in every scene.',
      '- Teach the concept THROUGH the story, not next to it: each scene shows what the character faces, what the platform does about it, and why it matters. A listener must genuinely understand the topic after ONE listen, with their eyes closed.',
      question
        ? '- Answer the learner’s actual question in the FIRST spoken sentence, then continue the storyline to make the reasoning stick.'
        : '- Reveal the concept through the storyline instead of listing the lesson sections.',
      focus === 'real-world'
        ? '- Use the supplied case study as the storyline: make its problem, turning point, and consequence concrete and personal.'
        : '- Invent a believable, specific storyline that fits the grounding content (real job titles, real business stakes — never "a company" in the abstract).',
      '- narration: 2–4 short conversational sentences, max 480 characters. Write for listening: contractions, natural emphasis, varied rhythm, and a clear causal thread.',
      '- Never read bullet points aloud, enumerate lesson headings, or sound like a slide deck.',
      '- Never read slide labels, copy a curriculum paragraph, say “as you can see”, announce “in this scene”, or say “in this scene we will learn”. The voice must add meaning the visual alone cannot.',
      '- Each scene teaches exactly one insight and flows naturally into the next. Use concrete nouns and active verbs.',
      '- delivery must be one of curious, clear, energetic, reflective and should fit the scene.',
      '- visualDescription: 1–3 detailed sentences directing a memorable cinematic image of THIS story moment (the place, the character, the objects at stake) while embodying the concept. Premium navy/sky/violet visual world; no written text, logos, or fake Salesforce UI.',
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
