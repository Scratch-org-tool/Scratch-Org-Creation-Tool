'use client';

import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import {
  DeploymentHubSection,
  DeploymentPageHeader,
  type HubActionItem,
} from '@/components/studio';
import { useAuth } from '@/contexts/auth-context';
import { canAccessModule } from '@/lib/auth-utils';
import { DEPLOYMENT_SECTIONS, type DeploymentLink } from '@/lib/deployment-links';

function toHubAction(link: DeploymentLink): HubActionItem {
  return {
    label: link.label,
    description: link.description,
    href: link.href,
    icon: link.icon,
    iconBg: link.iconBg,
    locked: link.locked,
    lockTooltip: link.lockTooltip,
  };
}

export default function DeploymentCenterPage() {
  const { profile } = useAuth();

  const visibleSections = useMemo(
    () =>
      DEPLOYMENT_SECTIONS.filter((section) =>
        section.modules.some((m) => canAccessModule(profile, m)),
      ),
    [profile],
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <DeploymentPageHeader
        title="Deployment Center"
        subtitle="Deploy metadata, move data, and set up orgs from one place"
        icon={Layers}
        accentClass="to-violet-500/10"
      />

      {visibleSections.map((section) => (
        <DeploymentHubSection
          key={section.id}
          title={section.title}
          description={section.description}
          actions={section.links.map(toHubAction)}
          columns={section.columns}
        />
      ))}
    </div>
  );
}
