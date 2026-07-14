'use client';

import { Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { IntegrationsWorkspaceState } from './use-integrations-workspace';

interface AzureIntegrationPanelProps {
  w: IntegrationsWorkspaceState;
}

export function AzureIntegrationPanel({ w }: AzureIntegrationPanelProps) {
  const connected = w.azureStatus?.connected;

  return (
    <div className="space-y-6 max-w-3xl">
      <div
        className={cn(
          'rounded-xl border p-5',
          connected
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-border/60 bg-card/40',
        )}
      >
        <p className="text-sm font-medium">{connected ? 'Azure DevOps connected' : 'Not linked'}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {connected
            ? `Org: ${w.azureStatus?.orgSlug ?? '—'}${w.azureStatus?.project ? ` · Project: ${w.azureStatus.project}` : ''}`
            : 'Connect Azure DevOps to deploy metadata from Git in automated pipelines.'}
        </p>
        {connected && w.azureStatus?.source === 'environment' && (
          <p className="text-xs text-muted-foreground mt-2">Credentials loaded from server environment.</p>
        )}
      </div>

      <GlassCard title="Link Azure DevOps">
        <FormSection
          title="Connection details"
          description="Create a PAT with Code (Read), Work Items (Read), and Work Items (Read & write) scopes in Azure DevOps User Settings."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Organization slug</Label>
              <Input
                value={w.azureForm.orgSlug}
                onChange={(e) => w.setAzureForm({ ...w.azureForm, orgSlug: e.target.value })}
                placeholder="my-org"
                disabled={w.azureSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                dev.azure.com/<strong>my-org</strong>
              </p>
            </div>
            <div>
              <Label>Default project (optional)</Label>
              <Input
                value={w.azureForm.project}
                onChange={(e) => w.setAzureForm({ ...w.azureForm, project: e.target.value })}
                placeholder="MyProject"
                disabled={w.azureSubmitting}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Personal Access Token</Label>
              <Input
                type="password"
                value={w.azureForm.pat}
                onChange={(e) => w.setAzureForm({ ...w.azureForm, pat: e.target.value })}
                placeholder="••••••••••••••••"
                disabled={w.azureSubmitting}
              />
            </div>
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            onClick={() => void w.azureConnect()}
            loading={w.azureSubmitting}
            disabled={!w.azureForm.orgSlug.trim() || !w.azureForm.pat}
          >
            Connect
          </Button>
          {connected && (
            <>
              <Button variant="outline" onClick={() => void w.azureVerify()} loading={w.azureSubmitting}>
                Verify
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => void w.azureDisconnect()}
                loading={w.azureSubmitting}
              >
                <Unplug className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </>
          )}
        </div>

        {w.azureMessage && (
          <InlineAlert variant={w.azureMessage.variant} className="mt-4">
            {w.azureMessage.text}
          </InlineAlert>
        )}
      </GlassCard>
    </div>
  );
}
