'use client';

import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { Label, Select } from '@/components/ui/input';
import { FormSection, InlineAlert } from '@/components/studio';
import { OrgConfigLoadAction } from './org-config-load-action';
import type { OrgSetupWorkspaceState } from './use-org-setup-workspace';

interface LoadOrgConfigPanelProps {
  w: OrgSetupWorkspaceState;
}

export function LoadOrgConfigPanel({ w }: LoadOrgConfigPanelProps) {
  const selectedAlias = w.orgs.find((o) => o.id === w.orgId)?.alias;

  return (
    <>
      <InlineAlert variant="info" title="Automatic in scratch pipeline" className="mb-4">
        This step runs automatically as <strong>Load Org Config</strong> after custom settings when you create a scratch org via the
        pipeline. Use this panel to run it manually against any connected org.{' '}
        <Link
          href="/environment-center/create-scratch-org"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          <Rocket className="w-3 h-3" />
          Create Scratch Org
        </Link>
      </InlineAlert>

      <FormSection title="Manual load">
        <div>
          <Label htmlFor="org-config-target-org">Target Org</Label>
          <Select id="org-config-target-org" value={w.orgId} onChange={(e) => w.setOrgId(e.target.value)}>
            <option value="">Select…</option>
            {w.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.alias}
              </option>
            ))}
          </Select>
        </div>
        <OrgConfigLoadAction
          orgId={w.orgId}
          orgAlias={selectedAlias}
          className="mt-4"
        />
      </FormSection>
    </>
  );
}
