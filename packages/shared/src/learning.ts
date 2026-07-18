import { z } from 'zod';

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

/**
 * Catalog groupings. `salesforce` is the core platform curriculum,
 * `programming` covers language tracks (JavaScript, Java, …), and
 * `delivery` covers release management / DevOps process tracks.
 */
export const LEARNING_PATH_CATEGORIES = ['salesforce', 'programming', 'delivery'] as const;
export type LearningPathCategory = (typeof LEARNING_PATH_CATEGORIES)[number];

export const LEARNING_PATH_CATEGORY_LABELS: Record<LearningPathCategory, string> = {
  salesforce: 'Salesforce core curriculum',
  programming: 'Programming & platform skills',
  delivery: 'Delivery & release management',
};

export const LEARNING_PATH_CATEGORY_DESCRIPTIONS: Record<LearningPathCategory, string> = {
  salesforce: 'The guided platform journey — from first login to architect.',
  programming: 'Language foundations that make you dangerous in code reviews and LWC work.',
  delivery: 'Ship changes safely: branching, pipelines, releases, and post-release care.',
};

/** Sort ranking used to present catalog groups in a stable order. */
export const LEARNING_PATH_CATEGORY_RANK: Record<LearningPathCategory, number> = {
  salesforce: 0,
  programming: 1,
  delivery: 2,
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
  level: LearningLevel;
  category: LearningPathCategory;
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
  /**
   * True when an administrator restricted this user to assigned paths only —
   * the catalog then contains just those paths and the UI explains why.
   */
  assignedOnly: boolean;
}

export interface LearningLessonResponse {
  lesson: LearningLessonContent;
  pathId: string;
  pathTitle: string;
  moduleId: string;
  moduleTitle: string;
  completed: boolean;
  completedAt: string | null;
  previousLessonId: string | null;
  nextLessonId: string | null;
  /** True when this is the module's final lesson — the quiz comes next. */
  quizNext: boolean;
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
  category: LearningPathCategory;
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
  /** True when this learner's catalog is restricted to assigned paths. */
  learningAssignedOnly: boolean;
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

/* ------------------------------------------------------------------ */
/* Video sessions (admin-uploaded lesson videos)                       */
/* ------------------------------------------------------------------ */

/** One admin-uploaded video attached to a lesson's Video session block. */
export interface LearningLessonVideoView {
  id: string;
  lessonId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: string;
}

export const LEARNING_VIDEO_TITLE_MAX = 120;

/** MIME types accepted for lesson video uploads. */
export const LEARNING_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
] as const;

export function isAllowedLearningVideoMime(mime: string): boolean {
  return (LEARNING_VIDEO_MIME_TYPES as readonly string[]).includes(mime);
}

export function formatVideoSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}
