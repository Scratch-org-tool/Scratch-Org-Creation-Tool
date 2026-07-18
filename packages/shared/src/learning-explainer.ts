import { z } from 'zod';

/**
 * Visual explainer ("story mode") contracts for the Salesforce Academy AI
 * mentor. The LLM scripts a storyboard — scenes with narration and a diagram
 * spec — which the web app renders as animated graphics with voice narration
 * (browser speech synthesis).
 *
 * Everything an LLM produces is sanitized through `sanitizeStoryboard` before
 * it is served: unknown icons/kinds/accents fall back to safe defaults and all
 * strings are length-clamped, so the renderer never meets malformed input.
 */

export const EXPLAINER_VISUAL_KINDS = [
  'flow',
  'compare',
  'stack',
  'timeline',
  'callout',
  'grid',
] as const;
export type ExplainerVisualKind = (typeof EXPLAINER_VISUAL_KINDS)[number];

export const EXPLAINER_ACCENTS = [
  'sky',
  'emerald',
  'violet',
  'amber',
  'red',
  'slate',
] as const;
export type ExplainerAccent = (typeof EXPLAINER_ACCENTS)[number];

/**
 * Icon vocabulary the LLM may use (subset of lucide icon names, kebab-case).
 * The web maps these to components; unknown names render as `sparkles`.
 */
export const EXPLAINER_ICONS = [
  'cloud',
  'database',
  'users',
  'user',
  'shield',
  'lock',
  'workflow',
  'git-branch',
  'boxes',
  'box',
  'table',
  'file-text',
  'mail',
  'phone',
  'bar-chart',
  'pie-chart',
  'trending-up',
  'rocket',
  'building',
  'briefcase',
  'globe',
  'server',
  'zap',
  'check-circle',
  'x-circle',
  'alert-triangle',
  'dollar-sign',
  'clock',
  'settings',
  'layers',
  'share-2',
  'key',
  'refresh-cw',
  'search',
  'target',
  'trophy',
  'lightbulb',
  'message-square',
  'list-checks',
  'package',
  'truck',
  'shopping-cart',
  'credit-card',
  'heart',
  'star',
  'sparkles',
  'wrench',
  'book-open',
  'graduation-cap',
  'code',
  'terminal',
  'cpu',
  'network',
  'link',
  'filter',
  'eye',
  'bell',
  'calendar',
  'smartphone',
  'life-buoy',
] as const;
export type ExplainerIcon = (typeof EXPLAINER_ICONS)[number];

export const EXPLAINER_MAX_SCENES = 8;
export const EXPLAINER_MIN_SCENES = 3;
export const EXPLAINER_MAX_ITEMS = 6;
export const EXPLAINER_NARRATION_MAX = 520;
export const EXPLAINER_LABEL_MAX = 48;
export const EXPLAINER_SUBLABEL_MAX = 72;

export interface ExplainerVisualItem {
  label: string;
  sublabel?: string;
  icon: ExplainerIcon;
  accent: ExplainerAccent;
  /** Only meaningful for `compare` visuals. */
  side?: 'left' | 'right';
}

export interface ExplainerVisual {
  kind: ExplainerVisualKind;
  /** Short caption rendered under the diagram. */
  caption?: string;
  items: ExplainerVisualItem[];
}

export interface ExplainerScene {
  id: string;
  title: string;
  /** Spoken (and captioned) teaching narration for this scene. */
  narration: string;
  visual: ExplainerVisual;
}

export interface ExplainerStoryboard {
  id: string;
  lessonId: string;
  title: string;
  /** 'ai' when scripted by the LLM, 'static' when derived from lesson content. */
  source: 'ai' | 'static';
  scenes: ExplainerScene[];
}

export const EXPLAINER_FOCUSES = ['lesson', 'real-world'] as const;
export type ExplainerFocus = (typeof EXPLAINER_FOCUSES)[number];

export const learningExplainerRequestSchema = z.object({
  lessonId: z.string().min(1).max(120),
  focus: z.enum(EXPLAINER_FOCUSES).optional(),
  /** Optional learner question to explain visually instead of the default story. */
  question: z.string().min(1).max(500).optional(),
});
export type LearningExplainerRequest = z.infer<typeof learningExplainerRequestSchema>;

/* ------------------------------------------------------------------ */
/* Sanitizing (LLM output → guaranteed-renderable storyboard)          */
/* ------------------------------------------------------------------ */

const ICON_SET = new Set<string>(EXPLAINER_ICONS);
const KIND_SET = new Set<string>(EXPLAINER_VISUAL_KINDS);
const ACCENT_SET = new Set<string>(EXPLAINER_ACCENTS);

function clampText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function sanitizeExplainerIcon(value: unknown): ExplainerIcon {
  if (typeof value === 'string' && ICON_SET.has(value.trim().toLowerCase())) {
    return value.trim().toLowerCase() as ExplainerIcon;
  }
  return 'sparkles';
}

export function sanitizeExplainerAccent(value: unknown, fallback: ExplainerAccent = 'sky'): ExplainerAccent {
  if (typeof value === 'string' && ACCENT_SET.has(value.trim().toLowerCase())) {
    return value.trim().toLowerCase() as ExplainerAccent;
  }
  return fallback;
}

function sanitizeItem(raw: unknown, index: number): ExplainerVisualItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const label = clampText(obj.label, EXPLAINER_LABEL_MAX);
  if (!label) return null;
  const accents: ExplainerAccent[] = ['sky', 'emerald', 'violet', 'amber'];
  const item: ExplainerVisualItem = {
    label,
    icon: sanitizeExplainerIcon(obj.icon),
    accent: sanitizeExplainerAccent(obj.accent, accents[index % accents.length]!),
  };
  const sublabel = clampText(obj.sublabel, EXPLAINER_SUBLABEL_MAX);
  if (sublabel) item.sublabel = sublabel;
  if (obj.side === 'left' || obj.side === 'right') item.side = obj.side;
  return item;
}

function sanitizeVisual(raw: unknown): ExplainerVisual | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const kind =
    typeof obj.kind === 'string' && KIND_SET.has(obj.kind.trim().toLowerCase())
      ? (obj.kind.trim().toLowerCase() as ExplainerVisualKind)
      : 'callout';
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .map((item, index) => sanitizeItem(item, index))
    .filter((item): item is ExplainerVisualItem => item !== null)
    .slice(0, EXPLAINER_MAX_ITEMS);
  if (items.length === 0) return null;

  if (kind === 'compare') {
    // Guarantee both sides exist; alternate unset sides.
    let hasLeft = items.some((item) => item.side === 'left');
    let hasRight = items.some((item) => item.side === 'right');
    items.forEach((item, index) => {
      if (item.side) return;
      if (!hasLeft) {
        item.side = 'left';
        hasLeft = true;
      } else if (!hasRight) {
        item.side = 'right';
        hasRight = true;
      } else {
        item.side = index % 2 === 0 ? 'left' : 'right';
      }
    });
    if (!hasLeft || !hasRight) {
      return { kind: 'grid', caption: clampText(obj.caption, EXPLAINER_SUBLABEL_MAX) || undefined, items };
    }
  }

  const caption = clampText(obj.caption, EXPLAINER_SUBLABEL_MAX);
  return { kind, ...(caption ? { caption } : {}), items };
}

function sanitizeScene(raw: unknown, index: number): ExplainerScene | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const narration = clampText(obj.narration, EXPLAINER_NARRATION_MAX);
  if (narration.length < 20) return null;
  const visual = sanitizeVisual(obj.visual);
  if (!visual) return null;
  return {
    id: `scene-${index + 1}`,
    title: clampText(obj.title, EXPLAINER_LABEL_MAX + 20) || `Step ${index + 1}`,
    narration,
    visual,
  };
}

/**
 * Validate and normalize a raw (LLM-produced) storyboard object. Returns null
 * when fewer than EXPLAINER_MIN_SCENES scenes survive sanitizing — callers
 * should then fall back to the static storyboard.
 */
export function sanitizeStoryboard(
  raw: unknown,
  lessonId: string,
  source: 'ai' | 'static',
): ExplainerStoryboard | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawScenes = Array.isArray(obj.scenes) ? obj.scenes : [];
  const scenes = rawScenes
    .map((scene, index) => sanitizeScene(scene, index))
    .filter((scene): scene is ExplainerScene => scene !== null)
    .slice(0, EXPLAINER_MAX_SCENES);
  if (scenes.length < EXPLAINER_MIN_SCENES) return null;
  // Re-number ids after filtering so they stay sequential and unique.
  scenes.forEach((scene, index) => {
    scene.id = `scene-${index + 1}`;
  });
  return {
    id: `${lessonId}-${source}-${scenes.length}`,
    lessonId,
    title: clampText(obj.title, 90) || 'Visual explainer',
    source,
    scenes,
  };
}

/** Estimated speaking time — used to auto-advance scenes when voice is off. */
export function estimateNarrationMs(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  // ~155 wpm conversational pace, min 4s so short scenes remain readable.
  return Math.max(4000, Math.round((words / 155) * 60_000));
}
