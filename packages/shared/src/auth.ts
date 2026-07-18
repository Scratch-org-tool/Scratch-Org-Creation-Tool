export const APP_USER_ID_PREFIX = 'DPT_';

/** Namespace Firebase Auth UIDs for Deployment Tool (shared Firebase project). */
export function toAppUserId(firebaseUid: string): string {
  if (firebaseUid.startsWith(APP_USER_ID_PREFIX)) return firebaseUid;
  return `${APP_USER_ID_PREFIX}${firebaseUid}`;
}

export function isAppUserId(id: string): boolean {
  return id.startsWith(APP_USER_ID_PREFIX);
}

export function toFirebaseUid(appUserId: string): string {
  return isAppUserId(appUserId) ? appUserId.slice(APP_USER_ID_PREFIX.length) : appUserId;
}

export const APP_MODULES = [
  'dashboard',
  'calendar',
  'environment',
  'data',
  'deployment',
  'org-setup',
  'provisioning',
  'monitoring',
  'copilot',
  'defects',
  'learning',
] as const;

/**
 * The dashboard is the authenticated landing shell. Every product feature is
 * opt-in and must be granted by an administrator.
 */
export const DEFAULT_USER_MODULES = ['dashboard'] as const;

export const LOCKED_MODULES = [
  'calendar',
  'environment',
  'data',
  'deployment',
  'org-setup',
  'provisioning',
  'monitoring',
  'copilot',
  'defects',
  'learning',
] as const;

/**
 * Default modules an administrator may switch OFF per user from User Access.
 * `dashboard` is deliberately not revocable: it is the post-login landing page
 * and the redirect target for locked routes, so removing it would strand the
 * user in a redirect loop.
 */
export const REVOCABLE_DEFAULT_MODULES = ['environment', 'data', 'defects'] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type UserRole = 'admin' | 'user';
export type UserAccessStatus = 'active' | 'inactive';

export interface UserAccessProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  grantedModules: AppModule[];
  /** Default modules explicitly switched off for this user by an admin. */
  revokedModules?: AppModule[];
  /** When true, the Academy only shows paths an admin assigned to this user. */
  learningAssignedOnly?: boolean;
  status?: UserAccessStatus;
  lastActiveAt?: string | null;
}

/** Server-side normalization: only revocable defaults may be revoked. */
export function sanitizeRevokedModules(modules: readonly string[] | undefined): AppModule[] {
  if (!modules || modules.length === 0) return [];
  const revocable = new Set<string>(REVOCABLE_DEFAULT_MODULES);
  return [...new Set(modules.filter((m) => revocable.has(m)))] as AppModule[];
}

/**
 * @deprecated UI hint only. Never use for authorization decisions — use
 * server-side ADMIN_BOOTSTRAP_SECRET or ADMIN_EMAILS allowlist instead.
 */
export function isAdminEmail(email: string): boolean {
  return /admin/i.test(email);
}

/**
 * Resolve the role for a login/signup attempt.
 *
 * Admin elevation requires BOTH the server-side allowlist (`isAllowlistedAdmin`,
 * derived from ADMIN_EMAILS) AND the explicit admin confirmation text. Email
 * substring matching alone must never grant admin.
 *
 * @deprecated Use server-side bootstrap token verification instead.
 */
export function resolveRole(
  _email: string,
  adminConfirmText?: string,
  isAllowlistedAdmin = false,
): UserRole {
  if (isAllowlistedAdmin && adminConfirmText?.trim().toLowerCase() === 'admin') {
    return 'admin';
  }
  return 'user';
}

export function getEffectiveModules(
  profile: Pick<UserAccessProfile, 'role' | 'grantedModules'> &
    Partial<Pick<UserAccessProfile, 'revokedModules'>>,
): AppModule[] {
  if (profile.role === 'admin') {
    return [...APP_MODULES];
  }
  const granted = new Set<AppModule>([...DEFAULT_USER_MODULES, ...profile.grantedModules]);
  // Revocations are admin-controlled and only ever apply to revocable
  // defaults, so a stale/legacy grant of a default module cannot bypass them.
  for (const revoked of sanitizeRevokedModules(profile.revokedModules)) {
    granted.delete(revoked);
  }
  return APP_MODULES.filter((m) => granted.has(m));
}

export function canAccessModule(
  profile:
    | (Pick<UserAccessProfile, 'role' | 'grantedModules'> &
        Partial<Pick<UserAccessProfile, 'revokedModules'>>)
    | null
    | undefined,
  module: AppModule,
): boolean {
  if (!profile) return false;
  return getEffectiveModules(profile).includes(module);
}

/** Copilot knowledge tiers. `internal` (code/architecture) is admin-only. */
export const KNOWLEDGE_TIERS = ['app_guide', 'internal'] as const;
export type KnowledgeTier = (typeof KNOWLEDGE_TIERS)[number];

/**
 * Knowledge tiers a user may retrieve from. Admins get everything; non-admin
 * users with an explicit copilot grant get only the app-usage guide tier —
 * internal (codebase/architecture) chunks physically never enter their prompts.
 */
export function resolveCopilotTiers(
  profile: Pick<UserAccessProfile, 'role' | 'grantedModules'> | null | undefined,
): KnowledgeTier[] {
  if (!profile) return [];
  if (profile.role === 'admin') return ['app_guide', 'internal'];
  return canAccessModule(profile, 'copilot') ? ['app_guide'] : [];
}

export const MODULE_LABELS: Record<AppModule, string> = {
  dashboard: 'Dashboard',
  calendar: 'Release Calendar',
  environment: 'Environment Center',
  data: 'Data Center',
  deployment: 'Deployment Center',
  'org-setup': 'Org Setup Center',
  provisioning: 'User Provisioning',
  monitoring: 'Monitoring',
  copilot: 'AI Copilot',
  defects: 'AI Defects Command Centre',
  learning: 'Salesforce Academy',
};

export const MODULE_DESCRIPTIONS: Record<AppModule, string> = {
  dashboard: 'Authenticated landing page and personal platform summary.',
  calendar: 'Release events, deployment windows, and freeze-window visibility.',
  environment: 'Salesforce org connections, source control, scratch orgs, and sandbox refresh.',
  data: 'Data movement, org-to-org deployment, seeding, and custom settings.',
  deployment: 'Metadata workbench, releases, CI/CD, quality, and drift operations.',
  'org-setup': 'Org configuration and post-provisioning setup workflows.',
  provisioning: 'Create and manage Salesforce user-provisioning batches.',
  monitoring: 'Operational metrics, job health, and platform diagnostics.',
  copilot: 'AI assistance grounded in the permitted application guide.',
  defects: 'Developer Board defects, Apex quality, chat, and work-item workflows.',
  learning: 'Salesforce Academy lessons, quizzes, mentor, videos, and assigned training.',
};

export const ROUTE_MODULE_MAP: Record<string, AppModule | null> = {
  // Explicitly registered authenticated-only routes are available regardless
  // of module grants. Authentication and active status remain server/guarded.
  '/account': null,
  '/calendar': 'calendar',
  '/dashboard': 'dashboard',
  '/environment-center': 'environment',
  '/scratch-templates': 'environment',
  '/sandbox-refresh': 'environment',
  '/data-center': 'data',
  '/data-deploy': 'data',
  '/custom-settings-load': 'data',
  '/deployment-center': 'deployment',
  '/deployment-workbench': 'deployment',
  '/metadata-deployment': 'deployment',
  '/releases': 'deployment',
  '/quality': 'deployment',
  '/drift': 'deployment',
  '/org-setup': 'org-setup',
  '/user-provisioning': 'provisioning',
  '/monitoring': 'monitoring',
  '/defects-command-centre': 'defects',
  '/learning': 'learning',
  // Admin routes are authorized by role, not by the default dashboard grant.
  '/admin': null,
};

function routePrefixForPath(pathname: string): string | undefined {
  const sorted = Object.keys(ROUTE_MODULE_MAP).sort((a, b) => b.length - a.length);
  return sorted.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function moduleForPath(pathname: string): AppModule | null {
  const prefix = routePrefixForPath(pathname);
  return prefix ? (ROUTE_MODULE_MAP[prefix] ?? null) : null;
}

/** True only for explicitly registered authenticated application routes. */
export function isRegisteredAppPath(pathname: string): boolean {
  return routePrefixForPath(pathname) !== undefined;
}

/** Mockup-style role label derived from admin/user + granted modules. */
export function displayAccessRole(
  profile: Pick<UserAccessProfile, 'role' | 'grantedModules'>,
): string {
  if (profile.role === 'admin') return 'Super Admin';
  const granted = profile.grantedModules ?? [];
  const hasDeployment = granted.includes('deployment');
  const hasData = granted.includes('data');
  if (hasDeployment && hasData) return 'Integration';
  const lockedCount = LOCKED_MODULES.filter((m) => granted.includes(m)).length;
  if (lockedCount >= 2) return 'Developer';
  return 'Viewer';
}
