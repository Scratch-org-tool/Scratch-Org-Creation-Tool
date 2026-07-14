'use client';

import Link from 'next/link';
import { ExternalLink, KeyRound, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/studio/status-badge';
import {
  IntegrationsDataTable,
  IntegrationsTableHead,
  IntegrationsTh,
  IntegrationsTd,
  IntegrationsTr,
} from './integrations-data-table';
import type { ScratchOrg } from './types';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ScratchOrgsTableProps {
  orgs: ScratchOrg[];
  loading?: boolean;
  deletingAlias: string | null;
  onOpenCredentials: (alias: string) => void;
  onDelete: (alias: string) => void;
}

export function ScratchOrgsTable({
  orgs,
  loading,
  deletingAlias,
  onOpenCredentials,
  onDelete,
}: ScratchOrgsTableProps) {
  if (!loading && orgs.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-muted-foreground">No scratch orgs yet.</p>
        <Link
          href="/environment-center/create-scratch-org"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs font-medium"
        >
          <Plus className="w-4 h-4 mr-1" />
          Create Scratch Org
        </Link>
      </div>
    );
  }

  return (
    <IntegrationsDataTable>
      <IntegrationsTableHead>
        <IntegrationsTh>Alias</IntegrationsTh>
        <IntegrationsTh>Username</IntegrationsTh>
        <IntegrationsTh>Dev Hub</IntegrationsTh>
        <IntegrationsTh>Created</IntegrationsTh>
        <IntegrationsTh>Expires</IntegrationsTh>
        <IntegrationsTh>Status</IntegrationsTh>
        <IntegrationsTh className="text-right">Actions</IntegrationsTh>
      </IntegrationsTableHead>
      <tbody>
        {orgs.map((org) => {
          const loginHref = org.loginUrl ?? org.instanceUrl;
          return (
            <IntegrationsTr key={org.id}>
              <IntegrationsTd>
                <span className="font-medium">{org.alias}</span>
              </IntegrationsTd>
              <IntegrationsTd>
                <span className="text-xs text-muted-foreground truncate max-w-[140px] block">{org.username}</span>
              </IntegrationsTd>
              <IntegrationsTd>
                <span className="text-xs">{org.devHubAlias ?? '—'}</span>
              </IntegrationsTd>
              <IntegrationsTd>
                <span className="text-xs text-muted-foreground">{formatDate(org.createdAt)}</span>
              </IntegrationsTd>
              <IntegrationsTd>
                <span className="text-xs text-muted-foreground">{formatDate(org.expirationDate)}</span>
              </IntegrationsTd>
              <IntegrationsTd>
                <StatusBadge status={org.status} />
              </IntegrationsTd>
              <IntegrationsTd>
                <div className="flex items-center justify-end gap-1 flex-wrap">
                  {loginHref && (
                    <a href={loginHref} target="_blank" rel="noreferrer" title="Login to scratch org">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary">
                        <ExternalLink className="w-3 h-3" />
                        Login
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!!deletingAlias}
                    onClick={() => onOpenCredentials(org.alias)}
                  >
                    <KeyRound className="w-3 h-3 mr-1" />
                    Creds
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    loading={deletingAlias === org.alias}
                    disabled={!!deletingAlias}
                    onClick={() => onDelete(org.alias)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </IntegrationsTd>
            </IntegrationsTr>
          );
        })}
      </tbody>
    </IntegrationsDataTable>
  );
}
