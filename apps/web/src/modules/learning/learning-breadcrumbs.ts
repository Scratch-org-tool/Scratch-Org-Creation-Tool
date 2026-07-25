import type { BreadcrumbItem } from '@/lib/nav-breadcrumbs';

export const LEARNING_ACADEMY_CRUMB: BreadcrumbItem = {
  href: '/learning',
  label: 'Salesforce Academy',
};

export const LEARNING_TEAM_CRUMB: BreadcrumbItem = {
  href: '/learning/team',
  label: 'Team Progress',
};

/** Build Salesforce Academy drill-down breadcrumbs (always includes the academy root). */
export function learningCrumbs(...trail: BreadcrumbItem[]): BreadcrumbItem[] {
  return [LEARNING_ACADEMY_CRUMB, ...trail];
}

export function learningPathCrumbs(pathId: string, pathTitle: string): BreadcrumbItem[] {
  return learningCrumbs({ href: `/learning/paths/${pathId}`, label: pathTitle });
}

export function learningLessonCrumbs(
  pathId: string,
  pathTitle: string,
  lessonId: string,
  lessonTitle: string,
): BreadcrumbItem[] {
  return learningCrumbs(
    { href: `/learning/paths/${pathId}`, label: pathTitle },
    { href: `/learning/lessons/${lessonId}`, label: lessonTitle },
  );
}

export function learningQuizCrumbs(
  pathId: string,
  pathTitle: string,
  moduleId: string,
  moduleTitle: string,
): BreadcrumbItem[] {
  return learningCrumbs(
    { href: `/learning/paths/${pathId}`, label: pathTitle },
    { href: `/learning/modules/${moduleId}/quiz`, label: `${moduleTitle} quiz` },
  );
}

export function learningTeamCrumbs(): BreadcrumbItem[] {
  return [LEARNING_ACADEMY_CRUMB, LEARNING_TEAM_CRUMB];
}
