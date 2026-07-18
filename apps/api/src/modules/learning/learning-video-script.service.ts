import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  sanitizeVideoScript,
  VIDEO_NARRATION_MAX,
  VIDEO_SEGMENT_KINDS,
  type LessonVideoScript,
  type VideoScriptLessonMeta,
} from '@sfcc/shared';
import { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import { extractJsonObject } from './learning-explainer.service';
import { getLesson, type LessonLocation } from './curriculum';

const SCRIPT_TIMEOUT_MS =
  parseInt(process.env.LEARNING_VIDEO_SCRIPT_TIMEOUT_MS ?? '45000', 10) || 45_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;

function clamp(text: string, max: number): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.replace(/^- /gm, '').replace(/\n/g, ' ').trim())
    .filter((chunk) => chunk.length > 0);
}

const ACTION_VERBS =
  /\b(open|click|create|add|configure|set|enable|assign|choose|select|navigate|go to|run|deploy|install|define|build|drag|save|test|schedule|map|import|export|query|write|use setup|check)\b/i;

function sentencesOf(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 15);
}

/**
 * The curriculum teaches hands-on work in prose, not bullet lists — so demo
 * steps are distilled from the most action-dense paragraph of a section:
 * every sentence with a do-this verb becomes one numbered screen-capture step.
 */
function demoStepsOf(body: string): string[] {
  let best: string[] = [];
  for (const paragraph of paragraphsOf(body)) {
    const sentences = sentencesOf(paragraph);
    const actionable = sentences.filter((sentence) => ACTION_VERBS.test(sentence));
    if (actionable.length > best.length) best = actionable;
  }
  return best.length >= 2 ? best.slice(0, 8) : [];
}

function metaOf(location: LessonLocation): VideoScriptLessonMeta {
  return {
    lessonId: location.lesson.id,
    lessonTitle: location.lesson.title,
    moduleTitle: location.module.title,
    pathTitle: location.path.title,
    level: location.path.level,
  };
}

/**
 * Deterministic end-to-end video script assembled from the curriculum itself:
 * cold open (objectives), one teaching segment per section (bullet lists
 * become numbered screen-capture steps), the real-world story, a recap, and
 * the quiz call-to-action. Always available for every lesson.
 */
export function buildStaticVideoScript(location: LessonLocation): LessonVideoScript {
  const { lesson, module: mod, path } = location;
  const segments: Array<Record<string, unknown>> = [];

  segments.push({
    kind: 'intro',
    title: `Why ${lesson.title} matters`,
    narration: clamp(
      `Welcome to your ${path.title} video session on ${lesson.title}. ${lesson.summary} ` +
        `In the next few minutes you will ${lesson.objectives
          .slice(0, 3)
          .map((objective) => objective.replace(/^[A-Z]/, (c) => c.toLowerCase()))
          .join('; ')}. Stay to the end — we finish inside a real company that lived this exact problem.`,
      VIDEO_NARRATION_MAX,
    ),
    onScreen:
      'Title card with the lesson name over a premium navy/violet animated backdrop; three objective chips slide in one by one.',
    lowerThird: clamp(`${path.title} · ${mod.title}`, 80),
  });

  lesson.sections.forEach((section) => {
    const paragraphs = paragraphsOf(section.body);
    const demoSteps = demoStepsOf(section.body);
    const looksHandsOn = demoSteps.length >= 2;
    segments.push({
      kind: looksHandsOn ? 'demo' : 'concept',
      title: section.heading,
      narration: clamp(
        looksHandsOn
          ? `Now let's actually do it. ${paragraphs[0] ?? section.heading} Follow along on screen — every click is shown in order, and pause any time you need.`
          : `${paragraphs.slice(0, 2).join(' ')}`,
        VIDEO_NARRATION_MAX,
      ),
      onScreen: looksHandsOn
        ? 'Full-screen Salesforce screen capture following the numbered steps, cursor highlighted, each completed step ticked in an overlay checklist.'
        : `Animated explainer diagram for “${section.heading}”: the key entities appear and connect as the narration names them.`,
      ...(looksHandsOn ? { demoSteps } : {}),
      ...(section.code
        ? {
            lowerThird: clamp(`Code: ${section.code.caption ?? section.code.language}`, 80),
          }
        : {}),
    });
    if (section.code) {
      segments.push({
        kind: 'demo',
        title: `Code walk-through — ${section.heading}`,
        narration: clamp(
          `Here is the same idea in code. ${section.code.caption ?? ''} Read it top to bottom as I narrate: notice what each line contributes, then re-type it yourself rather than copy-pasting — that is what makes it stick.`,
          VIDEO_NARRATION_MAX,
        ),
        onScreen:
          'Editor view; the code snippet types itself line by line, with the line under discussion highlighted.',
        lowerThird: clamp(section.code.language.toUpperCase(), 80),
      });
    }
  });

  segments.push({
    kind: 'story',
    title: `Real story: ${lesson.realWorld.title}`,
    narration: clamp(
      `Let me prove this matters with a true-to-life case. ${lesson.realWorld.scenario} Here is what they did: ${lesson.realWorld.solution} And the payoff: ${lesson.realWorld.outcome}`,
      VIDEO_NARRATION_MAX,
    ),
    onScreen:
      'Cinematic story sequence in three beats — the struggling team, the fix being applied, the calm after — matching the narration timing.',
    lowerThird: clamp(lesson.realWorld.title, 80),
  });

  segments.push({
    kind: 'recap',
    title: 'Lock it in',
    narration: clamp(
      `Before you go, say these back to yourself: ${lesson.keyTakeaways.join('. ')}.`,
      VIDEO_NARRATION_MAX,
    ),
    onScreen: 'Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.',
  });

  segments.push({
    kind: 'cta',
    title: 'Your next step',
    narration: clamp(
      `You now know ${lesson.title} end to end — the idea, the clicks, and the real-world payoff. Head back to the ${mod.title} module, take the quiz to make it count, and I will meet you in the next session.`,
      VIDEO_NARRATION_MAX,
    ),
    onScreen: 'Progress ring animates toward complete; the quiz button glows as the outro music swells.',
  });

  const script = sanitizeVideoScript({ segments }, metaOf(location), 'static');
  // The curriculum guarantees enough content for a valid script.
  if (!script) throw new Error(`Static video script invalid for lesson ${location.lesson.id}`);
  return script;
}

@Injectable()
export class LearningVideoScriptService {
  private readonly logger = new Logger(LearningVideoScriptService.name);
  private readonly cache = new Map<string, { script: LessonVideoScript; expires: number }>();

  constructor(private readonly nvidia: NvidiaService) {}

  async getScript(lessonId: string): Promise<LessonVideoScript> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');

    const cached = this.cache.get(lessonId);
    if (cached && cached.expires > Date.now()) return cached.script;

    let script: LessonVideoScript | null = null;
    try {
      script = await this.generateWithAi(location);
    } catch (error) {
      this.logger.warn(
        `AI video script failed for ${lessonId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!script) script = buildStaticVideoScript(location);

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(lessonId, { script, expires: Date.now() + CACHE_TTL_MS });
    return script;
  }

  private async generateWithAi(location: LessonLocation): Promise<LessonVideoScript | null> {
    const { lesson, module: mod, path } = location;
    const grounding = lesson.sections
      .map(
        (section) =>
          `${section.heading}: ${section.body}${section.code ? `\nCODE (${section.code.language}): ${section.code.snippet}` : ''}`,
      )
      .join('\n\n');

    const systemPrompt = [
      'You are a director-writer of professional Salesforce training videos.',
      'You write complete production scripts a video team can shoot without asking questions.',
      'Accuracy first: never invent Salesforce UI, limits, or behavior beyond the grounding.',
      'Output ONLY valid JSON — no prose and no markdown fences.',
    ].join(' ');

    const userPrompt = [
      `Write the COMPLETE end-to-end video session script for this Salesforce lesson.`,
      `Path: ${path.title} (${path.level}) · Module: ${mod.title}`,
      `Lesson: ${lesson.title} — ${lesson.summary}`,
      `Objectives: ${lesson.objectives.join(' | ')}`,
      `Grounding content:\n${clamp(grounding, 9000)}`,
      `Real-world case: ${lesson.realWorld.title}. ${lesson.realWorld.scenario} ${lesson.realWorld.solution} ${lesson.realWorld.outcome}`,
      `Key takeaways: ${lesson.keyTakeaways.join(' | ')}`,
      '',
      'Output a JSON object exactly shaped like:',
      '{"audience":"...","segments":[{"kind":"intro","title":"...","narration":"...","onScreen":"...","lowerThird":"...","demoSteps":["..."]}]}',
      '',
      'Script rules:',
      `- kind must be one of: ${VIDEO_SEGMENT_KINDS.join(', ')}.`,
      '- 7 to 12 segments covering the lesson END TO END: a cold-open hook, every major concept, at least one hands-on "demo" segment with exact numbered click-paths (Setup → … , what to type, what to verify) whenever the grounding describes something you can build/execute, the real-world story, a recap, and a closing cta.',
      '- Anchor the whole video in ONE continuous storyline with a named person, role, and company introduced in the intro — the viewer should understand the topic fully just by listening once.',
      '- narration: word-for-word voice-over, 3–6 conversational sentences per segment (max 950 characters). No stage directions inside narration.',
      '- onScreen: 1–3 sentences telling the editor exactly what to show (animation, b-roll, or screen capture) while that narration plays.',
      '- demoSteps: only for demo segments — numbered, concrete, executable steps grounded in the content. Never invent menus that are not implied by the grounding.',
      '- lowerThird: optional short caption (max 70 chars).',
      '- Language: clear, warm, confident; contractions welcome; no filler like "in this video".',
    ].join('\n');

    const result = await this.nvidia.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 3800,
      temperature: 0.6,
      timeoutMs: SCRIPT_TIMEOUT_MS,
    });

    if (result.model === 'dev-mock' || result.model === 'error') return null;
    const parsed = extractJsonObject(result.content);
    if (!parsed) return null;
    return sanitizeVideoScript(parsed, metaOf(location), 'ai');
  }
}
