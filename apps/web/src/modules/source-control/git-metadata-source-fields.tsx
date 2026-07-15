'use client';

import Link from 'next/link';
import { Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { InlineAlert } from '@/components/studio';
import { SCM_PROVIDER_LABELS } from './provider-config';
import type { GitMetadataSourceHook } from './use-git-metadata-source';

export function GitMetadataSourceFields({
  source,
  disabled,
  compact = false,
}: {
  source: GitMetadataSourceHook;
  disabled?: boolean;
  compact?: boolean;
}) {
  if (source.loading) {
    return <div className="h-36 rounded-lg bg-muted/30 animate-pulse" aria-label="Loading metadata source" />;
  }

  if (!source.connected) {
    return (
      <InlineAlert variant="warning" title="No source-control provider connected">
        <Link href="/environment-center?tab=source-control" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">
          <Link2 className="w-3.5 h-3.5" />
          Open Environment Center
        </Link>
      </InlineAlert>
    );
  }

  const providerConnections = source.connections.filter(
    (connection) => connection.provider === source.source.provider,
  );

  return (
    <div className="space-y-4">
      {source.error && (
        <InlineAlert variant="error" onDismiss={() => source.setError(null)}>
          {source.error}
        </InlineAlert>
      )}
      <div className={compact ? 'grid sm:grid-cols-2 gap-3' : 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
        <div>
          <Label htmlFor="git-source-provider">Provider</Label>
          <Select
            id="git-source-provider"
            value={source.source.provider}
            onChange={(event) => source.selectProvider(event.target.value as keyof typeof SCM_PROVIDER_LABELS)}
            disabled={disabled}
          >
            {source.connectedProviders.map((provider) => (
              <option key={provider} value={provider}>{SCM_PROVIDER_LABELS[provider]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="git-source-connection">Account / connection</Label>
          <Select
            id="git-source-connection"
            value={source.source.connectionId}
            onChange={(event) => source.selectConnection(event.target.value)}
            disabled={disabled}
          >
            {providerConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.displayName}{connection.namespace ? ` · ${connection.namespace}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="git-source-namespace">Workspace / namespace</Label>
          <Input
            id="git-source-namespace"
            value={source.source.namespace}
            onChange={(event) => source.setSource((current) => ({ ...current, namespace: event.target.value }))}
            disabled={disabled}
            placeholder="Organization or workspace"
          />
        </div>
        <div>
          <Label htmlFor="git-source-project">Project (when required)</Label>
          <Input
            id="git-source-project"
            value={source.source.project}
            onChange={(event) => source.setSource((current) => ({ ...current, project: event.target.value }))}
            disabled={disabled}
            placeholder={source.source.provider === 'azure_devops' ? 'Azure project' : 'Optional app context'}
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="git-source-repository">Repository</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5"
              onClick={source.reloadRepositories}
              disabled={disabled || source.loadingRepositories}
              aria-label="Reload repositories"
            >
              <RefreshCw className={source.loadingRepositories ? 'w-3 h-3 animate-spin' : 'w-3 h-3'} />
            </Button>
          </div>
          <Select
            id="git-source-repository"
            value={source.source.repositoryId}
            onChange={(event) => source.selectRepository(event.target.value)}
            disabled={disabled || source.loadingRepositories}
          >
            <option value="">{source.loadingRepositories ? 'Loading repositories…' : 'Select repository…'}</option>
            {source.repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>{repository.fullName}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="git-source-branch">Branch</Label>
          <Select
            id="git-source-branch"
            value={source.source.branch}
            onChange={(event) => source.setSource((current) => ({ ...current, branch: event.target.value }))}
            disabled={disabled || source.loadingBranches || !source.source.repo}
          >
            <option value="">{source.loadingBranches ? 'Loading branches…' : 'Select branch…'}</option>
            {source.branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </Select>
        </div>
        <div className={compact ? 'sm:col-span-2' : 'sm:col-span-2 lg:col-span-3'}>
          <Label htmlFor="git-source-manifest">Manifest path</Label>
          <Input
            id="git-source-manifest"
            value={source.source.manifestPath}
            onChange={(event) => source.setSource((current) => ({ ...current, manifestPath: event.target.value }))}
            disabled={disabled}
            placeholder="manifest/package.xml"
          />
          <p className="text-xs text-muted-foreground mt-1">Path to package.xml in the selected branch.</p>
        </div>
      </div>
    </div>
  );
}
