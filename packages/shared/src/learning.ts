import { z } from 'zod';
import { canAccessModule, type AppModule, type UserRole } from './auth.js';

/**
 * Shared contracts for the Salesforce Academy learning module: curriculum
 * metadata shapes, per-user progress views, quiz session/result contracts,
 * assignment management, and the admin team-progress report.
 *
 * Curriculum CONTENT lives server-side (apps/api learning-curriculum.ts);
 * these types describe what crosses the API boundary. Quiz correct answers
 * never leave the server before an attempt is submitted.
 */

export const LEARNING_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type LearningLevel = (typeof LEARNING_LEVELS)[number];

/* ------------------------------------------------------------------ */
/* Training categories (disciplines) + admin feature access            */
/* ------------------------------------------------------------------ */

/**
 * The Academy spans several disciplines. Every learning path belongs to one
 * category so the catalog can be grouped, and so administrators can grant
 * access one discipline at a time.
 */
export const LEARNING_CATEGORIES = ['salesforce', 'javascript', 'java', 'devops'] as const;
export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];

export const LEARNING_CATEGORY_LABELS: Record<LearningCategory, string> = {
  salesforce: 'Salesforce',
  javascript: 'JavaScript',
  java: 'Java',
  devops: 'Release Management & DevOps',
};

export const LEARNING_CATEGORY_TAGLINES: Record<LearningCategory, string> = {
  salesforce: 'Admin, development, and architecture on the Salesforce Platform.',
  javascript: 'The language of the web — and of Lightning Web Components.',
  java: 'Strongly-typed, object-oriented engineering fundamentals.',
  devops: 'Ship Salesforce changes safely with source control, CI/CD, and governance.',
};

/** Display/sort order used to present the disciplines. */
export const LEARNING_CATEGORY_RANK: Record<LearningCategory, number> = {
  salesforce: 0,
  javascript: 1,
  java: 2,
  devops: 3,
};

/**
 * Academy capabilities that can be granted independently of the training
 * tracks — e.g. a learner may read lessons but not have the AI mentor.
 */
export const LEARNING_CAPABILITIES = ['mentor', 'video', 'quiz'] as const;
export type LearningCapability = (typeof LEARNING_CAPABILITIES)[number];

export const LEARNING_CAPABILITY_LABELS: Record<LearningCapability, string> = {
  mentor: 'AI mentor & story mode',
  video: 'Video sessions',
  quiz: 'Quizzes & certification',
};

export const LEARNING_CAPABILITY_DESCRIPTIONS: Record<LearningCapability, string> = {
  mentor: 'Lesson-grounded AI tutor, chat answers, and animated story explainers.',
  video: 'The Read / Video session switch and end-to-end production scripts.',
  quiz: 'Module quizzes, scoring, retakes, and path completion badges.',
};

/**
 * A single admin-controllable Academy permission. Every feature is either a
 * training track (`category:*`) or an in-app capability (`capability:*`), so a
 * feature the admin has not granted never reaches the learner.
 */
export type LearningFeature =
  | `category:${LearningCategory}`
  | `capability:${LearningCapability}`;

export function categoryFeature(category: LearningCategory): LearningFeature {
  return `category:${category}`;
}

export function capabilityFeature(capability: LearningCapability): LearningFeature {
  return `capability:${capability}`;
}

/** Every grantable Academy feature, tracks first then capabilities. */
export const LEARNING_FEATURES: LearningFeature[] = [
  ...LEARNING_CATEGORIES.map(categoryFeature),
  ...LEARNING_CAPABILITIES.map(capabilityFeature),
];

export function isLearningFeature(value: string): value is LearningFeature {
  return (LEARNING_FEATURES as string[]).includes(value);
}

/**
 * Baseline features implied by holding the `learning` module when an admin has
 * not yet customised access. This preserves the original Salesforce Academy
 * experience (Salesforce track + every capability) while keeping the newer
 * tracks — JavaScript, Java, and Release Management — opt-in, so they stay
 * hidden from a learner until an admin explicitly turns them on.
 */
export const DEFAULT_LEARNING_FEATURES: LearningFeature[] = [
  categoryFeature('salesforce'),
  capabilityFeature('mentor'),
  capabilityFeature('video'),
  capabilityFeature('quiz'),
];

/** Resolved, ready-to-check view of what a learner may see in the Academy. */
export interface LearningFeatureAccess {
  categories: LearningCategory[];
  mentor: boolean;
  video: boolean;
  quiz: boolean;
}

type LearningAccessProfile =
  | (Pick<UserAccessProfileLike, 'role' | 'grantedModules'> & {
      learningFeatures?: string[] | null;
    })
  | null
  | undefined;

/** Minimal profile shape needed to resolve module + feature access. */
interface UserAccessProfileLike {
  role: UserRole;
  grantedModules: AppModule[];
}

/**
 * The set of Academy features a profile may use. Admins get everything; a user
 * without the `learning` module gets nothing; otherwise the explicit grant list
 * wins, falling back to {@link DEFAULT_LEARNING_FEATURES} when never configured.
 */
export function resolveLearningFeatures(profile: LearningAccessProfile): LearningFeature[] {
  if (!profile) return [];
  if (profile.role === 'admin') return [...LEARNING_FEATURES];
  if (!canAccessModule(profile, 'learning')) return [];
  const explicit = (profile.learningFeatures ?? []).filter(isLearningFeature);
  const base = explicit.length > 0 ? explicit : DEFAULT_LEARNING_FEATURES;
  const set = new Set<LearningFeature>(base);
  return LEARNING_FEATURES.filter((feature) => set.has(feature));
}

/** Structured feature access (categories + capability booleans) for a profile. */
export function resolveLearningFeatureAccess(profile: LearningAccessProfile): LearningFeatureAccess {
  const set = new Set(resolveLearningFeatures(profile));
  return {
    categories: LEARNING_CATEGORIES.filter((category) => set.has(categoryFeature(category))),
    mentor: set.has(capabilityFeature('mentor')),
    video: set.has(capabilityFeature('video')),
    quiz: set.has(capabilityFeature('quiz')),
  };
}

export function hasLearningCategory(
  access: LearningFeatureAccess,
  category: LearningCategory,
): boolean {
  return access.categories.includes(category);
}

export function hasLearningCapability(
  access: LearningFeatureAccess,
  capability: LearningCapability,
): boolean {
  return access[capability];
}

export const LEARNING_LEVEL_LABELS: Record<LearningLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

/** Sort ranking used to present paths from fresher-friendly to architect level. */
export const LEARNING_LEVEL_RANK: Record<LearningLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

/** Minimum quiz score (percent) required to complete a module. */
export const LEARNING_QUIZ_PASS_PERCENT = 70;
/** Number of questions served per module quiz. */
export const LEARNING_QUIZ_QUESTION_COUNT = 8;
/** Options per multiple-choice question. */
export const LEARNING_QUIZ_OPTION_COUNT = 4;

export const LEARNING_RESOURCE_SOURCES = [
  'trailhead',
  'developer',
  'help',
  'architect',
  'other',
] as const;
export type LearningResourceSource = (typeof LEARNING_RESOURCE_SOURCES)[number];

export const LEARNING_RESOURCE_SOURCE_LABELS: Record<LearningResourceSource, string> = {
  trailhead: 'Trailhead',
  developer: 'Salesforce Developers',
  help: 'Salesforce Help',
  architect: 'Salesforce Architects',
  other: 'Resource',
};

export interface LearningResourceLink {
  title: string;
  url: string;
  source: LearningResourceSource;
  /** Short hint shown next to the link, e.g. "Trailhead module · 1 hr". */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Lesson content                                                      */
/* ------------------------------------------------------------------ */

export interface LearningLessonCodeSample {
  language: string;
  snippet: string;
  caption?: string;
}

export interface LearningLessonSection {
  heading: string;
  /** Plain-text paragraphs separated by blank lines; supports `- ` bullets. */
  body: string;
  code?: LearningLessonCodeSample;
}

export interface LearningRealWorldExample {
  title: string;
  scenario: string;
  solution: string;
  outcome: string;
}

export interface LearningLessonContent {
  id: string;
  moduleId: string;
  pathId: string;
  title: string;
  summary: string;
  durationMinutes: number;
  objectives: string[];
  sections: LearningLessonSection[];
  realWorld: LearningRealWorldExample;
  keyTakeaways: string[];
  resources: LearningResourceLink[];
}

/* ------------------------------------------------------------------ */
/* Catalog metadata + per-user progress overlays                       */
/* ------------------------------------------------------------------ */

export interface LearningLessonMeta {
  id: string;
  title: string;
  summary: string;
  durationMinutes: number;
  completed: boolean;
  completedAt: string | null;
}

export interface LearningModuleQuizState {
  questionCount: number;
  passPercent: number;
  attemptCount: number;
  bestScorePercent: number | null;
  passed: boolean;
  lastAttemptAt: string | null;
}

export interface LearningModuleMeta {
  id: string;
  pathId: string;
  title: string;
  summary: string;
  durationMinutes: number;
  lessons: LearningLessonMeta[];
  quiz: LearningModuleQuizState;
  completed: boolean;
  progressPercent: number;
}

export type LearningAssignmentStatus = 'active' | 'revoked';

export interface LearningAssignmentView {
  id: string;
  userId: string;
  pathId: string;
  assignedBy: string;
  assignedByName: string | null;
  note: string | null;
  dueAt: string | null;
  status: LearningAssignmentStatus;
  createdAt: string;
}

export interface LearningPathSummary {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: LearningCategory;
  level: LearningLevel;
  /** Certificate-style badge awarded on completion, e.g. "Foundations Badge". */
  badge: string;
  estimatedHours: number;
  skills: string[];
  moduleCount: number;
  lessonCount: number;
  modules: LearningModuleMeta[];
  progressPercent: number;
  completed: boolean;
  assignment: LearningAssignmentView | null;
}

export interface LearningStats {
  lessonsCompleted: number;
  totalLessons: number;
  modulesCompleted: number;
  totalModules: number;
  pathsCompleted: number;
  totalPaths: number;
  quizzesPassed: number;
  quizAttempts: number;
  averageScorePercent: number | null;
}

export interface LearningContinueTarget {
  pathId: string;
  pathTitle: string;
  moduleId: string;
  moduleTitle: string;
  /** Null when the next step is the module quiz rather than a lesson. */
  lessonId: string | null;
  lessonTitle: string | null;
  /** 'lesson' → open lesson; 'quiz' → open the module quiz. */
  kind: 'lesson' | 'quiz';
}

export interface LearningCatalogResponse {
  paths: LearningPathSummary[];
  stats: LearningStats;
  continueTarget: LearningContinueTarget | null;
  /** Which tracks + capabilities the current learner is allowed to use. */
  features: LearningFeatureAccess;
}

export interface LearningLessonResponse {
  lesson: LearningLessonContent;
  pathId: string;
  pathTitle: string;
  category: LearningCategory;
  moduleId: string;
  moduleTitle: string;
  completed: boolean;
  completedAt: string | null;
  previousLessonId: string | null;
  nextLessonId: string | null;
  /** True when this is the module's final lesson — the quiz comes next. */
  quizNext: boolean;
  /** Capability grants that gate the mentor panel, video session, and quiz. */
  features: LearningFeatureAccess;
}

/* ------------------------------------------------------------------ */
/* Quiz session + result                                               */
/* ------------------------------------------------------------------ */

export type LearningQuizSource = 'ai' | 'static' | 'mixed';

/** Question as served to the learner — correctIndex intentionally absent. */
export interface LearningQuizQuestionView {
  id: string;
  prompt: string;
  options: string[];
  topic: string | null;
}

export interface LearningQuizAttemptView {
  id: string;
  moduleId: string;
  moduleTitle: string;
  pathId: string;
  status: 'in_progress' | 'completed';
  source: LearningQuizSource;
  questions: LearningQuizQuestionView[];
  questionCount: number;
  passPercent: number;
  startedAt: string;
}

export interface LearningQuizAnswerReview {
  questionId: string;
  prompt: string;
  options: string[];
  topic: string | null;
  selectedIndex: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

export interface LearningQuizResult {
  attemptId: string;
  moduleId: string;
  pathId: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  passPercent: number;
  review: LearningQuizAnswerReview[];
  moduleCompleted: boolean;
  pathCompleted: boolean;
  /** Short AI-style coaching summary of strengths/gaps. */
  coaching: string;
  completedAt: string;
}

export interface LearningQuizAttemptSummary {
  id: string;
  moduleId: string;
  pathId: string;
  scorePercent: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  source: LearningQuizSource;
  completedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* AI mentor (interactive session)                                     */
/* ------------------------------------------------------------------ */

export interface LearningTutorReply {
  answer: string;
  model: string;
  suggestions: string[];
}

/* ------------------------------------------------------------------ */
/* Admin: team progress + assignments                                  */
/* ------------------------------------------------------------------ */

export interface LearningAdminPathProgress {
  pathId: string;
  title: string;
  level: LearningLevel;
  assigned: boolean;
  assignmentId: string | null;
  dueAt: string | null;
  progressPercent: number;
  completed: boolean;
  lessonsCompleted: number;
  lessonCount: number;
  modulesCompleted: number;
  moduleCount: number;
  averageScorePercent: number | null;
}

export interface LearningAdminLearnerRow {
  userId: string;
  email: string;
  displayName: string;
  hasLearningAccess: boolean;
  lessonsCompleted: number;
  modulesCompleted: number;
  quizzesPassed: number;
  quizAttempts: number;
  averageScorePercent: number | null;
  lastActivityAt: string | null;
  activeAssignments: number;
  completedAssignments: number;
  paths: LearningAdminPathProgress[];
}

export interface LearningAdminOverview {
  learners: LearningAdminLearnerRow[];
  totals: {
    learners: number;
    activeLearners: number;
    activeAssignments: number;
    completedAssignments: number;
    averageScorePercent: number | null;
    quizzesPassed: number;
    lessonsCompleted: number;
  };
}

export interface LearningAssignmentResult {
  created: LearningAssignmentView[];
  skippedExisting: number;
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

export const learningQuizSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(120),
        selectedIndex: z.number().int().min(0).max(9).nullable(),
      }),
    )
    .min(1)
    .max(50),
});
export type LearningQuizSubmitInput = z.infer<typeof learningQuizSubmitSchema>;

export const learningTutorAskSchema = z.object({
  question: z.string().min(1).max(2000),
  lessonId: z.string().max(120).optional(),
  moduleId: z.string().max(120).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(6000),
      }),
    )
    .max(12)
    .optional(),
});
export type LearningTutorAskInput = z.infer<typeof learningTutorAskSchema>;

export const learningAssignmentCreateSchema = z.object({
  userIds: z.array(z.string().min(1).max(120)).min(1).max(200),
  pathIds: z.array(z.string().min(1).max(120)).min(1).max(20),
  note: z.string().max(500).optional(),
  dueAt: z
    .string()
    .datetime({ offset: true })
    .optional(),
});
export type LearningAssignmentCreateInput = z.infer<typeof learningAssignmentCreateSchema>;

/* ------------------------------------------------------------------ */
/* Progress math helpers (single source of truth for both apps)        */
/* ------------------------------------------------------------------ */

export function calculateQuizScorePercent(correctCount: number, totalQuestions: number): number {
  if (!Number.isFinite(correctCount) || !Number.isFinite(totalQuestions) || totalQuestions <= 0) {
    return 0;
  }
  const bounded = Math.max(0, Math.min(correctCount, totalQuestions));
  return Math.round((bounded / totalQuestions) * 100);
}

export function isQuizPassed(
  scorePercent: number,
  passPercent: number = LEARNING_QUIZ_PASS_PERCENT,
): boolean {
  return scorePercent >= passPercent;
}

/**
 * A module counts every lesson plus its quiz as one completion unit each, so
 * a 4-lesson module is complete at 5/5 units (all lessons read + quiz passed).
 */
export function moduleProgressPercent(
  lessonsCompleted: number,
  lessonCount: number,
  quizPassed: boolean,
): number {
  const totalUnits = Math.max(1, lessonCount + 1);
  const doneUnits = Math.max(0, Math.min(lessonsCompleted, lessonCount)) + (quizPassed ? 1 : 0);
  return Math.round((doneUnits / totalUnits) * 100);
}

export function isModuleCompleted(
  lessonsCompleted: number,
  lessonCount: number,
  quizPassed: boolean,
): boolean {
  return quizPassed && lessonsCompleted >= lessonCount;
}

export interface ModuleProgressUnits {
  lessonsCompleted: number;
  lessonCount: number;
  quizPassed: boolean;
}

export function pathProgressPercent(modules: ModuleProgressUnits[]): number {
  let done = 0;
  let total = 0;
  for (const m of modules) {
    total += m.lessonCount + 1;
    done += Math.max(0, Math.min(m.lessonsCompleted, m.lessonCount)) + (m.quizPassed ? 1 : 0);
  }
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export function isPathCompleted(modules: ModuleProgressUnits[]): boolean {
  if (modules.length === 0) return false;
  return modules.every((m) => isModuleCompleted(m.lessonsCompleted, m.lessonCount, m.quizPassed));
}

export function averagePercent(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}

/** Human label for a quiz outcome chip. */
export function quizStatusLabel(state: LearningModuleQuizState): string {
  if (state.passed) return `Passed · ${state.bestScorePercent}%`;
  if (state.attemptCount > 0) return `Best ${state.bestScorePercent ?? 0}% · retry`;
  return 'Not attempted';
}
