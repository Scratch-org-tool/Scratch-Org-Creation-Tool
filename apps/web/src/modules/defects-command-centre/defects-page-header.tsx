'use client';

import { Bug, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { DeploymentPageHeader } from '@/components/studio';
import { cn } from '@/utils/cn';
import type { DefectsWorkspaceState } from './use-defects-workspace';

interface DefectsPageHeaderProps {
  w: DefectsWorkspaceState;
}

export function DefectsPageHeader({ w }: DefectsPageHeaderProps) {
  const connected = w.projectsMeta?.connected ?? w.overview?.connected ?? false;
  const orgSlug = w.projectsMeta?.orgSlug ?? w.overview?.orgSlug;
  const project = w.selectedProject || w.overview?.project;
  const projects = w.projectsMeta?.projects ?? [];

  return (
    <DeploymentPageHeader
      title="AI Defects Command Centre"
      subtitle={
        w.overview?.isAdminView
          ? 'All Azure defects and user stories in the selected project (admin view)'
          : 'Your assigned Azure defects and user stories in one place'
      }
      icon={Bug}
      accentClass="to-rose-500/10"
      actions={
        <>
          {connected && projects.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Azure project
              </span>
              <Select
                value={w.selectedProject}
                onChange={(e) => w.setSelectedProject(e.target.value)}
                className="h-9 text-sm w-[min(200px,42vw)]"
                disabled={w.projectsLoading}
                aria-label="Azure project"
              >
                <option value="" disabled>
                  Select project…
                </option>
                {projects.map((p: { id: string; name: string }) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {connected && orgSlug && project && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://dev.azure.com/${encodeURIComponent(orgSlug)}/${encodeURIComponent(project)}/_boards/board/t`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Azure Boards
              </a>
            </Button>
          )}
          {!connected && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/environment-center?tab=azure">Connect Azure</Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void w.refreshAll({ manual: true });
            }}
            loading={w.refreshing}
            disabled={w.needsProjectSelection || w.refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', w.refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </>
      }
    />
  );
}
