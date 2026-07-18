import { z } from 'zod';

/**
 * Video Session contracts: a production-ready, end-to-end video script for
 * one Academy lesson. Scripts are written AI-first and sanitized here; a
 * deterministic curriculum-derived script is the guaranteed fallback, so
 * every Salesforce topic always has a complete video session.
 */

export const VIDEO_SEGMENT_KINDS = [
  'intro',
  'concept',
  'demo',
  'story',
  'recap',
  'cta',
] as const;
export type VideoSegmentKind = (typeof VIDEO_SEGMENT_KINDS)[number];

export const VIDEO_SEGMENT_KIND_LABELS: Record<VideoSegmentKind, string> = {
  intro: 'Cold open',
  concept: 'Teach the concept',
  demo: 'Hands-on demo',
  story: 'Real-world story',
  recap: 'Recap',
  cta: 'Next step',
};

export const VIDEO_MIN_SEGMENTS = 5;
export const VIDEO_MAX_SEGMENTS = 14;
export const VIDEO_NARRATION_MAX = 1_000;
export const VIDEO_ON_SCREEN_MAX = 500;
export const VIDEO_TITLE_MAX = 90;
export const VIDEO_LOWER_THIRD_MAX = 80;
export const VIDEO_MAX_DEMO_STEPS = 10;
export const VIDEO_DEMO_STEP_MAX = 200;

export interface VideoScriptSegment {
  id: string;
  kind: VideoSegmentKind;
  title: string;
  /** Word-for-word narration, written for the ear. */
  narration: string;
  /** What the video shows while the narration plays (animation / b-roll / screen capture). */
  onScreen: string;
  /** Optional caption strip for the bottom of the frame. */
  lowerThird?: string;
  /** Numbered click-path steps for screen-capture demo segments. */
  demoSteps?: string[];
  /** Estimated seconds for this segment (derived from narration + steps). */
  durationSeconds: number;
}

export interface LessonVideoScript {
  id: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  pathTitle: string;
  level: string;
  /** 'ai' when scripted by the LLM, 'static' when derived from lesson content. */
  source: 'ai' | 'static';
  audience: string;
  totalDurationSeconds: number;
  segments: VideoScriptSegment[];
}

export interface VideoScriptLessonMeta {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  pathTitle: string;
  level: string;
}

export const learningVideoScriptRequestSchema = z.object({
  lessonId: z.string().min(1).max(120),
});
export type LearningVideoScriptRequest = z.infer<typeof learningVideoScriptRequestSchema>;

/* ------------------------------------------------------------------ */
/* Sanitizing (LLM output → guaranteed-renderable script)              */
/* ------------------------------------------------------------------ */

const KIND_SET = new Set<string>(VIDEO_SEGMENT_KINDS);

function clampText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** ~150 spoken words per minute, plus a beat for each demo step. */
export function estimateSegmentSeconds(narration: string, demoSteps: number): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  return Math.max(12, Math.round((words / 150) * 60) + demoSteps * 4);
}

function sanitizeSegment(raw: unknown, index: number): VideoScriptSegment | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const narration = clampText(obj.narration, VIDEO_NARRATION_MAX);
  if (narration.length < 40) return null;
  const kind =
    typeof obj.kind === 'string' && KIND_SET.has(obj.kind.trim().toLowerCase())
      ? (obj.kind.trim().toLowerCase() as VideoSegmentKind)
      : 'concept';
  const onScreen =
    clampText(obj.onScreen, VIDEO_ON_SCREEN_MAX) ||
    'Animated concept visual matching the narration, premium navy and violet learning-film style.';
  const demoSteps = Array.isArray(obj.demoSteps)
    ? obj.demoSteps
        .map((step) => clampText(step, VIDEO_DEMO_STEP_MAX))
        .filter((step) => step.length > 0)
        .slice(0, VIDEO_MAX_DEMO_STEPS)
    : [];
  const lowerThird = clampText(obj.lowerThird, VIDEO_LOWER_THIRD_MAX);
  const segment: VideoScriptSegment = {
    id: `segment-${index + 1}`,
    kind,
    title: clampText(obj.title, VIDEO_TITLE_MAX) || `Part ${index + 1}`,
    narration,
    onScreen,
    durationSeconds: estimateSegmentSeconds(narration, demoSteps.length),
  };
  if (lowerThird) segment.lowerThird = lowerThird;
  if (demoSteps.length > 0) segment.demoSteps = demoSteps;
  return segment;
}

/**
 * Validate and normalize a raw (LLM-produced) script. Returns null when fewer
 * than VIDEO_MIN_SEGMENTS survive — callers then use the static script.
 */
export function sanitizeVideoScript(
  raw: unknown,
  meta: VideoScriptLessonMeta,
  source: 'ai' | 'static',
): LessonVideoScript | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];
  const segments = rawSegments
    .map((segment, index) => sanitizeSegment(segment, index))
    .filter((segment): segment is VideoScriptSegment => segment !== null)
    .slice(0, VIDEO_MAX_SEGMENTS);
  if (segments.length < VIDEO_MIN_SEGMENTS) return null;
  segments.forEach((segment, index) => {
    segment.id = `segment-${index + 1}`;
  });
  return {
    id: `${meta.lessonId}-video-${source}`,
    lessonId: meta.lessonId,
    lessonTitle: meta.lessonTitle,
    moduleTitle: meta.moduleTitle,
    pathTitle: meta.pathTitle,
    level: meta.level,
    source,
    audience:
      clampText(obj.audience, 120) ||
      `${meta.level} learners on the ${meta.pathTitle} path`,
    totalDurationSeconds: segments.reduce((sum, segment) => sum + segment.durationSeconds, 0),
    segments,
  };
}

/* ------------------------------------------------------------------ */
/* Exports for external video tools                                    */
/* ------------------------------------------------------------------ */

export function formatTimecode(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Full production script (segments, timecodes, directions, steps) as Markdown. */
export function videoScriptToMarkdown(script: LessonVideoScript): string {
  const lines: string[] = [
    `# Video session — ${script.lessonTitle}`,
    '',
    `- Path: ${script.pathTitle} (${script.level}) · Module: ${script.moduleTitle}`,
    `- Audience: ${script.audience}`,
    `- Target length: ~${Math.max(1, Math.round(script.totalDurationSeconds / 60))} min · ${script.segments.length} segments`,
    '',
  ];
  let elapsed = 0;
  for (const segment of script.segments) {
    lines.push(
      `## ${formatTimecode(elapsed)} · ${VIDEO_SEGMENT_KIND_LABELS[segment.kind]} — ${segment.title}`,
      '',
      `**Narration (voice-over):** ${segment.narration}`,
      '',
      `**On screen:** ${segment.onScreen}`,
    );
    if (segment.lowerThird) lines.push('', `**Lower third:** ${segment.lowerThird}`);
    if (segment.demoSteps?.length) {
      lines.push('', '**Screen-capture steps:**');
      segment.demoSteps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    }
    lines.push('');
    elapsed += segment.durationSeconds;
  }
  return lines.join('\n');
}

/** Narration only — paste straight into TTS / avatar video tools. */
export function videoScriptToNarration(script: LessonVideoScript): string {
  return script.segments.map((segment) => segment.narration).join('\n\n');
}
