'use client';

import { useMemo } from 'react';
import { Boxes, CalendarClock, Database, Layers, Rocket, Users, Wrench } from 'lucide-react';
import {
  DeploymentHubSection,
  DeploymentPageHeader,
  type HubActionItem,
} from '@/components/studio';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule } from '@/lib/auth-utils';

const DEPLOY_ACTIONS: HubActionItem[] = [
  {
    label: 'Deployment Workbench',
    description: 'Unified planning, quality gates, intelligent execution, rollback, and audit.',
    href: '/deployment-workbench',
    icon: Boxes,
    iconBg: 'bg-cyan-500/10 text-cyan-400',
  },
  {
    label: 'Git Metadata Deploy',
    description: 'Deploy metadata from Azure DevOps, GitHub, or Bitbucket with live execution logs.',
    href: '/deployment-center/git',
    icon: Rocket,
    iconBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    label: 'Org-to-Org Metadata',
    description: 'Browse, compare, and deploy metadata between Salesforce orgs.',
    href: '/metadata-deployment',
    icon: Layers,
    iconBg: 'bg-violet-500/10 text-violet-400',
  },
  {
    label: 'Deployment Automations',
    description: 'Schedule saved deployment plans to run automatically and track run history.',
    href: '/deployment-center/automations',
    icon: CalendarClock,
    iconBg: 'bg-pink-500/10 text-pink-400',
  },
  {
    label: 'Jenkins',
    description: 'Run Jenkins jobs and monitor build status.',
    href: '/deployment-center/jenkins',
    icon: Wrench,
    iconBg: 'bg-orange-500/10 text-orange-400',
    locked: true,
    lockTooltip: 'Coming soon',
  },
];

const DATA_SECTION = {
  title: 'Data operations',
  description: 'Move, replicate, and template data across orgs',
  actions: [
    {
      label: 'Data Operations',
      description: 'CONA seed, generic deploy, replication, and query templates.',
      href: '/data-center?tab=cona',
      icon: Database,
      iconBg: 'bg-green-500/10 text-green-400',
    },
    {
      label: 'Org-to-Org Data Deploy',
      description: 'Compare source vs target records and deploy with insert or upsert.',
      href: '/data-center?tab=org-to-org',
      icon: Database,
      iconBg: 'bg-indigo-500/10 text-indigo-400',
    },
    {
      label: 'Custom Settings Load',
      description: 'SFDMU export from a source org to a target org (bundled or custom JSON).',
      href: '/custom-settings-load',
      icon: Database,
      iconBg: 'bg-teal-500/10 text-teal-400',
    },
  ] satisfies HubActionItem[],
};

const ORG_SECTION = {
  title: 'Org & users',
  description: 'Configure orgs and provision users at scale',
  actions: [
    {
      label: 'Org & Users',
      description: 'Baseline setup, org config, and user provisioning.',
      href: '/org-setup',
      icon: Users,
      iconBg: 'bg-amber-500/10 text-amber-400',
    },
  ] satisfies HubActionItem[],
};

export default function DeploymentCenterPage() {
  const { profile } = useAuth();

  const showCicd = canAccessModule(profile, 'deployment');
  const showData = canAccessModule(profile, 'data');
  const showOrg =
    canAccessModule(profile, 'org-setup') || canAccessModule(profile, 'provisioning');

  const secondarySections = useMemo(() => {
    const out: typeof DATA_SECTION[] = [];
    if (showData) out.push(DATA_SECTION);
    if (showOrg) out.push(ORG_SECTION);
    return out;
  }, [showData, showOrg]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Deployment Center"
        subtitle="Deploy metadata, move data, and set up orgs from one place"
        icon={Layers}
        accentClass="to-violet-500/10"
      />

      {showCicd && (
        <DeploymentHubSection
          title="CI/CD deployment"
          description="Deploy Salesforce metadata from pipeline sources"
          actions={DEPLOY_ACTIONS}
          columns={3}
        />
      )}

      {secondarySections.length > 0 && (
        <div
          className={
            secondarySections.length > 1
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-start'
              : undefined
          }
        >
          {secondarySections.map((section) => (
            <DeploymentHubSection
              key={section.title}
              title={section.title}
              description={section.description}
              actions={section.actions}
              columns={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
