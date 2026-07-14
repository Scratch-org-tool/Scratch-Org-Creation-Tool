'use client';

import Link from 'next/link';
import { ExternalLink, Star, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/studio/status-badge';
import {
  IntegrationsDataTable,
  IntegrationsTableHead,
  IntegrationsTh,
  IntegrationsTd,
  IntegrationsTr,
} from './integrations-data-table';
import type { ConnectedOrg } from './types';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface SalesforceOrgsTableProps {
  orgs: ConnectedOrg[];
  loading?: boolean;
  disconnectingAlias: string | null;
  onSetDefault: (alias: string) => void;
  onDisconnect: (alias: string) => void;
}

export function SalesforceOrgsTable({
  orgs,
  loading,
  disconnectingAlias,
  onSetDefault,
  onDisconnect,
}: SalesforceOrgsTableProps) {
  if (!loading && orgs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No authenticated orgs yet. Use the form above to connect.
      </p>
    );
  }

  return (
    <IntegrationsDataTable>
      <IntegrationsTableHead>
        <IntegrationsTh>Org</IntegrationsTh>
        <IntegrationsTh>Type</IntegrationsTh>
        <IntegrationsTh>Instance</IntegrationsTh>
        <IntegrationsTh>Connected</IntegrationsTh>
        <IntegrationsTh>Status</IntegrationsTh>
        <IntegrationsTh className="text-right">Actions</IntegrationsTh>
      </IntegrationsTableHead>
      <tbody>
        {orgs.map((org) => (
          <IntegrationsTr key={org.id ?? org.alias}>
            <IntegrationsTd>
              <p className="font-medium">{org.alias}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{org.username ?? '—'}</p>
            </IntegrationsTd>
            <IntegrationsTd>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/60 capitalize">
                {org.orgType}
              </span>
            </IntegrationsTd>
            <IntegrationsTd>
              <span className="text-xs text-muted-foreground truncate max-w-[120px] block" title={org.instanceUrl}>
                {org.instanceUrl ?? '—'}
              </span>
            </IntegrationsTd>
            <IntegrationsTd>
              <span className="text-xs text-muted-foreground">{formatDate(org.createdAt)}</span>
            </IntegrationsTd>
            <IntegrationsTd>
              <StatusBadge status={org.status === 'Connected' ? 'completed' : org.status} label={org.status} />
            </IntegrationsTd>
            <IntegrationsTd>
              <div className="flex items-center justify-end gap-1 flex-wrap">
                {org.instanceUrl && (
                  <a href={org.instanceUrl} target="_blank" rel="noreferrer" title="Login to org">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary">
                      <ExternalLink className="w-3 h-3" />
                      Login
                    </Button>
                  </a>
                )}
                {org.isDevHub && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!!disconnectingAlias || org.isDefaultDevHub}
                    onClick={() => onSetDefault(org.alias)}
                    title={org.isDefaultDevHub ? 'Default Dev Hub' : 'Set as default Dev Hub'}
                  >
                    <Star className={`w-3 h-3 ${org.isDefaultDevHub ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  loading={disconnectingAlias === org.alias}
                  disabled={!!disconnectingAlias}
                  onClick={() => onDisconnect(org.alias)}
                >
                  <Unplug className="w-3 h-3" />
                </Button>
              </div>
            </IntegrationsTd>
          </IntegrationsTr>
        ))}
      </tbody>
    </IntegrationsDataTable>
  );
}
