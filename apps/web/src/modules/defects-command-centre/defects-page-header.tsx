'use client';

import { useState } from 'react';
import { Bug, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { DeploymentPageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { DefectsWorkspaceState } from './use-defects-workspace';
import {
  projectValue,
  providerLabel,
  providerProjectUrl,
  WORK_ITEM_PROVIDERS,
} from './work-item-contracts';
import { WorkItemEditorDialog } from './work-item-editor-dialog';

export function DefectsPageHeader({ w }: { w: DefectsWorkspaceState }) {
  const [createOpen, setCreateOpen] = useState(false);
  const project = w.projectsMeta?.projects.find(
    (candidate) => projectValue(w.provider, candidate) === w.selectedProject,
  ) ?? null;
  const externalUrl = providerProjectUrl(
    w.provider,
    project,
    w.selectedConnection?.baseUrl,
  );

  return (
    <>
      <DeploymentPageHeader
        title="AI Defects Command Centre"
        subtitle={
          w.overview?.isAdminView
            ? `All ${providerLabel(w.provider)} work items in the selected project (admin view)`
            : `Your assigned ${providerLabel(w.provider)} work items in one place`
        }
        icon={Bug}
        accentClass="to-rose-500/10"
        actions={
          <>
            <Select
              value={w.provider}
              onChange={(event) => w.setProvider(event.target.value as typeof w.provider)}
              className="h-9 text-sm w-[160px]"
              aria-label="Work-item provider"
              disabled={w.contextsLoading}
            >
              {WORK_ITEM_PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Select
              value={w.connectionId}
              onChange={(event) => w.setConnectionId(event.target.value)}
              className="h-9 text-sm w-[min(190px,45vw)]"
              aria-label={`${providerLabel(w.provider)} connection`}
              disabled={w.contextsLoading || w.connectionOptions.length === 0}
            >
              <option value="">Default connection</option>
              {w.connectionOptions.filter((connection) => connection.id).map((connection) => (
                <option key={connection.id!} value={connection.id!}>
                  {connection.displayName} · {connection.status}
                </option>
              ))}
            </Select>
            <Select
              value={w.bindingId}
              onChange={(event) => w.setBindingId(event.target.value)}
              className="h-9 text-sm w-[min(190px,45vw)]"
              aria-label="Project binding"
              disabled={w.contextsLoading || w.bindingOptions.length === 0}
            >
              <option value="">No ProjectBinding</option>
              {w.bindingOptions.map((binding) => (
                <option key={binding.id} value={binding.id}>
                  {binding.projectKey || binding.repositoryName || binding.externalProjectId}
                </option>
              ))}
            </Select>
            <Select
              value={w.selectedProject}
              onChange={(event) => w.setSelectedProject(event.target.value)}
              className="h-9 text-sm w-[min(190px,45vw)]"
              aria-label={`${providerLabel(w.provider)} project`}
              disabled={w.projectsLoading || !w.projectsMeta?.connected}
            >
              <option value="">Select project…</option>
              {(w.projectsMeta?.projects ?? []).map((option) => (
                <option key={option.id} value={projectValue(w.provider, option)}>{option.name}</option>
              ))}
            </Select>
            {externalUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open project
                </a>
              </Button>
            )}
            {w.capabilities.write && w.selectedProject && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void w.refreshAll({ manual: true })}
              loading={w.refreshing}
              disabled={!w.selectedProject || Boolean(w.setupError) || w.refreshing}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', w.refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </>
        }
      />
      <WorkItemEditorDialog
        open={createOpen}
        mode="create"
        w={w}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
