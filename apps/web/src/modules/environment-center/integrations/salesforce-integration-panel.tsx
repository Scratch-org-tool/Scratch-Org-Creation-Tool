'use client';

import Link from 'next/link';
import { Plus, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { GlassCard, InlineAlert } from '@/components/studio';
import { SalesforceOrgTypeSelector } from './salesforce-org-type-selector';
import { SalesforceOrgsTable } from './salesforce-orgs-table';
import { ScratchOrgsTable } from './scratch-orgs-table';
import type { IntegrationsWorkspaceState } from './use-integrations-workspace';

interface SalesforceIntegrationPanelProps {
  w: IntegrationsWorkspaceState;
}

export function SalesforceIntegrationPanel({ w }: SalesforceIntegrationPanelProps) {
  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{w.optimisticAnnouncement}</p>
      <GlassCard
        title="Add Salesforce org"
        description="Authenticate a production org, sandbox, or Dev Hub via web login."
      >
        <div className="space-y-4">
          <SalesforceOrgTypeSelector
            value={w.sfForm.orgType}
            onChange={w.setOrgType}
            disabled={w.authorizing}
            customUrl={w.sfForm.instanceUrl}
            onCustomUrlChange={(url) => w.setSfForm({ ...w.sfForm, instanceUrl: url })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salesforce-org-alias">Alias</Label>
              <Input
                id="salesforce-org-alias"
                value={w.sfForm.alias}
                onChange={(e) => w.setSfForm({ ...w.sfForm, alias: e.target.value })}
                placeholder="NE-DEVHUB"
                disabled={w.authorizing}
              />
            </div>
            <div>
              <Label htmlFor="salesforce-instance-url">Instance URL</Label>
              <Input
                id="salesforce-instance-url"
                value={w.sfForm.instanceUrl}
                onChange={(e) => w.setSfForm({ ...w.sfForm, instanceUrl: e.target.value, orgType: 'custom' })}
                disabled={w.authorizing || w.sfForm.orgType !== 'custom'}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void w.authorize()} loading={w.authorizing} disabled={!w.sfForm.alias.trim()}>
              Connect org
            </Button>
            {w.authorizing && (
              <Button variant="destructive" size="sm" onClick={() => void w.stopAuthorize()}>
                <Square className="w-3 h-3 mr-2 fill-current" />
                Stop
              </Button>
            )}
          </div>
          {w.authMessage && <InlineAlert variant={w.authVariant}>{w.authMessage}</InlineAlert>}
        </div>
      </GlassCard>

      <GlassCard title="Authenticated orgs" description="Dev Hubs and production/sandbox connections.">
        <SalesforceOrgsTable
          orgs={w.orgs}
          loading={w.refreshing}
          disconnectingAlias={w.disconnectingAlias}
          defaultDevHubBusy={w.defaultDevHubBusy}
          defaultDevHubErrors={w.defaultDevHubErrors}
          onSetDefault={(alias) => void w.setDefaultDevHub(alias)}
          onDisconnect={w.setPendingDisconnect}
        />
      </GlassCard>

      <div id="scratch-orgs">
        <GlassCard
          title="Scratch orgs"
          description="Created by the automation pipeline."
          headerAction={
            <Link
              href="/environment-center/create-scratch-org"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </Link>
          }
        >
          <ScratchOrgsTable
            orgs={w.scratchOrgs}
            loading={w.refreshing}
            deletingAlias={w.deletingScratchAlias}
            onOpenCredentials={(alias) => void w.openCredentials(alias)}
            onDelete={w.setPendingScratchDelete}
          />
        </GlassCard>
      </div>
    </div>
  );
}
