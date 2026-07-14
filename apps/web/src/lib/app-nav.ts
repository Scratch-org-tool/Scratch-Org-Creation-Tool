import {
  Activity,
  Bug,
  Cloud,
  FileStack,
  Layers,
  LayoutDashboard,
  Rocket,
  Shield,
} from 'lucide-react';
import { canAccessModule, type AppModule } from '@/lib/auth-utils';
import type { LucideIcon } from 'lucide-react';

export interface NavChild {
  href: string;
  label: string;
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

/** Flat top-level nav — hubs + breadcrumbs handle drill-down. */
export const APP_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  {
    href: '/environment-center',
    label: 'Environment',
    icon: Cloud,
    module: 'environment',
    children: [
      { href: '/environment-center', label: 'Integrations' },
      { href: '/environment-center/create-scratch-org', label: 'Create Scratch Org' },
    ],
    activePrefixes: ['/scratch-templates'],
  },
  { href: '/scratch-templates', label: 'Templates', icon: FileStack, module: 'environment' },
  {
    href: '/deployment-center',
    label: 'Deployment',
    icon: Rocket,
    module: 'deployment',
    accessibleModules: ['deployment', 'data', 'org-setup', 'provisioning'],
    activePrefixes: [
      '/deployment-center',
      '/data-center',
      '/org-setup',
      '/user-provisioning',
      '/custom-settings-load',
    ],
  },
  {
    href: '/metadata-deployment',
    label: 'Metadata Deployment',
    icon: Layers,
    module: 'deployment',
    activePrefixes: ['/metadata-deployment'],
  },
  { href: '/monitoring', label: 'Monitoring', icon: Activity, module: 'monitoring' },
  { href: '/defects-command-centre', label: 'Developer Board', icon: Bug, module: 'defects' },
];

export const ADMIN_NAV_ITEM = {
  href: '/admin/users',
  label: 'User Access',
  icon: Shield,
} as const;

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
