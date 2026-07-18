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
import { LearningAdminService } from './learning-admin.service';
import type { NvidiaService } from '../../integrations/nvidia/nvidia.service';
import type { NotificationsService } from '../notifications/notifications.service';

const USER = 'DPT_test-user';

function notificationService(): NotificationsService {
  return {
    notify: vi.fn().mockResolvedValue(null),
  } as unknown as NotificationsService;
}

function emptyState() {
  db.learningLessonProgress.findMany.mockResolvedValue([]);
  db.learningQuizAttempt.findMany.mockResolvedValue([]);
  db.learningAssignment.findMany.mockResolvedValue([]);
  db.appUser.findMany.mockResolvedValue([]);
}

describe('curriculum integrity', () => {
  it('contains the complete 8-path catalog ordered beginner → expert', () => {
    expect(CURRICULUM).toHaveLength(8);
    expect(CURRICULUM.map((p) => p.level)).toEqual([
      'beginner',
      'beginner',
      'intermediate',
      'intermediate',
      'advanced',
      'advanced',
      'advanced',
      'expert',
    ]);
    expect(CURRICULUM.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        'sf-modern-platform',
        'javascript-engineering',
        'java-integration-engineering',
        'salesforce-release-management',
      ]),
    );
  });

  it('pins the advertised catalog counts and globally unique ids', () => {
    const moduleIds = CURRICULUM.flatMap((p) => p.modules.map((m) => m.id));
    const lessonIds = CURRICULUM.flatMap((p) =>
      p.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );
    const questionIds = CURRICULUM.flatMap((p) =>
      p.modules.flatMap((m) => m.quizBank.map((q) => q.id)),
    );
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(new Set(questionIds).size).toBe(questionIds.length);
    expect(moduleIds).toHaveLength(25);
    expect(lessonIds).toHaveLength(66);
    expect(questionIds).toHaveLength(228);
    expect(totalLessonCount()).toBe(lessonIds.length);
  });

  it('keeps every expanded path at three modules and six scripted lessons', () => {
    const expandedPathIds = [
      'sf-modern-platform',
      'javascript-engineering',
      'java-integration-engineering',
      'salesforce-release-management',
    ];
    for (const pathId of expandedPathIds) {
      const path = getPath(pathId)!;
      expect(path.modules).toHaveLength(3);
      expect(path.modules.flatMap((module) => module.lessons)).toHaveLength(6);
    }
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
    service = new LearningService(notificationService());
    emptyState();
  });

  it('returns zeroed progress for a fresh user', async () => {
    const catalog = await service.getCatalog(USER);
    expect(catalog.paths).toHaveLength(8);
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

    const catalog = await service.getCatalog(USER);
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

    const catalog = await service.getCatalog(USER);
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

    const catalog = await service.getCatalog(USER);
    expect(catalog.continueTarget?.pathId).toBe(assignedPath.id);
    const summary = catalog.paths.find((p) => p.id === assignedPath.id)!;
    expect(summary.assignment?.assignedByName).toBe('Admin');
  });

  it('serves lesson content with prev/next navigation and quizNext on the last lesson', async () => {
    const module = CURRICULUM[0]!.modules[0]!;
    const last = module.lessons[module.lessons.length - 1]!;
    db.learningLessonProgress.findUnique.mockResolvedValue(null);

    const view = await service.getLessonView(USER, last.id);
    expect(view.lesson.sections.length).toBeGreaterThan(0);
    expect(view.nextLessonId).toBeNull();
    expect(view.quizNext).toBe(true);
    expect(view.previousLessonId).toBe(module.lessons[module.lessons.length - 2]!.id);
  });

  it('rejects unknown lessons', async () => {
    await expect(service.getLessonView(USER, 'ghost-lesson')).rejects.toThrow(
      'Lesson not found',
    );
  });

  it('completes lessons idempotently via upsert', async () => {
    const lesson = CURRICULUM[0]!.modules[0]!.lessons[0]!;
    db.learningLessonProgress.upsert.mockResolvedValue({
      completedAt: new Date('2026-07-03T09:00:00Z'),
    });
    emptyState();

    const result = await service.completeLesson(USER, lesson.id);
    expect(result.completed).toBe(true);
    expect(db.learningLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: USER, lessonId: lesson.id } },
      }),
    );
  });

  it('notifies when the final completion unit is a lesson', async () => {
    const path = CURRICULUM[0]!;
    const finalLesson = path.modules.at(-1)!.lessons.at(-1)!;
    const allLessons = path.modules.flatMap((module) => module.lessons);
    const before = allLessons
      .filter((lesson) => lesson.id !== finalLesson.id)
      .map((lesson) => ({ lessonId: lesson.id, completedAt: new Date() }));
    const after = allLessons.map((lesson) => ({
      lessonId: lesson.id,
      completedAt: new Date(),
    }));
    const passedModules = path.modules.map((module) => ({
      moduleId: module.id,
      scorePercent: 90,
      passed: true,
      completedAt: new Date(),
    }));
    const notifications = { notify: vi.fn().mockResolvedValue(null) };
    service = new LearningService(notifications as unknown as NotificationsService);
    db.learningLessonProgress.findMany
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    db.learningQuizAttempt.findMany.mockResolvedValue(passedModules);
    db.learningAssignment.findMany.mockResolvedValue([]);
    db.learningAssignment.findFirst.mockResolvedValue(null);
    db.learningLessonProgress.upsert.mockResolvedValue({ completedAt: new Date() });

    const result = await service.completeLesson(USER, finalLesson.id);

    expect(result.pathCompleted).toBe(true);
    await vi.waitFor(() =>
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER,
          title: `Path completed: ${path.title}`,
        }),
      ),
    );
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
    learningService = new LearningService(
      notifications as unknown as NotificationsService,
    );
    quizService = new LearningQuizService(
      nvidia as unknown as NvidiaService,
      learningService,
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

    const attempt = await quizService.startQuiz(USER, module.id);
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
    const attempt = await quizService.startQuiz(USER, module.id);
    expect(attempt.source).toBe('ai');
    expect(attempt.questions[0]!.prompt).toContain('Generated question');
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

    const attempt = await quizService.startQuiz(USER, module.id);
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

  it('does not report or notify path completion again on a quiz retake', async () => {
    const module = CURRICULUM[0]!.modules[0]!;
    const question = module.quizBank[0]!;
    db.learningQuizAttempt.findUnique.mockResolvedValue({
      id: 'attempt-retake',
      userId: USER,
      moduleId: module.id,
      pathId: CURRICULUM[0]!.id,
      status: 'in_progress',
      questions: [question],
      totalQuestions: 1,
    });
    db.learningQuizAttempt.update.mockResolvedValue({});
    vi.spyOn(learningService, 'isPathComplete').mockResolvedValue(true);
    const notifyCompleted = vi.spyOn(learningService, 'notifyPathCompleted');

    const result = await quizService.submitQuiz(USER, 'attempt-retake', {
      answers: [{ questionId: question.id, selectedIndex: question.correctIndex }],
    });

    expect(result.pathCompleted).toBe(false);
    expect(notifyCompleted).not.toHaveBeenCalled();
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

describe('LearningAdminService access control', () => {
  const input = {
    userIds: [USER],
    pathIds: [CURRICULUM[0]!.id],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires Academy permission to be granted in User Access before assignment', async () => {
    db.appUser.findMany.mockResolvedValue([
      {
        id: USER,
        role: 'user',
        status: 'active',
        grantedModules: [],
        displayName: 'Test Learner',
      },
    ]);
    const service = new LearningAdminService(
      new LearningService(notificationService()),
      { notify: vi.fn() } as unknown as NotificationsService,
    );

    await expect(service.createAssignments('DPT_admin', input)).rejects.toThrow(
      'Grant Salesforce Academy in Admin → User Access',
    );
    expect(db.appUser.update).not.toHaveBeenCalled();
    expect(db.learningAssignment.create).not.toHaveBeenCalled();
  });

  it('creates an assignment after an explicit Academy grant', async () => {
    db.appUser.findMany.mockResolvedValue([
      {
        id: USER,
        role: 'user',
        status: 'active',
        grantedModules: ['learning'],
        displayName: 'Test Learner',
      },
    ]);
    db.appUser.findUnique.mockResolvedValue({ displayName: 'Admin User' });
    db.learningAssignment.findUnique.mockResolvedValue(null);
    db.learningAssignment.create.mockResolvedValue({
      id: 'assignment-1',
      userId: USER,
      pathId: input.pathIds[0],
      assignedBy: 'DPT_admin',
      note: null,
      dueAt: null,
      status: 'active',
      createdAt: new Date(),
    });
    const notify = vi.fn().mockResolvedValue(null);
    const service = new LearningAdminService(
      new LearningService(notificationService()),
      { notify } as unknown as NotificationsService,
    );

    const result = await service.createAssignments('DPT_admin', input);

    expect(result.created).toHaveLength(1);
    expect(db.appUser.update).not.toHaveBeenCalled();
    expect(db.learningAssignment.create).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce());
  });
});
