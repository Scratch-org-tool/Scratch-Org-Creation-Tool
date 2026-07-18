import {
  LEARNING_CATEGORY_LABELS,
  LEARNING_CATEGORY_TAGLINES,
  LEARNING_LEVEL_LABELS,
  LEARNING_RESOURCE_SOURCE_LABELS,
} from '@sfcc/shared';
import type { LearningCategory, LearningLevel, LearningResourceLink } from './types';

export { LEARNING_LEVEL_LABELS, LEARNING_CATEGORY_LABELS, LEARNING_CATEGORY_TAGLINES };

export interface CategoryTheme {
  /** Accent hex used for the discipline header rule. */
  accent: string;
  /** Soft icon container classes. */
  iconWrap: string;
}

/** Per-discipline accents so grouped sections read as distinct tracks. */
export const CATEGORY_THEMES: Record<LearningCategory, CategoryTheme> = {
  salesforce: { accent: '#38bdf8', iconWrap: 'bg-sky-500/15 text-sky-300' },
  javascript: { accent: '#facc15', iconWrap: 'bg-yellow-500/15 text-yellow-300' },
  java: { accent: '#fb923c', iconWrap: 'bg-orange-500/15 text-orange-300' },
  devops: { accent: '#a78bfa', iconWrap: 'bg-violet-500/15 text-violet-300' },
};

export function categoryLabel(category: LearningCategory): string {
  return LEARNING_CATEGORY_LABELS[category];
}

export function categoryTagline(category: LearningCategory): string {
  return LEARNING_CATEGORY_TAGLINES[category];
}

export interface LevelTheme {
  /** Chip classes for the level badge. */
  badge: string;
  /** Accent hex used for rings/gradients/decorations. */
  accent: string;
  /** Progress bar fill classes. */
  bar: string;
  /** Soft icon container classes. */
  iconWrap: string;
}

export const LEVEL_THEMES: Record<LearningLevel, LevelTheme> = {
  beginner: {
    badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
    accent: '#34d399',
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-300',
    iconWrap: 'bg-emerald-500/15 text-emerald-300',
  },
  intermediate: {
    badge: 'bg-sky-500/15 text-sky-300 border border-sky-400/30',
    accent: '#38bdf8',
    bar: 'bg-gradient-to-r from-sky-500 to-cyan-300',
    iconWrap: 'bg-sky-500/15 text-sky-300',
  },
  advanced: {
    badge: 'bg-violet-500/15 text-violet-300 border border-violet-400/30',
    accent: '#a78bfa',
    bar: 'bg-gradient-to-r from-violet-500 to-fuchsia-400',
    iconWrap: 'bg-violet-500/15 text-violet-300',
  },
  expert: {
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-400/30',
    accent: '#fbbf24',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-400',
    iconWrap: 'bg-amber-500/15 text-amber-300',
  },
};

export function levelLabel(level: LearningLevel): string {
  return LEARNING_LEVEL_LABELS[level];
}

export function resourceSourceLabel(source: LearningResourceLink['source']): string {
  return LEARNING_RESOURCE_SOURCE_LABELS[source];
}

export const RESOURCE_SOURCE_BADGES: Record<LearningResourceLink['source'], string> = {
  trailhead: 'bg-sky-500/15 text-sky-300',
  developer: 'bg-violet-500/15 text-violet-300',
  help: 'bg-emerald-500/15 text-emerald-300',
  architect: 'bg-amber-500/15 text-amber-300',
  other: 'bg-secondary/60 text-muted-foreground',
};

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'No activity yet';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Split a lesson section body into paragraphs and `- ` bullet groups. */
export type BodyBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] };

export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const raw of body.split(/\n\s*\n/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split('\n').map((line) => line.trim());
    if (lines.every((line) => line.startsWith('- '))) {
      blocks.push({ kind: 'bullets', items: lines.map((line) => line.slice(2)) });
    } else {
      blocks.push({ kind: 'paragraph', text: chunk });
    }
  }
  return blocks;
}
