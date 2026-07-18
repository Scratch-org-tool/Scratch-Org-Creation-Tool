import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  averagePercent,
  canAccessLearningPath,
  isModuleCompleted,
  isPathCompleted,
  moduleProgressPercent,
  pathProgressPercent,
  resolveLearningPaths,
  type LearningAssignmentView,
  type LearningCatalogResponse,
  type LearningContinueTarget,
  type LearningLessonResponse,
  type LearningModuleMeta,
  type LearningPathSummary,
  type LearningQuizAttemptSummary,
  type LearningStats,
  type UserAccessProfile,
} from '@sfcc/shared';
import { getAppUser } from '../auth/app-user.service';
import {
  CURRICULUM,
  getLesson,
  getPath,
  moduleDurationMinutes,
  totalLessonCount,
  totalModuleCount,
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
  /** Resolve the caller's Academy access profile (throws if missing). */
  async requireProfile(userId: string): Promise<UserAccessProfile> {
    const profile = await getAppUser(userId);
    if (!profile) throw new ForbiddenException('User profile not found');
    return profile;
  }

  /** Enforce that the user may open this learning path. */
  async assertPathAccess(userId: string, pathId: string): Promise<UserAccessProfile> {
    const profile = await this.requireProfile(userId);
    if (!canAccessLearningPath(profile, pathId)) {
      throw new ForbiddenException('You do not have access to this training track');
    }
    return profile;
  }

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

  private buildStats(paths: LearningPathSummary[], state: UserLearningState): LearningStats {
    // Scope totals to the paths this user can see (not the full curriculum).
    const visibleLessonIds = new Set(
      paths.flatMap((path) => path.modules.flatMap((module) => module.lessons.map((l) => l.id))),
    );
    const visibleModuleIds = new Set(paths.flatMap((path) => path.modules.map((m) => m.id)));
    const allAttempts = [...state.quizAttemptsByModule.entries()]
      .filter(([moduleId]) => visibleModuleIds.has(moduleId))
      .flatMap(([, attempts]) => attempts);
    const modulesCompleted = paths
      .flatMap((p) => p.modules)
      .filter((m) => m.completed).length;
    const lessonsCompleted = [...state.lessonCompletions.keys()].filter((id) =>
      visibleLessonIds.has(id),
    ).length;
    return {
      lessonsCompleted,
      totalLessons: visibleLessonIds.size || totalLessonCount(),
      modulesCompleted,
      totalModules: visibleModuleIds.size || totalModuleCount(),
      pathsCompleted: paths.filter((p) => p.completed).length,
      totalPaths: paths.length,
      quizzesPassed: [...state.quizAttemptsByModule.entries()]
        .filter(([moduleId]) => visibleModuleIds.has(moduleId))
        .filter(([, attempts]) => attempts.some((a) => a.passed)).length,
      quizAttempts: allAttempts.length,
      averageScorePercent: averagePercent(allAttempts.map((a) => a.scorePercent)),
    };
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

  async getCatalog(userId: string): Promise<LearningCatalogResponse> {
    const profile = await this.requireProfile(userId);
    const allowed = new Set(resolveLearningPaths(profile));
    const state = await this.loadUserState(userId);
    const paths = CURRICULUM.filter((path) => allowed.has(path.id as never)).map((path) =>
      this.buildPathSummary(path, state),
    );
    return {
      paths,
      stats: this.buildStats(paths, state),
      continueTarget: this.buildContinueTarget(paths),
    };
  }

  async getPathDetail(userId: string, pathId: string): Promise<LearningPathSummary> {
    const path = getPath(pathId);
    if (!path) throw new NotFoundException('Learning path not found');
    await this.assertPathAccess(userId, pathId);
    const state = await this.loadUserState(userId);
    return this.buildPathSummary(path, state);
  }

  async getLessonView(userId: string, lessonId: string): Promise<LearningLessonResponse> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    await this.assertPathAccess(userId, location.path.id);
    const { path, module, lesson, lessonIndex } = location;

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
      moduleId: module.id,
      moduleTitle: module.title,
      completed: progress !== null,
      completedAt: progress?.completedAt.toISOString() ?? null,
      previousLessonId: previous?.id ?? null,
      nextLessonId: next?.id ?? null,
      quizNext: next === null,
    };
  }

  /** Idempotent lesson completion. Returns whether the whole path just completed. */
  async completeLesson(
    userId: string,
    lessonId: string,
  ): Promise<{ completed: true; completedAt: string; pathCompleted: boolean; pathId: string }> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    await this.assertPathAccess(userId, location.path.id);
    const { path, module } = location;

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
  ): Promise<LearningQuizAttemptSummary[]> {
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
