import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  learningLessonProgress: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  learningQuizAttempt: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  learningAssignment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  appUser: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@sfcc/db', () => ({ prisma: db }));

import { CURRICULUM, getLesson, getModule, getPath, totalLessonCount } from './curriculum';
import { LearningService } from './learning.service';
import {
  LearningQuizService,
  buildCoaching,
  extractJsonArray,
  normalizeAiQuestion,
} from './learning-quiz.service';
import { LEARNING_LEVEL_RANK, resolveLearningFeatureAccess } from '@sfcc/shared';
import type { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { NotificationsService } from '../notifications/notifications.service';

const USER = 'DPT_test-user';
/** Full feature access (all tracks + capabilities), as an admin would resolve. */
const ACCESS = resolveLearningFeatureAccess({ role: 'admin', grantedModules: [] });

function emptyState() {
  db.learningLessonProgress.findMany.mockResolvedValue([]);
  db.learningQuizAttempt.findMany.mockResolvedValue([]);
  db.learningAssignment.findMany.mockResolvedValue([]);
  db.appUser.findMany.mockResolvedValue([]);
}

describe('curriculum integrity', () => {
  it('groups paths by discipline, each ordered beginner → expert', () => {
    expect(CURRICULUM.length).toBeGreaterThanOrEqual(8);
    // The first path is the beginner Salesforce foundations track.
    expect(CURRICULUM[0]!.category).toBe('salesforce');
    expect(CURRICULUM[0]!.level).toBe('beginner');

    // Each discipline forms a single contiguous block (no interleaving).
    const categories = CURRICULUM.map((p) => p.category);
    const firstIndex = new Map<string, number>();
    const lastIndex = new Map<string, number>();
    categories.forEach((category, index) => {
      if (!firstIndex.has(category)) firstIndex.set(category, index);
      lastIndex.set(category, index);
    });
    for (const [category, first] of firstIndex) {
      const span = categories.slice(first, lastIndex.get(category)! + 1);
      expect(span.every((c) => c === category)).toBe(true);
    }

    // Within each discipline, levels are non-decreasing.
    for (const category of new Set(categories)) {
      const levels = CURRICULUM.filter((p) => p.category === category).map(
        (p) => LEARNING_LEVEL_RANK[p.level],
      );
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  it('covers every advertised discipline', () => {
    const categories = new Set(CURRICULUM.map((p) => p.category));
    expect(categories.has('salesforce')).toBe(true);
    expect(categories.has('javascript')).toBe(true);
    expect(categories.has('java')).toBe(true);
    expect(categories.has('devops')).toBe(true);
  });

  it('has globally unique lesson and module ids and non-trivial volume', () => {
    const moduleIds = CURRICULUM.flatMap((p) => p.modules.map((m) => m.id));
    const lessonIds = CURRICULUM.flatMap((p) =>
      p.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(moduleIds.length).toBeGreaterThanOrEqual(12);
    expect(lessonIds.length).toBeGreaterThanOrEqual(40);
    expect(totalLessonCount()).toBe(lessonIds.length);
  });

  it('gives every module a quiz bank of at least 8 valid questions', () => {
    for (const path of CURRICULUM) {
      for (const module of path.modules) {
        expect(module.quizBank.length).toBeGreaterThanOrEqual(8);
        for (const q of module.quizBank) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(q.options.length);
          expect(q.explanation.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('gives every lesson objectives, sections, a real-world example, and resource links', () => {
    for (const path of CURRICULUM) {
      for (const module of path.modules) {
        for (const lesson of module.lessons) {
          expect(lesson.objectives.length).toBeGreaterThanOrEqual(2);
          expect(lesson.sections.length).toBeGreaterThanOrEqual(2);
          expect(lesson.keyTakeaways.length).toBeGreaterThanOrEqual(3);
          expect(lesson.resources.length).toBeGreaterThanOrEqual(1);
          expect(lesson.realWorld.scenario.length).toBeGreaterThan(30);
          for (const resource of lesson.resources) {
            expect(resource.url).toMatch(/^https:\/\//);
          }
        }
      }
    }
  });

  it('resolves lookups by id', () => {
    const path = CURRICULUM[0]!;
    const module = path.modules[0]!;
    const lesson = module.lessons[0]!;
    expect(getPath(path.id)?.title).toBe(path.title);
    expect(getModule(module.id)?.module.title).toBe(module.title);
    expect(getLesson(lesson.id)?.lesson.title).toBe(lesson.title);
    expect(getPath('nope')).toBeNull();
    expect(getModule('nope')).toBeNull();
    expect(getLesson('nope')).toBeNull();
  });
});

describe('LearningService catalog + progress', () => {
  let service: LearningService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LearningService();
    emptyState();
  });

  it('returns zeroed progress for a fresh user', async () => {
    const catalog = await service.getCatalog(USER, ACCESS);
    expect(catalog.paths).toHaveLength(CURRICULUM.length);
    expect(catalog.features.categories).toContain('salesforce');
    expect(catalog.stats.lessonsCompleted).toBe(0);
    expect(catalog.stats.averageScorePercent).toBeNull();
    // Fresh users should be pointed at the very first lesson of the beginner path.
    expect(catalog.continueTarget?.pathId).toBe(CURRICULUM[0]!.id);
    expect(catalog.continueTarget?.kind).toBe('lesson');
  });

  it('overlays lesson completions and quiz passes into module progress', async () => {
    const path = CURRICULUM[0]!;
    const module = path.modules[0]!;
    db.learningLessonProgress.findMany.mockResolvedValue(
      module.lessons.map((lesson) => ({
        lessonId: lesson.id,
        completedAt: new Date('2026-07-01T10:00:00Z'),
      })),
    );
    db.learningQuizAttempt.findMany.mockResolvedValue([
      {
        moduleId: module.id,
        scorePercent: 88,
        passed: true,
        completedAt: new Date('2026-07-02T10:00:00Z'),
      },
    ]);

    const catalog = await service.getCatalog(USER, ACCESS);
    const summary = catalog.paths.find((p) => p.id === path.id)!;
    const moduleMeta = summary.modules.find((m) => m.id === module.id)!;

    expect(moduleMeta.completed).toBe(true);
    expect(moduleMeta.progressPercent).toBe(100);
    expect(moduleMeta.quiz.bestScorePercent).toBe(88);
    expect(catalog.stats.quizzesPassed).toBe(1);
    // The continue target must skip the completed module.
    expect(catalog.continueTarget?.moduleId).not.toBe(module.id);
  });

  it('points the continue target at the quiz when all lessons are read but quiz unpassed', async () => {
    const path = CURRICULUM[0]!;
    const module = path.modules[0]!;
    db.learningLessonProgress.findMany.mockResolvedValue(
      module.lessons.map((lesson) => ({
        lessonId: lesson.id,
        completedAt: new Date(),
      })),
    );

    const catalog = await service.getCatalog(USER, ACCESS);
    expect(catalog.continueTarget).toEqual(
      expect.objectContaining({ moduleId: module.id, kind: 'quiz', lessonId: null }),
    );
  });

  it('prioritizes assigned paths in the continue target', async () => {
    const assignedPath = CURRICULUM[2]!;
    db.learningAssignment.findMany.mockResolvedValue([
      {
        id: 'as-1',
        userId: USER,
        pathId: assignedPath.id,
        assignedBy: 'DPT_admin',
        note: null,
        dueAt: null,
        status: 'active',
        createdAt: new Date(),
      },
    ]);
    db.appUser.findMany.mockResolvedValue([{ id: 'DPT_admin', displayName: 'Admin' }]);

    const catalog = await service.getCatalog(USER, ACCESS);
    expect(catalog.continueTarget?.pathId).toBe(assignedPath.id);
    const summary = catalog.paths.find((p) => p.id === assignedPath.id)!;
    expect(summary.assignment?.assignedByName).toBe('Admin');
  });

  it('serves lesson content with prev/next navigation and quizNext on the last lesson', async () => {
    const module = CURRICULUM[0]!.modules[0]!;
    const last = module.lessons[module.lessons.length - 1]!;
    db.learningLessonProgress.findUnique.mockResolvedValue(null);

    const view = await service.getLessonView(USER, last.id, ACCESS);
    expect(view.lesson.sections.length).toBeGreaterThan(0);
    expect(view.nextLessonId).toBeNull();
    expect(view.quizNext).toBe(true);
    expect(view.previousLessonId).toBe(module.lessons[module.lessons.length - 2]!.id);
  });

  it('rejects unknown lessons', async () => {
    await expect(service.getLessonView(USER, 'ghost-lesson', ACCESS)).rejects.toThrow(
      'Lesson not found',
    );
  });

  it('completes lessons idempotently via upsert', async () => {
    const lesson = CURRICULUM[0]!.modules[0]!.lessons[0]!;
    db.learningLessonProgress.upsert.mockResolvedValue({
      completedAt: new Date('2026-07-03T09:00:00Z'),
    });
    emptyState();

    const result = await service.completeLesson(USER, lesson.id, ACCESS);
    expect(result.completed).toBe(true);
    expect(db.learningLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: USER, lessonId: lesson.id } },
      }),
    );
  });
});

describe('LearningService feature gating (admin-controlled access)', () => {
  let service: LearningService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LearningService();
    emptyState();
  });

  const jsOnly = resolveLearningFeatureAccess({
    role: 'user',
    grantedModules: ['learning'],
    learningFeatures: ['category:javascript', 'capability:quiz'],
  });

  it('hides tracks the learner has not been granted', async () => {
    const catalog = await service.getCatalog(USER, jsOnly);
    expect(catalog.paths.length).toBeGreaterThan(0);
    expect(catalog.paths.every((p) => p.category === 'javascript')).toBe(true);
    expect(catalog.features.categories).toEqual(['javascript']);
    // Denominators reflect only the visible tracks.
    expect(catalog.stats.totalPaths).toBe(catalog.paths.length);
  });

  it('forbids opening a lesson from a track the learner cannot access', async () => {
    const sfLesson = CURRICULUM.find((p) => p.category === 'salesforce')!.modules[0]!.lessons[0]!;
    db.learningLessonProgress.findUnique.mockResolvedValue(null);
    await expect(service.getLessonView(USER, sfLesson.id, jsOnly)).rejects.toThrow(/not enabled/);
  });

  it('allows opening a lesson from a granted track and reflects capability flags', async () => {
    const jsLesson = CURRICULUM.find((p) => p.category === 'javascript')!.modules[0]!.lessons[0]!;
    db.learningLessonProgress.findUnique.mockResolvedValue(null);
    const view = await service.getLessonView(USER, jsLesson.id, jsOnly);
    expect(view.category).toBe('javascript');
    expect(view.features.quiz).toBe(true);
    expect(view.features.mentor).toBe(false);
  });
});

describe('quiz generation helpers', () => {
  it('extracts JSON arrays from fenced and noisy LLM output', () => {
    expect(extractJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJsonArray('Here you go: [1,2,3] hope it helps')).toEqual([1, 2, 3]);
    expect(extractJsonArray('no array here')).toBeNull();
    expect(extractJsonArray('[broken')).toBeNull();
  });

  it('normalizes valid AI questions and rejects malformed ones', () => {
    const valid = normalizeAiQuestion(
      {
        topic: 'Apex',
        prompt: 'What does bulkification prevent in Apex triggers?',
        options: ['Slow UI', 'Governor limit breaches', 'Merge conflicts', 'Login failures'],
        correctIndex: 1,
        explanation: 'Bulkified code handles up to 200 records per invocation within limits.',
      },
      0,
    );
    expect(valid?.correctIndex).toBe(1);
    expect(valid?.options).toHaveLength(4);

    expect(normalizeAiQuestion(null, 0)).toBeNull();
    expect(
      normalizeAiQuestion(
        { prompt: 'short?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'x' },
        0,
      ),
    ).toBeNull();
    expect(
      normalizeAiQuestion(
        {
          prompt: 'A question long enough to pass validation?',
          options: ['a', 'b', 'c'],
          correctIndex: 0,
          explanation: 'Three options only, must be rejected.',
        },
        0,
      ),
    ).toBeNull();
    expect(
      normalizeAiQuestion(
        {
          prompt: 'A question long enough to pass validation?',
          options: ['a', 'b', 'c', 'd'],
          correctIndex: 9,
          explanation: 'Out of range correct index must be rejected.',
        },
        0,
      ),
    ).toBeNull();
  });

  it('builds coaching text for perfect, passing, and failing outcomes', () => {
    const reviewMiss = [
      {
        questionId: 'q1',
        prompt: 'p',
        options: [],
        topic: 'Sharing rules',
        selectedIndex: 0,
        correctIndex: 1,
        correct: false,
        explanation: 'e',
      },
    ];
    expect(buildCoaching(100, true, [], 'Security')).toContain('Perfect score');
    expect(buildCoaching(75, true, reviewMiss, 'Security')).toContain('Solid pass');
    expect(buildCoaching(75, true, reviewMiss, 'Security')).toContain('Sharing rules');
    const fail = buildCoaching(38, false, reviewMiss, 'Security');
    expect(fail).toContain('38%');
    expect(fail).toContain('pass mark is 70%');
  });
});

describe('LearningQuizService', () => {
  let quizService: LearningQuizService;
  let learningService: LearningService;
  const nvidia = { chat: vi.fn() };
  const notifications = { notify: vi.fn().mockResolvedValue(null) };

  beforeEach(() => {
    vi.clearAllMocks();
    learningService = new LearningService();
    quizService = new LearningQuizService(
      nvidia as unknown as NvidiaService,
      learningService,
      notifications as unknown as NotificationsService,
    );
    emptyState();
  });

  it('falls back to the static bank when the AI is unavailable', async () => {
    nvidia.chat.mockResolvedValue({ content: 'nope', model: 'dev-mock' });
    const module = CURRICULUM[0]!.modules[0]!;
    db.learningQuizAttempt.findFirst.mockResolvedValue(null);
    db.learningQuizAttempt.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'attempt-1',
        ...data,
        startedAt: new Date(),
      }),
    );

    const attempt = await quizService.startQuiz(USER, module.id, ACCESS);
    expect(attempt.source).toBe('static');
    expect(attempt.questions).toHaveLength(8);
    // Served questions must never leak answers.
    for (const question of attempt.questions) {
      expect(question).not.toHaveProperty('correctIndex');
      expect(question).not.toHaveProperty('explanation');
    }
  });

  it('uses AI questions when the model returns a full valid set', async () => {
    const aiPayload = Array.from({ length: 8 }, (_, i) => ({
      topic: 'CRM',
      prompt: `Generated question number ${i + 1} about Salesforce?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: i % 4,
      explanation: 'A generated explanation that is long enough.',
    }));
    nvidia.chat.mockResolvedValue({
      content: JSON.stringify(aiPayload),
      model: 'real-model',
    });
    db.learningQuizAttempt.findFirst.mockResolvedValue(null);
    db.learningQuizAttempt.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'attempt-2', ...data, startedAt: new Date() }),
    );

    const module = CURRICULUM[0]!.modules[0]!;
    const attempt = await quizService.startQuiz(USER, module.id, ACCESS);
    expect(attempt.source).toBe('ai');
    expect(attempt.questions[0]!.prompt).toContain('Generated question');
  });

  it('rejects quiz start when the track or quiz capability is not granted', async () => {
    const sfModule = CURRICULUM.find((p) => p.category === 'salesforce')!.modules[0]!;
    db.learningQuizAttempt.findFirst.mockResolvedValue(null);

    // Granted the track but not the quiz capability.
    const noQuiz = resolveLearningFeatureAccess({
      role: 'user',
      grantedModules: ['learning'],
      learningFeatures: ['category:salesforce'],
    });
    await expect(quizService.startQuiz(USER, sfModule.id, noQuiz)).rejects.toThrow(
      /Quizzes are not enabled/,
    );

    // Granted quizzes but the wrong track.
    const wrongTrack = resolveLearningFeatureAccess({
      role: 'user',
      grantedModules: ['learning'],
      learningFeatures: ['category:javascript', 'capability:quiz'],
    });
    await expect(quizService.startQuiz(USER, sfModule.id, wrongTrack)).rejects.toThrow(
      /not enabled/,
    );
    expect(db.learningQuizAttempt.create).not.toHaveBeenCalled();
  });

  it('resumes an in-progress attempt instead of generating a new quiz', async () => {
    const module = CURRICULUM[0]!.modules[0]!;
    db.learningQuizAttempt.findFirst.mockResolvedValue({
      id: 'attempt-existing',
      moduleId: module.id,
      pathId: CURRICULUM[0]!.id,
      status: 'in_progress',
      source: 'static',
      questions: module.quizBank.slice(0, 8),
      totalQuestions: 8,
      startedAt: new Date(),
    });

    const attempt = await quizService.startQuiz(USER, module.id, ACCESS);
    expect(attempt.id).toBe('attempt-existing');
    expect(nvidia.chat).not.toHaveBeenCalled();
    expect(db.learningQuizAttempt.create).not.toHaveBeenCalled();
  });

  it('scores submissions server-side and returns a full review', async () => {
    const module = CURRICULUM[0]!.modules[0]!;
    const questions = module.quizBank.slice(0, 4).map((q) => ({
      id: q.id,
      topic: q.topic,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));
    db.learningQuizAttempt.findUnique.mockResolvedValue({
      id: 'attempt-3',
      userId: USER,
      moduleId: module.id,
      pathId: CURRICULUM[0]!.id,
      status: 'in_progress',
      questions,
      totalQuestions: 4,
    });
    db.learningQuizAttempt.update.mockResolvedValue({});

    // Answer 3 of 4 correctly, leave one wrong.
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      selectedIndex: i === 0 ? (q.correctIndex + 1) % q.options.length : q.correctIndex,
    }));

    const result = await quizService.submitQuiz(USER, 'attempt-3', { answers });
    expect(result.correctCount).toBe(3);
    expect(result.scorePercent).toBe(75);
    expect(result.passed).toBe(true);
    expect(result.review).toHaveLength(4);
    expect(result.review[0]!.correct).toBe(false);
    expect(result.review[0]!.explanation.length).toBeGreaterThan(0);
    expect(result.coaching).toContain('Solid pass');
    expect(db.learningQuizAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attempt-3' },
        data: expect.objectContaining({ status: 'completed', passed: true, scorePercent: 75 }),
      }),
    );
  });

  it('rejects double submission and foreign attempts', async () => {
    db.learningQuizAttempt.findUnique.mockResolvedValue({
      id: 'attempt-4',
      userId: 'DPT_someone-else',
      status: 'in_progress',
      questions: [],
    });
    await expect(
      quizService.submitQuiz(USER, 'attempt-4', {
        answers: [{ questionId: 'x', selectedIndex: 0 }],
      }),
    ).rejects.toThrow('Quiz attempt not found');

    db.learningQuizAttempt.findUnique.mockResolvedValue({
      id: 'attempt-5',
      userId: USER,
      moduleId: CURRICULUM[0]!.modules[0]!.id,
      pathId: CURRICULUM[0]!.id,
      status: 'completed',
      questions: [],
    });
    await expect(
      quizService.submitQuiz(USER, 'attempt-5', {
        answers: [{ questionId: 'x', selectedIndex: 0 }],
      }),
    ).rejects.toThrow('already submitted');
  });
});
