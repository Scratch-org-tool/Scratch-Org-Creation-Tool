import {
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  Database,
  FlaskConical,
  GitBranch,
  Layers,
  Package,
  Settings2,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppModule } from '@/lib/auth-utils';

/**
 * Single source of truth for every deployment-related destination.
 *
 * Consumed by both the sidebar "Deployment" submenu and the Deployment Center
 * hub page so the two can never drift apart (no duplicated link lists).
 */
export interface DeploymentLink {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconBg: string;
  /** Visible when the user can access ANY of these modules. */
  modules: AppModule[];
  locked?: boolean;
  lockTooltip?: string;
  /** Extra path prefixes that should mark this link (and its section) active. */
  activePrefixes?: string[];
}

export interface DeploymentSection {
  id: string;
  title: string;
  /** Compact heading used to group links in the sidebar submenu. */
  shortTitle: string;
  description: string;
  /** Section is visible when the user can access ANY of these modules. */
  modules: AppModule[];
  columns: 1 | 2 | 3;
  links: DeploymentLink[];
}

export const DEPLOYMENT_SECTIONS: DeploymentSection[] = [
  {
    id: 'cicd',
    title: 'CI/CD deployment',
    shortTitle: 'CI/CD',
    description: 'Deploy Salesforce metadata from pipeline sources',
    modules: ['deployment'],
    columns: 3,
    links: [
      {
        label: 'Deployment Workbench',
        description: 'Unified planning, quality gates, intelligent execution, rollback, and audit.',
        href: '/deployment-workbench',
        icon: Boxes,
        iconBg: 'bg-cyan-500/10 text-cyan-400',
        modules: ['deployment'],
        activePrefixes: ['/deployment-workbench'],
      },
      {
        label: 'Git Metadata Deploy',
        description: 'Deploy metadata from Azure DevOps, GitHub, or Bitbucket with live execution logs.',
        href: '/deployment-center/git',
        icon: GitBranch,
        iconBg: 'bg-blue-500/10 text-blue-400',
        modules: ['deployment'],
        activePrefixes: ['/deployment-center/git', '/deployment-center/azure', '/deployment-center/releases'],
      },
      {
        label: 'Org-to-Org Metadata',
        description: 'Browse, compare, and deploy metadata between Salesforce orgs.',
        href: '/metadata-deployment',
        icon: Layers,
        iconBg: 'bg-violet-500/10 text-violet-400',
        modules: ['deployment'],
        activePrefixes: ['/metadata-deployment'],
      },
      {
        label: 'Deployment Automations',
        description: 'Schedule saved deployment plans to run automatically and track run history.',
        href: '/deployment-center/automations',
        icon: CalendarClock,
        iconBg: 'bg-pink-500/10 text-pink-400',
        modules: ['deployment'],
        activePrefixes: ['/deployment-center/automations'],
      },
      {
        label: 'Releases',
        description: 'Group deployments and work items into versioned releases with approvals and notes.',
        href: '/releases',
        icon: Package,
        iconBg: 'bg-fuchsia-500/10 text-fuchsia-400',
        modules: ['deployment'],
        activePrefixes: ['/releases'],
      },
      {
        label: 'Apex Quality',
        description: 'Run Apex tests, review failures, and track org-wide code coverage trends.',
        href: '/quality',
        icon: FlaskConical,
        iconBg: 'bg-emerald-500/10 text-emerald-400',
        modules: ['deployment'],
        activePrefixes: ['/quality'],
      },
      {
        label: 'Jenkins',
        description: 'Run Jenkins jobs, stream live console logs, and monitor build status.',
        href: '/deployment-center/jenkins',
        icon: Wrench,
        iconBg: 'bg-orange-500/10 text-orange-400',
        modules: ['deployment'],
        activePrefixes: ['/deployment-center/jenkins'],
      },
    ],
  },
  {
    id: 'data',
    title: 'Data operations',
    shortTitle: 'Data',
    description: 'Move, replicate, and template data across orgs',
    modules: ['data'],
    columns: 3,
    links: [
      {
        label: 'Org-to-Org Data Deploy',
        description: 'Pick objects, preview and compare records against the target, then insert or upsert.',
        href: '/data-deploy',
        icon: ArrowLeftRight,
        iconBg: 'bg-indigo-500/10 text-indigo-400',
        modules: ['data'],
        activePrefixes: ['/data-deploy'],
      },
      {
        label: 'Data Operations',
        description: 'CONA seed, generic SOQL deploy, replication, and query templates.',
        href: '/data-center',
        icon: Database,
        iconBg: 'bg-green-500/10 text-green-400',
        modules: ['data'],
        activePrefixes: ['/data-center'],
      },
      {
        label: 'Custom Settings Load',
        description: 'SFDMU export from a source org to a target org (bundled or custom JSON).',
        href: '/custom-settings-load',
        icon: Settings2,
        iconBg: 'bg-teal-500/10 text-teal-400',
        modules: ['data'],
        activePrefixes: ['/custom-settings-load'],
      },
    ],
  },
  {
    id: 'org',
    title: 'Org & users',
    shortTitle: 'Org & users',
    description: 'Configure orgs and provision users at scale',
    modules: ['org-setup', 'provisioning'],
    columns: 3,
    links: [
      {
        label: 'Org & Users',
        description: 'Baseline setup, org config, and user provisioning.',
        href: '/org-setup',
        icon: Users,
        iconBg: 'bg-amber-500/10 text-amber-400',
        modules: ['org-setup', 'provisioning'],
        activePrefixes: ['/org-setup', '/user-provisioning'],
      },
    ],
  },
];

/** Flat list of every deployment link (order preserved across sections). */
export const DEPLOYMENT_LINKS: DeploymentLink[] = DEPLOYMENT_SECTIONS.flatMap(
  (section) => section.links,
);
