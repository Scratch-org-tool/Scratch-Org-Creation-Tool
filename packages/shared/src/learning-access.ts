/**
 * Fine-grained Academy access: which training tracks and lesson features a
 * non-admin user may see. The platform module grant (`learning`) is still
 * required; these lists further restrict what appears inside the Academy.
 *
 * Empty arrays mean "not configured yet" and fall back to the Salesforce core
 * tracks + all features so existing grants keep working. New tracks
 * (JavaScript, Java, Release Management, Hands-on) are never auto-granted.
 */

/** Canonical path ids shipped in the curriculum registry. */
export const LEARNING_PATH_IDS = [
  'sf-foundations',
  'sf-admin',
  'sf-developer',
  'sf-architect',
  'sf-hands-on',
  'js-fundamentals',
  'java-fundamentals',
  'release-management',
] as const;

export type LearningPathId = (typeof LEARNING_PATH_IDS)[number];

/** Tracks that remain visible when learning is granted but no path list is saved. */
export const LEARNING_CORE_PATH_IDS = [
  'sf-foundations',
  'sf-admin',
  'sf-developer',
  'sf-architect',
] as const satisfies readonly LearningPathId[];

export const LEARNING_PATH_LABELS: Record<LearningPathId, string> = {
  'sf-foundations': 'Salesforce Foundations',
  'sf-admin': 'Admin & Configuration',
  'sf-developer': 'Platform Developer',
  'sf-architect': 'Architect & DevOps',
  'sf-hands-on': 'Salesforce Hands-on Lab',
  'js-fundamentals': 'JavaScript Training',
  'java-fundamentals': 'Java Training',
  'release-management': 'Release Management',
};

/** In-lesson capabilities that can be toggled per user. */
export const LEARNING_FEATURES = ['videos', 'mentor', 'quizzes', 'story'] as const;
export type LearningFeature = (typeof LEARNING_FEATURES)[number];

export const LEARNING_FEATURE_LABELS: Record<LearningFeature, string> = {
  videos: 'Video sessions',
  mentor: 'AI Mentor (chat)',
  quizzes: 'Module quizzes',
  story: 'Story mode / animated explainers',
};

export function isLearningPathId(value: string): value is LearningPathId {
  return (LEARNING_PATH_IDS as readonly string[]).includes(value);
}

export function isLearningFeature(value: string): value is LearningFeature {
  return (LEARNING_FEATURES as readonly string[]).includes(value);
}

export function sanitizeLearningPathIds(values: string[] | null | undefined): LearningPathId[] {
  if (!values?.length) return [];
  const seen = new Set<LearningPathId>();
  for (const value of values) {
    if (isLearningPathId(value)) seen.add(value);
  }
  return LEARNING_PATH_IDS.filter((id) => seen.has(id));
}

export function sanitizeLearningFeatures(values: string[] | null | undefined): LearningFeature[] {
  if (!values?.length) return [];
  const seen = new Set<LearningFeature>();
  for (const value of values) {
    if (isLearningFeature(value)) seen.add(value);
  }
  return LEARNING_FEATURES.filter((id) => seen.has(id));
}

export interface LearningAccessProfile {
  role: 'admin' | 'user';
  grantedModules: readonly string[];
  grantedLearningPaths?: readonly string[] | null;
  grantedLearningFeatures?: readonly string[] | null;
}

/** Paths the user may browse. Admins see every track. */
export function resolveLearningPaths(profile: LearningAccessProfile): LearningPathId[] {
  if (profile.role === 'admin') return [...LEARNING_PATH_IDS];
  if (!profile.grantedModules.includes('learning')) return [];
  const configured = sanitizeLearningPathIds([...(profile.grantedLearningPaths ?? [])]);
  if (configured.length === 0) return [...LEARNING_CORE_PATH_IDS];
  return configured;
}

/** Features the user may use inside granted paths. */
export function resolveLearningFeatures(profile: LearningAccessProfile): LearningFeature[] {
  if (profile.role === 'admin') return [...LEARNING_FEATURES];
  if (!profile.grantedModules.includes('learning')) return [];
  const configured = sanitizeLearningFeatures([...(profile.grantedLearningFeatures ?? [])]);
  if (configured.length === 0) return [...LEARNING_FEATURES];
  return configured;
}

export function canAccessLearningPath(
  profile: LearningAccessProfile,
  pathId: string,
): boolean {
  return resolveLearningPaths(profile).includes(pathId as LearningPathId);
}

export function canUseLearningFeature(
  profile: LearningAccessProfile,
  feature: LearningFeature,
): boolean {
  return resolveLearningFeatures(profile).includes(feature);
}
