import {
  Activity,
  Bell,
  Bug,
  CalendarDays,
  Cloud,
  FileStack,
  GitCompare,
  GraduationCap,
  LayoutDashboard,
  Rocket,
  ScrollText,
  Shield,
} from 'lucide-react';
import { canAccessModule, type AppModule } from '@/lib/auth-utils';
import { DEPLOYMENT_LINKS, DEPLOYMENT_SECTIONS } from '@/lib/deployment-links';
import type { LucideIcon } from 'lucide-react';

export interface NavChild {
  href: string;
  label: string;
  /** Visible when the user can access ANY of these modules (omit = always). */
  modules?: AppModule[];
  /** Rendered non-interactive with a lock (e.g. "coming soon"). */
  locked?: boolean;
  /** Extra path prefixes that mark this child active. */
  activePrefixes?: string[];
  /** Group heading rendered above this child when it differs from the previous child. */
  group?: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: AppModule;
  children?: NavChild[];
  activePrefixes?: string[];
  accessibleModules?: AppModule[];
}

/** Deployment submenu + active prefixes, derived from the shared link source. */
const DEPLOYMENT_CHILDREN: NavChild[] = DEPLOYMENT_SECTIONS.flatMap((section) =>
  section.links.map((link) => ({
    href: link.href,
    label: link.label,
    modules: link.modules,
    locked: link.locked,
    activePrefixes: link.activePrefixes,
    group: section.shortTitle,
  })),
);

const DEPLOYMENT_ACTIVE_PREFIXES = Array.from(
  new Set([
    '/deployment-center',
    ...DEPLOYMENT_LINKS.flatMap(
      (link) => link.activePrefixes ?? [link.href.split('?')[0]!],
    ),
  ]),
);

/** Flat top-level nav — hubs + breadcrumbs handle drill-down. */
export const APP_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  {
    href: '/environment-center',
    label: 'Environment Center',
    icon: Cloud,
    module: 'environment',
    children: [
      { href: '/environment-center?tab=salesforce', label: 'Salesforce' },
      { href: '/environment-center?tab=source-control', label: 'Source Control' },
      { href: '/environment-center?tab=work-management', label: 'Work Management' },
      { href: '/environment-center/create-scratch-org', label: 'Create Scratch Org' },
      { href: '/environment-center/automation', label: 'Scratch Org Automation' },
      { href: '/sandbox-refresh', label: 'Sandbox Refresh' },
    ],
    activePrefixes: ['/scratch-templates', '/sandbox-refresh'],
  },
  { href: '/scratch-templates', label: 'Templates', icon: FileStack, module: 'environment' },
  {
    href: '/deployment-center',
    label: 'Deployment',
    icon: Rocket,
    module: 'deployment',
    accessibleModules: ['deployment', 'data', 'org-setup', 'provisioning'],
    children: DEPLOYMENT_CHILDREN,
    activePrefixes: DEPLOYMENT_ACTIVE_PREFIXES,
  },
  { href: '/drift', label: 'Drift Monitoring', icon: GitCompare, module: 'deployment' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, module: 'calendar' },
  { href: '/monitoring', label: 'Monitoring', icon: Activity, module: 'monitoring' },
  { href: '/defects-command-centre', label: 'Developer Board', icon: Bug, module: 'defects' },
  { href: '/learning', label: 'Salesforce Academy', icon: GraduationCap, module: 'learning' },
];

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Admin-only entries rendered beneath the main nav for administrators. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin/users', label: 'User Access', icon: Shield },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/audit', label: 'Audit Report', icon: ScrollText },
  { href: '/learning/team', label: 'Academy Progress', icon: GraduationCap },
];

/** @deprecated Prefer {@link ADMIN_NAV_ITEMS}. Kept for existing imports. */
export const ADMIN_NAV_ITEM = ADMIN_NAV_ITEMS[0]!;

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname.startsWith(item.href)) return true;
  return (
    item.activePrefixes?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false
  );
}

export function canAccessNavItem(
  profile: Parameters<typeof canAccessModule>[0],
  item: NavItem,
): boolean {
  const modules = item.accessibleModules ?? [item.module];
  return modules.some((m) => canAccessModule(profile, m));
}

export function canAccessNavChild(
  profile: Parameters<typeof canAccessModule>[0],
  child: NavChild,
): boolean {
  if (!child.modules || child.modules.length === 0) return true;
  return child.modules.some((m) => canAccessModule(profile, m));
}

/**
 * Child links may carry query strings (e.g. `/data-center?tab=cona`). Match on
 * the path (plus any `activePrefixes`) and, when present, the query params too,
 * so sibling tabs of the same base route highlight independently.
 */
export function isNavChildActive(
  pathname: string,
  search: string,
  child: NavChild,
): boolean {
  const [base, query] = child.href.split('?');
  const prefixes = [base!, ...(child.activePrefixes ?? [])];
  const pathMatches = prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!pathMatches) return false;
  if (!query) return true;

  const expected = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  for (const [key, value] of expected) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function avatarColor(name: string): string {
  const colors = [
    'bg-blue-500/20 text-blue-300',
    'bg-purple-500/20 text-purple-300',
    'bg-green-500/20 text-green-300',
    'bg-amber-500/20 text-amber-300',
    'bg-cyan-500/20 text-cyan-300',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length]!;
}
