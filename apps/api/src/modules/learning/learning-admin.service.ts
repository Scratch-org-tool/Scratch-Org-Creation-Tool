import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@sfcc/db';
import {
  averagePercent,
  canAccessModule,
  isModuleCompleted,
  moduleProgressPercent,
  pathProgressPercent,
  type AppModule,
  type LearningAdminLearnerRow,
  type LearningAdminOverview,
  type LearningAdminPathProgress,
  type LearningAssignmentCreateInput,
  type LearningAssignmentResult,
  type LearningAssignmentView,
  type LearningPathSummary,
  type UserRole,
} from '@sfcc/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { CURRICULUM, getPath } from './curriculum';
import { LearningService } from './learning.service';

interface LearnerAccumulator {
  lessonsByPath: Map<string, Set<string>>;
  lessonsByModule: Map<string, Set<string>>;
  scoresByModule: Map<string, number[]>;
  passedModules: Set<string>;
  quizAttempts: number;
  allScores: number[];
  lastActivityAt: Date | null;
}

function newAccumulator(): LearnerAccumulator {
  return {
    lessonsByPath: new Map(),
    lessonsByModule: new Map(),
    scoresByModule: new Map(),
    passedModules: new Set(),
    quizAttempts: 0,
    allScores: [],
    lastActivityAt: null,
  };
}

function later(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

@Injectable()
export class LearningAdminService {
  constructor(
    private readonly learningService: LearningService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Assign paths only after User Access has explicitly enabled Academy. */
  async createAssignments(
    adminId: string,
    input: LearningAssignmentCreateInput,
  ): Promise<LearningAssignmentResult> {
    for (const pathId of input.pathIds) {
      if (!getPath(pathId)) {
        throw new BadRequestException(`Unknown learning path: ${pathId}`);
      }
    }

    const users = await prisma.appUser.findMany({
      where: { id: { in: input.userIds } },
      select: {
        id: true,
        role: true,
        status: true,
        grantedModules: true,
        displayName: true,
      },
    });
    const usersById = new Map(users.map((u) => [u.id, u]));
    const missing = input.userIds.filter((id) => !usersById.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown user(s): ${missing.join(', ')}`);
    }
    const inactive = users.filter((user) => user.status === 'inactive');
    if (inactive.length > 0) {
      throw new BadRequestException(
        `Training cannot be assigned to inactive user(s): ${inactive
          .map((user) => user.displayName)
          .join(', ')}`,
      );
    }
    const withoutAccess = users.filter(
      (user) =>
        !canAccessModule(
          {
            role: user.role as UserRole,
            grantedModules: user.grantedModules as AppModule[],
          },
          'learning',
        ),
    );
    if (withoutAccess.length > 0) {
      throw new BadRequestException(
        `Grant Salesforce Academy in Admin → User Access before assigning training to: ${withoutAccess
          .map((user) => user.displayName)
          .join(', ')}`,
      );
    }

    const admin = await prisma.appUser.findUnique({
      where: { id: adminId },
      select: { displayName: true },
    });

    const created: LearningAssignmentView[] = [];
    let skippedExisting = 0;
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;

    for (const userId of input.userIds) {
      for (const pathId of input.pathIds) {
        const existing = await prisma.learningAssignment.findUnique({
          where: { userId_pathId: { userId, pathId } },
        });
        if (existing && existing.status === 'active') {
          skippedExisting += 1;
          continue;
        }

        const row = existing
          ? await prisma.learningAssignment.update({
              where: { id: existing.id },
              data: {
                status: 'active',
                assignedBy: adminId,
                note: input.note ?? null,
                dueAt,
              },
            })
          : await prisma.learningAssignment.create({
              data: {
                userId,
                pathId,
                assignedBy: adminId,
                note: input.note ?? null,
                dueAt,
                status: 'active',
              },
            });

        created.push({
          id: row.id,
          userId: row.userId,
          pathId: row.pathId,
          assignedBy: row.assignedBy,
          assignedByName: admin?.displayName ?? null,
          note: row.note,
          dueAt: row.dueAt?.toISOString() ?? null,
          status: 'active',
          createdAt: row.createdAt.toISOString(),
        });

        const path = getPath(pathId)!;
        void this.notifications
          .notify({
            userId,
            category: 'system',
            level: 'info',
            title: `New training assigned: ${path.title}`,
            body: `${admin?.displayName ?? 'An administrator'} assigned you the "${path.title}" path in the Salesforce Academy${dueAt ? ` — due ${dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}` : ''}.${input.note ? ` Note: ${input.note}` : ''}`,
            link: `/learning/paths/${pathId}`,
          })
          .catch(() => undefined);
      }
    }

    return { created, skippedExisting };
  }

  async revokeAssignment(assignmentId: string): Promise<{ revoked: true }> {
    const assignment = await prisma.learningAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await prisma.learningAssignment.update({
      where: { id: assignmentId },
      data: { status: 'revoked' },
    });
    return { revoked: true };
  }

  /** Full-team progress report: one query set, computed in memory. */
  async getTeamOverview(): Promise<LearningAdminOverview> {
    const [users, lessonRows, attemptRows, assignmentRows] = await Promise.all([
      prisma.appUser.findMany({
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          grantedModules: true,
          revokedModules: true,
          learningAssignedOnly: true,
        },
      }),
      prisma.learningLessonProgress.findMany({
        select: { userId: true, pathId: true, moduleId: true, lessonId: true, completedAt: true },
      }),
      prisma.learningQuizAttempt.findMany({
        where: { status: 'completed' },
        select: {
          userId: true,
          pathId: true,
          moduleId: true,
          scorePercent: true,
          passed: true,
          completedAt: true,
        },
      }),
      prisma.learningAssignment.findMany({ where: { status: 'active' } }),
    ]);

    const accumulators = new Map<string, LearnerAccumulator>();
    const acc = (userId: string): LearnerAccumulator => {
      let entry = accumulators.get(userId);
      if (!entry) {
        entry = newAccumulator();
        accumulators.set(userId, entry);
      }
      return entry;
    };

    for (const row of lessonRows) {
      const entry = acc(row.userId);
      if (!entry.lessonsByPath.has(row.pathId)) entry.lessonsByPath.set(row.pathId, new Set());
      entry.lessonsByPath.get(row.pathId)!.add(row.lessonId);
      if (!entry.lessonsByModule.has(row.moduleId)) {
        entry.lessonsByModule.set(row.moduleId, new Set());
      }
      entry.lessonsByModule.get(row.moduleId)!.add(row.lessonId);
      entry.lastActivityAt = later(entry.lastActivityAt, row.completedAt);
    }

    for (const row of attemptRows) {
      const entry = acc(row.userId);
      entry.quizAttempts += 1;
      entry.allScores.push(row.scorePercent);
      if (!entry.scoresByModule.has(row.moduleId)) entry.scoresByModule.set(row.moduleId, []);
      entry.scoresByModule.get(row.moduleId)!.push(row.scorePercent);
      if (row.passed) entry.passedModules.add(row.moduleId);
      entry.lastActivityAt = later(entry.lastActivityAt, row.completedAt);
    }

    const assignmentsByUser = new Map<string, typeof assignmentRows>();
    for (const row of assignmentRows) {
      const list = assignmentsByUser.get(row.userId) ?? [];
      list.push(row);
      assignmentsByUser.set(row.userId, list);
    }

    const learners: LearningAdminLearnerRow[] = users
      .filter((user) => user.status !== 'inactive')
      .map((user) => {
        const entry = accumulators.get(user.id) ?? newAccumulator();
        const userAssignments = assignmentsByUser.get(user.id) ?? [];
        const assignedPathIds = new Set(userAssignments.map((a) => a.pathId));

        const paths: LearningAdminPathProgress[] = CURRICULUM.map((path) => {
          const modules = path.modules.map((module) => {
            const lessonsCompleted = entry.lessonsByModule.get(module.id)?.size ?? 0;
            const quizPassed = entry.passedModules.has(module.id);
            return {
              lessonsCompleted: Math.min(lessonsCompleted, module.lessons.length),
              lessonCount: module.lessons.length,
              quizPassed,
            };
          });
          const modulesCompleted = modules.filter((m) =>
            isModuleCompleted(m.lessonsCompleted, m.lessonCount, m.quizPassed),
          ).length;
          const moduleScores = path.modules
            .flatMap((module) => entry.scoresByModule.get(module.id) ?? []);
          const assignment = userAssignments.find((a) => a.pathId === path.id) ?? null;

          return {
            pathId: path.id,
            title: path.title,
            level: path.level,
            category: path.category,
            assigned: assignedPathIds.has(path.id),
            assignmentId: assignment?.id ?? null,
            dueAt: assignment?.dueAt?.toISOString() ?? null,
            progressPercent: pathProgressPercent(modules),
            completed:
              modules.length > 0 &&
              modules.every((m) => isModuleCompleted(m.lessonsCompleted, m.lessonCount, m.quizPassed)),
            lessonsCompleted: modules.reduce((sum, m) => sum + m.lessonsCompleted, 0),
            lessonCount: modules.reduce((sum, m) => sum + m.lessonCount, 0),
            modulesCompleted,
            moduleCount: modules.length,
            averageScorePercent: averagePercent(moduleScores),
          };
        });

        const completedAssignments = paths.filter((p) => p.assigned && p.completed).length;
        const profile = {
          role: user.role as UserRole,
          grantedModules: user.grantedModules as AppModule[],
          revokedModules: user.revokedModules as AppModule[],
        };

        return {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          hasLearningAccess: canAccessModule(profile, 'learning'),
          learningAssignedOnly: user.role !== 'admin' && user.learningAssignedOnly,
          lessonsCompleted: [...entry.lessonsByPath.values()].reduce(
            (sum, set) => sum + set.size,
            0,
          ),
          modulesCompleted: paths.reduce((sum, p) => sum + p.modulesCompleted, 0),
          quizzesPassed: entry.passedModules.size,
          quizAttempts: entry.quizAttempts,
          averageScorePercent: averagePercent(entry.allScores),
          lastActivityAt: entry.lastActivityAt?.toISOString() ?? null,
          activeAssignments: userAssignments.length,
          completedAssignments,
          paths,
        };
      });

    const engaged = learners.filter(
      (l) => l.lessonsCompleted > 0 || l.quizAttempts > 0,
    );
    const allScores = attemptRows.map((a) => a.scorePercent);

    return {
      learners,
      totals: {
        learners: learners.length,
        activeLearners: engaged.length,
        activeAssignments: assignmentRows.length,
        completedAssignments: learners.reduce((sum, l) => sum + l.completedAssignments, 0),
        averageScorePercent: averagePercent(allScores),
        quizzesPassed: learners.reduce((sum, l) => sum + l.quizzesPassed, 0),
        lessonsCompleted: learners.reduce((sum, l) => sum + l.lessonsCompleted, 0),
      },
    };
  }

  /** Full per-user drilldown (the same shape the learner sees themselves). */
  async getLearnerDetail(
    userId: string,
  ): Promise<{ userId: string; email: string; displayName: string; paths: LearningPathSummary[] }> {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const state = await this.learningService.loadUserState(userId);
    const paths = CURRICULUM.map((path) => this.learningService.buildPathSummary(path, state));
    return { userId: user.id, email: user.email, displayName: user.displayName, paths };
  }
}
