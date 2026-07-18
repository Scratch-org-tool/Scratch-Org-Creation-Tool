import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  averagePercent,
  hasLearningCategory,
  isModuleCompleted,
  isPathCompleted,
  moduleProgressPercent,
  pathProgressPercent,
  LEARNING_CATEGORY_LABELS,
  type LearningAssignmentView,
  type LearningCatalogResponse,
  type LearningContinueTarget,
  type LearningFeatureAccess,
  type LearningLessonResponse,
  type LearningModuleMeta,
  type LearningPathSummary,
  type LearningQuizAttemptSummary,
  type LearningStats,
} from '@sfcc/shared';
import {
  CURRICULUM,
  getLesson,
  getModule,
  getPath,
  moduleDurationMinutes,
  type CurriculumModule,
  type CurriculumPath,
} from './curriculum';

export interface UserLearningState {
  /** lessonId -> completedAt */
  lessonCompletions: Map<string, Date>;
  /** moduleId -> completed attempts, newest first */
  quizAttemptsByModule: Map<
    string,
    Array<{ scorePercent: number; passed: boolean; completedAt: Date | null }>
  >;
  /** pathId -> active assignment */
  assignmentsByPath: Map<string, LearningAssignmentView>;
}

interface AssignmentRow {
  id: string;
  userId: string;
  pathId: string;
  assignedBy: string;
  note: string | null;
  dueAt: Date | null;
  status: string;
  createdAt: Date;
}

function toAssignmentView(
  row: AssignmentRow,
  assignedByName: string | null = null,
): LearningAssignmentView {
  return {
    id: row.id,
    userId: row.userId,
    pathId: row.pathId,
    assignedBy: row.assignedBy,
    assignedByName,
    note: row.note,
    dueAt: row.dueAt?.toISOString() ?? null,
    status: row.status === 'revoked' ? 'revoked' : 'active',
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class LearningService {
  /** Load everything needed to overlay one user's progress onto the curriculum. */
  async loadUserState(userId: string): Promise<UserLearningState> {
    const [lessonRows, attemptRows, assignmentRows] = await Promise.all([
      prisma.learningLessonProgress.findMany({ where: { userId } }),
      prisma.learningQuizAttempt.findMany({
        where: { userId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { moduleId: true, scorePercent: true, passed: true, completedAt: true },
      }),
      prisma.learningAssignment.findMany({ where: { userId, status: 'active' } }),
    ]);

    const lessonCompletions = new Map<string, Date>();
    for (const row of lessonRows) lessonCompletions.set(row.lessonId, row.completedAt);

    const quizAttemptsByModule = new Map<
      string,
      Array<{ scorePercent: number; passed: boolean; completedAt: Date | null }>
    >();
    for (const row of attemptRows) {
      const list = quizAttemptsByModule.get(row.moduleId) ?? [];
      list.push({
        scorePercent: row.scorePercent,
        passed: row.passed,
        completedAt: row.completedAt,
      });
      quizAttemptsByModule.set(row.moduleId, list);
    }

    const assignerIds = [...new Set(assignmentRows.map((row) => row.assignedBy))];
    const assigners = assignerIds.length
      ? await prisma.appUser.findMany({
          where: { id: { in: assignerIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const assignerNames = new Map(assigners.map((u) => [u.id, u.displayName]));

    const assignmentsByPath = new Map<string, LearningAssignmentView>();
    for (const row of assignmentRows) {
      assignmentsByPath.set(
        row.pathId,
        toAssignmentView(row, assignerNames.get(row.assignedBy) ?? null),
      );
    }

    return { lessonCompletions, quizAttemptsByModule, assignmentsByPath };
  }

  buildModuleMeta(
    path: CurriculumPath,
    module: CurriculumModule,
    state: UserLearningState,
  ): LearningModuleMeta {
    const lessons = module.lessons.map((lesson) => {
      const completedAt = state.lessonCompletions.get(lesson.id) ?? null;
      return {
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        durationMinutes: lesson.durationMinutes,
        completed: completedAt !== null,
        completedAt: completedAt?.toISOString() ?? null,
      };
    });

    const attempts = state.quizAttemptsByModule.get(module.id) ?? [];
    const bestScore = attempts.length
      ? Math.max(...attempts.map((a) => a.scorePercent))
      : null;
    const passed = attempts.some((a) => a.passed);
    const lessonsCompleted = lessons.filter((l) => l.completed).length;

    return {
      id: module.id,
      pathId: path.id,
      title: module.title,
      summary: module.summary,
      durationMinutes: moduleDurationMinutes(module),
      lessons,
      quiz: {
        questionCount: Math.min(8, module.quizBank.length),
        passPercent: 70,
        attemptCount: attempts.length,
        bestScorePercent: bestScore,
        passed,
        lastAttemptAt: attempts[0]?.completedAt?.toISOString() ?? null,
      },
      completed: isModuleCompleted(lessonsCompleted, lessons.length, passed),
      progressPercent: moduleProgressPercent(lessonsCompleted, lessons.length, passed),
    };
  }

  buildPathSummary(path: CurriculumPath, state: UserLearningState): LearningPathSummary {
    const modules = path.modules.map((module) => this.buildModuleMeta(path, module, state));
    const units = modules.map((m) => ({
      lessonsCompleted: m.lessons.filter((l) => l.completed).length,
      lessonCount: m.lessons.length,
      quizPassed: m.quiz.passed,
    }));

    return {
      id: path.id,
      title: path.title,
      tagline: path.tagline,
      description: path.description,
      category: path.category,
      level: path.level,
      badge: path.badge,
      estimatedHours: path.estimatedHours,
      skills: path.skills,
      moduleCount: path.modules.length,
      lessonCount: path.modules.reduce((sum, m) => sum + m.lessons.length, 0),
      modules,
      progressPercent: pathProgressPercent(units),
      completed: isPathCompleted(units),
      assignment: state.assignmentsByPath.get(path.id) ?? null,
    };
  }

  /**
   * Stats are scoped to the paths the learner can actually see, so a user with
   * only the Salesforce track granted never sees denominators (or completions)
   * from tracks they cannot open.
   */
  private buildStats(paths: LearningPathSummary[], state: UserLearningState): LearningStats {
    const modules = paths.flatMap((p) => p.modules);
    const moduleIds = new Set(modules.map((m) => m.id));
    const accessibleAttempts = [...state.quizAttemptsByModule.entries()]
      .filter(([moduleId]) => moduleIds.has(moduleId))
      .flatMap(([, attempts]) => attempts);

    const lessonsCompleted = modules.reduce(
      (sum, m) => sum + m.lessons.filter((l) => l.completed).length,
      0,
    );
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

    return {
      lessonsCompleted,
      totalLessons,
      modulesCompleted: modules.filter((m) => m.completed).length,
      totalModules: modules.length,
      pathsCompleted: paths.filter((p) => p.completed).length,
      totalPaths: paths.length,
      quizzesPassed: modules.filter((m) => m.quiz.passed).length,
      quizAttempts: accessibleAttempts.length,
      averageScorePercent: averagePercent(accessibleAttempts.map((a) => a.scorePercent)),
    };
  }

  /** Throw a clear 403 if the learner has not been granted this path's track. */
  private assertCategoryAccess(access: LearningFeatureAccess, path: CurriculumPath): void {
    if (!hasLearningCategory(access, path.category)) {
      throw new ForbiddenException(
        `The ${LEARNING_CATEGORY_LABELS[path.category]} training track is not enabled for your account.`,
      );
    }
  }

  /** Only the paths whose discipline the learner is allowed to see. */
  private accessiblePaths(access: LearningFeatureAccess): CurriculumPath[] {
    return CURRICULUM.filter((path) => hasLearningCategory(access, path.category));
  }

  /**
   * The "continue learning" deep link: first incomplete unit (lesson, then
   * quiz) of the first in-progress path — assigned paths take priority.
   */
  private buildContinueTarget(paths: LearningPathSummary[]): LearningContinueTarget | null {
    const ordered = [
      ...paths.filter((p) => p.assignment && !p.completed),
      ...paths.filter((p) => !p.assignment && !p.completed),
    ];
    for (const path of ordered) {
      for (const module of path.modules) {
        const nextLesson = module.lessons.find((l) => !l.completed);
        if (nextLesson) {
          return {
            pathId: path.id,
            pathTitle: path.title,
            moduleId: module.id,
            moduleTitle: module.title,
            lessonId: nextLesson.id,
            lessonTitle: nextLesson.title,
            kind: 'lesson',
          };
        }
        if (!module.quiz.passed) {
          return {
            pathId: path.id,
            pathTitle: path.title,
            moduleId: module.id,
            moduleTitle: module.title,
            lessonId: null,
            lessonTitle: null,
            kind: 'quiz',
          };
        }
      }
    }
    return null;
  }

  async getCatalog(
    userId: string,
    access: LearningFeatureAccess,
  ): Promise<LearningCatalogResponse> {
    const state = await this.loadUserState(userId);
    const paths = this.accessiblePaths(access).map((path) => this.buildPathSummary(path, state));
    return {
      paths,
      stats: this.buildStats(paths, state),
      continueTarget: this.buildContinueTarget(paths),
      features: access,
    };
  }

  async getPathDetail(
    userId: string,
    pathId: string,
    access: LearningFeatureAccess,
  ): Promise<LearningPathSummary> {
    const path = getPath(pathId);
    if (!path) throw new NotFoundException('Learning path not found');
    this.assertCategoryAccess(access, path);
    const state = await this.loadUserState(userId);
    return this.buildPathSummary(path, state);
  }

  async getLessonView(
    userId: string,
    lessonId: string,
    access: LearningFeatureAccess,
  ): Promise<LearningLessonResponse> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    const { path, module, lesson, lessonIndex } = location;
    this.assertCategoryAccess(access, path);

    const progress = await prisma.learningLessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    const previous = module.lessons[lessonIndex - 1] ?? null;
    const next = module.lessons[lessonIndex + 1] ?? null;

    return {
      lesson: {
        id: lesson.id,
        moduleId: module.id,
        pathId: path.id,
        title: lesson.title,
        summary: lesson.summary,
        durationMinutes: lesson.durationMinutes,
        objectives: lesson.objectives,
        sections: lesson.sections,
        realWorld: lesson.realWorld,
        keyTakeaways: lesson.keyTakeaways,
        resources: lesson.resources,
      },
      pathId: path.id,
      pathTitle: path.title,
      category: path.category,
      moduleId: module.id,
      moduleTitle: module.title,
      completed: progress !== null,
      completedAt: progress?.completedAt.toISOString() ?? null,
      previousLessonId: previous?.id ?? null,
      nextLessonId: next?.id ?? null,
      quizNext: next === null,
      features: access,
    };
  }

  /** Idempotent lesson completion. Returns whether the whole path just completed. */
  async completeLesson(
    userId: string,
    lessonId: string,
    access: LearningFeatureAccess,
  ): Promise<{ completed: true; completedAt: string; pathCompleted: boolean; pathId: string }> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    const { path, module } = location;
    this.assertCategoryAccess(access, path);

    const wasCompleteBefore = await this.isPathComplete(userId, path.id);

    const row = await prisma.learningLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, pathId: path.id, moduleId: module.id, lessonId },
      update: {},
    });

    const isCompleteAfter = await this.isPathComplete(userId, path.id);

    return {
      completed: true,
      completedAt: row.completedAt.toISOString(),
      pathCompleted: !wasCompleteBefore && isCompleteAfter,
      pathId: path.id,
    };
  }

  async isPathComplete(userId: string, pathId: string): Promise<boolean> {
    const path = getPath(pathId);
    if (!path) return false;
    const state = await this.loadUserState(userId);
    const units = path.modules.map((module) => {
      const attempts = state.quizAttemptsByModule.get(module.id) ?? [];
      return {
        lessonsCompleted: module.lessons.filter((l) => state.lessonCompletions.has(l.id)).length,
        lessonCount: module.lessons.length,
        quizPassed: attempts.some((a) => a.passed),
      };
    });
    return isPathCompleted(units);
  }

  async listModuleAttempts(
    userId: string,
    moduleId: string,
    access: LearningFeatureAccess,
  ): Promise<LearningQuizAttemptSummary[]> {
    const location = getModule(moduleId);
    if (!location) throw new NotFoundException('Module not found');
    this.assertCategoryAccess(access, location.path);
    const rows = await prisma.learningQuizAttempt.findMany({
      where: { userId, moduleId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      moduleId: row.moduleId,
      pathId: row.pathId,
      scorePercent: row.scorePercent,
      passed: row.passed,
      totalQuestions: row.totalQuestions,
      correctCount: row.correctCount,
      source: (row.source === 'ai' || row.source === 'mixed' ? row.source : 'static'),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }
}
