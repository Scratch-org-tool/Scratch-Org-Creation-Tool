import { LEARNING_CATEGORY_RANK, LEARNING_LEVEL_RANK } from '@sfcc/shared';
import type {
  CurriculumLesson,
  CurriculumModule,
  CurriculumPath,
  CurriculumQuizQuestion,
} from './curriculum.types';
import { foundationsPath } from './foundations.path';
import { adminPath } from './admin.path';
import { developerPath } from './developer.path';
import { architectPath } from './architect.path';
import { sfIntegrationPath } from './sf-integration.path';
import { javascriptPath } from './javascript.path';
import { javaPath } from './java.path';
import { releaseManagementPath } from './release-management.path';

export type {
  CurriculumLesson,
  CurriculumModule,
  CurriculumPath,
  CurriculumQuizQuestion,
} from './curriculum.types';

/**
 * All paths, grouped by discipline (Salesforce → JavaScript → Java → DevOps)
 * and, within each discipline, ordered beginner → expert.
 */
export const CURRICULUM: CurriculumPath[] = [
  foundationsPath,
  adminPath,
  developerPath,
  architectPath,
  sfIntegrationPath,
  javascriptPath,
  javaPath,
  releaseManagementPath,
].sort((a, b) => {
  const byCategory = LEARNING_CATEGORY_RANK[a.category] - LEARNING_CATEGORY_RANK[b.category];
  return byCategory !== 0 ? byCategory : LEARNING_LEVEL_RANK[a.level] - LEARNING_LEVEL_RANK[b.level];
});

export interface LessonLocation {
  path: CurriculumPath;
  module: CurriculumModule;
  lesson: CurriculumLesson;
  lessonIndex: number;
}

export interface ModuleLocation {
  path: CurriculumPath;
  module: CurriculumModule;
}

const pathById = new Map<string, CurriculumPath>();
const moduleById = new Map<string, ModuleLocation>();
const lessonById = new Map<string, LessonLocation>();

for (const path of CURRICULUM) {
  if (pathById.has(path.id)) throw new Error(`Duplicate learning path id: ${path.id}`);
  pathById.set(path.id, path);
  for (const module of path.modules) {
    if (moduleById.has(module.id)) throw new Error(`Duplicate learning module id: ${module.id}`);
    moduleById.set(module.id, { path, module });
    module.lessons.forEach((lesson, lessonIndex) => {
      if (lessonById.has(lesson.id)) throw new Error(`Duplicate learning lesson id: ${lesson.id}`);
      lessonById.set(lesson.id, { path, module, lesson, lessonIndex });
    });
  }
}

export function getPath(pathId: string): CurriculumPath | null {
  return pathById.get(pathId) ?? null;
}

export function getModule(moduleId: string): ModuleLocation | null {
  return moduleById.get(moduleId) ?? null;
}

export function getLesson(lessonId: string): LessonLocation | null {
  return lessonById.get(lessonId) ?? null;
}

export function allLessonIds(): string[] {
  return [...lessonById.keys()];
}

export function totalLessonCount(): number {
  return lessonById.size;
}

export function totalModuleCount(): number {
  return moduleById.size;
}

export function moduleDurationMinutes(module: CurriculumModule): number {
  return module.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
}
