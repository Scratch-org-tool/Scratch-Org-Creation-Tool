import { Boxes, CalendarClock, Database, Layers, Rocket, Users, Wrench } from 'lucide-react';
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
  description: string;
  /** Section is visible when the user can access ANY of these modules. */
  modules: AppModule[];
  /** Rendered first, full-width, on the hub page. */
  primary?: boolean;
  columns: 1 | 2 | 3;
  links: DeploymentLink[];
}

export const DEPLOYMENT_SECTIONS: DeploymentSection[] = [
  {
    id: 'cicd',
    title: 'CI/CD deployment',
    description: 'Deploy Salesforce metadata from pipeline sources',
    modules: ['deployment'],
    primary: true,
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
        icon: Rocket,
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
        label: 'Jenkins',
        description: 'Run Jenkins jobs and monitor build status.',
        href: '/deployment-center/jenkins',
        icon: Wrench,
        iconBg: 'bg-orange-500/10 text-orange-400',
        modules: ['deployment'],
        locked: true,
        lockTooltip: 'Coming soon',
        activePrefixes: ['/deployment-center/jenkins'],
      },
    ],
  },
  {
    id: 'data',
    title: 'Data operations',
    description: 'Move, replicate, and template data across orgs',
    modules: ['data'],
    columns: 1,
    links: [
      {
        label: 'Data Operations',
        description: 'CONA seed, generic deploy, replication, and query templates.',
        href: '/data-center?tab=cona',
        icon: Database,
        iconBg: 'bg-green-500/10 text-green-400',
        modules: ['data'],
        activePrefixes: ['/data-center'],
      },
      {
        label: 'Org-to-Org Data Deploy',
        description: 'Compare source vs target records and deploy with insert or upsert.',
        href: '/data-center?tab=org-to-org',
        icon: Database,
        iconBg: 'bg-indigo-500/10 text-indigo-400',
        modules: ['data'],
        activePrefixes: ['/data-center'],
      },
      {
        label: 'Custom Settings Load',
        description: 'SFDMU export from a source org to a target org (bundled or custom JSON).',
        href: '/custom-settings-load',
        icon: Database,
        iconBg: 'bg-teal-500/10 text-teal-400',
        modules: ['data'],
        activePrefixes: ['/custom-settings-load'],
      },
    ],
  },
  {
    id: 'org',
    title: 'Org & users',
    description: 'Configure orgs and provision users at scale',
    modules: ['org-setup', 'provisioning'],
    columns: 1,
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
