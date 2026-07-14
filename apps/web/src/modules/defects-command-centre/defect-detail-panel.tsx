'use client';

import { useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmBanner, GlassCard, StatusBadge } from '@/components/studio';
import { stripHtmlForDisplay } from '@sfcc/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { DefectCommentsThread } from './defect-comments-thread';
import { DefectHistoryTimeline } from './defect-history-timeline';
import { DefectAttachmentsPanel } from './defect-attachments-panel';
import {
  workItemStatusBadgeClass,
  workItemStatusItemClass,
  workItemStatusSelectClass,
} from './work-item-status-styles';
import type { DefectsWorkspaceState } from './use-defects-workspace';

interface DefectDetailPanelProps {
  w: DefectsWorkspaceState;
}

function HtmlField({ label, html }: { label: string; html: string | null }) {
  if (!html?.trim()) return null;
  const text = stripHtmlForDisplay(html);
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

export function DefectDetailPanel({ w }: DefectDetailPanelProps) {
  const [pendingState, setPendingState] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  if (!w.selectedId) {
    return (
      <GlassCard title="Work Item Detail" description="Select a row to view details">
        <p className="text-sm text-muted-foreground py-12 text-center">
          Choose a defect or user story from the table to see description, comments, and status controls.
        </p>
      </GlassCard>
    );
  }

  if (w.detailLoading && !w.detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const item = w.detail;
  if (!item) {
    return (
      <GlassCard title="Work Item Detail">
        <p className="text-sm text-muted-foreground py-8 text-center">Could not load work item #{w.selectedId}.</p>
      </GlassCard>
    );
  }

  const handleConfirmState = async () => {
    if (!pendingState) return;
    setStateError(null);
    try {
      await w.updateStatus(pendingState);
      setPendingState(null);
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const displayState = pendingState ?? item.state;

  const statusControls = (
    <div className="inline-flex flex-col gap-2 w-fit shrink-0 max-w-full">
      <Button variant="outline" size="sm" asChild className="w-full">
        <a href={item.webUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in Azure
        </a>
      </Button>
      <div className="space-y-1.5 w-full">
        <p className="text-xs font-medium text-muted-foreground">Update status</p>
        <UiSelect
          value={displayState}
          onValueChange={(next) => {
            setStateError(null);
            setPendingState(next === item.state ? null : next);
          }}
          disabled={w.statusUpdating}
        >
          <SelectTrigger
            className={cn(
              'h-9 text-sm w-full min-w-0 shadow-sm transition-colors',
              workItemStatusSelectClass(displayState),
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {w.states.map((s) => (
              <SelectItem
                key={s.name}
                value={s.name}
                className={workItemStatusItemClass(s.name)}
              >
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </UiSelect>
      </div>
      {pendingState && pendingState !== item.state && (
        <div className="w-full">
          <ConfirmBanner
            title="Confirm status change"
            message={`Change work item #${item.id} from "${item.state}" to "${pendingState}"?`}
            confirmLabel="Update status"
            loading={w.statusUpdating}
            onConfirm={() => void handleConfirmState()}
            onCancel={() => {
              setPendingState(null);
              setStateError(null);
            }}
          />
        </div>
      )}
      {stateError && <p className="text-xs text-destructive">{stateError}</p>}
    </div>
  );

  return (
    <div className="space-y-4 lg:sticky lg:top-4">
      <GlassCard
        headerAction={statusControls}
        contentClassName="pt-2"
        title={
          <div className="min-w-0 space-y-1.5 pr-2">
            <p className="text-xs font-medium text-muted-foreground">
              #{item.id} — {item.type}
              {item.project ? (
                <span className="text-muted-foreground/80"> · {item.project}</span>
              ) : null}
            </p>
            <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={item.state} className={workItemStatusBadgeClass(item.state)} />
              {item.severity && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                  {item.severity}
                </span>
              )}
              {item.priority != null && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                  P{item.priority}
                </span>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Assigned to</dt>
              <dd className="truncate">{item.assignedTo ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Area</dt>
              <dd className="truncate">{item.areaPath ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Iteration</dt>
              <dd className="truncate">{item.iterationPath ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last changed</dt>
              <dd>{item.changedDate ? new Date(item.changedDate).toLocaleString() : '—'}</dd>
            </div>
          </dl>

          <DefectHistoryTimeline events={w.history} loading={w.detailLoading} />

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border/40">
            <HtmlField label="Description" html={item.description} />
            <HtmlField label="Repro steps" html={item.reproSteps} />
            <HtmlField label="Acceptance criteria" html={item.acceptanceCriteria} />
          </div>

          <DefectAttachmentsPanel
            workItemId={item.id}
            attachments={w.attachments}
            loading={w.detailLoading}
            projectQuery={w.selectedProject ? `project=${encodeURIComponent(w.selectedProject)}` : ''}
          />

          <div className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void w.investigate()}
              loading={w.investigating}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Investigate with AI
            </Button>
            {w.investigation && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-medium text-primary">AI Investigation</p>
                <p className="text-sm whitespace-pre-wrap">{w.investigation.content}</p>
                {w.investigation.reasoning && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Reasoning</summary>
                    <p className="mt-2 whitespace-pre-wrap">{w.investigation.reasoning}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      <DefectCommentsThread comments={w.comments} loading={w.detailLoading} />
    </div>
  );
}
