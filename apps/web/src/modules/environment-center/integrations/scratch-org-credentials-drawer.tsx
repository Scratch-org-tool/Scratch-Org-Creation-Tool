'use client';

import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard, PageSkeleton } from '@/components/studio';
import type { ScratchOrgCredentials } from './types';

function CredentialRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-mono break-all">{value || '—'}</p>
      </div>
      {value && (
        <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onCopy} title={`Copy ${label}`}>
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      )}
    </div>
  );
}

interface ScratchOrgCredentialsDrawerProps {
  alias: string | null;
  credentials: ScratchOrgCredentials | null;
  loading: boolean;
  regenerating: boolean;
  copiedField: string | null;
  onClose: () => void;
  onCopy: (field: string, text: string) => void;
  onRegenerate: () => void;
  onCopyAll: () => void;
}

export function ScratchOrgCredentialsDrawer({
  alias,
  credentials,
  loading,
  regenerating,
  copiedField,
  onClose,
  onCopy,
  onRegenerate,
  onCopyAll,
}: ScratchOrgCredentialsDrawerProps) {
  if (!alias) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] sm:m-4 sm:rounded-xl overflow-hidden flex flex-col bg-card border border-border shadow-xl">
        <GlassCard
          title="Scratch Org Credentials"
          description={alias}
          className="h-full flex flex-col border-0 rounded-none sm:rounded-xl shadow-none"
          contentClassName="overflow-y-auto scrollbar-thin flex-1"
          headerAction={
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          }
        >
          {loading && <PageSkeleton variant="form" />}
          {!loading && credentials && (
            <div className="space-y-1">
              <CredentialRow
                label="Alias"
                value={credentials.alias}
                onCopy={() => onCopy('alias', credentials.alias)}
                copied={copiedField === 'alias'}
              />
              <CredentialRow
                label="Username"
                value={credentials.username}
                onCopy={() => onCopy('username', credentials.username)}
                copied={copiedField === 'username'}
              />
              <div className="flex items-start justify-between gap-3 py-2 border-b border-border/50">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Password</p>
                  <p className="text-sm font-mono break-all">
                    {credentials.password ?? 'Unavailable — click Regenerate'}
                  </p>
                </div>
                {credentials.password && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => onCopy('password', credentials.password!)}
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
              {!credentials.password && (
                <Button variant="outline" size="sm" className="mt-2" onClick={onRegenerate} loading={regenerating}>
                  Regenerate Password
                </Button>
              )}
              <CredentialRow
                label="Org Id"
                value={credentials.orgId ?? ''}
                onCopy={() => onCopy('orgId', credentials.orgId ?? '')}
                copied={copiedField === 'orgId'}
              />
              <CredentialRow
                label="Instance URL"
                value={credentials.instanceUrl ?? ''}
                onCopy={() => onCopy('instanceUrl', credentials.instanceUrl ?? '')}
                copied={copiedField === 'instanceUrl'}
              />
              <CredentialRow
                label="Login URL"
                value={credentials.loginUrl ?? ''}
                onCopy={() => onCopy('loginUrl', credentials.loginUrl ?? '')}
                copied={copiedField === 'loginUrl'}
              />
              <CredentialRow
                label="Expiration"
                value={credentials.expirationDate ? new Date(credentials.expirationDate).toLocaleString() : ''}
                onCopy={() => onCopy('expiration', credentials.expirationDate ?? '')}
                copied={copiedField === 'expiration'}
              />
              <CredentialRow
                label="Dev Hub"
                value={credentials.devHubAlias ?? ''}
                onCopy={() => onCopy('devHub', credentials.devHubAlias ?? '')}
                copied={copiedField === 'devHub'}
              />
            </div>
          )}
          {credentials && !loading && (
            <div className="flex gap-2 pt-4 mt-4 border-t border-border">
              <Button onClick={onCopyAll} className="flex-1" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                {copiedField === 'all' ? 'Copied!' : 'Copy All'}
              </Button>
              {credentials.loginUrl && (
                <a href={credentials.loginUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                </a>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
