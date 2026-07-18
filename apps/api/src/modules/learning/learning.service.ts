import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  averagePercent,
  isModuleCompleted,
  isPathCompleted,
  moduleProgressPercent,
  pathProgressPercent,
  type LearningAssignmentView,
  type LearningCatalogResponse,
  type LearningContinueTarget,
  type LearningLessonResponse,
  type LearningModuleMeta,
  type LearningPathSummary,
  type LearningQuizAttemptSummary,
  type LearningStats,
} from '@sfcc/shared';
import {
  CURRICULUM,
  getLesson,
  getPath,
  moduleDurationMinutes,
  type CurriculumModule,
  type CurriculumPath,
} from './curriculum';
import { NotificationsService } from '../notifications/notifications.service';

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

/**
 * Per-user catalog scope. When an administrator flags a user as
 * "assigned paths only" (User Access → Manage), the Academy shows and serves
 * exclusively the paths that user has an active assignment for.
 */
export interface LearningAccessScope {
  assignedOnly: boolean;
  /** Populated only when assignedOnly — active-assignment path ids. */
  assignedPathIds: Set<string>;
}

const RESTRICTED_MESSAGE =
  'This training path has not been assigned to you. Ask an administrator to assign it from Academy Progress.';

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
  private readonly logger = new Logger(LearningService.name);

  constructor(@Optional() private readonly notifications?: NotificationsService) {}

  /** Resolve the user's catalog scope. Admins always see everything. */
  async getAccessScope(userId: string): Promise<LearningAccessScope> {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { role: true, learningAssignedOnly: true },
    });
    if (!user || user.role === 'admin' || !user.learningAssignedOnly) {
      return { assignedOnly: false, assignedPathIds: new Set() };
    }
    const assignments = await prisma.learningAssignment.findMany({
      where: { userId, status: 'active' },
      select: { pathId: true },
    });
    return {
      assignedOnly: true,
      assignedPathIds: new Set(assignments.map((a) => a.pathId)),
    };
  }

  private isPathVisible(scope: LearningAccessScope, pathId: string): boolean {
    return !scope.assignedOnly || scope.assignedPathIds.has(pathId);
  }

  /** Throw 403 when a restricted user reaches for an unassigned path. */
  async assertPathVisible(userId: string, pathId: string): Promise<void> {
    const scope = await this.getAccessScope(userId);
    if (!this.isPathVisible(scope, pathId)) {
      throw new ForbiddenException(RESTRICTED_MESSAGE);
    }
  }

  /** Same gate keyed by lesson — used by tutor/story/lesson-video endpoints. */
  async assertLessonVisible(userId: string, lessonId: string): Promise<void> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    await this.assertPathVisible(userId, location.path.id);
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
      category: path.category,
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
   * Stats are computed over the paths the user can SEE, so a restricted
   * learner's totals describe their assigned curriculum, not hidden content.
   */
  private buildStats(paths: LearningPathSummary[], state: UserLearningState): LearningStats {
    const visibleModules = paths.flatMap((p) => p.modules);
    const visibleModuleIds = new Set(visibleModules.map((m) => m.id));
    const visibleAttempts = [...state.quizAttemptsByModule.entries()]
      .filter(([moduleId]) => visibleModuleIds.has(moduleId))
      .flatMap(([, attempts]) => attempts);
    return {
      lessonsCompleted: visibleModules
        .flatMap((m) => m.lessons)
        .filter((l) => l.completed).length,
      totalLessons: visibleModules.reduce((sum, m) => sum + m.lessons.length, 0),
      modulesCompleted: visibleModules.filter((m) => m.completed).length,
      totalModules: visibleModules.length,
      pathsCompleted: paths.filter((p) => p.completed).length,
      totalPaths: paths.length,
      quizzesPassed: visibleModules.filter((m) => m.quiz.passed).length,
      quizAttempts: visibleAttempts.length,
      averageScorePercent: averagePercent(visibleAttempts.map((a) => a.scorePercent)),
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
    const [state, scope] = await Promise.all([
      this.loadUserState(userId),
      this.getAccessScope(userId),
    ]);
    const paths = CURRICULUM.filter((path) => this.isPathVisible(scope, path.id)).map((path) =>
      this.buildPathSummary(path, state),
    );
    return {
      paths,
      stats: this.buildStats(paths, state),
      continueTarget: this.buildContinueTarget(paths),
      assignedOnly: scope.assignedOnly,
    };
  }

  async getPathDetail(userId: string, pathId: string): Promise<LearningPathSummary> {
    const path = getPath(pathId);
    if (!path) throw new NotFoundException('Learning path not found');
    await this.assertPathVisible(userId, pathId);
    const state = await this.loadUserState(userId);
    return this.buildPathSummary(path, state);
  }

  async getLessonView(userId: string, lessonId: string): Promise<LearningLessonResponse> {
    const location = getLesson(lessonId);
    if (!location) throw new NotFoundException('Lesson not found');
    await this.assertPathVisible(userId, location.path.id);
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
    await this.assertPathVisible(userId, location.path.id);
    const { path, module } = location;

    const wasCompleteBefore = await this.isPathComplete(userId, path.id);

    const row = await prisma.learningLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, pathId: path.id, moduleId: module.id, lessonId },
      update: {},
    });

    const isCompleteAfter = await this.isPathComplete(userId, path.id);
    const pathJustCompleted = !wasCompleteBefore && isCompleteAfter;
    if (pathJustCompleted) {
      void this.notifyPathCompleted(userId, path.id, path.title);
    }

    return {
      completed: true,
      completedAt: row.completedAt.toISOString(),
      pathCompleted: pathJustCompleted,
      pathId: path.id,
    };
  }

  /** Notify once when either a lesson or quiz changes a path to complete. */
  async notifyPathCompleted(userId: string, pathId: string, pathTitle: string) {
    if (!this.notifications) return;
    try {
      await this.notifications.notify({
        userId,
        category: 'system',
        level: 'success',
        title: `Path completed: ${pathTitle}`,
        body: 'Congratulations — every lesson is done and every module quiz is passed. Your badge is on the academy page.',
        link: `/learning/paths/${pathId}`,
      });
      const assignment = await prisma.learningAssignment.findFirst({
        where: { userId, pathId, status: 'active' },
      });
      if (assignment && assignment.assignedBy !== userId) {
        const learner = await prisma.appUser.findUnique({
          where: { id: userId },
          select: { displayName: true },
        });
        await this.notifications.notify({
          userId: assignment.assignedBy,
          category: 'system',
          level: 'success',
          title: `${learner?.displayName ?? 'A learner'} completed "${pathTitle}"`,
          body: 'The assigned Salesforce Academy path is fully complete. Review their scores in Team Progress.',
          link: '/learning/team',
        });
      }
    } catch (error) {
      this.logger.warn(
        `path completion notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
